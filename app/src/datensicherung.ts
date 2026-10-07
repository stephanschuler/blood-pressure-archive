// Dateien über die Dialoge von Android: Ordner zum Speichern, Datei zum Einspielen, Teilen-Blatt; PDF über den Druckdienst.
import { Directory, File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';

const p2 = (n: number) => String(n).padStart(2, '0');

export const dateiname = (endung: string, d = new Date()) =>
  `blutdruck-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.${endung}`;

/** false, wenn der Nutzer die Ordnerwahl abbricht. */
export async function inOrdnerSpeichern(name: string, mime: string, inhalt: string | Uint8Array): Promise<boolean> {
  let ordner: Directory;
  try {
    ordner = await Directory.pickDirectoryAsync(); // wirft auch beim Abbruch
  } catch {
    return false;
  }
  ordner.createFile(name, mime).write(inhalt);
  return true;
}

/** Inhalt der gewählten Datei; null, wenn der Nutzer abbricht. */
export async function dateiOeffnen(): Promise<Uint8Array | null> {
  const { result } = await File.pickFileAsync({});
  return result ? result.bytes() : null;
}

/** Teilen-Blatt von Android, etwa „In Drive speichern“. */
export async function teilen(name: string, mime: string, inhalt: string | Uint8Array) {
  const datei = new File(Paths.cache, name);
  datei.create({ overwrite: true });
  datei.write(inhalt);
  await shareAsync(datei.uri, { mimeType: mime, dialogTitle: name });
}

/** HTML als PDF in A4; die Druckdatei im Cache wird gleich wieder gelöscht. */
export async function pdf(html: string): Promise<Uint8Array> {
  const { uri } = await printToFileAsync({ html, width: 595, height: 842 }); // 72 Pixel je Zoll
  const datei = new File(uri);
  try {
    return await datei.bytes();
  } finally {
    datei.delete();
  }
}
