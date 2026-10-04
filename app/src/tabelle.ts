// CSV und XLSX für Google Sheets nach DATENSICHERUNG.md.
import { strToU8, zipSync } from 'fflate';

import type { Messpunkt } from './messung';

const p2 = (n: number) => String(n).padStart(2, '0');

// Ortszeit ohne Zeitzone: so liest Sheets die Spalte als Datum und Uhrzeit
const zeit = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

const sortiert = (punkte: Messpunkt[]) => [...punkte].sort((a, b) => a.zeit.localeCompare(b.zeit));

/** Eine Zeile je Messpunkt, älteste zuerst. */
export const csv = (punkte: Messpunkt[]) =>
  ['Zeit,SYS,DIA,Puls', ...sortiert(punkte).map((p) => `${zeit(p.zeit)},${p.sys},${p.dia},${p.puls}`)].join('\n') + '\n';

// Tage seit 1899-12-30 in Ortszeit: Tabellenkalkulationen kennen keine Zeitzone
const seriell = (iso: string) => {
  const d = new Date(iso);
  return (d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000 + 25_569;
};

const KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org';

/** Wie csv(), aber als XLSX: die Zeit ist eine Zahl mit Datumsformat, Sheets muss nichts raten. */
export function xlsx(punkte: Messpunkt[]): Uint8Array {
  const zelle = (ref: string, inhalt: string) => `<c r="${ref}"${inhalt}</c>`;
  const zeilen = [
    `<row r="1">${['Zeit', 'SYS', 'DIA', 'Puls'].map((t, i) => zelle(`${'ABCD'[i]}1`, ` t="inlineStr"><is><t>${t}</t></is>`)).join('')}</row>`,
    ...sortiert(punkte).map((p, i) => {
      const r = i + 2;
      return `<row r="${r}">${zelle(`A${r}`, ` s="1"><v>${seriell(p.zeit)}</v>`)}${[p.sys, p.dia, p.puls].map((v, j) => zelle(`${'BCD'[j]}${r}`, `><v>${v}</v>`)).join('')}</row>`;
    }),
  ];
  const dateien: Record<string, string> = {
    '[Content_Types].xml': `<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="Messpunkte" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    // Excel verlangt beide Füllungen, auch wenn keine Zelle sie nutzt
    'xl/styles.xml': `<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}/spreadsheetml/2006/main"><cols><col min="1" max="1" width="17" customWidth="1"/></cols><sheetData>${zeilen.join('')}</sheetData></worksheet>`,
  };
  return zipSync(Object.fromEntries(Object.entries(dateien).map(([name, xml]) => [name, strToU8(KOPF + xml)])));
}
