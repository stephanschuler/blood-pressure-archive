// Schema und Abfragen, unabhängig vom SQLite-Treiber: in der App expo-sqlite, in Tests node:sqlite.
import { gruppieren, type Messpunkt, type Messung } from './messung';

type Param = string | number | null;

/** Die Teilmenge der synchronen API von expo-sqlite (SQLiteDatabase), die hier gebraucht wird. */
export interface Sql {
  execSync(source: string): void;
  runSync(source: string, ...params: Param[]): unknown;
  getFirstSync<T>(source: string, ...params: Param[]): T | null;
  getAllSync<T>(source: string, ...params: Param[]): T[];
  withTransactionSync(task: () => void): void;
}

// Schema-Version in PRAGMA user_version; jede Migration hebt sie um eins. Nie ändern, nur anhängen:
// auf dem Handy liegt eine Datenbank mit dem Stand der zuletzt installierten App.
export const MIGRATIONS = [
  `CREATE TABLE messpunkt (
     id INTEGER PRIMARY KEY,
     zeit TEXT NOT NULL,      -- ISO 8601, UTC
     sys INTEGER NOT NULL,
     dia INTEGER NOT NULL,
     puls INTEGER NOT NULL,
     arm TEXT CHECK (arm IN ('links', 'rechts'))
   )`,
  'ALTER TABLE messpunkt DROP COLUMN arm',
  'CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
];

export function migrate(db: Sql, upTo = MIGRATIONS.length) {
  const { user_version } = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')!;
  for (let v = user_version; v < upTo; v++) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[v]);
      db.execSync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

const SAME = 'zeit = ? AND sys = ? AND dia = ? AND puls = ?';

/** Legt nichts an, wenn derselbe Messpunkt schon existiert: ein Foto lässt sich mehrfach importieren. */
export function insertMesspunkt(db: Sql, p: Omit<Messpunkt, 'id'>) {
  db.runSync(
    `INSERT INTO messpunkt (zeit, sys, dia, puls) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM messpunkt WHERE ${SAME})`,
    p.zeit, p.sys, p.dia, p.puls, p.zeit, p.sys, p.dia, p.puls,
  );
}

export function hasMesspunkt(db: Sql, p: Omit<Messpunkt, 'id'>): boolean {
  return db.getFirstSync(`SELECT 1 FROM messpunkt WHERE ${SAME}`, p.zeit, p.sys, p.dia, p.puls) !== null;
}

export function deleteMesspunkt(db: Sql, id: number) {
  db.runSync('DELETE FROM messpunkt WHERE id = ?', id);
}

/** Messungen, neueste zuerst. */
export function listMessungen(db: Sql): Messung[] {
  return gruppieren(db.getAllSync<Messpunkt>('SELECT * FROM messpunkt ORDER BY zeit'));
}

export function getSetting(db: Sql, key: string): string | null {
  return db.getFirstSync<{ value: string }>('SELECT value FROM setting WHERE key = ?', key)?.value ?? null;
}

export function setSetting(db: Sql, key: string, value: string) {
  db.runSync('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', key, value);
}
