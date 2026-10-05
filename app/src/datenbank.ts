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
  // ältere Stände konnten Doppelte enthalten; ohne Aufräumen scheitert der Index beim Start
  `DELETE FROM messpunkt WHERE id NOT IN (SELECT MIN(id) FROM messpunkt GROUP BY zeit, sys, dia, puls);
   CREATE UNIQUE INDEX messpunkt_eindeutig ON messpunkt (zeit, sys, dia, puls)`,
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

/** Legt nichts an, wenn derselbe Messpunkt schon existiert: ein Foto lässt sich mehrfach importieren. */
export function insertMesspunkt(db: Sql, p: Omit<Messpunkt, 'id'>) {
  db.runSync('INSERT OR IGNORE INTO messpunkt (zeit, sys, dia, puls) VALUES (?, ?, ?, ?)', p.zeit, p.sys, p.dia, p.puls);
}

export function hasMesspunkt(db: Sql, p: Omit<Messpunkt, 'id'>): boolean {
  return db.getFirstSync('SELECT 1 FROM messpunkt WHERE zeit = ? AND sys = ? AND dia = ? AND puls = ?', p.zeit, p.sys, p.dia, p.puls) !== null;
}

/** Gleicht er danach einem anderen Messpunkt derselben Zeit, bleibt nur einer. */
export function updateMesspunkt(db: Sql, id: number, w: Pick<Messpunkt, 'sys' | 'dia' | 'puls'>) {
  db.runSync('UPDATE OR REPLACE messpunkt SET sys = ?, dia = ?, puls = ? WHERE id = ?', w.sys, w.dia, w.puls, id);
}

export function deleteMesspunkt(db: Sql, id: number) {
  db.runSync('DELETE FROM messpunkt WHERE id = ?', id);
}

export function zaehlen(db: Sql): number {
  return db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM messpunkt')!.n;
}

const gueltig = (p: Omit<Messpunkt, 'id'>) =>
  typeof p.zeit === 'string' && !Number.isNaN(Date.parse(p.zeit)) && [p.sys, p.dia, p.puls].every(Number.isInteger);

/**
 * Ergänzt die Messpunkte einer Datensicherung; Doppelte überspringt insertMesspunkt.
 * 'zu neu': Sicherung einer neueren App-Version. Wirft bei einer fremden Datenbank.
 */
export function einspielen(ziel: Sql, quelle: Sql): { gelesen: number; neu: number } | 'zu neu' {
  const { user_version } = quelle.getFirstSync<{ user_version: number }>('PRAGMA user_version')!;
  if (user_version > MIGRATIONS.length) return 'zu neu';
  if (user_version < 1) throw new Error('not a backup of this app');
  migrate(quelle);
  const punkte = quelle.getAllSync<Omit<Messpunkt, 'id'>>('SELECT zeit, sys, dia, puls FROM messpunkt').filter(gueltig);
  const vorher = zaehlen(ziel);
  ziel.withTransactionSync(() => punkte.forEach((p) => insertMesspunkt(ziel, p)));
  return { gelesen: punkte.length, neu: zaehlen(ziel) - vorher };
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
