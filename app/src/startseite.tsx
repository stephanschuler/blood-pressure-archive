// Übersicht der Messungen, Aufbau nach STARTSEITE.md.
import { Fragment, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import {
  AUSWAHL, filtern, gliedern, parseAuswahl, siebenTage, tagesbeginn, tageshaelfte, zeitpunkt, zwischen,
  type Auswahl, type Tag, type Tageshaelfte, type Werte, type Woche,
} from './auswertung';
import { getSetting, setSetting } from './db';
import type { Messpunkt, Messung } from './messung';
import type { Colors } from './theme';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONAT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONAT_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const LABEL: Record<Auswahl, string> = { vormittag: 'Vormittag', nachmittag: 'Nachmittag', beide: 'Beide' };
const ROT = '#E53946';

const p2 = (n: number) => String(n).padStart(2, '0');
const datum = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.`;
const uhr = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;

// Spaltenraster der Liste: Kalenderblatt, Abstand, Pfeil, Symbol, Uhrzeit; die Wertspalten teilen sich den Rest.
// Wochenzeile und Spaltenkopf richten sich danach aus.
const BLATT = 36;
const VOR_WERTEN = BLATT + 10 + 12 + 6 + 16 + 6 + 42;

export function Startseite({ messungen, c, onDelete }: { messungen: Messung[]; c: Colors; onDelete: (p: Messpunkt) => void }) {
  const [auswahl, setAuswahl] = useState(() => parseAuswahl(getSetting('tageshaelfte')));
  const [offen, setOffen] = useState(new Set<number>());
  if (!messungen.length) return <Text style={{ flex: 1, color: c.sub }}>Noch keine Messungen.</Text>;

  const heute = new Date();
  const ms = filtern(messungen, auswahl);
  const sieben = siebenTage(ms, heute);
  const waehlen = (a: Auswahl) => {
    setSetting('tageshaelfte', a);
    setAuswahl(a);
  };
  const umschalten = (m: Messung) =>
    setOffen((o) => {
      const n = new Set(o);
      const k = m.punkte[0].id;
      if (!n.delete(k)) n.add(k);
      return n;
    });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', backgroundColor: c.chip, borderRadius: 8, padding: 2, marginBottom: 6 }}>
        {AUSWAHL.map((a) => (
          <Pressable
            key={a}
            onPress={() => waehlen(a)}
            accessibilityRole="button"
            accessibilityState={{ selected: a === auswahl }}
            style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, paddingVertical: 6, borderRadius: 6, backgroundColor: a === auswahl ? c.bg : 'transparent' }}
          >
            {a !== 'beide' && <Tagesbogen haelfte={a} c={c} />}
            <Text style={{ fontSize: 12, color: a === auswahl ? c.text : c.sub, fontWeight: a === auswahl ? '600' : '400' }}>{LABEL[a]}</Text>
          </Pressable>
        ))}
      </View>
      <Kennzahl auswahl={auswahl} mittel={sieben.mittel} vorwoche={sieben.vorwoche} c={c} />
      <Diagramm ms={ms} heute={heute} c={c} />
      <View style={{ flexDirection: 'row', gap: 6, paddingLeft: VOR_WERTEN + 6, paddingVertical: 4, borderBottomWidth: 1, borderColor: c.line }}>
        {['SYS', 'DIA', 'PUL'].map((l) => <Text key={l} style={{ flex: 1, textAlign: 'right', fontSize: 11, color: c.sub }}>{l}</Text>)}
      </View>
      <SectionList
        style={{ flex: 1 }}
        sections={gliedern(ms)}
        stickySectionHeadersEnabled
        extraData={offen}
        keyExtractor={(z) => `${z.art}${(z.art === 'woche' ? z.von : z.tag).getTime()}`}
        renderSectionHeader={({ section }) => (
          <Text style={{ backgroundColor: c.bg, color: c.text, fontWeight: '700', paddingTop: 8, paddingBottom: 4, borderBottomWidth: 2, borderColor: ROT }}>
            {MONAT_LANG[section.monat.getMonth()]} {section.monat.getFullYear()}
          </Text>
        )}
        renderItem={({ item }) =>
          item.art === 'woche'
            ? <Wochenzeile w={item} c={c} />
            : <Tageszeile tag={item} bezug={sieben.mittel} offen={offen} onToggle={umschalten} onDelete={onDelete} c={c} />}
        ListEmptyComponent={<Text style={{ color: c.sub, marginTop: 12 }}>Keine Messungen am {LABEL[auswahl]}.</Text>}
      />
    </View>
  );
}

function Tagesbogen({ haelfte, c }: { haelfte: Tageshaelfte; c: Colors }) {
  const farbe = c[haelfte];
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M2 12.5A6 6 0 0 1 14 12.5" fill="none" stroke={farbe} strokeWidth={1.2} strokeDasharray="1.5 1.5" />
      <Line x1={1} x2={15} y1={12.8} y2={12.8} stroke={farbe} strokeWidth={1.4} />
      <Circle cx={haelfte === 'vormittag' ? 3.8 : 12.2} cy={8.3} r={2.4} fill={farbe} />
    </Svg>
  );
}

function Trend({ wert, bezug, c }: { wert: number; bezug?: number; c: Colors }) {
  if (bezug === undefined) return null;
  const d = wert - bezug;
  return <Text style={{ fontSize: 11, color: d > 0 ? c.up : d < 0 ? c.down : c.sub }}>{d > 0 ? '▲' : d < 0 ? '▼' : '•'}{Math.abs(d)}</Text>;
}

function Kennzahl({ auswahl, mittel, vorwoche, c }: { auswahl: Auswahl; mittel: Werte | null; vorwoche: Werte | null; c: Colors }) {
  const titel = `Ø 7 Tage${auswahl === 'beide' ? '' : auswahl === 'vormittag' ? ' vormittags' : ' nachmittags'} `;
  return (
    <View style={{ backgroundColor: c.chip, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 }}>
      <Text style={{ fontSize: 13, color: c.text }}>
        {titel}
        {mittel ? (
          <>
            <Text style={{ fontWeight: '700' }}>{mittel.sys}/{mittel.dia}</Text>{' '}
            <Trend wert={mittel.sys} bezug={vorwoche?.sys} c={c} /> <Trend wert={mittel.dia} bezug={vorwoche?.dia} c={c} />
            {' · '}<Text style={{ color: ROT }}>♥</Text> {mittel.puls} <Trend wert={mittel.puls} bezug={vorwoche?.puls} c={c} />
            {vorwoche && <Text style={{ fontSize: 10, color: c.sub }}>{'  '}Trend ggü. Vorwoche</Text>}
          </>
        ) : '–'}
      </Text>
    </View>
  );
}

const H = 44;
const LO = 60;
const HI = 170;

function Diagramm({ ms, heute, c }: { ms: Messung[]; heute: Date; c: Colors }) {
  const [breite, setBreite] = useState(0);
  const von = tagesbeginn(heute, 20);
  const bis = tagesbeginn(heute, -1);
  const x = (d: Date) => ((d.getTime() - von.getTime()) / (bis.getTime() - von.getTime())) * breite;
  const y = (v: number) => H - ((Math.min(Math.max(v, LO), HI) - LO) / (HI - LO)) * H;
  const verlauf = zwischen(ms, von, bis).reverse();
  const montage: Date[] = [];
  for (let d = von; d < bis; d = tagesbeginn(d, -1)) if (d.getDay() === 1) montage.push(d);
  const x7 = x(tagesbeginn(heute, 6));

  return (
    <View onLayout={(e) => setBreite(e.nativeEvent.layout.width)} style={{ marginTop: 6 }}>
      {breite > 0 && (
        <Svg width={breite} height={H + 12}>
          <Rect x={x7} y={0} width={breite - x7} height={H} fill={c.chip} />
          <SvgText x={x7 + 3} y={9} fontSize={8} fill={c.sub}>Ø 7 Tage</SvgText>
          {[80, 140].map((v) => (
            <Fragment key={v}>
              <Line x1={0} x2={breite} y1={y(v)} y2={y(v)} stroke={c.line} strokeDasharray="3 3" />
              <SvgText x={breite} y={y(v) - 2} fontSize={8} fill={c.sub} textAnchor="end">{v}</SvgText>
            </Fragment>
          ))}
          {montage.map((d) => <SvgText key={d.getTime()} x={x(d)} y={H + 10} fontSize={8} fill={c.sub}>{datum(d)}</SvgText>)}
          {(['vormittag', 'nachmittag'] as const).map((h) => {
            const punkte = verlauf.filter((m) => tageshaelfte(m) === h);
            const strich = h === 'nachmittag' ? '4 3' : undefined;
            return (['sys', 'dia'] as const).map((k) => punkte.length === 1
              ? <Circle key={h + k} cx={x(zeitpunkt(punkte[0]))} cy={y(punkte[0][k])} r={2} fill={c[k]} />
              : <Polyline key={h + k} points={punkte.map((m) => `${x(zeitpunkt(m))},${y(m[k])}`).join(' ')} fill="none" stroke={c[k]} strokeWidth={1.8} strokeDasharray={strich} />);
          })}
        </Svg>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, paddingBottom: 4 }}>
        <Text style={{ fontSize: 11, color: c.sys }}>━ SYS</Text>
        <Text style={{ fontSize: 11, color: c.dia }}>━ DIA</Text>
        {(['vormittag', 'nachmittag'] as const).map((h) => (
          <View key={h} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 11, color: c.sub }}>{h === 'vormittag' ? '━' : '╌'}</Text>
            <Tagesbogen haelfte={h} c={c} />
            <Text style={{ fontSize: 11, color: c.sub }}>{LABEL[h]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Ohne Bezug: Strich, wo ein Pfeil erwartet wird (Wochenzeile), sonst leer. */
function Wertspalten({ w, bezug, c, groesse = 18, strich }: { w: Werte; bezug: Werte | null; c: Colors; groesse?: number; strich?: boolean }) {
  return (['sys', 'dia', 'puls'] as const).map((k) => (
    <View key={k} style={{ flex: 1, alignItems: 'flex-end' }}>
      <Text style={{ fontSize: groesse, fontWeight: '700', color: c.text }}>{w[k]}</Text>
      {bezug ? <Trend wert={w[k]} bezug={bezug[k]} c={c} /> : <Text style={{ fontSize: 11, color: c.sub }}>{strich ? '–' : ' '}</Text>}
    </View>
  ));
}

function Wochenzeile({ w, c }: { w: Woche; c: Colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 6, borderBottomWidth: 1, borderColor: c.line }}>
      <View style={{ width: VOR_WERTEN }}>
        <Text style={{ color: c.text }}><Text style={{ fontWeight: '700' }}>KW {w.kw}</Text><Text style={{ fontSize: 11, color: c.sub }}> Ø Woche</Text></Text>
        <Text style={{ fontSize: 10, color: c.sub }}>{datum(w.von)}–{datum(w.bis)} · {w.anzahl} Mess.</Text>
      </View>
      <Wertspalten w={w.mittel} bezug={w.vorwoche} c={c} groesse={16} strich />
    </View>
  );
}

function Kalenderblatt({ d, c }: { d: Date; c: Colors }) {
  return (
    <View style={{ width: BLATT, borderRadius: 8, overflow: 'hidden', backgroundColor: c.chip, alignItems: 'stretch', marginTop: 3 }}>
      <Text style={{ backgroundColor: ROT, color: '#fff', fontSize: 9, textAlign: 'center' }}>{WOCHENTAG[d.getDay()]}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center' }}>{d.getDate()}</Text>
      <Text style={{ fontSize: 9, color: c.sub, textAlign: 'center', paddingBottom: 1 }}>{MONAT[d.getMonth()]}</Text>
    </View>
  );
}

type TagProps = { tag: Tag; bezug: Werte | null; offen: Set<number>; onToggle: (m: Messung) => void; onDelete: (p: Messpunkt) => void; c: Colors };

function Tageszeile({ tag, bezug, offen, onToggle, onDelete, c }: TagProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderColor: c.line }}>
      <Kalenderblatt d={tag.tag} c={c} />
      <View style={{ flex: 1 }}>
        {tag.messungen.map((m) => {
          const auf = offen.has(m.punkte[0].id);
          return (
            <View key={m.punkte[0].id}>
              <Pressable onPress={() => onToggle(m)} accessibilityRole="button" accessibilityState={{ expanded: auf }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
                <Text style={{ width: 12, color: c.sub, fontSize: 20, lineHeight: 22, textAlign: 'center', transform: [{ rotate: auf ? '90deg' : '0deg' }] }}>›</Text>
                <Tagesbogen haelfte={tageshaelfte(m)} c={c} />
                <View style={{ width: 42 }}>
                  <Text style={{ fontSize: 13, color: c.sub }}>{uhr(zeitpunkt(m))}</Text>
                  <Text style={{ fontSize: 10, color: c.sub }}>{m.punkte.length} Pkt.</Text>
                </View>
                <Wertspalten w={m} bezug={bezug} c={c} />
              </Pressable>
              {auf && (
                <View style={{ backgroundColor: c.chip, borderRadius: 8, paddingHorizontal: 10, marginLeft: 18, marginBottom: 8 }}>
                  {m.punkte.map((p) => (
                    <Pressable key={p.id} onLongPress={() => onDelete(p)} accessibilityLabel={`Messpunkt ${uhr(new Date(p.zeit))}, ${p.sys}/${p.dia}, Puls ${p.puls}`} style={{ flexDirection: 'row', gap: 6, paddingVertical: 5 }}>
                      <Text style={{ width: 40, fontSize: 13, color: c.sub }}>{uhr(new Date(p.zeit))}</Text>
                      {[p.sys, p.dia, p.puls].map((v, i) => <Text key={i} style={{ flex: 1, textAlign: 'right', fontSize: 14, color: c.text }}>{v}</Text>)}
                    </Pressable>
                  ))}
                  <Text style={{ fontSize: 11, color: c.sub, paddingTop: 2, paddingBottom: 6 }}>Messpunkt lange drücken zum Löschen</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
