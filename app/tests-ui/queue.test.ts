/// <reference types="jest" />
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Foto } from '../src/foto';
import * as fotoModule from '../src/foto';
import { erkennungsfehler, useQueue } from '../src/queue';

jest.mock('../src/foto', () => ({ recognize: jest.fn(), discard: jest.fn() }));
jest.mock('../src/db', () => ({ hasMesspunkt: () => false }));

const foto = fotoModule as jest.Mocked<typeof fotoModule>;
const FOTO: Foto = { uri: 'file:///cache/foto.jpg', zeit: new Date('2026-01-01T07:00:00Z'), zeitAusExif: false, temporaer: true };

test('Erkennung scheitert: Foto mit leeren Feldern zur Bestätigung, nach next verworfen', async () => {
  foto.recognize.mockRejectedValue(new Error('kaputt'));
  const onDone = jest.fn();
  const { result } = await renderHook(() => useQueue(onDone));
  await act(async () => result.current.enqueue([FOTO]));
  await waitFor(() => expect(result.current.offen?.reading).toEqual({ values: [null, null, null], uncertain: [false, false, false] }));
  expect([result.current.nr, result.current.gesamt]).toEqual([1, 1]);
  expect(erkennungsfehler()).toBe('Error: kaputt');
  await act(async () => { result.current.next(); });
  expect(result.current.offen).toBeNull();
  expect(foto.discard).toHaveBeenCalledWith(FOTO);
  expect(onDone).toHaveBeenCalledTimes(1);
});
