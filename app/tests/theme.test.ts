import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseTheme } from '../src/theme';

test('gespeicherte Darstellung: Unbekanntes gilt als System', () => {
  assert.equal(parseTheme('dark'), 'dark');
  assert.equal(parseTheme(null), 'unspecified');
  assert.equal(parseTheme('blau'), 'unspecified');
});
