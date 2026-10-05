import assert from 'node:assert/strict';
import { test } from 'node:test';

import { encode } from 'jpeg-js';

import {
  approxPoly, close, components, decodeJpeg, hsvRange, hull, minAreaRect, orderCorners, perspective, warpQuad,
  type Mask, type Pt, type Rgb,
} from '../src/erkennung/image';

const mask = (w: number, h: number, on: (x: number, y: number) => boolean): Mask => {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = on(x, y) ? 1 : 0;
  return { w, h, data };
};

test('JPEG: Maße, Kanalreihenfolge RGB, Farben nach Kompression nah am Original', () => {
  // Vier Farbflächen 32x16: Rot, Grün, Blau, Grau
  const w = 64, h = 32, farben = [[220, 30, 30], [30, 200, 60], [40, 50, 210], [128, 128, 128]];
  const rgba = new Uint8Array(w * h * 4);
  const farbe = (x: number, y: number) => farben[(y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rgba.set([...farbe(x, y), 255], (y * w + x) * 4);
  const img = decodeJpeg(new Uint8Array(encode({ data: rgba, width: w, height: h }, 95).data));
  assert.deepEqual([img.w, img.h, img.data.length], [w, h, w * h * 3]);
  for (const [x, y] of [[8, 4], [56, 4], [8, 28], [56, 28]]) {
    const ist = [...img.data.subarray((y * w + x) * 3, (y * w + x) * 3 + 3)];
    assert.ok(ist.every((v, i) => Math.abs(v - farbe(x, y)[i]) < 8), `(${x},${y}) ${ist}`);
  }
});

test('Hülle und kleinstes Rechteck eines gedrehten Rechtecks', () => {
  // Rechteck 40x20, um 30° gedreht
  const a = Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
  const m = mask(100, 100, (x, y) => {
    const u = (x - 50) * c + (y - 50) * s, v = -(x - 50) * s + (y - 50) * c;
    return Math.abs(u) <= 20 && Math.abs(v) <= 10;
  });
  const [comp] = components(m);
  const box = minAreaRect(hull(comp));
  const sides = [Math.hypot(box[1][0] - box[0][0], box[1][1] - box[0][1]), Math.hypot(box[2][0] - box[1][0], box[2][1] - box[1][1])].sort((p, q) => p - q);
  assert.ok(Math.abs(sides[0] - 20) < 2 && Math.abs(sides[1] - 40) < 2, `Seiten ${sides}`);
});

test('Douglas-Peucker macht aus der Hülle eines Vierecks vier Ecken', () => {
  const m = mask(120, 120, (x, y) => y >= 20 && y <= 100 && x >= 20 + (y - 20) * 0.2 && x <= 100);
  const quad = approxPoly(hull(components(m)[0]), 0.02 * 300);
  assert.equal(quad.length, 4);
  assert.deepEqual(orderCorners(quad).map(([x, y]) => [Math.round(x), Math.round(y)]), [[20, 20], [100, 20], [100, 100], [36, 100]]);
});

test('Schließen füllt kleine Lücken, Flächen zählen getrennt', () => {
  const m = close(mask(60, 20, (x) => (x >= 5 && x <= 20 && x !== 12) || (x >= 40 && x <= 50)), 3, 3);
  assert.equal(components(m).length, 2);
});

test('HSV-Bereich wie OpenCV: Grün ja, Grau nein', () => {
  const img: Rgb = { w: 2, h: 1, data: new Uint8Array([40, 160, 60, 128, 128, 128]) };
  assert.deepEqual([...hsvRange(img, [40, 80, 60], [90, 255, 255]).data], [1, 0]);
});

test('Perspektive bildet die Ecken exakt ab; Entzerrung trifft das Viereck', () => {
  const src: Pt[] = [[10, 12], [90, 8], [95, 70], [5, 80]], dst: Pt[] = [[0, 0], [100, 0], [100, 50], [0, 50]];
  const m = perspective(src, dst);
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], d = m[6] * x + m[7] * y + m[8];
    assert.ok(Math.abs((m[0] * x + m[1] * y + m[2]) / d - dst[i][0]) < 1e-6);
    assert.ok(Math.abs((m[3] * x + m[4] * y + m[5]) / d - dst[i][1]) < 1e-6);
  }
  // weißes Viereck auf Schwarz: entzerrt ist das Ergebnis fast vollständig weiß
  const w = 100, h = 90, data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pointInQuad([x, y], src)) data.fill(255, (y * w + x) * 3, (y * w + x) * 3 + 3);
  const out = warpQuad({ w, h, data }, src, 40, 40);
  const white = out.data.filter((v) => v > 200).length / out.data.length;
  assert.ok(white > 0.9, `weiß ${white}`);
});

function pointInQuad([x, y]: Pt, q: Pt[]) {
  return q.every((a, i) => {
    const b = q[(i + 1) % 4];
    return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) >= 0;
  });
}
