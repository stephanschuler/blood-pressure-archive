import assert from 'node:assert/strict';
import { test } from 'node:test';

import { exifTime } from '../src/exif';
import { gruppieren, type Messpunkt } from '../src/messung';

const p = (id: number, zeit: string, sys: number, dia: number, puls: number): Messpunkt => ({ id, zeit, sys, dia, puls });

test('Messpunkte mit weniger als 20 Minuten Abstand bilden eine Messung mit Mittelwert', () => {
  const m = gruppieren([
    p(1, '2026-01-01T07:00:00Z', 130, 85, 60),
    p(2, '2026-01-01T07:03:00Z', 125, 82, 63),
    p(3, '2026-01-01T07:40:00Z', 140, 90, 70),
  ]);
  assert.equal(m.length, 2);
  assert.deepEqual([m[0].sys, m[0].punkte.length], [140, 1]); // neueste zuerst
  assert.deepEqual([m[1].sys, m[1].dia, m[1].puls], [128, 84, 62]);
});

test('EXIF-Zeit mit und ohne Versatz', () => {
  assert.equal(exifTime({ DateTimeOriginal: '2025:08:05 08:02:40', OffsetTimeOriginal: '+02:00' })!.toISOString(), '2025-08-05T06:02:40.000Z');
  const local = exifTime({ DateTimeOriginal: '2025:08:05 08:02:40' })!;
  assert.deepEqual([local.getHours(), local.getMinutes()], [8, 2]);
  assert.equal(exifTime({}), null);
  assert.equal(exifTime(null), null);
});
