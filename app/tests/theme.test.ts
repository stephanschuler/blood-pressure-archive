import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextTheme, parseTheme } from '../src/theme';

test('Darstellung wechselt reihum System → Hell → Dunkel → System', () => {
  assert.deepEqual([nextTheme('unspecified'), nextTheme('light'), nextTheme('dark')], ['light', 'dark', 'unspecified']);
});

test('gespeicherte Darstellung: Unbekanntes gilt als System', () => {
  assert.equal(parseTheme('dark'), 'dark');
  assert.equal(parseTheme(null), 'unspecified');
  assert.equal(parseTheme('blau'), 'unspecified');
});
