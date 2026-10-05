/// <reference types="jest" />
// Oberfläche mit echter SQLite-Datenbank (node:sqlite); Kamera, Bildauswahl und Erkennung sind Attrappen.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Appearance, BackHandler, SectionList } from 'react-native';

import type { Reading } from '../src/erkennung/messwerte';
import type { Foto } from '../src/foto';

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Directory, File } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

import App from '../App';
import * as datenbank from '../src/datenbank';
import * as db from '../src/db';
import * as fotoModule from '../src/foto';
import { memoryDb } from '../tests/sqlite';

// db.ts öffnet die Datenbank einmal beim Laden; die Attrappe leitet an die Datenbank des laufenden Tests weiter
declare global { var testDb: ReturnType<typeof memoryDb>; var sicherung: ReturnType<typeof memoryDb> & { closeSync: jest.Mock }; }
jest.mock('expo-sqlite', () => ({
  deserializeDatabaseSync: () => globalThis.sicherung,
  openDatabaseSync: () => new Proxy({}, {
    // App.tsx migriert schon beim Laden, vor beforeEach: dann erste Datenbank hier anlegen
    get: (_, k: string) => (...a: unknown[]) => ((globalThis.testDb ??= require('../tests/sqlite').memoryDb()) as any)[k](...a),
  }),
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/foto', () => ({ takePhoto: jest.fn(), importPhotos: jest.fn(), pendingPhotos: jest.fn(), recognize: jest.fn(), discard: jest.fn(), messzeit: () => null }));
jest.mock('expo-file-system', () => ({
  Directory: { pickDirectoryAsync: jest.fn() },
  File: Object.assign(jest.fn(() => ({ uri: 'file:///cache/datei', create: jest.fn(), write: jest.fn() })), { pickFileAsync: jest.fn() }),
  Paths: { cache: 'cache' },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: jest.fn() } }));

const foto = fotoModule as jest.Mocked<typeof fotoModule>;
const FOTO: Foto = { uri: 'file:///cache/foto.jpg', zeit: new Date('2026-01-01T07:00:00Z'), zeitAusExif: false, temporaer: true };

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  globalThis.testDb = memoryDb();
  db.migrate();
  foto.pendingPhotos.mockResolvedValue([]);
});

test('beim Start liegengebliebene Aufnahme: gleich zur Bestätigung', async () => {
  foto.pendingPhotos.mockResolvedValue([FOTO]);
  foto.recognize.mockResolvedValue({ values: [128, 85, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  expect(await screen.findByDisplayValue('128')).toBeOnTheScreen();
  expect(screen.getByText('Foto 1 von 1')).toBeOnTheScreen();
});

test('leerer Start: Hinweis und Knöpfe', async () => {
  await render(<App />);
  expect(screen.getByText('Noch keine Messungen.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Foto aufnehmen')).toBeOnTheScreen();
  expect(screen.getByLabelText('Fotos importieren')).toBeOnTheScreen();
  expect(screen.getByLabelText('Menü')).toBeOnTheScreen();
});

test('Foto aufnehmen, unsicheres Feld markiert, speichern, Messung in der Liste', async () => {
  foto.takePhoto.mockResolvedValue([FOTO]);
  foto.recognize.mockResolvedValue({ values: [128, 85, 64], uncertain: [false, false, true] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Foto aufnehmen'));
  const puls = await screen.findByDisplayValue('64');
  expect(puls).toHaveStyle({ backgroundColor: '#fff3b0' });
  expect(screen.getByDisplayValue('128')).not.toHaveStyle({ backgroundColor: '#fff3b0' });
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(await screen.findByText('1 Pkt.')).toBeOnTheScreen();
  expect(screen.getAllByText('128').length).toBeGreaterThan(0);
  expect(foto.discard).toHaveBeenCalledWith(FOTO);
});

test('Speichern erst, wenn alle Felder gefüllt sind', async () => {
  foto.takePhoto.mockResolvedValue([FOTO]);
  foto.recognize.mockResolvedValue({ values: [128, null, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Foto aufnehmen'));
  await screen.findByDisplayValue('128');
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(db.listMessungen()).toEqual([]);
  await fireEvent.changeText(screen.getByDisplayValue(''), '85');
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(db.listMessungen().map((m) => [m.sys, m.dia, m.puls])).toEqual([[128, 85, 64]]);
});

test('Tastatur öffnet im ersten unsicheren Feld, bei sicheren Werten gar nicht', async () => {
  foto.importPhotos.mockResolvedValue([FOTO, { ...FOTO, uri: 'file:///cache/zwei.jpg' }]);
  foto.recognize
    .mockResolvedValueOnce({ values: [128, 85, 64], uncertain: [false, true, true] } as Reading)
    .mockResolvedValueOnce({ values: [131, 85, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Fotos importieren'));
  await screen.findByDisplayValue('128');
  expect(['SYS', 'DIA', 'PUL'].map((l) => screen.getByLabelText(l).props.autoFocus)).toEqual([false, true, false]);
  await fireEvent.press(screen.getByLabelText('Speichern'));
  await screen.findByDisplayValue('131');
  expect(['SYS', 'DIA', 'PUL'].map((l) => screen.getByLabelText(l).props.autoFocus)).toEqual([false, false, false]);
});

test('Weiter im letzten Feld speichert, solange kein Feld ungültig ist', async () => {
  foto.takePhoto.mockResolvedValue([FOTO]);
  foto.recognize.mockResolvedValue({ values: [128, null, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Foto aufnehmen'));
  await screen.findByDisplayValue('128');
  await fireEvent(screen.getByLabelText('PUL'), 'submitEditing');
  expect(db.listMessungen()).toEqual([]);
  await fireEvent.changeText(screen.getByLabelText('DIA'), '85');
  await fireEvent(screen.getByLabelText('DIA'), 'submitEditing');
  expect(db.listMessungen().map((m) => [m.sys, m.dia, m.puls])).toEqual([[128, 85, 64]]);
});

test('Messpunkt lange drücken, Rückfrage bestätigen: gelöscht', async () => {
  db.insertMesspunkt({ zeit: '2026-01-01T07:00:00.000Z', sys: 130, dia: 85, puls: 60 });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<App />);
  await fireEvent.press(screen.getByText('1 Pkt.'));
  const punkt = screen.getByLabelText(/^Messpunkt .*130\/85, Puls 60$/);
  await fireEvent(punkt, 'longPress');
  expect(alert).toHaveBeenCalledWith('Messpunkt löschen?', expect.any(String), expect.any(Array));
  const loeschen = alert.mock.calls[0][2]!.find((b) => b.text === 'Löschen')!;
  await act(async () => loeschen.onPress!());
  expect(await screen.findByText('Noch keine Messungen.')).toBeOnTheScreen();
  expect(db.listMessungen()).toEqual([]);
});

test('Umschalter Tageshälfte filtert die Liste und wird gespeichert; Messung klappt auf', async () => {
  db.insertMesspunkt({ zeit: new Date(2026, 0, 1, 7).toISOString(), sys: 130, dia: 85, puls: 60 });
  db.insertMesspunkt({ zeit: new Date(2026, 0, 1, 19).toISOString(), sys: 140, dia: 90, puls: 70 });
  db.insertMesspunkt({ zeit: new Date(2026, 0, 1, 19, 2).toISOString(), sys: 144, dia: 92, puls: 72 });
  await render(<App />);
  expect(screen.getByText('1 Pkt.')).toBeOnTheScreen();
  expect(screen.getByText('2 Pkt.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Vormittag' }));
  expect(screen.queryByText('2 Pkt.')).toBeNull();
  expect(db.getSetting('tageshaelfte')).toBe('vormittag');
  await fireEvent.press(screen.getByRole('button', { name: 'Nachmittag' }));
  expect(screen.queryByText('1 Pkt.')).toBeNull();
  expect(screen.queryByLabelText(/^Messpunkt/)).toBeNull();
  await fireEvent.press(screen.getByText('2 Pkt.'));
  expect(screen.getAllByLabelText(/^Messpunkt/)).toHaveLength(2);
});

test('Seitenleiste: Darstellung wählen und speichern, Version', async () => {
  const set = jest.spyOn(Appearance, 'setColorScheme');
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Menü'));
  expect(screen.getByRole('button', { name: 'System', selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Dunkel' }));
  expect(set).toHaveBeenLastCalledWith('dark');
  expect(db.getSetting('theme')).toBe('dark');
  expect(screen.getByRole('button', { name: 'Dunkel', selected: true })).toBeOnTheScreen();
  expect(screen.getByText('Version Entwicklung')).toBeOnTheScreen();
  for (const name of ['Speichern', 'Einspielen', 'Als CSV speichern', 'Als XLSX speichern', 'In Google Drive ablegen']) {
    expect(screen.getByRole('button', { name })).toBeOnTheScreen();
  }
});

/** Zurück-Taste nachbilden: angemeldete Handler abfangen, den zuletzt angemeldeten auslösen. */
type BackHandlerFn = Parameters<typeof BackHandler.addEventListener>[1];

function backButton() {
  const handlers: BackHandlerFn[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, h) => {
    handlers.push(h);
    return { remove: () => handlers.splice(handlers.indexOf(h), 1) };
  });
  return () => act(async () => { handlers[handlers.length - 1]?.({} as Parameters<BackHandlerFn>[0]); });
}

test('Importieren links, Aufnehmen rechts', async () => {
  await render(<App />);
  // Treffer kommen in Darstellungsreihenfolge
  const labels = screen.getAllByLabelText(/^Fotos? (importieren|aufnehmen)$/).map((n) => n.props.accessibilityLabel);
  expect(labels).toEqual(['Fotos importieren', 'Foto aufnehmen']);
});

/** Rückfrage abfangen; liefert den Knopf mit diesem Text aus der letzten. */
function rueckfrage() {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  return Object.assign(alert, { knopf: (text: string) => alert.mock.calls.at(-1)![2]!.find((b) => b.text === text)! });
}

test('Zurück-Taste bei einer Aufnahme fragt nach; Abbrechen behält sie, Verwerfen löscht sie', async () => {
  const back = backButton();
  const alert = rueckfrage();
  foto.takePhoto.mockResolvedValue([FOTO]);
  foto.recognize.mockResolvedValue({ values: [128, 85, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Foto aufnehmen'));
  await screen.findByDisplayValue('128');
  await back();
  expect(alert).toHaveBeenCalledWith('Aufnahme verwerfen?', expect.any(String), expect.any(Array));
  expect(screen.getByDisplayValue('128')).toBeOnTheScreen();
  expect(foto.discard).not.toHaveBeenCalled();
  await act(async () => alert.knopf('Verwerfen').onPress!());
  expect(await screen.findByText('Noch keine Messungen.')).toBeOnTheScreen();
  expect(foto.discard).toHaveBeenCalledWith(FOTO);
  expect(db.listMessungen()).toEqual([]);
});

/** Wählt im Datumsdialog `tag`, im folgenden Uhrzeitdialog `uhr`; null bricht den Dialog ab. */
async function zeitWaehlen(tag: Date | null, uhr?: Date) {
  const open = DateTimePickerAndroid.open as jest.Mock;
  await fireEvent.press(screen.getByHintText('Zeit ändern'));
  expect(open.mock.calls.at(-1)[0].mode).toBe('date');
  await act(async () => open.mock.calls.at(-1)[0].onChange({ type: tag ? 'set' : 'dismissed' }, tag ?? undefined));
  if (!tag) return;
  expect(open.mock.calls.at(-1)[0].mode).toBe('time');
  await act(async () => open.mock.calls.at(-1)[0].onChange({ type: 'set' }, uhr));
}

test('Zeit ohne EXIF wählen: Datum, dann Uhrzeit auf die volle Minute; Hinweis verschwindet', async () => {
  foto.importPhotos.mockResolvedValue([{ ...FOTO, temporaer: false }]);
  foto.recognize.mockResolvedValue({ values: [128, 85, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Fotos importieren'));
  expect(await screen.findByText(/^Zeitpunkt nicht im Foto/)).toBeOnTheScreen();
  await zeitWaehlen(null);
  expect(DateTimePickerAndroid.open).toHaveBeenCalledTimes(1);
  await zeitWaehlen(new Date(2025, 11, 24), new Date(2025, 11, 24, 8, 15, 33));
  expect(screen.queryByText(/^Zeitpunkt nicht im Foto/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(db.listMessungen()[0].punkte[0].zeit).toBe(new Date(2025, 11, 24, 8, 15).toISOString());
});

test('Bearbeiten ändert auch die Zeit', async () => {
  db.insertMesspunkt({ zeit: '2026-01-01T07:00:00.000Z', sys: 130, dia: 85, puls: 60 });
  await render(<App />);
  await fireEvent.press(screen.getByText('1 Pkt.'));
  await fireEvent.press(screen.getByLabelText(/^Messpunkt .*130\/85, Puls 60$/));
  await zeitWaehlen(new Date(2025, 11, 24), new Date(2025, 11, 24, 19, 30));
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(db.listMessungen()[0].punkte[0]).toMatchObject({ zeit: new Date(2025, 11, 24, 19, 30).toISOString(), sys: 130 });
});

test('Zurück-Taste bei einem Foto aus der Galerie verwirft ohne Rückfrage', async () => {
  const back = backButton();
  const alert = rueckfrage();
  const galerie = { ...FOTO, zeitAusExif: true, temporaer: false };
  foto.importPhotos.mockResolvedValue([galerie]);
  foto.recognize.mockResolvedValue({ values: [128, 85, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Fotos importieren'));
  await screen.findByDisplayValue('128');
  await back();
  expect(await screen.findByText('Noch keine Messungen.')).toBeOnTheScreen();
  expect(alert).not.toHaveBeenCalled();
  expect(foto.discard).toHaveBeenCalledWith(galerie);
});

test('Messpunkt antippen: bearbeiten und speichern; Zurück bricht ab; Löschen fragt nach', async () => {
  const back = backButton();
  const alert = rueckfrage();
  db.insertMesspunkt({ zeit: '2026-01-01T07:00:00.000Z', sys: 130, dia: 85, puls: 60 });
  await render(<App />);
  await fireEvent.press(screen.getByText('1 Pkt.'));
  await fireEvent.press(screen.getByLabelText(/^Messpunkt .*130\/85, Puls 60$/));
  expect(screen.getByText('Messpunkt bearbeiten')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('SYS'), '999');
  await back();
  expect(db.listMessungen()[0].sys).toBe(130);

  await fireEvent.press(screen.getByText('1 Pkt.'));
  await fireEvent.press(screen.getByLabelText(/^Messpunkt .*130\/85, Puls 60$/));
  await fireEvent.changeText(screen.getByLabelText('SYS'), '132');
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(db.listMessungen().map((m) => [m.sys, m.dia, m.puls])).toEqual([[132, 85, 60]]);
  expect(db.listMessungen()[0].punkte[0].zeit).toBe('2026-01-01T07:00:00.000Z');
  expect(screen.queryByText('Messpunkt bearbeiten')).toBeNull();

  await fireEvent.press(screen.getByText('1 Pkt.'));
  await fireEvent.press(screen.getByLabelText(/^Messpunkt .*132\/85, Puls 60$/));
  await fireEvent.press(screen.getByLabelText('Löschen'));
  expect(alert).toHaveBeenCalledWith('Messpunkt löschen?', expect.any(String), expect.any(Array));
  await act(async () => alert.knopf('Löschen').onPress!());
  expect(await screen.findByText('Noch keine Messungen.')).toBeOnTheScreen();
});

test('mehrere Fotos: alle werden erkannt, ohne auf die Entscheidung zu warten', async () => {
  const fotos = [128, 131, 135].map((sys) => ({ ...FOTO, uri: `file:///cache/${sys}.jpg` }));
  foto.importPhotos.mockResolvedValue(fotos);
  foto.recognize.mockImplementation(async (f) =>
    ({ values: [Number(f.uri.match(/\d+/)![0]), 85, 64], uncertain: [false, false, false] }) as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Fotos importieren'));
  await screen.findByDisplayValue('128');
  expect(screen.getByText('Foto 1 von 3')).toBeOnTheScreen();
  await act(() => new Promise((r) => setTimeout(r, 200)));
  expect(foto.recognize.mock.calls.map(([f]) => f)).toEqual(fotos);
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(screen.getByDisplayValue('131')).toBeOnTheScreen();
  expect(screen.getByText('Foto 2 von 3')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(screen.getByDisplayValue('135')).toBeOnTheScreen();
  expect(foto.recognize).toHaveBeenCalledTimes(3);
});

test('Fortschritt: rot bestätigt, hellgrau erkannt, Rest ausstehend', async () => {
  const fotos = [128, 131, 135].map((sys) => ({ ...FOTO, uri: `file:///cache/${sys}.jpg` }));
  let finish!: (r: Reading) => void;
  foto.importPhotos.mockResolvedValue(fotos);
  foto.recognize.mockImplementation((f) => f === fotos[2]
    ? new Promise((r) => { finish = r; })
    : Promise.resolve({ values: [Number(f.uri.match(/\d+/)![0]), 85, 64], uncertain: [false, false, false] } as Reading));
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Fotos importieren'));
  await screen.findByDisplayValue('128');
  const breite = (id: string) => screen.getByTestId(id).props.style.width;
  expect([breite('bestaetigt'), breite('erkannt')]).toEqual(['0%', `${200 / 3}%`]);
  await act(async () => finish({ values: [135, 85, 64], uncertain: [false, false, false] }));
  expect(breite('erkannt')).toBe('100%');
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect([breite('bestaetigt'), breite('erkannt')]).toEqual([`${100 / 3}%`, '100%']);
});

test('Zurück-Taste während der Erkennung: verworfen, spätes Ergebnis öffnet nichts', async () => {
  const back = backButton();
  let finish!: (r: Reading) => void;
  foto.takePhoto.mockResolvedValue([FOTO]);
  foto.recognize.mockReturnValue(new Promise((r) => { finish = r; }));
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Foto aufnehmen'));
  expect(await screen.findByText('Erkenne …')).toBeOnTheScreen();
  const alert = rueckfrage();
  await back();
  await act(async () => alert.knopf('Verwerfen').onPress!());
  await act(async () => finish({ values: [128, 85, 64], uncertain: [false, false, false] }));
  expect(screen.getByText('Noch keine Messungen.')).toBeOnTheScreen();
  expect(screen.queryByDisplayValue('128')).toBeNull();
});

test('Import eines schon gespeicherten Messpunkts: ohne Bestätigung übersprungen', async () => {
  db.insertMesspunkt({ zeit: FOTO.zeit.toISOString(), sys: 128, dia: 85, puls: 64 });
  const neu = { ...FOTO, uri: 'file:///cache/neu.jpg', zeit: new Date('2026-01-01T19:00:00Z') };
  foto.importPhotos.mockResolvedValue([FOTO, neu]);
  foto.recognize.mockResolvedValue({ values: [128, 85, 64], uncertain: [false, true, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Fotos importieren'));
  await screen.findByDisplayValue('128');
  expect(foto.discard).toHaveBeenCalledWith(FOTO);
  expect(screen.getByText('Foto 2 von 2')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(db.listMessungen().map((m) => m.punkte.length)).toEqual([1, 1]);
});

test('gleiche Zeit, andere erkannte Werte: Bestätigung wie gewohnt', async () => {
  db.insertMesspunkt({ zeit: FOTO.zeit.toISOString(), sys: 128, dia: 85, puls: 64 });
  foto.importPhotos.mockResolvedValue([FOTO]);
  foto.recognize.mockResolvedValue({ values: [123, 85, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Fotos importieren'));
  await fireEvent.changeText(await screen.findByDisplayValue('123'), '128');
  await fireEvent.press(screen.getByLabelText('Speichern'));
  expect(db.listMessungen()[0].punkte).toHaveLength(1);
});

test('Monatskopf öffnet den Datumswähler; Tag ohne Messung: Sprung zum Tag davor mit Hinweis', async () => {
  db.insertMesspunkt({ zeit: new Date(2026, 0, 1, 7).toISOString(), sys: 130, dia: 85, puls: 60 });
  db.insertMesspunkt({ zeit: new Date(2026, 0, 3, 7).toISOString(), sys: 140, dia: 90, puls: 70 });
  await render(<App />);
  expect(screen.getByLabelText('Zeitleiste')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Januar 2026'));
  const open = DateTimePickerAndroid.open as jest.Mock;
  expect(open).toHaveBeenCalledTimes(1);
  await act(() => open.mock.calls[0][0].onChange({ type: 'set' }, new Date(2026, 0, 2, 12)));
  expect(screen.getByText('Keine Messung am 02.01.2026, nächste davor: Do 01.01.2026')).toBeOnTheScreen();
});

test('sichtbare Zeilen melden: SectionList übergibt keyExtractor auch den Monatsabschnitt', async () => {
  db.insertMesspunkt({ zeit: new Date(2026, 0, 1, 7).toISOString(), sys: 130, dia: 85, puls: 60 });
  const { container } = await render(<App />);
  const layout = (x: object) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 40, ...x } } });
  // Jest berechnet kein Layout: ohne diese Ereignisse meldet die Liste nie, was sichtbar ist
  await fireEvent(container.queryAll((n) => n.type === 'RCTScrollView')[0], 'layout', layout({ height: 800 }));
  const zellen = container.queryAll((n) => n.type === 'View' && !!n.props.onFocusCapture);
  for (const [i, z] of zellen.entries()) await fireEvent(z, 'layout', layout({ y: i * 40 }));
  expect(screen.getByText('Januar 2026')).toBeOnTheScreen();
});

test('Zeitleiste per Bedienungshilfe: zurück springt in den Vormonat, vor in den Folgemonat', async () => {
  const jetzt = new Date();
  db.insertMesspunkt({ zeit: new Date(jetzt.getFullYear(), jetzt.getMonth() - 1, 15, 7).toISOString(), sys: 130, dia: 85, puls: 60 });
  db.insertMesspunkt({ zeit: new Date(jetzt.getFullYear(), jetzt.getMonth(), 1, 0, 0, 1).toISOString(), sys: 140, dia: 90, puls: 70 });
  const scroll = jest.spyOn(SectionList.prototype, 'scrollToLocation').mockImplementation(() => {});
  await render(<App />);
  const leiste = screen.getByLabelText('Zeitleiste');
  // Monatsabschnitte, neueste zuerst: 0 dieser Monat, 1 Vormonat
  await fireEvent(leiste, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ sectionIndex: 1 }));
  await fireEvent(leiste, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ sectionIndex: 0 }));
});

/** Ordnerwahl, die den Ordner liefert; geschrieben wird in write. */
function ordner(write = jest.fn()) {
  const createFile = jest.fn(() => ({ write }));
  (Directory.pickDirectoryAsync as jest.Mock).mockResolvedValue({ createFile });
  return { createFile, write };
}

/** Das Menü schließt sich mit jedem Eintrag. */
async function menue(eintrag: string) {
  await fireEvent.press(screen.getByLabelText('Menü'));
  await fireEvent.press(screen.getByRole('button', { name: eintrag }));
}

test('Sichern: Datenbank in den gewählten Ordner, Rückmeldung mit Anzahl', async () => {
  db.insertMesspunkt({ zeit: FOTO.zeit.toISOString(), sys: 128, dia: 85, puls: 64 });
  jest.spyOn(db, 'sichern').mockReturnValue(new Uint8Array([1, 2, 3]));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { createFile, write } = ordner();
  await render(<App />);
  await menue('Speichern');
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Gesichert', '1 Messpunkte.'));
  expect(createFile).toHaveBeenCalledWith(expect.stringMatching(/^blutdruck-\d{4}-\d\d-\d\d\.sqlite$/), 'application/octet-stream');
  expect(write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
});

test('Sichern: Abbruch der Ordnerwahl meldet nichts, Schreibfehler wird angezeigt', async () => {
  jest.spyOn(db, 'sichern').mockReturnValue(new Uint8Array([1]));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (Directory.pickDirectoryAsync as jest.Mock).mockRejectedValue(new Error('cancelled'));
  await render(<App />);
  await menue('Speichern');
  await act(() => new Promise((r) => setTimeout(r, 50)));
  expect(alert).not.toHaveBeenCalled();
  ordner(jest.fn(() => { throw new Error('kein Platz'); }));
  await menue('Speichern');
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Nicht gesichert', 'Error: kein Platz'));
});

test('Sicherungshinweis: ohne Sicherung sichtbar, Antippen sichert, danach weg; Seitenleiste nennt den Tag', async () => {
  db.insertMesspunkt({ zeit: FOTO.zeit.toISOString(), sys: 128, dia: 85, puls: 64 });
  jest.spyOn(db, 'sichern').mockReturnValue(new Uint8Array([1]));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { write } = ordner();
  await render(<App />);
  await fireEvent.press(screen.getByText(/^Noch keine Datensicherung/));
  await waitFor(() => expect(write).toHaveBeenCalled());
  expect(Date.parse(db.getSetting('gesichert')!)).toBeGreaterThan(Date.now() - 60_000);
  expect(screen.queryByText(/Datensicherung · /)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Menü'));
  expect(screen.getByText(`Zuletzt am ${new Date().toLocaleDateString('de-DE')}`)).toBeOnTheScreen();
});

test.each([
  ['30 Tage, ohne Messpunkte', 30, false, false],
  ['13 Tage', 13, true, false],
  ['15 Tage', 15, true, true],
])('Sicherungshinweis nach 14 Tagen, nie ohne Messpunkte: %s', async (_, tage, mitPunkt, sichtbar) => {
  if (mitPunkt) db.insertMesspunkt({ zeit: FOTO.zeit.toISOString(), sys: 128, dia: 85, puls: 64 });
  db.setSetting('gesichert', new Date(Date.now() - tage * 864e5).toISOString());
  await render(<App />);
  expect(screen.queryByText(/^Letzte Datensicherung am /) !== null).toBe(sichtbar);
});

test('Einspielen: neue Messpunkte übernommen, doppelte übersprungen, Sicherung geschlossen', async () => {
  db.insertMesspunkt({ zeit: FOTO.zeit.toISOString(), sys: 128, dia: 85, puls: 64 });
  globalThis.sicherung = Object.assign(memoryDb(), { closeSync: jest.fn() });
  datenbank.migrate(globalThis.sicherung);
  datenbank.insertMesspunkt(globalThis.sicherung, { zeit: FOTO.zeit.toISOString(), sys: 128, dia: 85, puls: 64 });
  datenbank.insertMesspunkt(globalThis.sicherung, { zeit: '2026-01-02T07:00:00.000Z', sys: 131, dia: 86, puls: 61 });
  (File.pickFileAsync as jest.Mock).mockResolvedValue({ result: { bytes: () => new Uint8Array([1]) } });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<App />);
  await menue('Einspielen');
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Eingespielt', '2 Messpunkte gelesen, 1 neu übernommen.'));
  expect(db.zaehlen()).toBe(2);
  expect(globalThis.sicherung.closeSync).toHaveBeenCalled();
  expect(screen.getAllByText('1 Pkt.')).toHaveLength(2);
});

test('Einspielen: Abbruch, fremde Datei und Sicherung einer neueren Version', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const pick = File.pickFileAsync as jest.Mock;
  pick.mockResolvedValue({ result: null });
  await render(<App />);
  await menue('Einspielen');
  await act(() => new Promise((r) => setTimeout(r, 50)));
  expect(alert).not.toHaveBeenCalled();

  pick.mockResolvedValue({ result: { bytes: () => new Uint8Array([1]) } });
  globalThis.sicherung = Object.assign(memoryDb(), { closeSync: jest.fn() });
  await menue('Einspielen');
  await waitFor(() => expect(alert).toHaveBeenLastCalledWith('Nicht eingespielt', 'Keine Datensicherung dieser App.'));
  expect(globalThis.sicherung.closeSync).toHaveBeenCalled();

  globalThis.sicherung.execSync(`PRAGMA user_version = ${datenbank.MIGRATIONS.length + 1}`);
  await menue('Einspielen');
  await waitFor(() => expect(alert).toHaveBeenLastCalledWith('Nicht eingespielt', 'Die Sicherung stammt von einer neueren App-Version.'));
  expect(db.zaehlen()).toBe(0);
});

test('Tabelle: CSV und XLSX in den Ordner, XLSX ins Teilen-Blatt', async () => {
  db.insertMesspunkt({ zeit: FOTO.zeit.toISOString(), sys: 128, dia: 85, puls: 64 });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { createFile, write } = ordner();
  await render(<App />);
  await menue('Als CSV speichern');
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Gespeichert', '1 Messpunkte.'));
  expect(createFile).toHaveBeenLastCalledWith(expect.stringMatching(/\.csv$/), 'text/csv');
  expect(write.mock.calls[0][0]).toContain('128');

  await menue('Als XLSX speichern');
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(2));
  expect(createFile).toHaveBeenLastCalledWith(expect.stringMatching(/\.xlsx$/), expect.stringContaining('spreadsheetml'));
  expect(write.mock.calls[1][0]).toBeInstanceOf(Uint8Array);

  await menue('In Google Drive ablegen');
  await waitFor(() => expect(shareAsync).toHaveBeenCalledWith('file:///cache/datei', expect.objectContaining({ mimeType: expect.stringContaining('spreadsheetml') })));
  expect((File as unknown as jest.Mock).mock.calls.at(-1)).toEqual(['cache', expect.stringMatching(/^blutdruck-\d{4}-\d\d-\d\d\.xlsx$/)]);
});
