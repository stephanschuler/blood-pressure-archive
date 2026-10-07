import assert from 'node:assert/strict';
import { test } from 'node:test';

import { exportiert, parseFormat, parseZiel, zuletzt } from '../src/export';

test('gespeicherte Exportwahl: Unbekanntes gilt als XLSX in einen Ordner', () => {
  assert.equal(parseFormat('pdf'), 'pdf');
  assert.equal(parseFormat(null), 'xlsx');
  assert.equal(parseZiel('teilen'), 'teilen');
  assert.equal(parseZiel('drive'), 'ordner');
});

test('Hinweis zum letzten Export', () => {
  assert.equal(zuletzt(null), 'Noch nie exportiert');
  assert.equal(zuletzt(exportiert('xlsx', 'teilen', new Date(2026, 9, 3, 12))), 'Zuletzt am 3.10.2026: XLSX · geteilt');
  assert.equal(zuletzt(exportiert('csv', 'ordner', new Date(2026, 9, 3, 12))), 'Zuletzt am 3.10.2026: CSV · in Ordner');
});
