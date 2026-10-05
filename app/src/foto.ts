import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { createWorkletRuntime, runOnRuntimeAsync, type WorkletRuntime } from 'react-native-worklets';

import { decodeJpeg } from './erkennung/image';
import { readValues, type Reading } from './erkennung/messwerte';
import { exifTime } from './exif';

// Je Runtime ein eigener Thread: die Erkennung blockiert sonst den JS-Thread und damit die
// Oberfläche. Das S22 hat 1 großen, 3 mittlere und 4 kleine Kerne; Stellschraube für den Durchsatz.
const RUNTIMES = 3;
const frei: WorkletRuntime[] = [];
const wartend: ((r: WorkletRuntime) => void)[] = [];
let angelegt = 0;

function belegen(): WorkletRuntime | Promise<WorkletRuntime> {
  if (frei.length) return frei.pop()!;
  if (angelegt < RUNTIMES) return createWorkletRuntime(`erkennung${angelegt++}`);
  return new Promise((r) => wartend.push(r));
}

function freigeben(r: WorkletRuntime) {
  const w = wartend.shift();
  if (w) w(r);
  else frei.push(r);
}

// Summen in ms seit App-Start; ermittelt, wo die Zeit je Foto auf dem Handy bleibt.
// beschaeftigt: Zeit, in der mindestens ein Foto in Arbeit war; geteilt durch fotos der Durchsatz.
const zeiten = { fotos: 0, verkleinern: 0, umweg: 0, dekodieren: 0, lesen: 0, gesamt: 0, beschaeftigt: 0 };
let inArbeit = 0, seit = 0;

export function messzeit(): string | null {
  const { fotos, ...summen } = zeiten;
  if (!fotos) return null;
  const s = (ms: number) => `${(ms / fotos / 1000).toFixed(2).replace('.', ',')} s`;
  return [
    `Erkennung, Ø aus ${fotos} Fotos`,
    `Verkleinern ${s(summen.verkleinern)}`,
    `JPEG-Umweg ${s(summen.umweg)}`,
    `Dekodieren ${s(summen.dekodieren)}`,
    `Lesen ${s(summen.lesen)}`,
    `Gesamt ${s(summen.gesamt)}`,
    `Durchsatz ${s(summen.beschaeftigt)} je Foto (${RUNTIMES} parallel)`,
  ].join('\n');
}

export type Foto = {
  uri: string;
  zeit: Date;
  zeitAusExif: boolean; // false: Zeitpunkt unbekannt, „jetzt" angenommen
  temporaer: boolean; // aus der Kamera: nach dem Auswerten löschen
};

const ausKamera = (a: ImagePicker.ImagePickerAsset): Foto => ({ uri: a.uri, zeit: new Date(), zeitAusExif: false, temporaer: true });

function ausGalerie(a: ImagePicker.ImagePickerAsset): Foto {
  const t = exifTime(a.exif);
  return { uri: a.uri, zeit: t ?? new Date(), zeitAusExif: t !== null, temporaer: false };
}

export async function takePhoto(): Promise<Foto[]> {
  if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) return [];
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  return r.canceled ? [] : r.assets.map(ausKamera);
}

export async function importPhotos(): Promise<Foto[]> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, exif: true });
  return r.canceled ? [] : r.assets.map(ausGalerie);
}

/** Fotos aus Kamera oder Galerie, während deren Android die App beendet hatte; sonst leer. */
export async function pendingPhotos(): Promise<Foto[]> {
  const r = await ImagePicker.getPendingResultAsync();
  if (!r || 'code' in r || r.canceled) return [];
  // EXIF verlangt nur der Galerieaufruf, auch ein Foto ohne EXIF bringt dort ein Objekt mit
  return r.assets.map((a) => (a.exif ? ausGalerie(a) : ausKamera(a)));
}

// nacheinander: das Original liegt beim Verkleinern in voller Größe im Speicher
let verkleinert: Promise<unknown> = Promise.resolve();

async function verkleinern(foto: Foto): Promise<Uint8Array> {
  const t0 = Date.now();
  const full = await ImageManipulator.manipulate(foto.uri).renderAsync();
  const size = full.width >= full.height ? { width: 1200 } : { height: 1200 };
  const small = await ImageManipulator.manipulate(full).resize(size).renderAsync();
  const t1 = Date.now();
  const saved = await small.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.92 });
  new File(saved.uri).delete();
  const bin = atob(saved.base64!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  zeiten.verkleinern += t1 - t0;
  zeiten.umweg += Date.now() - t1;
  return bytes;
}

/**
 * Foto verkleinern (lange Seite 1200 px, EXIF-Drehung angewendet) und Messwerte lesen. Höchstens
 * RUNTIMES Fotos zugleich, in Reihenfolge der Aufrufe.
 */
export async function recognize(foto: Foto): Promise<Reading> {
  const runtime = await belegen();
  const t0 = Date.now();
  if (!inArbeit++) seit = t0;
  try {
    const p = verkleinert.then(() => verkleinern(foto));
    verkleinert = p.catch(() => {});
    const r = await runOnRuntimeAsync(runtime, (b: Uint8Array) => {
      'worklet';
      const a = Date.now();
      const img = decodeJpeg(b);
      const m = Date.now();
      return { reading: readValues(img), dekodieren: m - a, lesen: Date.now() - m };
    }, await p);
    zeiten.fotos++;
    zeiten.dekodieren += r.dekodieren;
    zeiten.lesen += r.lesen;
    zeiten.gesamt += Date.now() - t0;
    return r.reading;
  } finally {
    if (!--inArbeit) zeiten.beschaeftigt += Date.now() - seit;
    freigeben(runtime);
  }
}
export function discard(foto: Foto) {
  if (foto.temporaer) {
    const f = new File(foto.uri);
    if (f.exists) f.delete();
  }
}
