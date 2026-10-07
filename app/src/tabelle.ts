// CSV und XLSX für Google Sheets nach DATENSICHERUNG.md.
import { strToU8, zipSync } from 'fflate';

import { halbtage, mittel } from './auswertung';
import { gruppieren, type Messpunkt, type Messung } from './messung';

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

type Zelle = string | number | [wert: number, stil: number] | undefined;

const zelle = (ref: string, z: Zelle) =>
  z === undefined ? ''
    : typeof z === 'string' ? `<c r="${ref}" t="inlineStr"><is><t>${z}</t></is></c>`
      : typeof z === 'number' ? `<c r="${ref}"><v>${z}</v></c>`
        : `<c r="${ref}" s="${z[1]}"><v>${z[0]}</v></c>`;

const blatt = (breiteA: number, zeilen: Zelle[][]) =>
  `<worksheet xmlns="${NS}/spreadsheetml/2006/main"><cols><col min="1" max="1" width="${breiteA}" customWidth="1"/></cols><sheetData>${zeilen
    .map((z, i) => `<row r="${i + 1}">${z.map((w, j) => zelle(`${'ABCDEFG'[j]}${i + 1}`, w)).join('')}</row>`)
    .join('')}</sheetData></worksheet>`;

const werte = (ms: Messung[]) => {
  const w = mittel(ms);
  return w ? [w.sys, w.dia, w.puls] : [undefined, undefined, undefined];
};

/** Je Tag eine Zeile mit den Mitteln der Messungen vor und ab 12 Uhr Ortszeit, wie auf der Startseite. */
function tagesmittel(punkte: Messpunkt[]): Zelle[][] {
  return [
    ['Datum', 'SYS Vormittag', 'DIA Vormittag', 'Puls Vormittag', 'SYS Nachmittag', 'DIA Nachmittag', 'Puls Nachmittag'],
    ...halbtage(gruppieren(sortiert(punkte))).map(([tag, vm, nm]): Zelle[] => [[seriell(tag.toISOString()), 2], ...werte(vm), ...werte(nm)]),
  ];
}

/** Blatt 1 wie csv(), die Zeit als Zahl mit Datumsformat, Sheets muss nichts raten; Blatt 2 Tagesmittel. */
export function xlsx(punkte: Messpunkt[]): Uint8Array {
  const messpunkte: Zelle[][] = [
    ['Zeit', 'SYS', 'DIA', 'Puls'],
    ...sortiert(punkte).map((p): Zelle[] => [[seriell(p.zeit), 1], p.sys, p.dia, p.puls]),
  ];
  const blattTyp = 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"';
  const dateien: Record<string, string> = {
    '[Content_Types].xml': `<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ${blattTyp}/><Override PartName="/xl/worksheets/sheet2.xml" ${blattTyp}/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="Messpunkte" sheetId="1" r:id="rId1"/><sheet name="Tagesmittel" sheetId="2" r:id="rId3"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
    // Excel verlangt beide Füllungen, auch wenn keine Zelle sie nutzt
    'xl/styles.xml': `<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml': blatt(17, messpunkte),
    'xl/worksheets/sheet2.xml': blatt(11, tagesmittel(punkte)),
  };
  return zipSync(Object.fromEntries(Object.entries(dateien).map(([name, xml]) => [name, strToU8(KOPF + xml)])));
}
