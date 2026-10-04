// CSV für Google Sheets nach DATENSICHERUNG.md.
import type { Messpunkt } from './messung';

const p2 = (n: number) => String(n).padStart(2, '0');

// Ortszeit ohne Zeitzone: so liest Sheets die Spalte als Datum und Uhrzeit
const zeit = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

/** Eine Zeile je Messpunkt, älteste zuerst. */
export const csv = (punkte: Messpunkt[]) =>
  ['Zeit,SYS,DIA,Puls', ...[...punkte].sort((a, b) => a.zeit.localeCompare(b.zeit)).map((p) => `${zeit(p.zeit)},${p.sys},${p.dia},${p.puls}`)].join('\n') + '\n';
