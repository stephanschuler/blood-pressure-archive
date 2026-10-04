import assert from 'node:assert/strict';
import { test } from 'node:test';

import { csv } from '../src/tabelle';

test('CSV: Kopfzeile, älteste zuerst, Zeit in Ortszeit', () => {
  const zeit = (h: number) => new Date(2026, 9, 4, h, 59).toISOString();
  const punkte = [
    { id: 2, zeit: zeit(21), sys: 148, dia: 74, puls: 82 },
    { id: 1, zeit: zeit(7), sys: 123, dia: 84, puls: 67 },
  ];
  assert.equal(csv(punkte), 'Zeit,SYS,DIA,Puls\n2026-10-04 07:59,123,84,67\n2026-10-04 21:59,148,74,82\n');
});
