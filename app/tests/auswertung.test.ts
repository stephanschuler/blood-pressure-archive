import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filtern, gliedern, kalenderwoche, mittel, parseAuswahl, siebenTage, tageshaelfte, tagSuchen, type Tag, type Woche } from '../src/auswertung';
import type { Messung } from '../src/messung';

let id = 0;
/** Messung zu einem Zeitpunkt in Ortszeit; die Messpunkte selbst spielen hier keine Rolle. */
const m = (zeit: Date, sys: number, dia = 80, puls = 60): Messung =>
  ({ punkte: [{ id: ++id, zeit: zeit.toISOString(), sys, dia, puls }], sys, dia, puls });
const am = (monat: number, tag: number, stunde = 8, minute = 0) => new Date(2026, monat - 1, tag, stunde, minute);

test('Vormittag bis 11:59, ab 12:00 Nachmittag', () => {
  assert.equal(tageshaelfte(m(am(10, 4, 11, 59), 120)), 'vormittag');
  assert.equal(tageshaelfte(m(am(10, 4, 12, 0), 120)), 'nachmittag');
  const ms = [m(am(10, 4, 7), 120), m(am(10, 4, 20), 130)];
  assert.deepEqual(filtern(ms, 'nachmittag').map((x) => x.sys), [130]);
  assert.equal(filtern(ms, 'beide'), ms);
});

test('gespeicherte Auswahl: Unbekanntes gilt als beide', () => {
  assert.equal(parseAuswahl('vormittag'), 'vormittag');
  assert.equal(parseAuswahl(null), 'beide');
  assert.equal(parseAuswahl('abends'), 'beide');
});

test('Mittel: jede Messung zählt gleich, gerundet', () => {
  assert.deepEqual(mittel([m(am(10, 4), 120, 80, 60), m(am(10, 4, 20), 141, 85, 63)]), { sys: 131, dia: 83, puls: 62 });
  assert.equal(mittel([]), null);
});

test('Ø 7 Tage: heute und sechs Tage davor, Vorwoche die sieben Tage davor', () => {
  const heute = am(10, 4, 9);
  const ms = [
    m(am(10, 4, 23, 59), 150), // später am selben Tag zählt mit
    m(am(9, 28, 0, 0), 130),
    m(am(9, 27, 23, 59), 110),
    m(am(9, 21, 0, 0), 100),
    m(am(9, 20, 23, 59), 90),
  ];
  const s = siebenTage(ms, heute);
  assert.deepEqual(s.messungen.map((x) => x.sys), [150, 130]);
  assert.equal(s.mittel!.sys, 140);
  assert.equal(s.vorwoche!.sys, 105);
  assert.equal(siebenTage([], heute).mittel, null);
});

test('Kalenderwoche nach ISO 8601', () => {
  assert.equal(kalenderwoche(am(10, 4)), 40); // Sonntag
  assert.equal(kalenderwoche(am(9, 28)), 40); // Montag
  assert.equal(kalenderwoche(new Date(2025, 11, 29)), 1); // gehört zur ersten Woche 2026
  assert.equal(kalenderwoche(new Date(2027, 0, 1)), 53);
});

test('Gliederung: Monate, Wochenzeile nur einmal je Woche, Tage mit ihren Messungen', () => {
  const ms = [m(am(10, 1, 20), 140), m(am(10, 1, 7), 130), m(am(9, 30, 7), 120), m(am(9, 27, 7), 100)];
  const g = gliedern(ms);
  const art = (z: Woche | Tag) => (z.art === 'woche' ? `KW${z.kw}` : `${z.tag.getDate()}.:${z.messungen.length}`);
  assert.deepEqual(g.map((a) => [a.monat.getMonth() + 1, a.data.map(art)]), [
    [10, ['KW40', '1.:2']],
    [9, ['30.:1', 'KW39', '27.:1']],
  ]);
  const kw40 = g[0].data[0] as Woche;
  assert.deepEqual([kw40.anzahl, kw40.mittel.sys, kw40.vorwoche!.sys], [3, 130, 100]);
  assert.equal((g[1].data[1] as Woche).vorwoche, null);
});

test('Tag suchen: der Tag selbst, sonst der nächstältere, außerhalb der jüngste bzw. älteste', () => {
  const g = gliedern([m(am(10, 1, 20), 140), m(am(9, 30, 7), 120), m(am(9, 27, 7), 100)]);
  const wo = (d: Date) => {
    const z = tagSuchen(g, d)!;
    return [z.sectionIndex, z.itemIndex, z.tag.tag.getDate()];
  };
  assert.deepEqual(wo(am(10, 1, 23)), [0, 1, 1]);
  assert.deepEqual(wo(am(10, 4)), [0, 1, 1]);
  assert.deepEqual(wo(am(9, 29)), [1, 2, 27]);
  assert.deepEqual(wo(am(9, 30)), [1, 0, 30]);
  assert.deepEqual(wo(am(1, 1)), [1, 2, 27]);
  assert.equal(tagSuchen([], am(10, 1)), undefined);
});

test('Pfeil der Messung: Bezug ist die vorige Messung derselben Tageshälfte', () => {
  const g = gliedern([m(am(10, 4, 18), 133), m(am(10, 4, 8), 130), m(am(10, 4, 7), 125), m(am(10, 1, 18), 127), m(am(9, 30, 8), 132)]);
  const tage = g.flatMap((a) => a.data.filter((z): z is Tag => z.art === 'tag'));
  assert.deepEqual(tage.map((t) => t.vorige.map((v) => v?.sys ?? null)), [[127, 125, 132], [null], [null]]);
});
