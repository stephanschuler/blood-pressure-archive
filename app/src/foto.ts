import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { decodeJpeg } from './erkennung/image';
import { readValues, type Reading } from './erkennung/messwerte';
import { exifTime } from './exif';

export type Foto = {
  uri: string;
  zeit: Date;
  zeitAusExif: boolean; // false: Zeitpunkt unbekannt, „jetzt" angenommen
  temporaer: boolean; // aus der Kamera: nach dem Auswerten löschen
};

export async function takePhoto(): Promise<Foto[]> {
  if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) return [];
  const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (r.canceled) return [];
  return r.assets.map((a) => ({ uri: a.uri, zeit: new Date(), zeitAusExif: false, temporaer: true }));
}

export async function importPhotos(): Promise<Foto[]> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, exif: true });
  if (r.canceled) return [];
  return r.assets.map((a) => {
    const t = exifTime(a.exif);
    return { uri: a.uri, zeit: t ?? new Date(), zeitAusExif: t !== null, temporaer: false };
  });
}

/** Foto verkleinern (lange Seite 1200 px, EXIF-Drehung angewendet) und Messwerte lesen. */
export async function recognize(foto: Foto): Promise<Reading> {
  const full = await ImageManipulator.manipulate(foto.uri).renderAsync();
  const size = full.width >= full.height ? { width: 1200 } : { height: 1200 };
  const small = await ImageManipulator.manipulate(full).resize(size).renderAsync();
  const saved = await small.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.92 });
  new File(saved.uri).delete();
  const bin = atob(saved.base64!);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return readValues(decodeJpeg(bytes));
}

export function discard(foto: Foto) {
  if (foto.temporaer) {
    const f = new File(foto.uri);
    if (f.exists) f.delete();
  }
}
