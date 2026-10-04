import { deserializeDatabaseSync, openDatabaseSync } from 'expo-sqlite';

import * as d from './datenbank';
import type { Messpunkt } from './messung';

export type { Messung } from './messung';

const db = openDatabaseSync('blutdruck.db');

export const migrate = () => d.migrate(db);
export const insertMesspunkt = (p: Omit<Messpunkt, 'id'>) => d.insertMesspunkt(db, p);
export const hasMesspunkt = (p: Omit<Messpunkt, 'id'>) => d.hasMesspunkt(db, p);
export const deleteMesspunkt = (id: number) => d.deleteMesspunkt(db, id);
export const listMessungen = () => d.listMessungen(db);
export const getSetting = (key: string) => d.getSetting(db, key);
export const setSetting = (key: string, value: string) => d.setSetting(db, key, value);
export const zaehlen = () => d.zaehlen(db);
export const sichern = () => db.serializeSync();

/** Siehe einspielen() in datenbank.ts; die Sicherung liegt dabei nur im Speicher. */
export function einspielen(bytes: Uint8Array) {
  const quelle = deserializeDatabaseSync(bytes);
  try {
    return d.einspielen(db, quelle);
  } finally {
    quelle.closeSync();
  }
}
