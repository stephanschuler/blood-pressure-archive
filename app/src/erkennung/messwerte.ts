// Blutdruckwerte aus einem Foto (EXIF-gedreht, lange Seite ~1200 px) lesen.
import { viaButton, viaEdges } from './display';
import type { Rgb } from './image';
import { decode, measures, plausible, type Values } from './segments';

export type Reading = {
  values: Values; // null je Feld, wenn nichts Plausibles gelesen wurde
  uncertain: [boolean, boolean, boolean]; // Feld ist mehrdeutig: in der Bestätigung hervorheben
};

const MARGIN = 0.2; // Mehrdeutigkeitsprüfung, Messung in TECHNOLOGIE.md

export function readValues(img: Rgb): Reading {
  const chains = [viaButton(img), viaEdges(img)].map((d) => (d ? measures(d) : null));
  const read = (margin: number): Values | null => {
    const [a, b] = chains.map((m) => {
      if (!m) return null;
      const v = decode(m, margin);
      return plausible(v) ? v : null;
    });
    // ein Weg genügt; widersprechen sich beide, gilt keiner
    if (a && b) return a.every((x, i) => x === b[i]) ? a : null;
    return a ?? b;
  };
  const values = read(0);
  if (!values) return { values: [null, null, null], uncertain: [false, false, false] };
  // unsicher: kein Weg liefert das Feld auch mit Mehrdeutigkeitsprüfung
  const sure = chains.map((m) => (m ? decode(m, MARGIN) : null));
  return { values, uncertain: values.map((v, i) => !sure.some((s) => s?.[i] === v)) as Reading['uncertain'] };
}
