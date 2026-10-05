/// <reference types="jest" />
// Warteschlange von recognize(); Runtimes und Bildverkleinerung sind Attrappen, die echte Runtime sieht der Test nicht.
import type { Reading } from '../src/erkennung/messwerte';
import type { Foto } from '../src/foto';

type Lauf = { runtime: object; fertig: (r: unknown) => void; fehler: (e: Error) => void };
const mockLaeufe: Lauf[] = [];
const mockVerkleinern = { aktiv: 0, max: 0, reihenfolge: [] as string[], fehler: new Set<string>() };
const mockGeloescht: string[] = [];

jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: (name: string) => ({ name }),
  runOnRuntimeAsync: (runtime: object) => new Promise((fertig, fehler) => mockLaeufe.push({ runtime, fertig, fehler })),
}));
jest.mock('expo-image-manipulator', () => {
  const bild = {
    width: 4000, height: 3000,
    saveAsync: async () => { mockVerkleinern.aktiv--; return { uri: 'file:///cache/klein.jpg', base64: '' }; },
  };
  const kontext = { resize: () => kontext, renderAsync: () => new Promise((r) => setTimeout(() => r(bild), 1)) };
  return {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: {
      manipulate: (quelle: unknown) => {
        if (typeof quelle !== 'string') return kontext;
        if (mockVerkleinern.fehler.has(quelle)) return { renderAsync: () => Promise.reject(new Error('kaputt')) };
        mockVerkleinern.reihenfolge.push(quelle);
        mockVerkleinern.max = Math.max(mockVerkleinern.max, ++mockVerkleinern.aktiv);
        return kontext;
      },
    },
  };
});
jest.mock('expo-image-picker', () => ({ getPendingResultAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: function (uri: string) { return { exists: true, delete: () => mockGeloescht.push(uri) }; },
}));

const foto = (n: number): Foto => ({ uri: `file:///cache/${n}.jpg`, zeit: new Date(), zeitAngenommen: false, temporaer: n % 2 === 1 });
const reading = (sys: number): Reading => ({ values: [sys, 85, 64], uncertain: [false, false, false] });
const warten = () => new Promise((r) => setTimeout(r, 50));

let recognize: typeof import('../src/foto').recognize;
let discard: typeof import('../src/foto').discard;
let pendingPhotos: typeof import('../src/foto').pendingPhotos;

beforeEach(() => {
  // foto.ts hält Runtimes und Warteschlange auf Modulebene
  jest.resetModules();
  ({ recognize, discard, pendingPhotos } = require('../src/foto'));
  mockLaeufe.length = 0;
  mockGeloescht.length = 0;
  Object.assign(mockVerkleinern, { aktiv: 0, max: 0, reihenfolge: [], fehler: new Set() });
});

test('höchstens drei zugleich, Verkleinern nacheinander, freie Runtime an das nächste Foto in Aufrufreihenfolge', async () => {
  const ergebnisse = [1, 2, 3, 4, 5].map((n) => recognize(foto(n)));
  await warten();
  expect(mockLaeufe).toHaveLength(3);
  expect(new Set(mockLaeufe.map((l) => l.runtime)).size).toBe(3);
  expect(mockVerkleinern.max).toBe(1);

  mockLaeufe[1].fertig({ reading: reading(122), dekodieren: 0, lesen: 0 });
  await expect(ergebnisse[1]).resolves.toEqual(reading(122));
  await warten();
  expect(mockLaeufe).toHaveLength(4);
  expect(mockLaeufe[3].runtime).toBe(mockLaeufe[1].runtime);
  expect(mockVerkleinern.reihenfolge).toEqual([1, 2, 3, 4].map((n) => foto(n).uri));

  for (const l of mockLaeufe) l.fertig({ reading: reading(130), dekodieren: 0, lesen: 0 });
  await warten();
  mockLaeufe[4].fertig({ reading: reading(130), dekodieren: 0, lesen: 0 });
  await Promise.all(ergebnisse);
  expect(new Set(mockLaeufe.map((l) => l.runtime)).size).toBe(3);
  expect(mockVerkleinern.max).toBe(1);
});

test('Fehler beim Verkleinern oder Lesen geben die Runtime frei: das nächste Foto läuft', async () => {
  mockVerkleinern.fehler.add(foto(1).uri);
  await expect(recognize(foto(1))).rejects.toThrow('kaputt');

  const fehlerhaft = [2, 3, 4].map((n) => recognize(foto(n)));
  await warten();
  for (const l of mockLaeufe) l.fehler(new Error('Lesefehler'));
  expect((await Promise.allSettled(fehlerhaft)).map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected']);

  const fuenf = recognize(foto(5));
  await warten();
  expect(mockLaeufe).toHaveLength(4);
  mockLaeufe[3].fertig({ reading: reading(140), dekodieren: 0, lesen: 0 });
  await expect(fuenf).resolves.toEqual(reading(140));
});

test('verwerfen löscht nur Fotos aus der Kamera', () => {
  discard(foto(1));
  discard(foto(2));
  expect(mockGeloescht).toEqual([foto(1).uri]);
});

test('liegengebliebenes Ergebnis: Kamera als Aufnahme mit angenommener Zeit, Galerie mit EXIF-Zeit; Abbruch und Fehler leer', async () => {
  const pending = require('expo-image-picker').getPendingResultAsync as jest.Mock;
  pending.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/kamera.jpg' }] });
  expect(await pendingPhotos()).toEqual([expect.objectContaining({ uri: 'file:///cache/kamera.jpg', zeitAngenommen: true, temporaer: true })]);
  pending.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/a.jpg', exif: { DateTimeOriginal: '2025:08:05 08:02:40' } }, { uri: 'file:///cache/b.jpg', exif: {} }] });
  expect(await pendingPhotos()).toEqual([
    { uri: 'file:///cache/a.jpg', zeit: new Date(2025, 7, 5, 8, 2, 40), zeitAngenommen: false, temporaer: false },
    expect.objectContaining({ uri: 'file:///cache/b.jpg', zeitAngenommen: true, temporaer: false }),
  ]);
  for (const r of [null, { canceled: true, assets: null }, { code: 'ERR', message: 'kaputt' }]) {
    pending.mockResolvedValue(r);
    expect(await pendingPhotos()).toEqual([]);
  }
});
