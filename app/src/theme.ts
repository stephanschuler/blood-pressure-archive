export type Theme = 'unspecified' | 'light' | 'dark'; // unspecified: wie das System

export const THEMES: Theme[] = ['unspecified', 'light', 'dark'];
export const THEME_LABEL: Record<Theme, string> = { unspecified: 'System', light: 'Hell', dark: 'Dunkel' };

/** Gespeicherten Wert lesen; Unbekanntes gilt als „wie das System". */
export function parseTheme(value: string | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : 'unspecified';
}

export const COLORS = {
  light: { bg: '#fff', text: '#111', mid: '#444', sub: '#666', line: '#ccc', field: '#fff', fieldLine: '#999', photo: '#eee', chip: '#f0f0f0', uncertain: '#fff3b0', erkannt: '#b5b5b5', focus: '#1a5fb4', tooltip: '#322F35', tooltipText: '#F5EFF7', tooltipAction: '#ffb3b8', focusText: '#fff', selected: '#d3e3fd',
    sys: '#c62828', dia: '#1f6feb', up: '#d32f2f', down: '#2e9d5b' },
  dark: { bg: '#121212', text: '#eee', mid: '#ccc', sub: '#aaa', line: '#333', field: '#1e1e1e', fieldLine: '#666', photo: '#222', chip: '#2a2a2a', uncertain: '#5a4a00', erkannt: '#6a6a6a', focus: '#78aeed', tooltip: '#E6E0E9', tooltipText: '#322F35', tooltipAction: '#b3261e', focusText: '#0b1d33', selected: '#1f3a5c',
    sys: '#ef6b6b', dia: '#58a6ff', up: '#ef5350', down: '#4cc27a' },
};

/** Farben der Tageshälften zur Wahl in der Seitenleiste, bis eine feststeht: die Zahlen sind Optionen des Farb-Prototyps. */
export const AKZENTE = ['23', '19', '17', '16', '15', '7'] as const;
export type Akzent = (typeof AKZENTE)[number];
export const AKZENT_LABEL: Record<Akzent, string> = {
  23: 'Zwei Grautöne', 19: 'Sand und Blaugrau', 17: 'Ocker und Graublau', 16: 'Sand und Schiefer', 15: 'Orange und Teal', 7: 'Gold und Petrol',
};
export const parseAkzent = (v: string | null): Akzent => (AKZENTE.includes(v as Akzent) ? (v as Akzent) : '23');

type Tageshaelften = { vormittag: string; nachmittag: string };
export const AKZENT_FARBEN: Record<Akzent, Record<keyof typeof COLORS, Tageshaelften>> = {
  23: { light: { vormittag: '#9a9a9a', nachmittag: '#4a4a4a' }, dark: { vormittag: '#bdbdbd', nachmittag: '#7a7a7a' } },
  19: { light: { vormittag: '#c7a35a', nachmittag: '#455a64' }, dark: { vormittag: '#e0c27a', nachmittag: '#90a4ae' } },
  17: { light: { vormittag: '#b07d2b', nachmittag: '#4a6a8a' }, dark: { vormittag: '#d6a650', nachmittag: '#86a6c6' } },
  16: { light: { vormittag: '#a68a64', nachmittag: '#5b6b7f' }, dark: { vormittag: '#cbb58f', nachmittag: '#8fa0b5' } },
  15: { light: { vormittag: '#EE7733', nachmittag: '#009988' }, dark: { vormittag: '#FF9955', nachmittag: '#33BBAA' } },
  7: { light: { vormittag: '#b8860b', nachmittag: '#0f766e' }, dark: { vormittag: '#e6b422', nachmittag: '#2dd4bf' } },
};
export type Colors = typeof COLORS.light & Tageshaelften;
