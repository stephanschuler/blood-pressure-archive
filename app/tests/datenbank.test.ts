import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MIGRATIONS, deleteMesspunkt, einspielen, getSetting, hasMesspunkt, insertMesspunkt, listMessungen, migrate, setSetting, updateMesspunkt, zaehlen } from '../src/datenbank';
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

test('derselbe Messpunkt wird nur einmal gespeichert', () => {
  const db = memoryDb();
  migrate(db);
  const p = { zeit: '2026-01-01T07:00:00.000Z', sys: 130, dia: 85, puls: 60 };
  assert.equal(hasMesspunkt(db, p), false);
  insertMesspunkt(db, p);
  insertMesspunkt(db, p);
  insertMesspunkt(db, { ...p, puls: 61 });
  assert.equal(hasMesspunkt(db, p), true);
  assert.equal(hasMesspunkt(db, { ...p, zeit: '2026-01-01T07:00:01.000Z' }), false);
  assert.deepEqual(listMessungen(db)[0].punkte.map((x) => x.puls), [60, 61]);
});

test('Messpunkt bearbeiten: Werte ändern sich, Zeit bleibt; gleicht er einem anderen, bleibt einer', () => {
  const db = memoryDb();
  migrate(db);
  const zeit = '2026-01-01T07:00:00.000Z';
  insertMesspunkt(db, { zeit, sys: 130, dia: 85, puls: 60 });
  insertMesspunkt(db, { zeit, sys: 180, dia: 85, puls: 60 });
  const [a, b] = listMessungen(db)[0].punkte;
  updateMesspunkt(db, b.id, { sys: 131, dia: 86, puls: 61 });
  assert.deepEqual(listMessungen(db)[0].punkte.map((p) => [p.zeit, p.sys, p.dia, p.puls]), [[zeit, 130, 85, 60], [zeit, 131, 86, 61]]);
  updateMesspunkt(db, b.id, { sys: a.sys, dia: a.dia, puls: a.puls });
  assert.equal(zaehlen(db), 1);
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

test('Doppelte aus älteren Ständen: Migration behält den ersten, danach verhindert der Index neue', () => {
  const db = memoryDb();
  migrate(db, 3);
  const zeile = "('2026-01-01T07:00:00.000Z', 130, 85, 60)";
  db.runSync(`INSERT INTO messpunkt (zeit, sys, dia, puls) VALUES ${zeile}, ${zeile}, ('2026-01-01T07:03:00.000Z', 126, 83, 64)`);
  migrate(db);
  assert.equal(zaehlen(db), 2);
  assert.throws(() => db.runSync(`INSERT INTO messpunkt (zeit, sys, dia, puls) VALUES ${zeile}`));
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

test('Datensicherung einspielen: ergänzt, überspringt Doppelte und ungültige Werte', () => {
  const p = { zeit: '2026-01-01T07:00:00.000Z', sys: 130, dia: 85, puls: 60 };
  const ziel = memoryDb();
  migrate(ziel);
  insertMesspunkt(ziel, p);
  const quelle = memoryDb();
  migrate(quelle);
  insertMesspunkt(quelle, p);
  insertMesspunkt(quelle, { ...p, zeit: '2026-01-02T07:00:00.000Z' });
  quelle.runSync("INSERT INTO messpunkt (zeit, sys, dia, puls) VALUES ('kaputt', 1, 2, 3), ('2026-01-03T07:00:00.000Z', 'x', 2, 3)");
  assert.deepEqual(einspielen(ziel, quelle), { gelesen: 2, neu: 1 });
  assert.equal(zaehlen(ziel), 2);
});

test('Datensicherung im Stand der ersten App-Version wird migriert und eingespielt', () => {
  const quelle = memoryDb();
  migrate(quelle, 1);
  quelle.runSync("INSERT INTO messpunkt (zeit, sys, dia, puls, arm) VALUES ('2026-01-01T07:00:00.000Z', 130, 85, 60, 'links')");
  const ziel = memoryDb();
  migrate(ziel);
  assert.deepEqual(einspielen(ziel, quelle), { gelesen: 1, neu: 1 });
});

test('Sicherung einer neueren App-Version oder fremde Datenbank: nichts übernommen', () => {
  const ziel = memoryDb();
  migrate(ziel);
  const neuer = memoryDb();
  migrate(neuer);
  neuer.execSync(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
  assert.equal(einspielen(ziel, neuer), 'zu neu');
  const fremd = memoryDb();
  fremd.execSync('CREATE TABLE rezept (name TEXT)');
  assert.throws(() => einspielen(ziel, fremd));
  assert.equal(zaehlen(ziel), 0);
});
