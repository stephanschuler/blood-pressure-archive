import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gliedern } from '../src/auswertung';
import type { Messung } from '../src/messung';
import { lagen, MASSE, parseRaster } from '../src/raster';

let id = 0;
const m = (zeit: Date, punkte = 1): Messung =>
  ({ punkte: Array.from({ length: punkte }, () => ({ id: ++id, zeit: zeit.toISOString(), sys: 120, dia: 80, puls: 60 })), sys: 120, dia: 80, puls: 60 });
const am = (tag: number, stunde = 8) => new Date(2026, 9, tag, stunde);

// neueste zuerst: KW 41 mit Mi 7. (zwei Messungen) und Di 6. (eine mit drei Punkten), KW 40 mit So 4.
const offen = m(am(6), 3);
const abschnitte = gliedern([m(am(7, 20)), m(am(7)), offen, m(am(4))], am(12));

test('Raster 52: jedes Element ein Vielfaches, der Monatsfuß zählt mit 0', () => {
  assert.deepEqual(lagen(abschnitte, MASSE[52], new Set(), 1).laenge, [52, 52, 104, 52, 52, 52, 0]);
  const { laenge, versatz } = lagen(abschnitte, MASSE[52], new Set([offen.punkte[0].id]), 1);
  assert.equal(laenge[3], 52 + 3 * 26 + 26);
  assert.equal(versatz[3], 52 + 52 + 104);
});

test('große Systemschrift: das Kalenderblatt wird höher als die Messung', () => {
  assert.equal(lagen(abschnitte, MASSE[52], new Set(), 2).laenge[5], 4 + 44 * 2 + 1);
});

test('gespeichertes Raster: Unbekanntes gilt als 52', () => {
  assert.equal(parseRaster('48'), '48');
  assert.equal(parseRaster(null), '52');
  assert.equal(parseRaster('heute'), '52');
});
