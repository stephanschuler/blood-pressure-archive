// Höhen der Listenelemente der Startseite, damit die Liste ferne Tage ohne Schätzung anspringt.
import type { Abschnitt, Tag } from './auswertung';

/** In der Seitenleiste wählbar: Kopf, Wochenkarte und Messung so hoch, Messpunkt und Hinweis halb so hoch. */
export const RASTER = ['48', '52', '56'] as const;
export type Raster = (typeof RASTER)[number];
export const parseRaster = (v: string | null): Raster => (RASTER.includes(v as Raster) ? (v as Raster) : '52');

/** Abstände in dp, je oben und unten; Wochenkarte: außen, innen oben, innen unten. */
export type Masse = { kopf: [number, number]; woche: [number, number, number]; blatt: number; messung: [number, number]; punkt: number; hinweis: [number, number] };
export const MASSE: Record<Raster, Masse> = {
  48: { kopf: [15, 13], woche: [2, 3, 4], blatt: 2, messung: [4, 5], punkt: 3, hinweis: [3, 6] },
  52: { kopf: [17, 15], woche: [3, 4, 5], blatt: 4, messung: [6, 7], punkt: 4, hinweis: [4, 7] },
  56: { kopf: [20, 16], woche: [4, 5, 6], blatt: 4, messung: [8, 9], punkt: 5, hinweis: [5, 8] },
};

// Falle: startseite.tsx setzt genau diese Zeilenhöhen; wer dort eine ändert oder einen Text ohne sie einfügt, versetzt jeden Sprung
export const ZEILE = { kopf: 18, kwKopf: 12, kw: 20, zeitraum: 15, anzahl: 13, pfeil: 15, blattKopf: 12, tag: 20, monat: 12, punkt: 18, hinweis: 15 };
export const SYMBOL = 18;
// Zeilenhöhe der fetten Werte: Symbol und Uhrzeit stehen auf ihrer Höhe
export const wertzeile = (groesse: number) => Math.round(groesse * 4 / 3);

/** Länge und Versatz je Element, wie SectionList sie zählt: je Abschnitt Kopf, Zeilen, Fuß. `s`: Schriftfaktor des Systems. */
export function lagen(abschnitte: Abschnitt[], m: Masse, offen: Set<number>, s: number) {
  const kopf = m.kopf[0] + Math.max(ZEILE.kopf * s, SYMBOL) + m.kopf[1] + 2;
  const woche = 2 * m.woche[0] + m.woche[1] + m.woche[2]
    + Math.max((ZEILE.kwKopf + ZEILE.kw) * s + 5, (ZEILE.zeitraum + ZEILE.anzahl) * s, (wertzeile(16) + ZEILE.pfeil) * s);
  const blatt = m.blatt + (ZEILE.blattKopf + ZEILE.tag + ZEILE.monat) * s + 1;
  // links steht ein Kasten fester Höhe, rechts Wert und Pfeil
  const messung = m.messung[0] + Math.max(wertzeile(18), (wertzeile(18) + ZEILE.pfeil) * s) + m.messung[1];
  const kasten = (punkte: number) => punkte * (2 * m.punkt + ZEILE.punkt * s) + m.hinweis[0] + ZEILE.hinweis * s + m.hinweis[1];
  // die Trennlinie liegt ohne eigene Höhe über dem Tag
  const tag = (t: Tag) => Math.max(blatt, t.messungen.reduce((h, x) => h + messung + (offen.has(x.punkte[0].id) ? kasten(x.punkte.length) : 0), 0));

  const laenge: number[] = [];
  for (const a of abschnitte) {
    laenge.push(kopf);
    for (const z of a.data) laenge.push(z.art === 'woche' ? woche : tag(z));
    laenge.push(0);
  }
  const versatz = [0];
  laenge.forEach((l, i) => versatz.push(versatz[i] + l));
  return { laenge, versatz };
}
