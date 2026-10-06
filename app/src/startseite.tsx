// Übersicht der Messungen, Aufbau nach STARTSEITE.md.
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, Modal, PanResponder, Platform, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import {
  AUSWAHL, filtern, gliedern, siebenTage, tagesbeginn, tageshaelfte, tagSuchen, zeitpunkt,
  type Abschnitt, type Auswahl, type Tag, type Tageshaelfte, type Werte, type Woche,
} from './auswertung';
import type { Messpunkt, Messung } from './messung';
import { lagen, MASSE, SYMBOL, wertzeile, ZEILE, type Masse, type Raster } from './raster';
import type { Colors } from './theme';

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONAT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONAT_LANG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const LABEL: Record<Auswahl, string> = { vormittag: 'Vormittag', nachmittag: 'Nachmittag', beide: 'Beide' };
const ROT = '#E53946';

const p2 = (n: number) => String(n).padStart(2, '0');
const datum = (d: Date) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.`;
const uhr = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;

// Spaltenraster der Liste: Kalenderblatt, Abstand, Symbol, Uhrzeit mit Punktzahl; die Wertspalten teilen sich den Rest.
// Wochenzeile und Spaltenkopf richten sich danach aus.
const BLATT = 36;
const ZEIT = 58;
const VOR_WERTEN = BLATT + 10 + 16 + 6 + ZEIT;

type Sichtbar = (oben: Date) => void;
type Bereich = (unten: Date, oben: Date) => void;

export function Startseite({ messungen, auswahl, raster, c, onEdit, onDelete }: {
  messungen: Messung[]; auswahl: Auswahl; raster: Raster; c: Colors; onEdit: (p: Messpunkt) => void; onDelete: (p: Messpunkt) => void;
}) {
  const [offen, setOffen] = useState(new Set<number>());
  const [markiert, setMarkiert] = useState<number | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const ms = useMemo(() => filtern(messungen, auswahl), [messungen, auswahl]);
  const abschnitte = useMemo(() => gliedern(ms), [ms]);
  const m = MASSE[raster];
  const { fontScale } = useWindowDimensions();
  const lage = useMemo(() => lagen(abschnitte, m, offen, fontScale), [abschnitte, m, offen, fontScale]);
  const liste = useRef<SectionList<Woche | Tag, Abschnitt>>(null);
  const oben = useRef(new Date());
  const sichtbar = useRef<Sichtbar>(undefined);
  const bereich = useRef<Bereich>(undefined);
  const zeitgeber = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => zeitgeber.current.forEach(clearTimeout), []);
  const spaeter = (f: () => void, ms: number) => zeitgeber.current.push(setTimeout(f, ms));
  // beim Ziehen stellt allein der Finger den Griff; die Liste landet erst nach Schätzen und Nachkorrigieren
  // und würde ihn zurückziehen, das Diagramm baute je Sprung Kacheln neu
  const ziehend = useRef(false);
  const zuletzt = useRef<Date[]>([]);
  const melden = useRef(() => {
    const tage = zuletzt.current;
    if (ziehend.current || !tage.length) return;
    sichtbar.current?.(tage[0]);
    bereich.current?.(tage[tage.length - 1], tage[0]);
  }).current;
  const ziehenMelden = useRef((an: boolean, springt = false) => {
    ziehend.current = an;
    // springt die Liste beim Loslassen noch, hält zuletzt den Stand davor; sie meldet dann selbst, außer am Listenende
    if (springt) spaeter(melden, 300);
    else melden();
  }).current;
  // SectionList verlangt eine Funktion, die sich über die Lebensdauer nicht ändert
  const meldeSichtbar = useRef(({ viewableItems }: { viewableItems: ViewToken<Woche | Tag>[] }) => {
    const tage = viewableItems.flatMap((v) => (v.item?.art === 'tag' ? [v.item.tag] : []));
    if (!tage.length) return;
    oben.current = tage[0];
    zuletzt.current = tage;
    melden();
  }).current;
  if (!messungen.length) return <Text style={{ flex: 1, color: c.sub }}>Noch keine Messungen.</Text>;

  const heute = new Date();
  const aeltester = (abschnitte.at(-1)?.data.at(-1) as Tag | undefined)?.tag;

  const springen = (d: Date) => {
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
  const umschalten = (m: Messung) =>
    setOffen((o) => {
      const n = new Set(o);
      const k = m.punkte[0].id;
      if (!n.delete(k)) n.add(k);
      return n;
    });

  return (
    <View style={{ flex: 1 }}>
      <Diagramm ms={ms} von={aeltester} heute={heute} bereich={bereich} c={c} />
      {/* reicht bis an beide Bildschirmränder: App.tsx rückt um 16 ein; die Wochenkarte ragt über */}
      <View style={{ flex: 1, marginHorizontal: -16 }}>
        <SectionList
          ref={liste}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          sections={abschnitte}
          stickySectionHeadersEnabled
          extraData={[offen, markiert, m]}
          // beim Melden der Sichtbarkeit kommt für Monatskopf und -fuß der Abschnitt selbst
          keyExtractor={(z: Woche | Tag | Abschnitt) =>
            'monat' in z ? `monat${z.monat.getTime()}` : `${z.art}${(z.art === 'woche' ? z.von : z.tag).getTime()}`}
          onViewableItemsChanged={meldeSichtbar}
          getItemLayout={(_, i) => ({ length: lage.laenge[i], offset: lage.versatz[i], index: i })}
          renderSectionHeader={({ section }) => (
            <Pressable
              onPress={datumWaehlen}
              accessibilityRole="button"
              accessibilityHint="Datum wählen"
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, paddingTop: m.kopf[0], paddingBottom: m.kopf[1], borderBottomWidth: 2, borderColor: ROT }}
            >
              <Text numberOfLines={1} style={{ flex: 1, lineHeight: ZEILE.kopf, color: c.text, fontWeight: '700' }}>{MONAT_LANG[section.monat.getMonth()]} {section.monat.getFullYear()}</Text>
              <Svg width={SYMBOL} height={SYMBOL} viewBox="0 0 24 24" fill="none" stroke={ROT} strokeWidth={2} strokeLinecap="round">
                <Rect x={3} y={5} width={18} height={16} rx={2} />
                <Path d="M3 10h18M8 3v4M16 3v4" />
              </Svg>
            </Pressable>
          )}
          renderItem={({ item, index, section }) =>
            item.art === 'woche'
              ? <Wochenzeile w={item} m={m} c={c} />
              : <Tageszeile tag={item} vorWoche={section.data[index + 1]?.art === 'woche'} offen={offen} markiert={item.tag.getTime() === markiert} onToggle={umschalten} onEdit={onEdit} onDelete={onDelete} m={m} c={c} />}
          ListEmptyComponent={<Text style={{ color: c.sub, marginTop: 12 }}>Keine Messungen am {LABEL[auswahl]}.</Text>}
        />
        {aeltester && <Henkel abschnitte={abschnitte} sichtbar={sichtbar} onZiel={springen} onZiehen={ziehenMelden} c={c} />}
        {hinweis && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 12, backgroundColor: '#333', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }}>
            <Text style={{ color: '#fff', fontSize: 13 }}>{hinweis}</Text>
          </View>
        )}
      </View>
      {/* unter der Liste: darüber trennte der klebende Monatskopf ihn von den Spalten */}
      <View style={{ flexDirection: 'row', gap: 6, paddingLeft: VOR_WERTEN + 6, paddingVertical: 4, borderBottomWidth: 2, borderColor: ROT }}>
        {['SYS', 'DIA', 'PUL'].map((l) => <Text key={l} style={{ flex: 1, textAlign: 'right', fontSize: 11, color: c.sub }}>{l}</Text>)}
      </View>
    </View>
  );
}

function Bogen({ haelfte, c }: { haelfte: Tageshaelfte; c: Colors }) {
  const farbe = c[haelfte];
  return (
    <>
      <Path d="M2 12.5A6 6 0 0 1 14 12.5" fill="none" stroke={farbe} strokeWidth={1.2} strokeDasharray="1.5 1.5" />
      <Line x1={1} x2={15} y1={12.8} y2={12.8} stroke={farbe} strokeWidth={1.4} />
      <Circle cx={haelfte === 'vormittag' ? 3.8 : 12.2} cy={8.3} r={2.4} fill={farbe} />
    </>
  );
}

function Tagesbogen({ haelfte, c, groesse = 16 }: { haelfte: Auswahl; c: Colors; groesse?: number }) {
  return (
    <Svg width={groesse} height={groesse} viewBox="0 0 16 16">
      {haelfte === 'beide' ? (
        <>
          <G x={-1} y={-1.5} scale={11 / 16}><Bogen haelfte="vormittag" c={c} /></G>
          <G x={6} y={5.5} scale={11 / 16}><Bogen haelfte="nachmittag" c={c} /></G>
        </>
      ) : <Bogen haelfte={haelfte} c={c} />}
    </Svg>
  );
}

function Trend({ wert, bezug, c }: { wert: number; bezug?: number; c: Colors }) {
  if (bezug === undefined) return null;
  const d = wert - bezug;
  return <Text style={{ fontSize: 11, lineHeight: ZEILE.pfeil, color: d > 2 ? c.up : d < -2 ? c.down : c.sub }}>{d > 0 ? '▲' : d < 0 ? '▼' : '•'}{Math.abs(d)}</Text>;
}

/** Kennzahl und Auswahl der Tageshälfte; App.tsx setzt sie in die Titelzeile. */
export function Kopf({ messungen, auswahl, onAuswahl, c }: { messungen: Messung[]; auswahl: Auswahl; onAuswahl: (a: Auswahl) => void; c: Colors }) {
  const mittel = useMemo(() => siebenTage(filtern(messungen, auswahl), new Date()).mittel, [messungen, auswahl]);
  return (
    <>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 10, color: c.sub }}>∅ 7-Tage:</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
            {mittel ? (
              <>
                <Text style={{ color: c.sys }}>{mittel.sys}</Text>/<Text style={{ color: c.dia }}>{mittel.dia}</Text>
                <Text style={{ fontSize: 13, fontWeight: '400' }}>, </Text>
                <Text style={{ fontSize: 11, fontWeight: '400', color: ROT }}>♥</Text>
                <Text style={{ fontSize: 11.5, fontWeight: '400', color: c.sub }}>{mittel.puls}</Text>
              </>
            ) : '–'}
          </Text>
        </View>
      </View>
      <View style={{ width: 1, height: 28, backgroundColor: c.line, marginRight: 12 }} />
      <AuswahlMenue auswahl={auswahl} onAuswahl={onAuswahl} c={c} />
    </>
  );
}

function AuswahlMenue({ auswahl, onAuswahl, c }: { auswahl: Auswahl; onAuswahl: (a: Auswahl) => void; c: Colors }) {
  const knopf = useRef<View>(null);
  const [offen, setOffen] = useState(false);
  const [lage, setLage] = useState({ top: 0, right: 0 });
  const { width } = useWindowDimensions();
  const oeffnen = () => {
    knopf.current?.measureInWindow((x, y, w, h) => setLage({ top: y + h + 4, right: width - x - w }));
    setOffen(true);
  };
  return (
    <>
      <Pressable
        ref={knopf}
        onPress={oeffnen}
        accessibilityRole="button"
        accessibilityLabel={`Tageshälfte: ${LABEL[auswahl]}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: c.chip, borderRadius: 8, paddingVertical: 5, paddingLeft: 8, paddingRight: 6 }}
      >
        <Tagesbogen haelfte={auswahl} c={c} groesse={18} />
        <Text style={{ fontSize: 10, color: c.sub }}>▾</Text>
      </Pressable>
      <Modal visible={offen} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOffen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOffen(false)} accessibilityLabel="Auswahl schließen" />
        <View style={{ position: 'absolute', ...lage, backgroundColor: c.bg, borderRadius: 8, padding: 4, elevation: 8 }}>
          {AUSWAHL.map((a) => (
            <Pressable
              key={a}
              onPress={() => { setOffen(false); onAuswahl(a); }}
              accessibilityRole="button"
              accessibilityLabel={LABEL[a]}
              accessibilityState={{ selected: a === auswahl }}
              style={{ paddingVertical: 9, paddingHorizontal: 10, borderRadius: 6, backgroundColor: a === auswahl ? c.chip : 'transparent' }}
            >
              <Tagesbogen haelfte={a} c={c} groesse={18} />
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

const H = 44;
const LO = 60;
const HI = 170;

const TAG = 864e5;
const TAGE = 21;
const y = (v: number) => H - ((Math.min(Math.max(v, LO), HI) - LO) / (HI - LO)) * H;

// react-native-svg zeichnet auf Android in eine Bitmap der vollen Fläche: die ganze Zeit als ein Svg sprengt sie
const Kachel = memo(function Kachel({ k, breite, children }: { k: number; breite: number; children: ReactNode }) {
  return <Svg width={breite} height={H + 12} viewBox={`${k * breite} 0 ${breite} ${H + 12}`} style={{ position: 'absolute', left: k * breite }}>{children}</Svg>;
});

/** 21 Tage, die in der Liste sichtbaren in der Mitte; am Anfang und Ende der Zeit an den Rand gerückt. */
function Diagramm({ ms, von, heute, bereich, c }: { ms: Messung[]; von?: Date; heute: Date; bereich: RefObject<Bereich | undefined>; c: Colors }) {
  const [breite, setBreite] = useState(0);
  const [sichtbar, setSichtbar] = useState<[number, number] | null>(null);
  const verschiebung = useRef(new Animated.Value(0)).current;
  const zuletzt = useRef<number | null>(null);
  useEffect(() => {
    bereich.current = (unten, oben) => setSichtbar([unten.getTime(), tagesbeginn(oben, -1).getTime()]);
    return () => { bereich.current = undefined; };
  }, [bereich]);

  const bis = tagesbeginn(heute, -1).getTime();
  const anfang = Math.min(von?.getTime() ?? bis, bis - TAGE * TAG);
  const x7 = tagesbeginn(heute, 6).getTime();
  const x = (t: number) => ((t - anfang) / TAG) * (breite / TAGE);
  const start = sichtbar ? Math.min(Math.max((sichtbar[0] + sichtbar[1] - TAGE * TAG) / 2, anfang), bis - TAGE * TAG) : bis - TAGE * TAG;
  const ziel = -x(start);

  useEffect(() => {
    if (!breite) return;
    // weiter als eine Breite, etwa nach dem Ziehen am Henkel: springen, sonst liefen leere Kacheln durch
    if (zuletzt.current === null || Math.abs(ziel - zuletzt.current) > breite) verschiebung.setValue(ziel);
    else Animated.timing(verschiebung, { toValue: ziel, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    zuletzt.current = ziel;
  }, [ziel, breite, verschiebung]);

  const szene = useMemo(() => {
    const x = (t: number) => ((t - anfang) / TAG) * (breite / TAGE);
    const verlauf = [...ms].reverse();
    const montage: Date[] = [];
    for (let d = new Date(anfang); d.getTime() < bis; d = tagesbeginn(d, -1)) if (d.getDay() === 1) montage.push(d);
    return (
      <>
        <Rect x={x(x7)} y={0} width={x(bis) - x(x7)} height={H} fill={c.chip} />
        <SvgText x={x(x7) + 3} y={9} fontSize={8} fill={c.sub}>Ø 7 Tage</SvgText>
        {[80, 140].map((v) => <Line key={v} x1={0} x2={x(bis)} y1={y(v)} y2={y(v)} stroke={c.line} strokeDasharray="3 3" />)}
        {montage.map((d) => <SvgText key={d.getTime()} x={x(d.getTime())} y={H + 10} fontSize={8} fill={c.sub}>{datum(d)}</SvgText>)}
        {(['vormittag', 'nachmittag'] as const).map((h) => {
          const punkte = verlauf.filter((m) => tageshaelfte(m) === h);
          const [sys, dia] = (['sys', 'dia'] as const).map((k) => punkte.map((m) => [x(zeitpunkt(m).getTime()), y(m[k])]));
          return (
            <G key={h} fill="none" stroke={c[h]} strokeWidth={1.2} strokeLinejoin="round">
              <Polygon points={[...sys, ...[...dia].reverse()].join(' ')} fill={c[h]} fillOpacity={0.18} stroke="none" />
              <Polyline points={sys.join(' ')} />
              <Polyline points={dia.join(' ')} />
            </G>
          );
        })}
      </>
    );
  }, [ms, anfang, bis, x7, breite, c]);

  // die Kacheln um den Ausschnitt, auch die, aus der die Animation kommt
  const kacheln: number[] = [];
  const k0 = breite ? Math.floor(-ziel / breite) : 0;
  for (let k = Math.max(k0 - 1, 0); k <= k0 + 2 && k * breite < x(bis); k++) kacheln.push(k);

  return (
    <View onLayout={(e) => setBreite(e.nativeEvent.layout.width)} style={{ marginTop: 6, paddingBottom: 4 }}>
      {breite > 0 && (
        <View style={{ height: H + 12, overflow: 'hidden' }}>
          <Animated.View style={{ position: 'absolute', top: 0, left: 0, width: x(bis), height: H + 12, transform: [{ translateX: verschiebung }] }}>
            {kacheln.map((k) => <Kachel key={k} k={k} breite={breite}>{szene}</Kachel>)}
            {sichtbar && <View pointerEvents="none" style={{ position: 'absolute', top: 0, height: H, left: x(sichtbar[0]), width: x(sichtbar[1]) - x(sichtbar[0]), backgroundColor: 'rgba(229,57,70,0.16)' }} />}
          </Animated.View>
          <Svg width={24} height={H} pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0 }}>
            {[80, 140].map((v) => <SvgText key={v} x={24} y={y(v) - 2} fontSize={8} fill={c.sub} textAnchor="end">{v}</SvgText>)}
          </Svg>
        </View>
      )}
    </View>
  );
}

/** Ohne Bezug: Strich, wo ein Pfeil erwartet wird (Wochenzeile), sonst leer. */
function Wertspalten({ w, bezug, c, groesse = 18, farbe = c.text, strich }: { w: Werte; bezug: Werte | null; c: Colors; groesse?: number; farbe?: string; strich?: boolean }) {
  return (['sys', 'dia', 'puls'] as const).map((k) => (
    <View key={k} style={{ flex: 1, alignItems: 'flex-end' }}>
      <Text style={{ fontSize: groesse, lineHeight: wertzeile(groesse), fontWeight: '700', color: farbe }}>{w[k]}</Text>
      {bezug ? <Trend wert={w[k]} bezug={bezug[k]} c={c} /> : <Text style={{ fontSize: 11, lineHeight: ZEILE.pfeil, color: c.sub }}>{strich ? '–' : ' '}</Text>}
    </View>
  ));
}

function Wochenzeile({ w, m, c }: { w: Woche; m: Masse; c: Colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: m.woche[0], marginHorizontal: -8, paddingTop: m.woche[1], paddingBottom: m.woche[2], paddingHorizontal: 8, borderRadius: 12, backgroundColor: c.chip }}>
      <View style={{ width: VOR_WERTEN, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* bleibt auch im Dunkelmodus hell */}
        <View style={{ width: BLATT, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff', alignSelf: 'center' }}>
          <Text style={{ backgroundColor: '#666', color: '#fff', fontSize: 9, lineHeight: ZEILE.kwKopf, textAlign: 'center' }}>KW</Text>
          <Text style={{ fontSize: 15, lineHeight: ZEILE.kw, fontWeight: '700', color: '#111', textAlign: 'center', paddingTop: 2, paddingBottom: 3 }}>{w.kw}</Text>
        </View>
        <View>
          <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: ZEILE.zeitraum, color: c.text }}>{datum(w.von)}–{datum(w.bis)}</Text>
          <Text numberOfLines={1} style={{ fontSize: 10, lineHeight: ZEILE.anzahl, color: c.sub }}>{w.anzahl === 1 ? '1 Messung' : `${w.anzahl} Messungen`}</Text>
        </View>
      </View>
      <Wertspalten w={w.mittel} bezug={w.vorwoche} c={c} groesse={16} farbe={c.mid} strich />
    </View>
  );
}

function Kalenderblatt({ d, oben, c }: { d: Date; oben: number; c: Colors }) {
  return (
    <View style={{ width: BLATT, borderRadius: 8, overflow: 'hidden', backgroundColor: c.chip, alignItems: 'stretch', alignSelf: 'flex-start', marginTop: oben }}>
      <Text style={{ backgroundColor: ROT, color: '#fff', fontSize: 9, lineHeight: ZEILE.blattKopf, textAlign: 'center' }}>{WOCHENTAG[d.getDay()]}</Text>
      <Text style={{ fontSize: 15, lineHeight: ZEILE.tag, fontWeight: '700', color: c.text, textAlign: 'center' }}>{d.getDate()}</Text>
      <Text style={{ fontSize: 9, lineHeight: ZEILE.monat, color: c.sub, textAlign: 'center', paddingBottom: 1 }}>{MONAT[d.getMonth()]}</Text>
    </View>
  );
}

type TagProps = { tag: Tag; vorWoche: boolean; offen: Set<number>; markiert: boolean; onToggle: (m: Messung) => void; onEdit: (p: Messpunkt) => void; onDelete: (p: Messpunkt) => void; m: Masse; c: Colors };

function Tageszeile({ tag, vorWoche, offen, markiert, onToggle, onEdit, onDelete, m: masse, c }: TagProps) {
  const leuchten = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!markiert) return;
    leuchten.setValue(1);
    Animated.timing(leuchten, { toValue: 0, duration: 1800, useNativeDriver: false }).start();
  }, [markiert, leuchten]);
  const hinterlegt = leuchten.interpolate({ inputRange: [0, 1], outputRange: ['rgba(229,57,70,0)', 'rgba(229,57,70,0.4)'] });
  return (
    <Animated.View style={{ flexDirection: 'row', gap: 10, backgroundColor: hinterlegt }}>
      {!vorWoche && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: c.line }} />}
      <Kalenderblatt d={tag.tag} oben={masse.blatt} c={c} />
      <View style={{ flex: 1 }}>
        {tag.messungen.map((m, i) => {
          const auf = offen.has(m.punkte[0].id);
          return (
            <View key={m.punkte[0].id}>
              <Pressable onPress={() => onToggle(m)} accessibilityRole="button" accessibilityState={{ expanded: auf }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: masse.messung[0], paddingBottom: masse.messung[1] }}>
                <View style={{ height: wertzeile(18), flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Tagesbogen haelfte={tageshaelfte(m)} c={c} />
                  <View style={{ width: ZEIT, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 13, color: c.sub }}>{uhr(zeitpunkt(m))}</Text>
                    <Text accessibilityLabel={m.punkte.length === 1 ? '1 Messpunkt' : `${m.punkte.length} Messpunkte`} style={{ fontSize: 9, color: c.sub, backgroundColor: c.chip, borderRadius: 6, paddingHorizontal: 4, overflow: 'hidden' }}>{m.punkte.length}</Text>
                  </View>
                </View>
                <Wertspalten w={m} bezug={tag.vorige[i]} c={c} />
              </Pressable>
              {auf && (
                <View style={{ backgroundColor: c.chip, borderRadius: 8, paddingHorizontal: 10 }}>
                  {m.punkte.map((p) => (
                    <Pressable key={p.id} onPress={() => onEdit(p)} onLongPress={() => onDelete(p)} accessibilityLabel={`Messpunkt ${uhr(new Date(p.zeit))}, ${p.sys}/${p.dia}, Puls ${p.puls}`} style={{ flexDirection: 'row', gap: 6, paddingVertical: masse.punkt }}>
                      <Text style={{ width: 40, fontSize: 13, lineHeight: ZEILE.punkt, color: c.sub }}>{uhr(new Date(p.zeit))}</Text>
                      {[p.sys, p.dia, p.puls].map((v, i) => <Text key={i} style={{ flex: 1, textAlign: 'right', fontSize: 14, lineHeight: ZEILE.punkt, color: c.text }}>{v}</Text>)}
                    </Pressable>
                  ))}
                  <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: ZEILE.hinweis, color: c.sub, paddingTop: masse.hinweis[0], paddingBottom: masse.hinweis[1] }}>Antippen zum Bearbeiten, lange drücken zum Löschen</Text>
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

// halbe Pille an der Bildkante: sichtbar 14 dp, in Ruhe bis auf den Anriss eingefahren
const HENKEL = 14;
const ANRISS = 3;
const GRIFF = 64;
// oben bleibt der Kalenderknopf des Monatskopfs frei
const BAHN = 56;
// Finger so weit links vom Rand: Tag für Tag, je JE_TAG Fingerweg
const FEIN_AB = 60;
const JE_TAG = 10;
// grob springt die Liste erst, wenn der Finger so lange auf einem Tag ruht
const RUHE = 150;

type HenkelProps = {
  abschnitte: Abschnitt[]; sichtbar: RefObject<Sichtbar | undefined>;
  onZiel: (d: Date) => Tag | undefined; onZiehen: (an: boolean, springt?: boolean) => void; c: Colors;
};
type Finger = { py: number; x: number };

/** Fährt beim Scrollen aus; Ziehen springt von Tag zu Tag, jeder Tag gleich weit, mit einem Tick je Tag. */
function Henkel({ abschnitte, sichtbar, onZiel, onZiehen, c }: HenkelProps) {
  const { width } = useWindowDimensions();
  const tage = useMemo(() => abschnitte.flatMap((a) => a.data.filter((z): z is Tag => z.art === 'tag')), [abschnitte]);
  const [hoehe, setHoehe] = useState(0);
  const [aktiv, setAktiv] = useState(false);
  const [oben, setOben] = useState<Date | null>(null);
  const [blase, setBlase] = useState<{ y: number; titel: string } | null>(null);
  const aus = useRef(new Animated.Value(0)).current;
  const finger = useRef<Finger>({ py: 0, x: 0 });
  const bezug = useRef({ i: 0, py: 0, fein: false });
  const letzter = useRef(-1);
  const start = useRef(0);
  const bild = useRef(0);
  const ruhe = useRef<{ t?: ReturnType<typeof setTimeout>; sprung?: () => void }>({});

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
      clearTimeout(ruhe.current.t);
      cancelAnimationFrame(bild.current);
      sichtbar.current = undefined;
    };
  }, [sichtbar]);

  const zeigen = aktiv || !!blase;
  useEffect(() => {
    Animated.timing(aus, { toValue: zeigen ? 1 : 0, duration: 300, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: true }).start();
  }, [zeigen, aus]);

  const o = oben ?? tage[0].tag;
  const index = Math.max(0, tage.findIndex((t) => t.tag.getTime() <= o.getTime()));
  const n = Math.max(1, tage.length - 1);
  const spur = Math.max(1, hoehe - 2 * BAHN);
  const y = (i: number) => BAHN + (Math.min(Math.max(i, 0), n) / n) * spur;

  const ziehen = ({ py, x }: Finger) => {
    if (!hoehe) return;
    const fein = width - x > FEIN_AB;
    // beim Wechsel der Art von hier aus weiterzählen, sonst spränge die Liste
    if (fein !== bezug.current.fein) bezug.current = { i: letzter.current < 0 ? bezug.current.i : letzter.current, py, fein };
    const roh = fein ? bezug.current.i + Math.round((py - bezug.current.py) / JE_TAG) : Math.round(((py - BAHN) / spur) * n);
    const i = Math.min(Math.max(roh, 0), tage.length - 1);
    if (i === letzter.current) return;
    letzter.current = i;
    const tag = tage[i].tag;
    clearTimeout(ruhe.current.t);
    ruhe.current = {};
    // grob liegt jedes Ziel ungemessen weit weg: die Liste schätzte, zeichnete leer und rutschte nach
    if (fein) onZiel(tag);
    else ruhe.current = { sprung: () => onZiel(tag), t: setTimeout(landen, RUHE) };
    ticken();
    setOben(tag);
    setBlase({ y: Math.min(Math.max(y(i), 24), hoehe - 24), titel: `${WOCHENTAG[tag.getDay()]} ${datum(tag)}${tag.getFullYear()}` });
  };
  const landen = () => {
    const { t, sprung } = ruhe.current;
    clearTimeout(t);
    ruhe.current = {};
    sprung?.();
    return !!sprung;
  };
  const beginnen = (locationY: number, x: number) => {
    onZiehen(true);
    start.current = y(index) + locationY - GRIFF / 2;
    bezug.current = { i: index, py: start.current, fein: width - x > FEIN_AB };
    letzter.current = -1;
    vormerken({ py: start.current, x });
  };
  // PanResponder entsteht einmal; ziehen und beginnen hängen an Höhe und Daten des letzten Renderns
  const aktuell = useRef({ ziehen, beginnen });
  aktuell.current = { ziehen, beginnen };
  // höchstens ein Sprung je Frame: jedes Move-Event einzeln staut den JS-Thread, die Liste rendert nicht nach
  const vormerken = (f: Finger) => {
    finger.current = f;
    bild.current ||= requestAnimationFrame(() => {
      bild.current = 0;
      aktuell.current.ziehen(finger.current);
    });
  };
  const loslassen = () => {
    if (bild.current) {
      cancelAnimationFrame(bild.current);
      bild.current = 0;
      aktuell.current.ziehen(finger.current);
    }
    const springt = landen();
    setBlase(null);
    onZiehen(false, springt);
  };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => aktuell.current.beginnen(e.nativeEvent.locationY, e.nativeEvent.pageX),
    onPanResponderMove: (_, g) => vormerken({ py: start.current + g.dy, x: g.moveX }),
    onPanResponderRelease: loslassen,
    onPanResponderTerminate: loslassen,
  })).current;

  return (
    <View testID="henkelbahn" pointerEvents="box-none" onLayout={(e) => setHoehe(e.nativeEvent.layout.height)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
      <View
        {...pan.panHandlers}
        accessibilityLabel="Zeitleiste"
        accessibilityRole="adjustable"
        accessibilityValue={{ text: `${MONAT_LANG[o.getMonth()]} ${o.getFullYear()}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onZiel(new Date(o.getFullYear(), o.getMonth() + (e.nativeEvent.actionName === 'increment' ? 2 : 0), 0))}
        style={{ position: 'absolute', right: 0, top: y(index) - GRIFF / 2, width: 2 * HENKEL, height: GRIFF, alignItems: 'flex-end', justifyContent: 'center' }}
      >
        <Animated.View
          style={{
            width: HENKEL, height: 4 * HENKEL, borderTopLeftRadius: HENKEL, borderBottomLeftRadius: HENKEL, backgroundColor: ROT, paddingLeft: 2, justifyContent: 'center',
            opacity: aus.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
            transform: [{ translateX: aus.interpolate({ inputRange: [0, 1], outputRange: [HENKEL - ANRISS, 0] }) }],
          }}
        >
          <Svg width={10} height={20} viewBox="0 0 10 20">
            <Path d="M2 7l3-3 3 3M2 13l3 3 3-3" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </View>
      {blase && (
        <View pointerEvents="none" style={{ position: 'absolute', right: 2 * HENKEL - 2, top: blase.y - 14, backgroundColor: c.tooltip, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8 }}>
          <Text style={{ color: c.tooltipText, fontSize: 14, fontWeight: '500' }}>{blase.titel}</Text>
        </View>
      )}
    </View>
  );
}
