// Wahl auf der Seite „Export“ der Seitenleiste nach DATENSICHERUNG.md, gespeichert als Einstellung.
export const FORMATE = ['csv', 'xlsx', 'pdf'] as const;
export type Format = (typeof FORMATE)[number];
export const parseFormat = (v: string | null): Format => (FORMATE.includes(v as Format) ? (v as Format) : 'xlsx');

export const ZIELE = ['ordner', 'teilen'] as const;
export type Ziel = (typeof ZIELE)[number];
export const ZIEL_LABEL: Record<Ziel, string> = { ordner: 'Ordner', teilen: 'Teilen' };
export const parseZiel = (v: string | null): Ziel => (ZIELE.includes(v as Ziel) ? (v as Ziel) : 'ordner');

/** Einstellung „exportiert“: Zeitpunkt, Format, Ziel. */
export const exportiert = (format: Format, ziel: Ziel, am = new Date()) => `${am.toISOString()} ${format} ${ziel}`;

export function zuletzt(wert: string | null): string {
  if (!wert) return 'Noch nie exportiert';
  const [am, format, ziel] = wert.split(' ');
  return `Zuletzt am ${new Date(am).toLocaleDateString('de-DE')}: ${format.toUpperCase()} · ${ziel === 'teilen' ? 'geteilt' : 'in Ordner'}`;
}
