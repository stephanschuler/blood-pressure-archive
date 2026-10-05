// Übersicht der Messungen, Aufbau nach STARTSEITE.md.
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, SectionList, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import {
  AUSWAHL, filtern, gliedern, siebenTage, tagesbeginn, tageshaelfte, tagSuchen, zeitpunkt,
  type Abschnitt, type Auswahl, type Tag, type Tageshaelfte, type Werte, type Woche,
} from './auswertung';
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

// Spaltenraster der Liste: Kalenderblatt, Abstand, Symbol, Uhrzeit mit Punktzahl; die Wertspalten teilen sich den Rest.
// Wochenzeile und Spaltenkopf richten sich danach aus.
const BLATT = 36;
const ZEIT = 58;
const VOR_WERTEN = BLATT + 10 + 16 + 6 + ZEIT;
// Zeilenhöhe der fetten Werte: Symbol und Uhrzeit stehen auf ihrer Höhe
const wertzeile = (groesse: number) => Math.round(groesse * 4 / 3);

type Sichtbar = (oben: Date) => void;
type Bereich = (unten: Date, oben: Date) => void;

export function Startseite({ messungen, auswahl, onAuswahl, c, onEdit, onDelete }: {
  messungen: Messung[]; auswahl: Auswahl; onAuswahl: (a: Auswahl) => void; c: Colors; onEdit: (p: Messpunkt) => void; onDelete: (p: Messpunkt) => void;
}) {
  const [offen, setOffen] = useState(new Set<number>());
  const [markiert, setMarkiert] = useState<number | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const ms = useMemo(() => filtern(messungen, auswahl), [messungen, auswahl]);
  const abschnitte = useMemo(() => gliedern(ms), [ms]);
  const liste = useRef<SectionList<Woche | Tag, Abschnitt>>(null);
  const ziel = useRef({ d: new Date(), versuche: 0 });
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
  const ziehenMelden = useRef((an: boolean) => {
    ziehend.current = an;
    melden();
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
            onPress={() => onAuswahl(a)}
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
      <Diagramm ms={ms} von={aeltester} heute={heute} bereich={bereich} c={c} />
      <View style={{ flexDirection: 'row', gap: 6, paddingLeft: VOR_WERTEN + 6, paddingVertical: 4, borderBottomWidth: 1, borderColor: c.line }}>
        {['SYS', 'DIA', 'PUL'].map((l) => <Text key={l} style={{ flex: 1, textAlign: 'right', fontSize: 11, color: c.sub }}>{l}</Text>)}
      </View>
      {/* reicht bis an den Bildschirmrand: App.tsx rückt um 16 ein */}
      <View style={{ flex: 1, marginRight: -16 }}>
        <SectionList
          ref={liste}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingRight: 16 }}
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
              : <Tageszeile tag={item} offen={offen} markiert={item.tag.getTime() === markiert} onToggle={umschalten} onEdit={onEdit} onDelete={onDelete} c={c} />}
          ListEmptyComponent={<Text style={{ color: c.sub, marginTop: 12 }}>Keine Messungen am {LABEL[auswahl]}.</Text>}
        />
        {aeltester && <Henkel abschnitte={abschnitte} sichtbar={sichtbar} onZiel={springen} onZiehen={ziehenMelden} c={c} />}
        {hinweis && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 16, bottom: 12, backgroundColor: '#333', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }}>
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
  return <Text style={{ fontSize: 11, color: d > 2 ? c.up : d < -2 ? c.down : c.sub }}>{d > 0 ? '▲' : d < 0 ? '▼' : '•'}{Math.abs(d)}</Text>;
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
          const strich = h === 'nachmittag' ? '4 3' : undefined;
          return (['sys', 'dia'] as const).map((k) => punkte.length === 1
            ? <Circle key={h + k} cx={x(zeitpunkt(punkte[0]).getTime())} cy={y(punkte[0][k])} r={2} fill={c[k]} />
            : <Polyline key={h + k} points={punkte.map((m) => `${x(zeitpunkt(m).getTime())},${y(m[k])}`).join(' ')} fill="none" stroke={c[k]} strokeWidth={1.8} strokeDasharray={strich} />);
        })}
      </>
    );
  }, [ms, anfang, bis, x7, breite, c]);

  // die Kacheln um den Ausschnitt, auch die, aus der die Animation kommt
  const kacheln: number[] = [];
  const k0 = breite ? Math.floor(-ziel / breite) : 0;
  for (let k = Math.max(k0 - 1, 0); k <= k0 + 2 && k * breite < x(bis); k++) kacheln.push(k);

  return (
    <View onLayout={(e) => setBreite(e.nativeEvent.layout.width)} style={{ marginTop: 6 }}>
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
      <Text style={{ fontSize: groesse, lineHeight: wertzeile(groesse), fontWeight: '700', color: c.text }}>{w[k]}</Text>
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
    <View style={{ width: BLATT, borderRadius: 8, overflow: 'hidden', backgroundColor: c.chip, alignItems: 'stretch', alignSelf: 'flex-start', marginTop: 3 }}>
      <Text style={{ backgroundColor: ROT, color: '#fff', fontSize: 9, textAlign: 'center' }}>{WOCHENTAG[d.getDay()]}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.text, textAlign: 'center' }}>{d.getDate()}</Text>
      <Text style={{ fontSize: 9, color: c.sub, textAlign: 'center', paddingBottom: 1 }}>{MONAT[d.getMonth()]}</Text>
    </View>
  );
}

type TagProps = { tag: Tag; offen: Set<number>; markiert: boolean; onToggle: (m: Messung) => void; onEdit: (p: Messpunkt) => void; onDelete: (p: Messpunkt) => void; c: Colors };

function Tageszeile({ tag, offen, markiert, onToggle, onEdit, onDelete, c }: TagProps) {
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
        {tag.messungen.map((m, i) => {
          const auf = offen.has(m.punkte[0].id);
          return (
            <View key={m.punkte[0].id}>
              <Pressable onPress={() => onToggle(m)} accessibilityRole="button" accessibilityState={{ expanded: auf }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 6 }}>
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
                <View style={{ backgroundColor: c.chip, borderRadius: 8, paddingHorizontal: 10, marginBottom: 8 }}>
                  {m.punkte.map((p) => (
                    <Pressable key={p.id} onPress={() => onEdit(p)} onLongPress={() => onDelete(p)} accessibilityLabel={`Messpunkt ${uhr(new Date(p.zeit))}, ${p.sys}/${p.dia}, Puls ${p.puls}`} style={{ flexDirection: 'row', gap: 6, paddingVertical: 5 }}>
                      <Text style={{ width: 40, fontSize: 13, color: c.sub }}>{uhr(new Date(p.zeit))}</Text>
                      {[p.sys, p.dia, p.puls].map((v, i) => <Text key={i} style={{ flex: 1, textAlign: 'right', fontSize: 14, color: c.text }}>{v}</Text>)}
                    </Pressable>
                  ))}
                  <Text style={{ fontSize: 11, color: c.sub, paddingTop: 2, paddingBottom: 6 }}>Antippen zum Bearbeiten, lange drücken zum Löschen</Text>
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

type HenkelProps = {
  abschnitte: Abschnitt[]; sichtbar: RefObject<Sichtbar | undefined>;
  onZiel: (d: Date) => Tag | undefined; onZiehen: (an: boolean) => void; c: Colors;
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
    const tag = onZiel(tage[i].tag);
    if (!tag) return;
    ticken();
    setOben(tag.tag);
    setBlase({ y: Math.min(Math.max(y(i), 24), hoehe - 24), titel: `${WOCHENTAG[tag.tag.getDay()]} ${datum(tag.tag)}${tag.tag.getFullYear()}` });
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
    setBlase(null);
    onZiehen(false);
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
