/// <reference types="node" />
// Erkennung in Node über einen Ordner mit Fotos laufen lassen; Ergebnis als CSV, eine Zeile je Foto.
// Aufruf: npx tsx tools/messlauf.ts <ordner> <teil> <teile> <ausgabe.csv>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decodeJpeg } from '../src/erkennung/image';
import { readValues } from '../src/erkennung/messwerte';

const [dir, part, parts, out] = process.argv.slice(2);
const names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.jpg')).sort()
  .filter((_, i) => i % Number(parts) === Number(part));
const lines = ['datei,sys,dia,puls,unsicher_sys,unsicher_dia,unsicher_puls,ms'];
for (const n of names) {
  const t = Date.now();
  const { values, uncertain } = readValues(decodeJpeg(readFileSync(`${dir}/${n}`)));
  lines.push([n, ...values.map((v) => v ?? ''), ...uncertain, Date.now() - t].join(','));
}
writeFileSync(out, lines.join('\n') + '\n');
