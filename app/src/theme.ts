export type Theme = 'unspecified' | 'light' | 'dark'; // unspecified: wie das System

export const THEMES: Theme[] = ['unspecified', 'light', 'dark'];
export const THEME_LABEL: Record<Theme, string> = { unspecified: 'System', light: 'Hell', dark: 'Dunkel' };

export function nextTheme(t: Theme): Theme {
  return THEMES[(THEMES.indexOf(t) + 1) % THEMES.length];
}

/** Gespeicherten Wert lesen; Unbekanntes gilt als „wie das System". */
export function parseTheme(value: string | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : 'unspecified';
}

export const COLORS = {
  light: { bg: '#fff', text: '#111', sub: '#666', line: '#ccc', field: '#fff', fieldLine: '#999', photo: '#eee', chip: '#f0f0f0', uncertain: '#fff3b0', button: '#1f6feb' },
  dark: { bg: '#121212', text: '#eee', sub: '#aaa', line: '#333', field: '#1e1e1e', fieldLine: '#666', photo: '#222', chip: '#2a2a2a', uncertain: '#5a4a00', button: '#2f81f7' },
};
export type Colors = typeof COLORS.light;
