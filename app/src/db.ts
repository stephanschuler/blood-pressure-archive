import { openDatabaseSync } from 'expo-sqlite';

import { gruppieren, type Messpunkt, type Messung } from './messung';

export type { Messung } from './messung';

const db = openDatabaseSync('blutdruck.db');

// Schema-Version in PRAGMA user_version; jede Migration hebt sie um eins
const MIGRATIONS = [
  `CREATE TABLE messpunkt (
     id INTEGER PRIMARY KEY,
     zeit TEXT NOT NULL,      -- ISO 8601, UTC
     sys INTEGER NOT NULL,
     dia INTEGER NOT NULL,
     puls INTEGER NOT NULL,
     arm TEXT CHECK (arm IN ('links', 'rechts'))
   )`,
  'ALTER TABLE messpunkt DROP COLUMN arm',
];

export function migrate() {
  const { user_version } = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')!;
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[v]);
      db.execSync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export function insertMesspunkt(p: Omit<Messpunkt, 'id'>) {
  db.runSync('INSERT INTO messpunkt (zeit, sys, dia, puls) VALUES (?, ?, ?, ?)', p.zeit, p.sys, p.dia, p.puls);
}

/** Messungen, neueste zuerst. */
export function listMessungen(): Messung[] {
  return gruppieren(db.getAllSync<Messpunkt>('SELECT * FROM messpunkt ORDER BY zeit'));
}
