// PDF-Bericht nach DATENSICHERUNG.md als HTML für den Druckdienst; ohne Expo-Importe, damit testbar.
import { halbtage, mittel, tagesbeginn, tageshaelfte, zeitpunkt, type Tageshaelfte, type Werte } from './auswertung';
import { gruppieren, type Messpunkt, type Messung } from './messung';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONAT = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const p2 = (n: number) => String(n).padStart(2, '0');
const datum = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
const zellen = (w: Werte | null) => (w ? [w.sys, w.dia, w.puls] : ['', '', '']).map((v) => `<td>${v}</td>`).join('');

// viewBox des Diagramms; Ränder für die Achsenbeschriftung. Die Höhe ist so knapp, dass 31 Tage auf die Seite passen.
const B = 1000;
const H = 260;
const LINKS = 36;
const OBEN = 8;
const UNTEN = 20;

function diagramm(ms: Messung[], von: Date, bis: Date, [lo, hi]: [number, number], farben: Record<Tageshaelfte, string>) {
  const verlauf = [...ms].reverse();
  const x = (t: number) => (LINKS + ((t - von.getTime()) / (bis.getTime() - von.getTime())) * (B - LINKS)).toFixed(1);
  const y = (v: number) => (OBEN + (H - UNTEN - OBEN) * (1 - (v - lo) / (hi - lo))).toFixed(1);

  const raster = [];
  for (let v = lo; v <= hi; v += 20) {
    raster.push(`<line x1="${LINKS}" x2="${B}" y1="${y(v)}" y2="${y(v)}" ${v === 80 || v === 140 ? 'stroke="#888" stroke-dasharray="6 4"' : 'stroke="#ccc"'}/>`,
      `<text x="${LINKS - 6}" y="${y(v)}" dy="5" text-anchor="end">${v}</text>`);
  }
  const achse = [];
  for (let d = von; d < bis; d = tagesbeginn(d, -1)) {
    achse.push(`<text x="${x(d.getTime() + 432e5)}" y="${H - 2}" text-anchor="middle"${d.getDay() % 6 ? '' : ' fill="#999"'}>${d.getDate()}</text>`);
  }

  const reihen = (['vormittag', 'nachmittag'] as const).map((h) => {
    const punkte = verlauf.filter((m) => tageshaelfte(m) === h);
    const [sys, dia] = (['sys', 'dia'] as const).map((k) => punkte.map((m) => `${x(zeitpunkt(m).getTime())},${y(m[k])}`));
    return `<g fill="none" stroke="${farben[h]}" stroke-width="2" stroke-linejoin="round">`
      + `<polygon points="${[...sys, ...[...dia].reverse()].join(' ')}" fill="${farben[h]}" fill-opacity="0.18" stroke="none"/>`
      + `<polyline points="${sys.join(' ')}"/><polyline points="${dia.join(' ')}"/>`
      + [...sys, ...dia].map((p) => { const [cx, cy] = p.split(','); return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${farben[h]}" stroke="none"/>`; }).join('')
      + '</g>';
  });

  return `<svg viewBox="0 0 ${B} ${H}" font-size="15" fill="#444">${raster.join('')}${achse.join('')}${reihen.join('')}</svg>`;
}

/** Je Kalendermonat mit Messung eine Seite: Mittel, Diagramm des Monats, Tagesmittel für jeden Tag; älteste zuerst. */
export function bericht(punkte: Messpunkt[], farben: Record<Tageshaelfte, string>, heute = new Date()): string {
  const ms = gruppieren([...punkte].sort((a, b) => a.zeit.localeCompare(b.zeit)));
  const tage = new Map(halbtage(ms).map(([tag, vm, nm]) => [tag.getTime(), [mittel(vm), mittel(nm)]]));
  // eine Skala für alle Seiten, damit die Monate vergleichbar bleiben
  const skala: [number, number] = [
    Math.floor((Math.min(...ms.map((m) => m.dia)) - 5) / 20) * 20,
    Math.ceil((Math.max(...ms.map((m) => m.sys)) + 5) / 20) * 20,
  ];
  const kennzahl = (label: string, w: Werte | null, farbe?: string) =>
    w ? `<span>${farbe ? `<i style="background:${farbe}"></i>` : ''}${label} <b>${w.sys}/${w.dia}</b>, Puls ${w.puls}</span>` : '';
  const fuss = `<p class="hinweis">Mittel in mmHg, jede Messung zählt gleich; Grenze der Tageshälften 12 Uhr. Erstellt am ${datum(heute)}.</p>`;

  const monate = [...new Set(ms.map((m) => { const t = zeitpunkt(m); return new Date(t.getFullYear(), t.getMonth(), 1).getTime(); }))].reverse();
  const seiten = monate.map((anfang) => {
    const von = new Date(anfang);
    const bis = new Date(von.getFullYear(), von.getMonth() + 1, 1);
    const imMonat = ms.filter((m) => zeitpunkt(m) >= von && zeitpunkt(m) < bis);
    const haelfte = (h: Tageshaelfte) => mittel(imMonat.filter((m) => tageshaelfte(m) === h));
    const zeilen = [];
    for (let d = von; d < bis; d = tagesbeginn(d, -1)) {
      const [vm, nm] = tage.get(d.getTime()) ?? [null, null];
      zeilen.push(`<tr><td>${WOCHENTAG[d.getDay()]} ${p2(d.getDate())}.${p2(d.getMonth() + 1)}.</td>${zellen(vm)}${zellen(nm)}</tr>`);
    }
    return `<section>
<h1>${MONAT[von.getMonth()]} ${von.getFullYear()}</h1>
<p class="mittel">${kennzahl('Mittel', mittel(imMonat))}${kennzahl('vormittags', haelfte('vormittag'), farben.vormittag)}${kennzahl('nachmittags', haelfte('nachmittag'), farben.nachmittag)}</p>
${diagramm(imMonat, von, bis, skala, farben)}
<p class="hinweis">Je Tageshälfte obere Linie SYS, untere DIA; gestrichelt 80 und 140 mmHg.</p>
<table>
<thead><tr><th></th><th colspan="3">Vormittag</th><th colspan="3">Nachmittag</th></tr><tr><th>Datum</th><th>SYS</th><th>DIA</th><th>Puls</th><th>SYS</th><th>DIA</th><th>Puls</th></tr></thead>
<tbody>${zeilen.join('')}</tbody>
</table>
${fuss}
</section>`;
  });

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 15mm 14mm; }
body { margin: 0; font: 10pt/1.2 sans-serif; color: #111; }
section + section { break-before: page; }
h1 { font-size: 16pt; margin: 0 0 2pt; }
p { margin: 2pt 0; }
.mittel span { margin-right: 14pt; white-space: nowrap; }
.mittel i { display: inline-block; width: 8pt; height: 8pt; border-radius: 4pt; margin-right: 4pt; }
.hinweis { color: #666; font-size: 8pt; }
svg { display: block; width: 100%; margin: 8pt 0 2pt; }
table { width: 100%; border-collapse: collapse; margin: 8pt 0 4pt; }
th, td { padding: 1pt 6pt; text-align: right; border-bottom: 0.5pt solid #ccc; }
th:first-child, td:first-child { text-align: left; }
th[colspan] { text-align: center; border-bottom-color: #888; }
td:nth-child(4), th:nth-child(4) { border-right: 0.5pt solid #ccc; }
thead tr:first-child th:nth-child(2) { border-right: 0.5pt solid #ccc; }
</style></head><body>
${seiten.length ? seiten.join('\n') : `<p>Keine Messungen.</p>${fuss}`}
</body></html>`;
}
