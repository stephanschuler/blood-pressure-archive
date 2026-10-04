// Bildoperationen in reinem TypeScript, nach dem Vorbild der OpenCV-Funktionen des Python-Prototyps
// (ocr-prototyp/). Läuft in der App (Hermes) und in Node.
// Hermes hat keinen JIT: Funktionsaufrufe, Objekte und Destrukturierung je Pixel kosten dort ein
// Vielfaches. In Pixelschleifen nur lokale Variablen und Typed Arrays; messen mit `make hermes`.
import { decode } from 'jpeg-js';

export type Rgb = { w: number; h: number; data: Uint8Array }; // RGB, 3 Byte je Pixel
export type Gray = { w: number; h: number; data: Float32Array };
export type Mask = { w: number; h: number; data: Uint8Array }; // 0 oder 1
export type Pt = [number, number];

export function decodeJpeg(bytes: Uint8Array): Rgb {
  const img = decode(bytes, { useTArray: true, formatAsRGBA: false });
  return { w: img.width, h: img.height, data: img.data };
}

export function channelMax(img: Rgb): Gray {
  const out = new Float32Array(img.w * img.h);
  for (let i = 0, j = 0; i < out.length; i++, j += 3) {
    out[i] = Math.max(img.data[j], img.data[j + 1], img.data[j + 2]);
  }
  return { w: img.w, h: img.h, data: out };
}

export function grayscale(img: Rgb): Gray {
  const out = new Float32Array(img.w * img.h);
  for (let i = 0, j = 0; i < out.length; i++, j += 3) {
    out[i] = Math.round(0.299 * img.data[j] + 0.587 * img.data[j + 1] + 0.114 * img.data[j + 2]);
  }
  return { w: img.w, h: img.h, data: out };
}

/** HSV-Bereich wie cv2.inRange auf cv2.COLOR_RGB2HSV: H 0–180, S und V 0–255. */
export function hsvRange(img: Rgb, lo: [number, number, number], hi: [number, number, number]): Mask {
  const out = new Uint8Array(img.w * img.h);
  for (let i = 0, j = 0; i < out.length; i++, j += 3) {
    const r = img.data[j], g = img.data[j + 1], b = img.data[j + 2];
    const v = Math.max(r, g, b);
    const d = v - Math.min(r, g, b);
    const s = v === 0 ? 0 : Math.round((255 * d) / v);
    let h = 0;
    if (d > 0) {
      h = v === r ? (60 * (g - b)) / d : v === g ? 120 + (60 * (b - r)) / d : 240 + (60 * (r - g)) / d;
      if (h < 0) h += 360;
    }
    const hh = Math.round(h / 2);
    out[i] = hh >= lo[0] && hh <= hi[0] && s >= lo[1] && s <= hi[1] && v >= lo[2] && v <= hi[2] ? 1 : 0;
  }
  return { w: img.w, h: img.h, data: out };
}

// dst[p] = 1, wenn im Fenster [p − a, p − a + k) der Linie, aufs Bild beschnitten, ein Pixel gesetzt
// ist (all: jedes). pre: Puffer mit mindestens n + 1 Einträgen.
function window1d(src: Uint8Array, dst: Uint8Array, start: number, step: number, n: number, a: number, k: number, all: boolean, pre: Int32Array) {
  for (let p = 0, i = start; p < n; p++, i += step) pre[p + 1] = pre[p] + src[i];
  for (let p = 0, i = start; p < n; p++, i += step) {
    const p0 = p - a < 0 ? 0 : p - a, p1 = p - a + k > n ? n : p - a + k;
    const c = pre[p1] - pre[p0];
    dst[i] = (all ? c === p1 - p0 : c > 0) ? 1 : 0;
  }
}

/** Morphologisches Schließen mit Rechteck kw x kh (wie cv2.morphologyEx MORPH_CLOSE). */
export function close(m: Mask, kw: number, kh: number): Mask {
  const { w, h } = m, ax = Math.floor(kw / 2), ay = Math.floor(kh / 2);
  const a = new Uint8Array(w * h), b = new Uint8Array(w * h), pre = new Int32Array(Math.max(w, h) + 1);
  // Rechteck separabel: Zeilen, dann Spalten. Erosion: außerhalb des Bildes gilt als gesetzt (OpenCV-Vorgabe)
  for (let y = 0; y < h; y++) window1d(m.data, a, y * w, 1, w, ax, kw, false, pre);
  for (let x = 0; x < w; x++) window1d(a, b, x, w, h, ay, kh, false, pre);
  for (let y = 0; y < h; y++) window1d(b, a, y * w, 1, w, ax, kw, true, pre);
  for (let x = 0; x < w; x++) window1d(a, b, x, w, h, ay, kh, true, pre);
  return { w, h, data: b };
}

/** 3x3-Dilatation (wie cv2.dilate mit np.ones((3, 3))). */
export function dilate3(m: Mask): Mask {
  const { w, h, data } = m, n = w * h;
  const row = new Uint8Array(n), out = new Uint8Array(n);
  for (let y = 0, i = 0; y < h; y++)
    for (let x = 0; x < w; x++, i++) row[i] = data[i] | (x > 0 ? data[i - 1] : 0) | (x < w - 1 ? data[i + 1] : 0);
  for (let i = 0; i < n; i++) out[i] = row[i] | (i >= w ? row[i - w] : 0) | (i < n - w ? row[i + w] : 0);
  return { w, h, data: out };
}

function reflect101(i: number, n: number) {
  if (n === 1) return 0;
  while (i < 0 || i >= n) i = i < 0 ? -i : 2 * n - 2 - i;
  return i;
}

export function gaussKernel(ksize: number, sigma: number): Float32Array {
  if (sigma <= 0) sigma = 0.3 * ((ksize - 1) * 0.5 - 1) + 0.8;
  const k = new Float32Array(ksize);
  const c = (ksize - 1) / 2;
  let sum = 0;
  for (let i = 0; i < ksize; i++) sum += k[i] = Math.exp(-((i - c) ** 2) / (2 * sigma * sigma));
  for (let i = 0; i < ksize; i++) k[i] /= sum;
  return k;
}

/** Separabler Gauß-Filter, Rand wie OpenCV (BORDER_REFLECT_101). round: Ergebnis wie bei uint8. */
export function gaussianBlur(g: Gray, ksize: number, sigma: number, round = false): Gray {
  const k = gaussKernel(ksize, sigma);
  const r = (ksize - 1) / 2;
  const { w, h, data } = g;
  // gespiegelte Indizes je Fensterposition: ix[x + i] für Pixel x + i − r, iy schon mal w
  const ix = new Int32Array(w + 2 * r), iy = new Int32Array(h + 2 * r);
  for (let i = 0; i < ix.length; i++) ix[i] = reflect101(i - r, w);
  for (let i = 0; i < iy.length; i++) iy[i] = reflect101(i - r, h) * w;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = 0; i < ksize; i++) s += k[i] * data[row + ix[x + i]];
      tmp[row + x] = s;
    }
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = 0; i < ksize; i++) s += k[i] * tmp[iy[y + i] + x];
      out[y * w + x] = round ? Math.min(255, Math.max(0, Math.round(s))) : s;
    }
  return { w, h, data: out };
}

/**
 * Canny mit 3x3-Sobel und L1-Gradient (OpenCV-Vorgabe) für mehrere Schwellenpaare: Gradient und
 * Maximumsuche einmal, nur die Verknüpfung schwacher und starker Kanten je Paar.
 */
export function canny(g: Gray, pairs: [number, number][]): Mask[] {
  const { w, h } = g;
  const d = g.data;
  const mag = new Float32Array(w * h);
  const dir = new Uint8Array(w * h); // 0: waagrecht, 1: 45°, 2: senkrecht, 3: 135°
  for (let y = 0; y < h; y++) {
    const ym = reflect101(y - 1, h) * w, y0 = y * w, yp = reflect101(y + 1, h) * w;
    for (let x = 0; x < w; x++) {
      const xm = reflect101(x - 1, w), xp = reflect101(x + 1, w);
      const gx = d[ym + xp] + 2 * d[y0 + xp] + d[yp + xp] - d[ym + xm] - 2 * d[y0 + xm] - d[yp + xm];
      const gy = d[yp + xm] + 2 * d[yp + x] + d[yp + xp] - d[ym + xm] - 2 * d[ym + x] - d[ym + xp];
      const ax = gx < 0 ? -gx : gx, ay = gy < 0 ? -gy : gy;
      mag[y0 + x] = ax + ay;
      // tan(22,5°) ≈ 0,4142
      dir[y0 + x] = ay <= ax * 0.4142 ? 0 : ay >= ax * 2.4142 ? 2 : (gx > 0) === (gy > 0) ? 1 : 3;
    }
  }
  // lokales Maximum quer zur Kante (Nicht-Maximum-Unterdrückung), unabhängig von den Schwellen
  const peak = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, m = mag[i];
      if (m === 0) continue;
      let ia = -1, ib = -1;
      switch (dir[i]) {
        case 0: if (x > 0) ia = i - 1; if (x < w - 1) ib = i + 1; break;
        case 2: if (y > 0) ia = i - w; if (y < h - 1) ib = i + w; break;
        case 1: if (x > 0 && y > 0) ia = i - w - 1; if (x < w - 1 && y < h - 1) ib = i + w + 1; break;
        default: if (x < w - 1 && y > 0) ia = i - w + 1; if (x > 0 && y < h - 1) ib = i + w - 1;
      }
      if (m > (ia < 0 ? 0 : mag[ia]) && m >= (ib < 0 ? 0 : mag[ib])) peak[i] = 1;
    }
  return pairs.map(([lo, hi]) => {
    const out = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let i = 0; i < w * h; i++) if (peak[i] && mag[i] > hi) stack.push(i);
    while (stack.length) {
      const i = stack.pop()!;
      if (out[i]) continue;
      out[i] = 1;
      const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!out[j] && peak[j] && mag[j] > lo) stack.push(j);
        }
    }
    return { w, h, data: out };
  });
}

/** Mittelwert-Schwelle wie cv2.adaptiveThreshold(MEAN_C, THRESH_BINARY_INV): 1 = dunkler als Umgebung − c. */
export function adaptiveDark(g: Gray, block: number, c: number): Mask {
  const { w, h } = g;
  const r = (block - 1) / 2;
  // Summenbild über das am Rand fortgesetzte Bild (BORDER_REPLICATE)
  const W = w + 2 * r, H = h + 2 * r, S = W + 1;
  const sum = new Float64Array(S * (H + 1));
  for (let y = 0; y < H; y++) {
    const sy = Math.min(h - 1, Math.max(0, y - r));
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += g.data[sy * w + Math.min(w - 1, Math.max(0, x - r))];
      sum[(y + 1) * S + x + 1] = sum[y * S + x + 1] + row;
    }
  }
  const out = new Uint8Array(w * h);
  const n = block * block;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = sum[(y + block) * S + x + block] - sum[y * S + x + block] - sum[(y + block) * S + x] + sum[y * S + x];
      out[y * w + x] = g.data[y * w + x] > Math.round(s / n) - c ? 0 : 1;
    }
  return { w, h, data: out };
}

export type Component = {
  x: number; y: number; w: number; h: number;
  pixels: number;
  filled: number; // Fläche ohne Löcher, zeilenweise von links bis rechts gezählt
  rows: Map<number, [number, number]>; // y -> [xmin, xmax]
};

/** Zusammenhängende Flächen (8er-Nachbarschaft) mit Zeilen-Extremen für die konvexe Hülle. */
export function components(m: Mask, eight = true): Component[] {
  const { w, h, data } = m;
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h); // jedes Pixel kommt höchstens einmal hinein
  const rowMin = new Int32Array(h).fill(w), rowMax = new Int32Array(h).fill(-1);
  const out: Component[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!data[start] || label[start] >= 0) continue;
    const id = out.length;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, pixels = 0, sp = 0, j = 0;
    label[start] = id;
    stack[sp++] = start;
    while (sp) {
      const i = stack[--sp];
      const y = (i / w) | 0, x = i - y * w;
      pixels++;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      if (x < rowMin[y]) rowMin[y] = x;
      if (x > rowMax[y]) rowMax[y] = x;
      const l = x > 0, r = x < w - 1, u = y > 0, d = y < h - 1;
      if (l && data[j = i - 1] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
      if (r && data[j = i + 1] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
      if (u && data[j = i - w] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
      if (d && data[j = i + w] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
      if (!eight) continue;
      if (u && l && data[j = i - w - 1] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
      if (u && r && data[j = i - w + 1] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
      if (d && l && data[j = i + w - 1] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
      if (d && r && data[j = i + w + 1] && label[j] < 0) { label[j] = id; stack[sp++] = j; }
    }
    // zusammenhängend: jede Zeile zwischen y0 und y1 enthält ein Pixel
    const rows = new Map<number, [number, number]>();
    let filled = 0;
    for (let y = y0; y <= y1; y++) {
      rows.set(y, [rowMin[y], rowMax[y]]);
      filled += rowMax[y] - rowMin[y] + 1;
      rowMin[y] = w;
      rowMax[y] = -1;
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, pixels, filled, rows });
  }
  return out;
}

export function invert(m: Mask): Mask {
  const out = new Uint8Array(m.data.length);
  for (let i = 0; i < out.length; i++) out[i] = m.data[i] ? 0 : 1;
  return { w: m.w, h: m.h, data: out };
}

/** Konvexe Hülle (Andrew) der Zeilen-Extreme einer Fläche, gegen den Uhrzeigersinn in Bildkoordinaten. */
export function hull(c: Component): Pt[] {
  const pts: Pt[] = [];
  for (const [y, [a, b]] of c.rows) { pts.push([a, y]); if (b !== a) pts.push([b, y]); }
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function polygonArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export function perimeter(p: Pt[]): number {
  let l = 0;
  for (let i = 0; i < p.length; i++) l += Math.hypot(p[(i + 1) % p.length][0] - p[i][0], p[(i + 1) % p.length][1] - p[i][1]);
  return l;
}

/** Kleinstes umschließendes Rechteck einer konvexen Hülle: vier Ecken der Reihe nach. */
export function minAreaRect(h: Pt[]): Pt[] {
  if (h.length === 1) return [h[0], h[0], h[0], h[0]];
  let best: Pt[] = [], bestArea = Infinity;
  for (let i = 0; i < h.length; i++) {
    const [x1, y1] = h[i], [x2, y2] = h[(i + 1) % h.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (!len) continue;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of h) {
      const a = x * ux + y * uy, b = -x * uy + y * ux;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    const area = (a1 - a0) * (b1 - b0);
    if (area < bestArea) {
      bestArea = area;
      const pt = (a: number, b: number): Pt => [a * ux - b * uy, a * uy + b * ux];
      best = [pt(a0, b0), pt(a1, b0), pt(a1, b1), pt(a0, b1)];
    }
  }
  return best;
}

/** Douglas-Peucker für geschlossene Polygone (wie cv2.approxPolyDP mit closed=True). */
export function approxPoly(p: Pt[], eps: number): Pt[] {
  if (p.length < 3) return p;
  const dist = (q: Pt, a: Pt, b: Pt) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return l ? Math.abs(dy * q[0] - dx * q[1] + b[0] * a[1] - b[1] * a[0]) / l : Math.hypot(q[0] - a[0], q[1] - a[1]);
  };
  const dp = (pts: Pt[]): Pt[] => {
    let idx = 0, max = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = dist(pts[i], pts[0], pts[pts.length - 1]);
      if (d > max) { max = d; idx = i; }
    }
    if (max <= eps) return [pts[0], pts[pts.length - 1]];
    return dp(pts.slice(0, idx + 1)).slice(0, -1).concat(dp(pts.slice(idx)));
  };
  // Start am Punkt, der vom ersten am weitesten weg ist; Teilung beim davon entferntesten
  let a = 0;
  for (let i = 1; i < p.length; i++) if (Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]) > Math.hypot(p[a][0] - p[0][0], p[a][1] - p[0][1])) a = i;
  let b = a;
  for (let i = 0; i < p.length; i++) if (Math.hypot(p[i][0] - p[a][0], p[i][1] - p[a][1]) > Math.hypot(p[b][0] - p[a][0], p[b][1] - p[a][1])) b = i;
  const ring = p.slice(a).concat(p.slice(0, a));
  const k = (b - a + p.length) % p.length;
  const first = dp(ring.slice(0, k + 1));
  const second = dp(ring.slice(k).concat([ring[0]]));
  const out = first.slice(0, -1).concat(second.slice(0, -1));
  return out;
}

/** Ecken sortieren: oben links, oben rechts, unten rechts, unten links (wie order_corners). */
export function orderCorners(p: Pt[]): Pt[] {
  const s = p.map(([x, y]) => x + y), d = p.map(([x, y]) => y - x);
  const arg = (v: number[], f: (a: number, b: number) => boolean) => v.reduce((bi, x, i) => (f(x, v[bi]) ? i : bi), 0);
  return [p[arg(s, (a, b) => a < b)], p[arg(d, (a, b) => a < b)], p[arg(s, (a, b) => a > b)], p[arg(d, (a, b) => a > b)]];
}

/** Homographie, die die Punkte src auf dst abbildet (wie cv2.getPerspectiveTransform). */
export function perspective(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [...A.map((row, i) => row[8] / A[i][i]), 1];
}

/** Bild durch inverse Abbildung (Zielpixel -> Quellpunkt) neu abtasten, bilinear, außen schwarz. */
export function remap(img: Rgb, w: number, h: number, inv: (x: number, y: number, s: Float64Array) => void): Rgb {
  const out = new Uint8Array(w * h * 3);
  const src = img.data, iw = img.w, ih = img.h, s = new Float64Array(2);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      inv(x, y, s);
      const sx = s[0], sy = s[1];
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const o = (y * w + x) * 3;
      if (x0 >= 0 && y0 >= 0 && x0 + 1 < iw && y0 + 1 < ih) {
        const i00 = (y0 * iw + x0) * 3, i01 = i00 + 3, i10 = i00 + iw * 3, i11 = i10 + 3;
        for (let c = 0; c < 3; c++)
          out[o + c] = Math.round((1 - fy) * ((1 - fx) * src[i00 + c] + fx * src[i01 + c]) + fy * ((1 - fx) * src[i10 + c] + fx * src[i11 + c]));
        continue;
      }
      for (let c = 0; c < 3; c++) {
        const p = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= iw || yy >= ih ? 0 : src[(yy * iw + xx) * 3 + c]);
        out[o + c] = Math.round((1 - fy) * ((1 - fx) * p(x0, y0) + fx * p(x0 + 1, y0)) + fy * ((1 - fx) * p(x0, y0 + 1) + fx * p(x0 + 1, y0 + 1)));
      }
    }
  return { w, h, data: out };
}

/** Viereck quad (Bild) auf ein Rechteck w x h entzerren. */
export function warpQuad(img: Rgb, quad: Pt[], w: number, h: number): Rgb {
  const m = perspective([[0, 0], [w, 0], [w, h], [0, h]], quad);
  return remap(img, w, h, (x, y, s) => {
    const d = m[6] * x + m[7] * y + m[8];
    s[0] = (m[0] * x + m[1] * y + m[2]) / d;
    s[1] = (m[3] * x + m[4] * y + m[5]) / d;
  });
}
