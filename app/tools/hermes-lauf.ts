// Erkennung unter Hermes messen, wie sie auf dem Handy läuft. Fotos kommen als base64 in
// globalThis.FOTOS (Hermes hat kein Dateisystem); ausgegeben werden nur Summen.
import { decodeJpeg } from '../src/erkennung/image';
import { readValues } from '../src/erkennung/messwerte';

declare const FOTOS: string[];
declare const print: ((...a: unknown[]) => void) | undefined;
const out = typeof print === 'function' ? print : console.log;

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const v = (c: string) => Math.max(0, ABC.indexOf(c)); // '=' zählt als 0
function bytes(b64: string): Uint8Array {
  const r = new Uint8Array(Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0));
  for (let i = 0, j = 0; i < b64.length; i += 4) {
    const n = (v(b64[i]) << 18) | (v(b64[i + 1]) << 12) | (v(b64[i + 2]) << 6) | v(b64[i + 3]);
    for (const k of [16, 8, 0]) if (j < r.length) r[j++] = (n >> k) & 255;
  }
  return r;
}

let dekodieren = 0, lesen = 0, gelesen = 0;
for (const f of FOTOS) {
  const b = bytes(f);
  const t0 = Date.now();
  const img = decodeJpeg(b);
  const t1 = Date.now();
  if (readValues(img).values[0] !== null) gelesen++;
  lesen += Date.now() - t1;
  dekodieren += t1 - t0;
}
const s = (ms: number) => (ms / FOTOS.length / 1000).toFixed(2);
out(`Fotos ${FOTOS.length}, gelesen ${gelesen}; je Foto: Dekodieren ${s(dekodieren)} s, Lesen ${s(lesen)} s`);
