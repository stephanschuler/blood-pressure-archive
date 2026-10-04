// Dateien über die Dialoge von Android: Ordner zum Speichern, Datei zum Einspielen.
import { Directory, File } from 'expo-file-system';

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
