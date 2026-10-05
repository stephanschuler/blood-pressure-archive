export type Theme = 'unspecified' | 'light' | 'dark'; // unspecified: wie das System

export const THEMES: Theme[] = ['unspecified', 'light', 'dark'];
export const THEME_LABEL: Record<Theme, string> = { unspecified: 'System', light: 'Hell', dark: 'Dunkel' };

/** Gespeicherten Wert lesen; Unbekanntes gilt als „wie das System". */
export function parseTheme(value: string | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : 'unspecified';
}

export const COLORS = {
  light: { bg: '#fff', text: '#111', sub: '#666', line: '#ccc', field: '#fff', fieldLine: '#999', photo: '#eee', chip: '#f0f0f0', uncertain: '#fff3b0', erkannt: '#b5b5b5', focus: '#1a5fb4', tooltip: '#322F35', tooltipText: '#F5EFF7',
    vormittag: '#d97706', nachmittag: '#6d4fd8', up: '#d32f2f', down: '#2e9d5b' },
  dark: { bg: '#121212', text: '#eee', sub: '#aaa', line: '#333', field: '#1e1e1e', fieldLine: '#666', photo: '#222', chip: '#2a2a2a', uncertain: '#5a4a00', erkannt: '#6a6a6a', focus: '#78aeed', tooltip: '#E6E0E9', tooltipText: '#322F35',
    vormittag: '#f5a524', nachmittag: '#9d86ff', up: '#ef5350', down: '#4cc27a' },
};
export type Colors = typeof COLORS.light;
