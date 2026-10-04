// Zwei Wege zum entzerrten Display (330x400). Vorbild: ocr-prototyp/display.py und stufe1.py.
import {
  adaptiveDark, canny, channelMax, close, components, dilate3, gaussianBlur, grayscale, hsvRange, hull,
  invert, minAreaRect, orderCorners, perimeter, polygonArea, approxPoly, remap, warpQuad,
  type Pt, type Rgb,
} from './image';

export const OUT_W = 330, OUT_H = 400;

// --- Weg 1: grüne START/STOP-Taste des Medisana ---

type Button = { cx: number; cy: number; w: number; h: number; angle: number };

function buttonCandidate(img: Rgb, lo: [number, number, number], hi: [number, number, number], minFill: number | null) {
  const mask = close(hsvRange(img, lo, hi), 15, 15);
  let best: Pt[] | null = null, bestArea = 0.002 * mask.data.length;
  for (const c of components(mask)) {
    if (c.filled <= bestArea) continue;
    const box = minAreaRect(hull(c));
    const sides = [Math.hypot(box[1][0] - box[0][0], box[1][1] - box[0][1]), Math.hypot(box[2][0] - box[1][0], box[2][1] - box[1][1])];
    const w = Math.min(...sides), h = Math.max(...sides);
    // Taste: aufrechtes Rechteck, etwa 1,6-mal so hoch wie breit, gut gefüllt. Ohne minFill keine
    // Formprüfung: am Bildrand angeschnittene Tasten sollen durchgehen.
    const shaped = minFill === null || (w > 0 && h / w > 1.2 && h / w < 2.4 && c.filled / (w * h) > minFill);
    if (shaped) { best = box; bestArea = c.filled; }
  }
  return best;
}

function findButton(img: Rgb): Button | null {
  // Formgeprüft zuerst: andere grüne Flächen (Ampelskala, Hintergrund) können größer sein.
  // Blasses Grün bei schwachem Licht vor der ungeprüften Suche, die angeschnittene Tasten fängt.
  const box = buttonCandidate(img, [40, 80, 60], [90, 255, 255], 0)
    ?? buttonCandidate(img, [35, 30, 30], [95, 255, 255], 0.65)
    ?? buttonCandidate(img, [40, 80, 60], [90, 255, 255], null);
  if (!box) return null;
  const edges = box.map((p, i): Pt => [box[(i + 1) % 4][0] - p[0], box[(i + 1) % 4][1] - p[1]]);
  const len = (e: Pt) => Math.hypot(e[0], e[1]);
  let long = edges.reduce((a, e) => (len(e) > len(a) ? e : a));
  if (long[1] < 0) long = [-long[0], -long[1]];
  return {
    cx: box.reduce((s, p) => s + p[0], 0) / 4,
    cy: box.reduce((s, p) => s + p[1], 0) / 4,
    w: Math.min(...edges.map(len)),
    h: Math.max(...edges.map(len)),
    angle: (Math.atan2(-long[0], long[1]) * 180) / Math.PI,
  };
}

// Alle Maße in Tastenhöhen; die Breite der Taste taugt nicht, sie ist bei Nahaufnahmen angeschnitten.
const UNIT = 150; // Pixel je Tastenhöhe im groben Ausschnitt
const REGION = [-2.6, -0.1, -0.9, 2.0]; // x links/rechts ab linker Tastenkante, y oben/unten ab Oberkante
const GLASS = [0.41, 2.24, 0.31, 2.56]; // erwartete Glaskanten im groben Ausschnitt
const BAND = 0.3;

function cropRegion(img: Rgb, b: Button): Rgb {
  // Drehung um den Tastenmittelpunkt (wie cv2.getRotationMatrix2D mit −angle), dann Maßstab und Verschiebung
  const a = (-b.angle * Math.PI) / 180, al = Math.cos(a), be = Math.sin(a);
  const rot = [al, be, (1 - al) * b.cx - be * b.cy, -be, al, be * b.cx + (1 - al) * b.cy];
  const left = b.cx - b.w / 2, top = b.cy - b.h / 2, k = UNIT / b.h;
  const tx = -k * (left + REGION[0] * b.h), ty = -k * (top + REGION[2] * b.h);
  // Vorwärts: dst = k * rot(src) + t; rückwärts für das Abtasten
  const m = [k * rot[0], k * rot[1], k * rot[2] + tx, k * rot[3], k * rot[4], k * rot[5] + ty];
  const det = m[0] * m[4] - m[1] * m[3];
  const w = Math.trunc((REGION[1] - REGION[0]) * UNIT), h = Math.trunc((REGION[3] - REGION[2]) * UNIT);
  return remap(img, w, h, (x, y) => {
    const u = x - m[2], v = y - m[5];
    return [(m[4] * u - m[1] * v) / det, (-m[3] * u + m[0] * v) / det];
  });
}

/** Kante als Gerade pos = slope * a + offset, gesucht in neun Streifen quer zur Kante. */
function edgeLine(g: Float32Array, w: number, h: number, expected: number, falling: boolean, vertical: boolean) {
  // vertical: Kante senkrecht, Streifen sind Zeilen (a = y, pos = x); sonst umgekehrt
  const n = vertical ? h : w, len = vertical ? w : h;
  const at = (a: number, p: number) => (vertical ? g[a * w + p] : g[p * w + a]);
  const lo = Math.max(Math.trunc((expected - BAND) * UNIT), 1), hi = Math.min(Math.trunc((expected + BAND) * UNIT), len - 1);
  const pts: Pt[] = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.trunc(0.2 * n + (i * 0.6 * n) / 8);
    const profile = new Float32Array(len);
    for (let p = 0; p < len; p++) {
      let s = 0;
      for (let r = a - 10; r < a + 10; r++) s += at(r, p);
      profile[p] = s / 20;
    }
    let best = lo, bestD = falling ? Infinity : -Infinity;
    for (let p = lo; p < hi; p++) {
      const d = profile[p + 1] - profile[p];
      if (falling ? d < bestD : d > bestD) { bestD = d; best = p; }
    }
    pts.push([a, best]);
  }
  const sorted = pts.map((p) => p[1]).sort((x, y) => x - y);
  const median = sorted[4];
  const keep = pts.filter((p) => Math.abs(p[1] - median) < 0.05 * UNIT);
  if (keep.length < 2) return { slope: 0, offset: median };
  const ma = keep.reduce((s, p) => s + p[0], 0) / keep.length, mp = keep.reduce((s, p) => s + p[1], 0) / keep.length;
  const sxx = keep.reduce((s, p) => s + (p[0] - ma) ** 2, 0), sxy = keep.reduce((s, p) => s + (p[0] - ma) * (p[1] - mp), 0);
  const slope = sxx ? sxy / sxx : 0;
  return { slope, offset: mp - slope * ma };
}

function intersect(v: { slope: number; offset: number }, h: { slope: number; offset: number }): Pt {
  // v: x = a*y + b, h: y = c*x + d
  const y = (h.slope * v.offset + h.offset) / (1 - v.slope * h.slope);
  return [v.slope * y + v.offset, y];
}

export function viaButton(img: Rgb): Rgb | null {
  const b = findButton(img);
  if (!b) return null;
  const region = cropRegion(img, b);
  const g = grayscale(region).data;
  const { w, h } = region;
  const left = edgeLine(g, w, h, GLASS[0], true, true);
  const right = edgeLine(g, w, h, GLASS[1], false, true);
  const top = edgeLine(g, w, h, GLASS[2], true, false);
  const bottom = edgeLine(g, w, h, GLASS[3], false, false);
  return warpQuad(region, [intersect(left, top), intersect(right, top), intersect(right, bottom), intersect(left, bottom)], OUT_W, OUT_H);
}

// --- Weg 2: Display über seine Ränder (Stufe 1) ---

/** Konvexe Vierecke passender Größe aus den Kanten des ganzen Bildes. */
function candidates(img: Rgb): Pt[][] {
  const gray = gaussianBlur(grayscale(img), 5, 0, true);
  const areaImg = img.w * img.h;
  const quads: Pt[][] = [];
  for (const raw of canny(gray, [[20, 60], [40, 120], [80, 200]])) {
    const edges = dilate3(raw);
    // Konturen der Kantenflächen und ihrer Löcher: Hülle der Fläche bzw. der eingeschlossenen Fläche
    for (const c of [...components(edges), ...components(invert(edges), false)]) {
      if (c.w * c.h < 0.02 * areaImg) continue;
      const hl = hull(c);
      const quad = approxPoly(hl, 0.02 * perimeter(hl));
      if (quad.length !== 4) continue;
      const area = polygonArea(quad);
      if (area <= 0.02 * areaImg || area >= 0.7 * areaImg) continue;
      const q = orderCorners(quad);
      const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const w = (d(q[1], q[0]) + d(q[2], q[3])) / 2, h = (d(q[3], q[0]) + d(q[2], q[1])) / 2;
      // Kandidaten aus den drei Kantenschwellen sind oft fast gleich: nur einmal prüfen
      const same = (o: Pt[]) => o.every((p, i) => Math.abs(p[0] - q[i][0]) < 4 && Math.abs(p[1] - q[i][1]) < 4);
      if (h > 0 && w / h > 0.55 && w / h < 1.2 && !quads.some(same)) quads.push(q);
    }
  }
  return quads;
}

/** Anzahl ziffernartiger Flecken im entzerrten Display. */
function glyphCount(display: Rgb): number {
  const max = channelMax(display);
  // hellster Kanal: farbige Geistersegmente werden hell; Schließen verbindet die Segmente einer Ziffer
  const dark = close(adaptiveDark(max, 41, 12), 5, 7);
  let n = 0;
  for (const c of components(dark)) {
    if (c.h > 0.12 * OUT_H && c.h < 0.4 * OUT_H && c.w / c.h > 0.1 && c.w / c.h < 0.9 && c.pixels > 0.15 * c.w * c.h) n++;
  }
  return n;
}

export function viaEdges(img: Rgb): Rgb | null {
  let best: Rgb | null = null, bestScore = 2;
  // Kandidaten auf halber Auflösung kosten 3 Prozentpunkte Lesequote (make test-archiv, 4.10.2026)
  for (const q of candidates(img)) {
    const display = warpQuad(img, q, OUT_W, OUT_H);
    const score = glyphCount(display);
    if (score > bestScore) { best = display; bestScore = score; }
  }
  return best;
}
