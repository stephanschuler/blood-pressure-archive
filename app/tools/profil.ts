/// <reference types="node" />
// Zeit je Schritt der Erkennung für ein Foto.
import { readFileSync } from 'node:fs';
import { viaButton, viaEdges } from '../src/erkennung/display';
import { canny, components, decodeJpeg, dilate3, gaussianBlur, grayscale, invert } from '../src/erkennung/image';

const img = decodeJpeg(readFileSync(process.argv[2]));
const t = (label: string, f: () => unknown) => { const s = Date.now(); const r = f(); console.log(label.padEnd(28), Date.now() - s, 'ms'); return r; };
t('viaButton', () => viaButton(img));
t('viaEdges gesamt', () => viaEdges(img));
const g = t('grau + blur', () => gaussianBlur(grayscale(img), 5, 0, true)) as ReturnType<typeof grayscale>;
const e = t('canny (3 Schwellen) + dilate', () => dilate3(canny(g, [[20, 60], [40, 120], [80, 200]])[0])) as ReturnType<typeof dilate3>;
t('components Kanten', () => components(e).length);
t('components Löcher', () => components(invert(e), false).length);
const n = 5, s = Date.now();
for (let i = 0; i < n; i++) { viaButton(img); viaEdges(img); }
console.log('Mittel über 5 Läufe'.padEnd(28), Math.round((Date.now() - s) / n), 'ms');
