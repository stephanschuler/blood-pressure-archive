import assert from 'node:assert/strict';
import { test } from 'node:test';

import { strFromU8, unzipSync } from 'fflate';

import { csv, xlsx } from '../src/tabelle';

const zeit = (h: number) => new Date(2026, 9, 4, h, 59).toISOString();
const punkte = [
  { id: 2, zeit: zeit(21), sys: 148, dia: 74, puls: 82 },
  { id: 1, zeit: zeit(7), sys: 123, dia: 84, puls: 67 },
];

test('CSV: Kopfzeile, älteste zuerst, Zeit in Ortszeit', () => {
  assert.equal(csv(punkte), 'Zeit,SYS,DIA,Puls\n2026-10-04 07:59,123,84,67\n2026-10-04 21:59,148,74,82\n');
});

test('XLSX: Zeit als Tageszahl in Ortszeit mit Datumsformat, älteste zuerst', () => {
  const sheet = strFromU8(unzipSync(xlsx(punkte))['xl/worksheets/sheet1.xml']);
  const a2 = sheet.match(/<c r="A2" s="1"><v>([\d.]+)<\/v>/);
  assert.ok(a2);
  assert.ok(Math.abs(Number(a2[1]) - (46299 + (7 * 60 + 59) / 1440)) < 1e-9); // 2026-10-04 07:59
  assert.match(sheet, /<c r="B2"><v>123<\/v><\/c>.*<c r="B3"><v>148<\/v><\/c>/);
});
