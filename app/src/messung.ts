export type Messpunkt = { id: number; zeit: string; sys: number; dia: number; puls: number };
export type Messung = { punkte: Messpunkt[]; sys: number; dia: number; puls: number };

const GAP_MS = 20 * 60 * 1000; // Messpunkte mit weniger Abstand gehören zu einer Messung

/** Messpunkte (nach Zeit sortiert) zu Messungen, neueste zuerst; Werte sind gerundete Mittelwerte. */
export function gruppieren(punkte: Messpunkt[]): Messung[] {
  const groups: Messpunkt[][] = [];
  for (const p of punkte) {
    const last = groups[groups.length - 1];
    if (last && Date.parse(p.zeit) - Date.parse(last[last.length - 1].zeit) < GAP_MS) last.push(p);
    else groups.push([p]);
  }
  const mean = (g: Messpunkt[], k: 'sys' | 'dia' | 'puls') => Math.round(g.reduce((s, p) => s + p[k], 0) / g.length);
  return groups.reverse().map((g) => ({ punkte: g, sys: mean(g, 'sys'), dia: mean(g, 'dia'), puls: mean(g, 'puls') }));
}
