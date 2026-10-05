import assert from 'node:assert/strict';
import { test } from 'node:test';

import { viaButton, viaEdges } from '../src/erkennung/display';
import { readValues } from '../src/erkennung/messwerte';
import { decode, measures } from '../src/erkennung/segments';
import { szene } from './szene';

const NICHTS = { values: [null, null, null], uncertain: [false, false, false] };
const lesen = (d: ReturnType<typeof viaEdges>) => (d ? decode(measures(d)) : null);

test('Taste und Ränder lesen dasselbe: Werte ohne Unsicherheit', () => {
  const s = szene(900, 1200, [{ werte: [99, 60, 48], links: 250, oben: 350 }], 1);
  assert.deepEqual(lesen(viaButton(s)), [99, 60, 48]);
  assert.deepEqual(lesen(viaEdges(s)), [99, 60, 48]);
  assert.deepEqual(readValues(s), { values: [99, 60, 48], uncertain: [false, false, false] });
});

test('ohne Taste genügt der Weg über die Ränder, auch gedreht', () => {
  const s = szene(900, 1200, [{ werte: [173, 109, 68], links: 250, oben: 350, taste: false }], 4);
  assert.equal(viaButton(s), null);
  assert.deepEqual(readValues(s), { values: [173, 109, 68], uncertain: [false, false, false] });
});

test('widersprechen sich die Wege, gilt keiner', () => {
  // Taste am Gerät links; die Ränder wählen das Display mit den meisten Ziffern, rechts
  const s = szene(1500, 1000, [{ werte: [99, 60, 48], links: 150, oben: 300 }, { werte: [173, 109, 68], links: 900, oben: 300, taste: false }]);
  assert.deepEqual(lesen(viaButton(s)), [99, 60, 48]);
  assert.deepEqual(lesen(viaEdges(s)), [173, 109, 68]);
  assert.deepEqual(readValues(s), NICHTS);
});

test('ohne Gerät: nichts gelesen', () => {
  assert.deepEqual(readValues(szene(900, 1200, [])), NICHTS);
});
