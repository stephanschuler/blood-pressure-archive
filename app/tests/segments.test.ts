import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decode, measures, plausible } from '../src/erkennung/segments';
import { display } from './szene';

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
