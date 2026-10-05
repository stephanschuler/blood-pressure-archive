// Künstliche Bilder für die Erkennung: echte Fotos gehören nicht ins Repo.
import type { Rgb } from '../src/erkennung/image';
import { DIA, PUL, SYS, segmentLines, type Cell } from '../src/erkennung/segments';

const SEGMENTS: Record<number, string> = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

/**
 * Künstliches entzerrtes Display: aktive Segmente dunkel, alle übrigen als helle Geistersegmente.
 * Geister müssen unter der festen Untergrenze (12 % Kontrast) bleiben, sonst liest eine leere
 * Hunderterstelle als 1 — auf echten Fotos ist das im hellsten Farbkanal der Fall.
 */
export function display(values: [number, number, number], ghost = 175, dark = 40): Rgb {
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

type Werte = [number, number, number];

/**
 * Messgerät auf dem Tisch: weißes Gehäuse, Display als Glas, rechts daneben die grüne START/STOP-Taste.
 * Lage von Glas und Taste in Tastenhöhen wie REGION und GLASS in display.ts erwarten.
 */
type Geraet = { werte: Werte; links: number; oben: number; taste?: boolean };

const TASTE = 160; // Tastenhöhe in Pixeln
// Aus REGION und GLASS: Glas 2,27 − 0,50 breit und 2,52 − 0,29 hoch, Taste 0,33 rechts und 0,61 unter der Glasoberkante
const GLAS_B = 1.77 * TASTE, GLAS_H = 2.23 * TASTE;
const RAND = 5; // Pixel im entzerrten Display

/** Szene w×h, um winkel Grad um die Mitte gedreht; links/oben ist die linke obere Glasecke. */
export function szene(w: number, h: number, geraete: Geraet[], winkel = 0): Rgb {
  const glaeser = geraete.map((g) => ({ ...g, bild: display(g.werte) }));
  const a = (winkel * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = cos * (x - w / 2) + sin * (y - h / 2) + w / 2, v = -sin * (x - w / 2) + cos * (y - h / 2) + h / 2;
    data.set(farbe(glaeser, u, v), (y * w + x) * 3);
  }
  return { w, h, data };
}

function farbe(glaeser: (Geraet & { bild: Rgb })[], u: number, v: number): ArrayLike<number> {
  for (const g of glaeser) {
    const x = u - g.links, y = v - g.oben;
    if (x >= 0 && x < GLAS_B && y >= 0 && y < GLAS_H) {
      const px = Math.floor((x / GLAS_B) * g.bild.w), py = Math.floor((y / GLAS_H) * g.bild.h);
      // Dunkler Glasrand: ohne ihn ist die Ziffernkante rechts stärker als die Glaskante, die display.ts sucht
      if (px < RAND || px >= g.bild.w - RAND || py < RAND || py >= g.bild.h - RAND) return [60, 60, 60];
      const i = (py * g.bild.w + px) * 3;
      return g.bild.data.subarray(i, i + 3);
    }
    const tasteX = x - GLAS_B - 0.33 * TASTE, tasteY = y - 0.61 * TASTE;
    if (g.taste !== false && tasteX >= 0 && tasteX < TASTE / 1.6 && tasteY >= 0 && tasteY < TASTE) return [40, 170, 70];
    if (x >= -0.8 * TASTE && x < GLAS_B + 1.4 * TASTE && y >= -0.8 * TASTE && y < GLAS_H + 0.8 * TASTE) return [245, 245, 245];
  }
  return [100, 100, 100];
}
