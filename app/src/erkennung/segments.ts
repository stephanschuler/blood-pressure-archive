// Ziffern im entzerrten Display (330x400) Segment für Segment lesen. Vorbild: ocr-prototyp/segments.py.
import type { Rgb } from './image';

export type Cell = [number | null, number, number, number, number, number]; // xl, xr, yt, ym, yb, slant

// Ziffernzellen des Medisana: linke/rechte Kante oben, y oben/Mitte/unten, Schrägung über die volle
// Höhe. Hunderter (xl null) haben nur die Segmente b und c.
export const SYS: Cell[] = [[null, 120, 57, 107, 161, -12], [155, 215, 57, 107, 161, -12], [249, 310, 57, 107, 161, -12]];
export const DIA: Cell[] = [[null, 122, 192, 245, 299, -12], [155, 215, 192, 245, 299, -12], [252, 312, 192, 245, 299, -12]];
export const PUL: Cell[] = [[236, 265, 330, 357, 389, -8], [286, 319, 330, 357, 389, -8]];

const DIGITS: Record<string, number> = {
  abcdef: 0, bc: 1, abdeg: 2, abcdg: 3, bcfg: 4, acdfg: 5, acdefg: 6,
  abc: 7, abcf: 7, abcdefg: 8, abcdfg: 9, abcfg: 9,
};

const FLOOR = 0.12;
const RATIO = [0.4, 0.4, 0.5]; // je Zeile SYS, DIA, PUL; kleine Pulsziffern: Geistersegmente bei Dunkelheit

type Line = { from: [number, number]; to: [number, number]; across: 'x' | 'y' };
type Measures = Record<string, number>[][];
export type Values = [number | null, number | null, number | null];

export function segmentLines([xl, xr, yt, ym, yb, slant]: Cell): Record<string, Line> {
  const k = (y: number) => (slant * (y - yt)) / (yb - yt);
  const lines: Record<string, Line> = {
    b: { from: [xr, yt], to: [xr + k(ym), ym], across: 'x' },
    c: { from: [xr + k(ym), ym], to: [xr + k(yb), yb], across: 'x' },
  };
  if (xl !== null) {
    lines.a = { from: [xl, yt], to: [xr, yt], across: 'y' };
    lines.g = { from: [xl + k(ym), ym], to: [xr + k(ym), ym], across: 'y' };
    lines.d = { from: [xl + k(yb), yb], to: [xr + k(yb), yb], across: 'y' };
    lines.f = { from: [xl, yt], to: [xl + k(ym), ym], across: 'x' };
    lines.e = { from: [xl + k(ym), ym], to: [xl + k(yb), yb], across: 'x' };
  }
  return lines;
}

/** Hellster Kanal + 1: farbige Geistersegmente werden hell, aktive (schwarze) bleiben dunkel. */
function brightness(img: Rgb): Float32Array {
  const out = new Float32Array(img.w * img.h);
  for (let i = 0, j = 0; i < out.length; i++, j += 3) out[i] = Math.max(img.data[j], img.data[j + 1], img.data[j + 2]) + 1;
  return out;
}

const T = Array.from({ length: 9 }, (_, i) => 0.25 + (i * 0.5) / 8);

function lineMean(b: Float32Array, w: number, h: number, l: Line, dx: number, dy: number) {
  let s = 0;
  for (const t of T) {
    const x = Math.min(w - 1, Math.max(0, Math.trunc(l.from[0] + t * (l.to[0] - l.from[0]) + dx)));
    const y = Math.min(h - 1, Math.max(0, Math.trunc(l.from[1] + t * (l.to[1] - l.from[1]) + dy)));
    s += b[y * w + x];
  }
  return s / T.length;
}

/** Dunkelheit je Segment relativ zu seiner Umgebung beidseits quer; robust gegen Schatten. */
function measure(b: Float32Array, w: number, h: number, cell: Cell, shift = 5): Record<string, number> {
  const gap = Math.round(0.13 * (cell[4] - cell[2])); // jenseits der Segmentbreite
  const out: Record<string, number> = {};
  for (const [seg, l] of Object.entries(segmentLines(cell))) {
    const q = (o: number): [number, number] => (l.across === 'x' ? [o, 0] : [0, o]);
    let best = -shift, bestV = Infinity;
    for (let o = -shift; o <= shift; o++) {
      const v = lineMean(b, w, h, l, ...q(o));
      if (v < bestV) { bestV = v; best = o; }
    }
    const bg = Math.max(lineMean(b, w, h, l, ...q(best - gap)), lineMean(b, w, h, l, ...q(best + gap)));
    out[seg] = Math.max(0, 1 - bestV / bg);
  }
  return out;
}

export function measures(display: Rgb): Measures {
  const b = brightness(display);
  return [SYS, DIA, PUL].map((row) => row.map((cell) => measure(b, display.w, display.h, cell)));
}

/**
 * (sys, dia, puls); null je Feld bei unbekanntem oder mehrdeutigem Segmentmuster.
 * Mehrdeutig: das Segment am nächsten an der Schwelle liegt näher als margin (relativ zur Schwelle),
 * und umgeschaltet ergäbe es ebenfalls eine gültige Ziffer.
 */
export function decode(rows: Measures, margin = 0): Values {
  return rows.map((row, r) => {
    let value: number | null = 0;
    for (const m of row) {
      // Schwelle je Ziffer: Schatten heben alle Segmente einer Ziffer gemeinsam an.
      const thr = Math.max(FLOOR, RATIO[r] * Math.max(...Object.values(m)));
      const on = [...'abcdefg'].filter((s) => (m[s] ?? 0) > thr).join('');
      const leading = value === 0;
      if (!(on in DIGITS) && !(on === '' && leading)) return null;
      const seg = Object.keys(m).reduce((a, s) => (Math.abs(m[s] - thr) < Math.abs(m[a] - thr) ? s : a));
      if (Math.abs(m[seg] - thr) < margin * thr) {
        const flipped = [...'abcdefg'].filter((s) => on.includes(s) !== (s === seg)).join('');
        if (flipped in DIGITS || (flipped === '' && leading)) return null;
      }
      value = value * 10 + (DIGITS[on] ?? 0);
    }
    return value || null;
  }) as Values;
}

export function plausible([s, d, p]: Values): boolean {
  return s !== null && d !== null && p !== null &&
    s >= 70 && s <= 250 && d >= 40 && d <= 150 && p >= 40 && p <= 180 && s - d >= 15;
}
