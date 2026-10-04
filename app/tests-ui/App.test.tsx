/// <reference types="jest" />
// Oberfläche mit echter SQLite-Datenbank (node:sqlite); Kamera, Bildauswahl und Erkennung sind Attrappen.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Appearance, BackHandler } from 'react-native';

import type { Reading } from '../src/erkennung/messwerte';
import type { Foto } from '../src/foto';

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import App from '../App';
import * as db from '../src/db';
import * as fotoModule from '../src/foto';
import { memoryDb } from '../tests/sqlite';

// db.ts öffnet die Datenbank einmal beim Laden; die Attrappe leitet an die Datenbank des laufenden Tests weiter
declare global { var testDb: ReturnType<typeof memoryDb>; }
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => new Proxy({}, {
    // App.tsx migriert schon beim Laden, vor beforeEach: dann erste Datenbank hier anlegen
    get: (_, k: string) => (...a: unknown[]) => ((globalThis.testDb ??= require('../tests/sqlite').memoryDb()) as any)[k](...a),
  }),
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/foto', () => ({ takePhoto: jest.fn(), importPhotos: jest.fn(), recognize: jest.fn(), discard: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: jest.fn() } }));

const foto = fotoModule as jest.Mocked<typeof fotoModule>;
const FOTO: Foto = { uri: 'file:///cache/foto.jpg', zeit: new Date('2026-01-01T07:00:00Z'), zeitAusExif: false, temporaer: true };

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  globalThis.testDb = memoryDb();
  db.migrate();
});

test('leerer Start: Hinweis und Knöpfe', async () => {
  await render(<App />);
  expect(screen.getByText('Noch keine Messungen.')).toBeOnTheScreen();
  expect(screen.getByLabelText('Foto aufnehmen')).toBeOnTheScreen();
  expect(screen.getByLabelText('Fotos importieren')).toBeOnTheScreen();
  expect(screen.getByText('Darstellung: System')).toBeOnTheScreen();
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
  await fireEvent.press(punkt); // kurzes Tippen löscht nicht
  expect(db.listMessungen()).toHaveLength(1);
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

test('Darstellung wechselt reihum und wird gespeichert', async () => {
  const set = jest.spyOn(Appearance, 'setColorScheme');
  await render(<App />);
  await fireEvent.press(screen.getByText('Darstellung: System'));
  expect(screen.getByText('Darstellung: Hell')).toBeOnTheScreen();
  expect(set).toHaveBeenLastCalledWith('light');
  expect(db.getSetting('theme')).toBe('light');
  await fireEvent.press(screen.getByText('Darstellung: Hell'));
  await fireEvent.press(screen.getByText('Darstellung: Dunkel'));
  expect(screen.getByText('Darstellung: System')).toBeOnTheScreen();
  expect(db.getSetting('theme')).toBe('unspecified');
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

test('Zurück-Taste in der Bestätigung verwirft das Foto', async () => {
  const back = backButton();
  foto.takePhoto.mockResolvedValue([FOTO]);
  foto.recognize.mockResolvedValue({ values: [128, 85, 64], uncertain: [false, false, false] } as Reading);
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Foto aufnehmen'));
  await screen.findByDisplayValue('128');
  await back();
  expect(await screen.findByText('Noch keine Messungen.')).toBeOnTheScreen();
  expect(foto.discard).toHaveBeenCalledWith(FOTO);
  expect(db.listMessungen()).toEqual([]);
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

test('Zurück-Taste während der Erkennung: verworfen, spätes Ergebnis öffnet nichts', async () => {
  const back = backButton();
  let finish!: (r: Reading) => void;
  foto.takePhoto.mockResolvedValue([FOTO]);
  foto.recognize.mockReturnValue(new Promise((r) => { finish = r; }));
  await render(<App />);
  await fireEvent.press(screen.getByLabelText('Foto aufnehmen'));
  expect(await screen.findByText('Erkenne …')).toBeOnTheScreen();
  await back();
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
