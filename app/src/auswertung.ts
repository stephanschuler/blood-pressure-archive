// Kennzahlen und Gliederung der Startseite (STARTSEITE.md); alle Zeiten in Ortszeit.
import type { Messung } from './messung';

export type Auswahl = 'vormittag' | 'nachmittag' | 'beide';
export type Tageshaelfte = Exclude<Auswahl, 'beide'>;
export type Werte = { sys: number; dia: number; puls: number };

export const AUSWAHL: Auswahl[] = ['vormittag', 'nachmittag', 'beide'];

/** Gespeicherten Wert lesen; Unbekanntes gilt als „beide". */
export function parseAuswahl(value: string | null): Auswahl {
  return AUSWAHL.includes(value as Auswahl) ? (value as Auswahl) : 'beide';
}

export const zeitpunkt = (m: Messung) => new Date(m.punkte[0].zeit);
export const tageshaelfte = (m: Messung): Tageshaelfte => (zeitpunkt(m).getHours() < 12 ? 'vormittag' : 'nachmittag');
export const filtern = (ms: Messung[], a: Auswahl) => (a === 'beide' ? ms : ms.filter((m) => tageshaelfte(m) === a));

/** Mitternacht `tage` Kalendertage vor dem Tag von `d`; negativ für spätere Tage. */
export function tagesbeginn(d: Date, tage = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - tage);
}

export const zwischen = (ms: Messung[], von: Date, bis: Date) =>
  ms.filter((m) => zeitpunkt(m) >= von && zeitpunkt(m) < bis);

/** Jede Messung zählt gleich, egal wie viele Messpunkte sie hat; null ohne Messung. */
export function mittel(ms: Messung[]): Werte | null {
  if (!ms.length) return null;
  const avg = (k: keyof Werte) => Math.round(ms.reduce((s, m) => s + m[k], 0) / ms.length);
  return { sys: avg('sys'), dia: avg('dia'), puls: avg('puls') };
}

/** Heute und die sechs Kalendertage davor. */
export function siebenTage(ms: Messung[], heute: Date) {
  const beginn = tagesbeginn(heute, 6);
  const messungen = zwischen(ms, beginn, tagesbeginn(heute, -1));
  return { messungen, mittel: mittel(messungen) };
}

export const montag = (d: Date) => tagesbeginn(d, (d.getDay() + 6) % 7);

/** Kalenderwoche nach ISO 8601: die Woche, deren Donnerstag im Jahr liegt. */
export function kalenderwoche(d: Date): number {
  const donnerstag = tagesbeginn(montag(d), -3);
  const tageSeitNeujahr = Math.round((donnerstag.getTime() - new Date(donnerstag.getFullYear(), 0, 1).getTime()) / 864e5);
  return Math.floor(tageSeitNeujahr / 7) + 1;
}

export type Woche = { art: 'woche'; kw: number; von: Date; bis: Date; anzahl: number; mittel: Werte; vorwoche: Werte | null };
/** `vorige[i]`: die Messung vor `messungen[i]` in derselben Tageshälfte, auch Tage zurück; Bezug ihres Pfeils. */
export type Tag = { art: 'tag'; tag: Date; messungen: Messung[]; vorige: (Messung | null)[] };
export type Abschnitt = { monat: Date; data: (Woche | Tag)[] };

/**
 * Messungen (neueste zuerst) je Monat; vor dem neuesten Tag jeder Kalenderwoche ihre Wochenzeile.
 * Liegt ein Monatswechsel in der Woche, steht die Wochenzeile nur im neueren Monat.
 */
export function gliedern(ms: Messung[]): Abschnitt[] {
  const wochen = new Map<number, Messung[]>();
  for (const m of ms) {
    const k = montag(zeitpunkt(m)).getTime();
    if (!wochen.has(k)) wochen.set(k, []);
    wochen.get(k)!.push(m);
  }
  const vorige = new Map<Messung, Messung>();
  const letzte: Partial<Record<Tageshaelfte, Messung>> = {};
  for (const m of [...ms].reverse()) {
    const h = tageshaelfte(m);
    if (letzte[h]) vorige.set(m, letzte[h]);
    letzte[h] = m;
  }
  const abschnitte: Abschnitt[] = [];
  let tag: Tag | undefined;
  let woche: number | undefined;
  for (const m of ms) {
    const t = zeitpunkt(m);
    if (tag?.tag.getTime() === tagesbeginn(t).getTime()) {
      tag.messungen.push(m);
      tag.vorige.push(vorige.get(m) ?? null);
      continue;
    }
    let abschnitt = abschnitte[abschnitte.length - 1];
    if (abschnitt?.monat.getMonth() !== t.getMonth() || abschnitt.monat.getFullYear() !== t.getFullYear()) {
      abschnitt = { monat: new Date(t.getFullYear(), t.getMonth(), 1), data: [] };
      abschnitte.push(abschnitt);
    }
    const von = montag(t);
    if (von.getTime() !== woche) {
      woche = von.getTime();
      const dieser = wochen.get(woche)!;
      abschnitt.data.push({
        art: 'woche', kw: kalenderwoche(von), von, bis: tagesbeginn(von, -6), anzahl: dieser.length,
        mittel: mittel(dieser)!, vorwoche: mittel(wochen.get(tagesbeginn(von, 7).getTime()) ?? []),
      });
    }
    tag = { art: 'tag', tag: tagesbeginn(t), messungen: [m], vorige: [vorige.get(m) ?? null] };
    abschnitt.data.push(tag);
  }
  return abschnitte;
}

/** Stelle des Tags `d` in der Gliederung; ohne Messung an `d` der nächstältere, vor der ersten Messung die älteste. */
export function tagSuchen(abschnitte: Abschnitt[], d: Date) {
  const ziel = tagesbeginn(d).getTime();
  let letzter: { sectionIndex: number; itemIndex: number; tag: Tag } | undefined;
  for (const [sectionIndex, a] of abschnitte.entries()) {
    for (const [itemIndex, z] of a.data.entries()) {
      if (z.art !== 'tag') continue;
      letzter = { sectionIndex, itemIndex, tag: z };
      if (z.tag.getTime() <= ziel) return letzter;
    }
  }
  return letzter;
}
