import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bericht } from '../src/bericht';

const FARBEN = { vormittag: '#aaaaaa', nachmittag: '#444444' };
const tag = (d: number, h: number, min = 0) => new Date(2026, 9, d, h, min).toISOString();

test('Bericht: je Monat eine Seite mit jedem Kalendertag, SYS, DIA und Puls je Tageshälfte in eigenen Spalten', () => {
  const html = bericht([
    { id: 6, zeit: new Date(2026, 10, 2, 8).toISOString(), sys: 135, dia: 85, puls: 70 },
    { id: 4, zeit: tag(5, 20), sys: 130, dia: 80, puls: 60 },
    { id: 1, zeit: tag(4, 7), sys: 120, dia: 80, puls: 60 },
    { id: 5, zeit: tag(4, 7, 5), sys: 124, dia: 84, puls: 64 }, // eine Messung mit id 1
    { id: 3, zeit: tag(4, 12), sys: 148, dia: 74, puls: 82 },
  ], FARBEN);
  const [oktober, november] = html.split('<section>').slice(1);
  assert.match(oktober, /<h1>Oktober 2026<\/h1>/);
  assert.match(november, /<h1>November 2026<\/h1>/);
  assert.match(oktober, /vormittags <b>122\/82<\/b>, Puls 62/);
  assert.equal(oktober.match(/<tr><td>/g)?.length, 31);
  assert.equal(november.match(/<tr><td>/g)?.length, 30);
  assert.match(oktober, /<tr><td>Sa 03\.10\.<\/td><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><td><\/td><\/tr>/);
  assert.match(oktober, /<tr><td>So 04\.10\.<\/td><td>122<\/td><td>82<\/td><td>62<\/td><td>148<\/td><td>74<\/td><td>82<\/td><\/tr>/);
  assert.match(oktober, /<tr><td>Mo 05\.10\.<\/td><td><\/td><td><\/td><td><\/td><td>130<\/td><td>80<\/td><td>60<\/td><\/tr>/);
  assert.equal(oktober.match(/<polyline /g)?.length, 4);
});

test('Bericht ohne Messungen: kein Diagramm', () => {
  const html = bericht([], FARBEN);
  assert.match(html, /Keine Messungen\./);
  assert.doesNotMatch(html, /<svg/);
});
