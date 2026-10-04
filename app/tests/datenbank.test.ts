import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MIGRATIONS, deleteMesspunkt, getSetting, insertMesspunkt, listMessungen, migrate, setSetting } from '../src/datenbank';
import { memoryDb } from './sqlite';

const version = (db: ReturnType<typeof memoryDb>) => db.getFirstSync<{ user_version: number }>('PRAGMA user_version')!.user_version;

test('frische Datenbank: alle Migrationen, Messpunkte speichern, gruppieren, löschen', () => {
  const db = memoryDb();
  migrate(db);
  assert.equal(version(db), MIGRATIONS.length);
  insertMesspunkt(db, { zeit: '2026-01-01T07:00:00.000Z', sys: 130, dia: 85, puls: 60 });
  insertMesspunkt(db, { zeit: '2026-01-01T07:03:00.000Z', sys: 126, dia: 83, puls: 64 });
  insertMesspunkt(db, { zeit: '2026-01-01T19:00:00.000Z', sys: 120, dia: 80, puls: 58 });
  const [abend, morgen] = listMessungen(db);
  assert.equal(morgen.punkte.length, 2);
  assert.equal(abend.punkte.length, 1);
  deleteMesspunkt(db, morgen.punkte[0].id);
  assert.deepEqual(listMessungen(db).map((m) => m.punkte.length), [1, 1]);
});

test('Datenbank im Stand der ersten App-Version wird ohne Verlust migriert', () => {
  const db = memoryDb();
  migrate(db, 1);
  db.runSync("INSERT INTO messpunkt (zeit, sys, dia, puls, arm) VALUES ('2026-01-01T07:00:00.000Z', 130, 85, 60, 'links')");
  migrate(db);
  assert.equal(version(db), MIGRATIONS.length);
  const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(messpunkt)').map((c) => c.name);
  assert.deepEqual(columns, ['id', 'zeit', 'sys', 'dia', 'puls']);
  assert.deepEqual(listMessungen(db)[0].punkte.map(({ sys, dia, puls }) => [sys, dia, puls]), [[130, 85, 60]]);
});

test('migrate ist wiederholbar', () => {
  const db = memoryDb();
  migrate(db);
  migrate(db);
  assert.equal(version(db), MIGRATIONS.length);
});

test('Einstellungen: fehlend, setzen, überschreiben', () => {
  const db = memoryDb();
  migrate(db);
  assert.equal(getSetting(db, 'theme'), null);
  setSetting(db, 'theme', 'dark');
  setSetting(db, 'theme', 'light');
  assert.equal(getSetting(db, 'theme'), 'light');
});
