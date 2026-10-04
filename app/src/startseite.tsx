// Übersicht der Messungen, Aufbau nach STARTSEITE.md.
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Fragment, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Animated, PanResponder, Platform, Pressable, SectionList, Text, View, type ViewToken } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import {
  AUSWAHL, filtern, gliedern, parseAuswahl, siebenTage, tagesbeginn, tageshaelfte, tagSuchen, zeitpunkt, zwischen,
  type Abschnitt, type Auswahl, type Tag, type Tageshaelfte, type Werte, type Woche,
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
const LEISTE = 40;

type Sichtbar = (oben: Date) => void;

export function Startseite({ messungen, c, onDelete }: { messungen: Messung[]; c: Colors; onDelete: (p: Messpunkt) => void }) {
  const [auswahl, setAuswahl] = useState(() => parseAuswahl(getSetting('tageshaelfte')));
  const [offen, setOffen] = useState(new Set<number>());
  const [markiert, setMarkiert] = useState<number | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const ms = useMemo(() => filtern(messungen, auswahl), [messungen, auswahl]);
  const abschnitte = useMemo(() => gliedern(ms), [ms]);
  const liste = useRef<SectionList<Woche | Tag, Abschnitt>>(null);
  const ziel = useRef({ d: new Date(), versuche: 0 });
  const oben = useRef(new Date());
  const sichtbar = useRef<Sichtbar>(undefined);
  const zeitgeber = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => zeitgeber.current.forEach(clearTimeout), []);
  const spaeter = (f: () => void, ms: number) => zeitgeber.current.push(setTimeout(f, ms));
  // SectionList verlangt eine Funktion, die sich über die Lebensdauer nicht ändert
  const meldeSichtbar = useRef(({ viewableItems }: { viewableItems: ViewToken<Woche | Tag>[] }) => {
    const tage = viewableItems.flatMap((v) => (v.item?.art === 'tag' ? [v.item.tag] : []));
    if (!tage.length) return;
    oben.current = tage[0];
    sichtbar.current?.(tage[0]);
  }).current;
  if (!messungen.length) return <Text style={{ flex: 1, color: c.sub }}>Noch keine Messungen.</Text>;

  const heute = new Date();
  const sieben = siebenTage(ms, heute);
  const aeltester = (abschnitte.at(-1)?.data.at(-1) as Tag | undefined)?.tag;

  const springen = (d: Date, versuche = 0) => {
    ziel.current = { d, versuche };
    const z = tagSuchen(abschnitte, d);
    if (z) liste.current?.scrollToLocation({ sectionIndex: z.sectionIndex, itemIndex: z.itemIndex, viewOffset: 0, animated: false });
    return z?.tag;
  };
  const datumWaehlen = () =>
    DateTimePickerAndroid.open({
      value: oben.current,
      mode: 'date',
      minimumDate: aeltester,
      maximumDate: heute,
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        const tag = springen(d);
        if (!tag) return;
        setMarkiert(tag.tag.getTime());
        spaeter(() => setMarkiert(null), 1900);
        if (tag.tag.getTime() === tagesbeginn(d).getTime()) return;
        setHinweis(`Keine Messung am ${datum(d)}${d.getFullYear()}, nächste davor: ${WOCHENTAG[tag.tag.getDay()]} ${datum(tag.tag)}${tag.tag.getFullYear()}`);
        spaeter(() => setHinweis(null), 2800);
      },
    });
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
      <View style={{ flexDirection: 'row', gap: 6, paddingLeft: VOR_WERTEN + 6, paddingRight: LEISTE + 6 - 16, paddingVertical: 4, borderBottomWidth: 1, borderColor: c.line }}>
        {['SYS', 'DIA', 'PUL'].map((l) => <Text key={l} style={{ flex: 1, textAlign: 'right', fontSize: 11, color: c.sub }}>{l}</Text>)}
      </View>
      {/* reicht bis an den Bildschirmrand: App.tsx rückt um 16 ein */}
      <View style={{ flex: 1, marginRight: -16 }}>
        <SectionList
          ref={liste}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingRight: LEISTE + 6 }}
          sections={abschnitte}
          stickySectionHeadersEnabled
          extraData={[offen, markiert]}
          // beim Melden der Sichtbarkeit kommt für Monatskopf und -fuß der Abschnitt selbst
          keyExtractor={(z: Woche | Tag | Abschnitt) =>
            'monat' in z ? `monat${z.monat.getTime()}` : `${z.art}${(z.art === 'woche' ? z.von : z.tag).getTime()}`}
          onViewableItemsChanged={meldeSichtbar}
          // Ziel noch nicht vermessen: grob dorthin, dann genau
          onScrollToIndexFailed={(info) => {
            liste.current?.getScrollResponder()?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
            const { d, versuche } = ziel.current;
            if (versuche < 3) setTimeout(() => ziel.current.d === d && springen(d, versuche + 1), 50);
          }}
          renderSectionHeader={({ section }) => (
            <Pressable
              onPress={datumWaehlen}
              accessibilityRole="button"
              accessibilityHint="Datum wählen"
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, paddingTop: 8, paddingBottom: 4, borderBottomWidth: 2, borderColor: ROT }}
            >
              <Text style={{ flex: 1, color: c.text, fontWeight: '700' }}>{MONAT_LANG[section.monat.getMonth()]} {section.monat.getFullYear()}</Text>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={ROT} strokeWidth={2} strokeLinecap="round">
                <Rect x={3} y={5} width={18} height={16} rx={2} />
                <Path d="M3 10h18M8 3v4M16 3v4" />
              </Svg>
            </Pressable>
          )}
          renderItem={({ item }) =>
            item.art === 'woche'
              ? <Wochenzeile w={item} c={c} />
              : <Tageszeile tag={item} bezug={sieben.mittel} offen={offen} markiert={item.tag.getTime() === markiert} onToggle={umschalten} onDelete={onDelete} c={c} />}
          ListEmptyComponent={<Text style={{ color: c.sub, marginTop: 12 }}>Keine Messungen am {LABEL[auswahl]}.</Text>}
        />
        {aeltester && <Kurvenleiste abschnitte={abschnitte} von={aeltester} heute={heute} sichtbar={sichtbar} onZiel={springen} c={c} />}
        {hinweis && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: LEISTE + 10, bottom: 12, backgroundColor: '#333', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }}>
            <Text style={{ color: '#fff', fontSize: 13 }}>{hinweis}</Text>
          </View>
        )}
      </View>
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

type TagProps = { tag: Tag; bezug: Werte | null; offen: Set<number>; markiert: boolean; onToggle: (m: Messung) => void; onDelete: (p: Messpunkt) => void; c: Colors };

function Tageszeile({ tag, bezug, offen, markiert, onToggle, onDelete, c }: TagProps) {
  const leuchten = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!markiert) return;
    leuchten.setValue(1);
    Animated.timing(leuchten, { toValue: 0, duration: 1800, useNativeDriver: false }).start();
  }, [markiert, leuchten]);
  const hinterlegt = leuchten.interpolate({ inputRange: [0, 1], outputRange: ['rgba(229,57,70,0)', 'rgba(229,57,70,0.4)'] });
  return (
    <Animated.View style={{ flexDirection: 'row', gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderColor: c.line, backgroundColor: hinterlegt }}>
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
    </Animated.View>
  );
}

const ticken = () =>
  (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick) : Haptics.selectionAsync()).catch(() => {});
const monatsnummer = (d: Date) => d.getFullYear() * 12 + d.getMonth();

type LeisteProps = { abschnitte: Abschnitt[]; von: Date; heute: Date; sichtbar: RefObject<Sichtbar | undefined>; onZiel: (d: Date) => Tag | undefined; c: Colors };

/** Wochenmittel über die ganze Zeit, oben heute; zeigt den sichtbaren Ausschnitt, Antippen und Ziehen springt. */
function Kurvenleiste({ abschnitte, von, heute, sichtbar, onZiel, c }: LeisteProps) {
  const [hoehe, setHoehe] = useState(0);
  const [aktiv, setAktiv] = useState(false);
  const [oben, setOben] = useState(heute);
  const [blase, setBlase] = useState<{ y: number; titel: string } | null>(null);
  const wochen = useMemo(() => abschnitte.flatMap((a) => a.data.filter((z): z is Woche => z.art === 'woche')), [abschnitte]);
  const monat = useRef(-1);
  const start = useRef(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    sichtbar.current = (d) => {
      setOben(d);
      setAktiv(true);
      clearTimeout(t);
      t = setTimeout(() => setAktiv(false), 1500);
    };
    return () => {
      clearTimeout(t);
      sichtbar.current = undefined;
    };
  }, [sichtbar]);

  const spanne = Math.max(1, heute.getTime() - von.getTime());
  const y = (d: Date) => Math.min(Math.max((heute.getTime() - d.getTime()) / spanne, 0), 1) * hoehe;

  const ziehen = (py: number) => {
    const d = new Date(heute.getTime() - (Math.min(Math.max(py, 0), hoehe) / hoehe) * spanne);
    const tag = onZiel(d);
    if (!tag) return;
    setOben(tag.tag);
    const k = monatsnummer(tag.tag);
    if (k !== monat.current) {
      monat.current = k;
      ticken();
    }
    setBlase({ y: Math.min(Math.max(py, 24), hoehe - 24), titel: `${WOCHENTAG[tag.tag.getDay()]} ${datum(tag.tag)}${tag.tag.getFullYear()}` });
  };
  // PanResponder entsteht einmal; ziehen dagegen hängt an Höhe und Daten des letzten Renderns
  const aktuell = useRef(ziehen);
  aktuell.current = ziehen;
  const loslassen = () => setBlase(null);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      start.current = e.nativeEvent.locationY;
      monat.current = -1;
      aktuell.current(start.current);
    },
    onPanResponderMove: (_, g) => aktuell.current(start.current + g.dy),
    onPanResponderRelease: loslassen,
    onPanResponderTerminate: loslassen,
  })).current;

  const x = (v: number) => 3 + ((Math.min(Math.max(v, LO), HI) - LO) / (HI - LO)) * (LEISTE - 6);
  const jahre: number[] = [];
  for (let j = von.getFullYear() + 1; j <= heute.getFullYear(); j++) jahre.push(j);

  return (
    <>
      <View
        {...pan.panHandlers}
        onLayout={(e) => setHoehe(e.nativeEvent.layout.height)}
        accessibilityLabel="Zeitleiste"
        accessibilityRole="adjustable"
        accessibilityValue={{ text: `${MONAT_LANG[oben.getMonth()]} ${oben.getFullYear()}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onZiel(new Date(oben.getFullYear(), oben.getMonth() + (e.nativeEvent.actionName === 'increment' ? 2 : 0), 0))}
        style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: LEISTE, backgroundColor: c.bg, borderLeftWidth: 1, borderColor: c.line }}
      >
        {hoehe > 0 && (
          <Svg width={LEISTE} height={hoehe}>
            {[80, 140].map((v) => <Line key={v} x1={x(v)} x2={x(v)} y1={0} y2={hoehe} stroke={c.line} strokeDasharray="2 2" />)}
            {(['sys', 'dia'] as const).map((k) => (
              <Polyline key={k} points={wochen.map((wo) => `${x(wo.mittel[k])},${y(tagesbeginn(wo.von, -3))}`).join(' ')} fill="none" stroke={c[k]} strokeWidth={1.1} />
            ))}
            {jahre.map((j) => (
              <Fragment key={j}>
                <Line x1={0} x2={LEISTE} y1={y(new Date(j, 0, 1))} y2={y(new Date(j, 0, 1))} stroke={c.sub} />
                <SvgText x={2} y={y(new Date(j, 0, 1)) + 10} fontSize={9} fontWeight="700" fill={c.sub}>’{String(j - 1).slice(2)}</SvgText>
              </Fragment>
            ))}
          </Svg>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: y(oben) - 1, height: 2, backgroundColor: ROT }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: -9, width: 18, height: 28, borderRadius: 9, backgroundColor: ROT, top: y(oben) - 14, opacity: blase || aktiv ? 1 : 0.55, elevation: 2 }} />
      </View>
      {blase && (
        <View pointerEvents="none" style={{ position: 'absolute', right: LEISTE + 12, top: blase.y - 16, backgroundColor: ROT, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 12, elevation: 4 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{blase.titel}</Text>
        </View>
      )}
    </>
  );
}
