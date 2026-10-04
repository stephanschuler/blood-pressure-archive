/// <reference types="node" />
// node:sqlite mit der Schnittstelle, die src/datenbank.ts von expo-sqlite erwartet.
import { DatabaseSync } from 'node:sqlite';

import type { Sql } from '../src/datenbank';

export function memoryDb(): Sql {
  const d = new DatabaseSync(':memory:');
  return {
    execSync: (s) => { d.exec(s); },
    runSync: (s, ...p) => d.prepare(s).run(...p),
    getFirstSync: <T>(s: string, ...p: (string | number | null)[]) => (d.prepare(s).get(...p) as T | undefined) ?? null,
    getAllSync: <T>(s: string, ...p: (string | number | null)[]) => d.prepare(s).all(...p) as T[],
    withTransactionSync: (task) => {
      d.exec('BEGIN');
      try { task(); d.exec('COMMIT'); } catch (e) { d.exec('ROLLBACK'); throw e; }
    },
  };
}
