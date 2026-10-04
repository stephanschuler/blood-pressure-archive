import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Rgb } from '../src/erkennung/image';
import { DIA, PUL, SYS, decode, measures, plausible, segmentLines, type Cell } from '../src/erkennung/segments';

const SEGMENTS: Record<number, string> = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

/**
 * Künstliches entzerrtes Display: aktive Segmente dunkel, alle übrigen als helle Geistersegmente.
 * Geister müssen unter der festen Untergrenze (12 % Kontrast) bleiben, sonst liest eine leere
 * Hunderterstelle als 1 — auf echten Fotos ist das im hellsten Farbkanal der Fall.
 */
function display(values: [number, number, number], ghost = 175, dark = 40): Rgb {
  const w = 330, h = 400, data = new Uint8Array(w * h * 3).fill(190);
  const line = (x1: number, y1: number, x2: number, y2: number, v: number) => {
    // Segment etwas kürzer als die Zellkante: Lücken wie auf dem echten Display
    const ax = x1 + 0.12 * (x2 - x1), ay = y1 + 0.12 * (y2 - y1), bx = x2 - 0.12 * (x2 - x1), by = y2 - 0.12 * (y2 - y1);
    for (let y = Math.floor(Math.min(ay, by)) - 6; y <= Math.max(ay, by) + 6; y++)
      for (let x = Math.floor(Math.min(ax, bx)) - 6; x <= Math.max(ax, bx) + 6; x++) {
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
        if (Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) <= 4) data.fill(v, (y * w + x) * 3, (y * w + x) * 3 + 3);
      }
  };
  [SYS, DIA, PUL].forEach((row: Cell[], r) => {
    const digits = String(values[r]).padStart(row.length, ' ');
    row.forEach((cell, i) => {
      const on = digits[i] === ' ' ? '' : SEGMENTS[+digits[i]];
      for (const [seg, l] of Object.entries(segmentLines(cell))) line(...l.from, ...l.to, on.includes(seg) ? dark : ghost);
    });
  });
  return { w, h, data };
}

test('liest künstliche Displays', () => {
  for (const v of [[128, 85, 64], [173, 109, 68], [99, 60, 48], [140, 90, 77]] as [number, number, number][]) {
    assert.deepEqual(decode(measures(display(v))), v);
  }
});

test('Mehrdeutigkeitsprüfung: Geistersegment nahe der Schwelle macht das Feld unsicher', () => {
  const m = measures(display([128, 85, 64]));
  // b der Puls-Zehnerstelle (6 ohne b) künstlich nahe an die Schwelle heben: 6 und 8 werden verwechselbar
  const top = Math.max(...Object.values(m[2][0]));
  m[2][0].b = 0.5 * top * 0.95;
  assert.deepEqual(decode(m, 0), [128, 85, 64]);
  assert.deepEqual(decode(m, 0.2), [128, 85, null]);
});

test('Plausibilität', () => {
  assert.equal(plausible([128, 85, 64]), true);
  assert.equal(plausible([145, 132, 54]), false); // SYS − DIA < 15
  assert.equal(plausible([128, null, 64]), false);
  assert.equal(plausible([300, 85, 64]), false);
});
