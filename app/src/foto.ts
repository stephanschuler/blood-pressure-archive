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

export type Foto = {
  uri: string;
  zeit: Date;
  zeitAngenommen: boolean; // Zeitpunkt unbekannt, „jetzt" angenommen
  temporaer: boolean; // aus der Kamera: nach dem Auswerten löschen
};

// angenommen: abgeholt erst nach Prozessende, „jetzt" ist dann der Neustart
const ausKamera = (a: ImagePicker.ImagePickerAsset, angenommen = false): Foto => ({ uri: a.uri, zeit: new Date(), zeitAngenommen: angenommen, temporaer: true });

function ausGalerie(a: ImagePicker.ImagePickerAsset): Foto {
  const t = exifTime(a.exif);
  return { uri: a.uri, zeit: t ?? new Date(), zeitAngenommen: t === null, temporaer: false };
}

export async function takePhoto(): Promise<Foto[]> {
  if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) return [];
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  return r.canceled ? [] : r.assets.map((a) => ausKamera(a));
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
  return r.assets.map((a) => (a.exif ? ausGalerie(a) : ausKamera(a, true)));
}

// nacheinander: das Original liegt beim Verkleinern in voller Größe im Speicher
let verkleinert: Promise<unknown> = Promise.resolve();

async function verkleinern(foto: Foto): Promise<Uint8Array> {
  const full = await ImageManipulator.manipulate(foto.uri).renderAsync();
  const size = full.width >= full.height ? { width: 1200 } : { height: 1200 };
  const small = await ImageManipulator.manipulate(full).resize(size).renderAsync();
  const saved = await small.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.92 });
  new File(saved.uri).delete();
  const bin = atob(saved.base64!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Foto verkleinern (lange Seite 1200 px, EXIF-Drehung angewendet) und Messwerte lesen. Höchstens
 * RUNTIMES Fotos zugleich, in Reihenfolge der Aufrufe.
 */
export async function recognize(foto: Foto): Promise<Reading> {
  const runtime = await belegen();
  try {
    const p = verkleinert.then(() => verkleinern(foto));
    verkleinert = p.catch(() => {});
    return await runOnRuntimeAsync(runtime, (b: Uint8Array) => {
      'worklet';
      return readValues(decodeJpeg(b));
    }, await p);
  } finally {
    freigeben(runtime);
  }
}
export function discard(foto: Foto) {
  if (foto.temporaer) {
    const f = new File(foto.uri);
    if (f.exists) f.delete();
  }
}
