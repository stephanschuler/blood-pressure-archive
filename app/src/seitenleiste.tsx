// Seitenleiste nach DATENSICHERUNG.md: links die Leiste mit Aussehen, Sicherung, Export, rechts deren Seite.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Animated, Image, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FORMATE, ZIELE, ZIEL_LABEL, zuletzt, type Format, type Ziel } from './export';
import { RASTER, type Raster } from './raster';
import { AKZENT_FARBEN, AKZENT_LABEL, AKZENTE, THEMES, THEME_LABEL, type Akzent, type Colors, type Theme } from './theme';

export type Eintrag = { label: string; detail?: string; icon: number; onPress: () => void };

const BREITE = 330;
// setzt buildenv/build-apk.sh; Metro und Tests kennen sie nicht
const VERSION = process.env.EXPO_PUBLIC_VERSION ?? 'Entwicklung';

const SEITEN = [
  ['aussehen', 'Aussehen', require('../assets/palette.png')],
  ['sicherung', 'Sicherung', require('../assets/backup.png')],
  ['export', 'Export', require('../assets/download.png')],
] as const;
type Seite = (typeof SEITEN)[number][0];

const FORMAT_ICON: Record<Format, number> = {
  csv: require('../assets/csv.png'), xlsx: require('../assets/table-view.png'), pdf: require('../assets/picture-as-pdf.png'),
};
const ZIEL_ICON: Record<Ziel, number> = { ordner: require('../assets/folder.png'), teilen: require('../assets/share.png') };

export function Seitenleiste({ offen, onClose, theme, onTheme, raster, onRaster, akzent, onAkzent, sicherung, format, onFormat, ziel, onZiel, onExport, exportiert, fehler, c }: {
  offen: boolean; onClose: () => void; theme: Theme; onTheme: (t: Theme) => void; raster: Raster; onRaster: (r: Raster) => void;
  akzent: Akzent; onAkzent: (a: Akzent) => void; sicherung: Eintrag[];
  format: Format; onFormat: (f: Format) => void; ziel: Ziel; onZiel: (z: Ziel) => void; onExport: () => void; exportiert: string | null;
  fehler: string | null; c: Colors;
}) {
  const insets = useSafeAreaInsets();
  const schema = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [seite, setSeite] = useState<Seite>('aussehen');
  const x = useRef(new Animated.Value(-BREITE)).current;
  useEffect(() => {
    if (offen) Animated.timing(x, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [offen]);
  const schliessen = () => Animated.timing(x, { toValue: -BREITE, duration: 150, useNativeDriver: true }).start(onClose);
  const titel = { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, fontSize: 12, fontWeight: '600', color: c.sub } as const;

  const inhalt = {
    aussehen: (
      <>
        <Text style={titel}>Darstellung</Text>
        <Umschalter werte={THEMES} label={THEME_LABEL} wert={theme} onWahl={onTheme} c={c} />
        <Text style={titel}>Raster</Text>
        <Umschalter werte={RASTER} label={{ 48: '48', 52: '52', 56: '56' }} wert={raster} onWahl={onRaster} c={c} />
        <Text style={titel}>Akzente</Text>
        <Umschalter werte={AKZENTE} label={AKZENT_LABEL} wert={akzent} onWahl={onAkzent} c={c} inhalt={(a) => <Kreis {...AKZENT_FARBEN[a][schema]} />} />
      </>
    ),
    sicherung: (
      <>
        <Text style={titel}>Datensicherung</Text>
        {sicherung.map((e) => (
          <Pressable
            key={e.label}
            accessibilityLabel={e.label}
            accessibilityHint={e.detail}
            onPress={() => { schliessen(); e.onPress(); }}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <Image source={e.icon} style={{ width: 24, height: 24, tintColor: c.sub }} />
            <View>
              <Text style={{ fontSize: 15, color: c.text }}>{e.label}</Text>
              {e.detail && <Text style={{ fontSize: 12, color: c.sub }}>{e.detail}</Text>}
            </View>
          </Pressable>
        ))}
      </>
    ),
    export: (
      <>
        <Text style={titel}>Format</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginVertical: 4 }}>
          {FORMATE.map((f) => (
            <Pressable
              key={f}
              onPress={() => onFormat(f)}
              accessibilityRole="button"
              accessibilityLabel={f.toUpperCase()}
              accessibilityState={{ selected: f === format }}
              style={{ flex: 1, gap: 4, padding: 10, borderRadius: 12, borderWidth: f === format ? 2 : 1, borderColor: f === format ? c.focus : c.line, backgroundColor: f === format ? c.selected : 'transparent' }}
            >
              <Image source={FORMAT_ICON[f]} style={{ width: 24, height: 24, tintColor: c.sub }} />
              <Text style={{ fontSize: 13, color: c.text, fontWeight: f === format ? '600' : '400' }}>{f.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={titel}>Ziel</Text>
        <Umschalter werte={ZIELE} label={ZIEL_LABEL} wert={ziel} onWahl={onZiel} c={c} inhalt={(z) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image source={ZIEL_ICON[z]} style={{ width: 18, height: 18, tintColor: z === ziel ? c.text : c.sub }} />
            <Text style={{ fontSize: 13, color: z === ziel ? c.text : c.sub, fontWeight: z === ziel ? '600' : '400' }}>{ZIEL_LABEL[z]}</Text>
          </View>
        )} />
        <View style={{ marginTop: 'auto', borderTopWidth: 1, borderColor: c.line, padding: 16, gap: 12 }}>
          <Pressable
            onPress={() => { schliessen(); onExport(); }}
            accessibilityRole="button"
            accessibilityLabel="Speichern"
            style={{ height: 40, borderRadius: 20, backgroundColor: c.focus, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: c.focusText }}>Speichern</Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: c.sub, textAlign: 'center' }}>{zuletzt(exportiert)}</Text>
        </View>
      </>
    ),
  }[seite];

  return (
    <Modal visible={offen} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={schliessen}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#0008', opacity: x.interpolate({ inputRange: [-BREITE, 0], outputRange: [0, 1] }) }]}>
        <Pressable style={{ flex: 1 }} onPress={schliessen} accessibilityLabel="Menü schließen" />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: BREITE, backgroundColor: c.bg, elevation: 16, paddingTop: insets.top, paddingBottom: insets.bottom, transform: [{ translateX: x }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: c.line }}>
          <Image source={require('../assets/icon.png')} style={{ width: 32, height: 32, borderRadius: 8 }} />
          <Text style={{ fontSize: 20, fontWeight: '600', color: c.text }}>Blutdruck</Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 76, paddingTop: 8, borderRightWidth: 1, borderColor: c.line }}>
            {SEITEN.map(([s, label, icon]) => (
              <Pressable
                key={s}
                onPress={() => setSeite(s)}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: s === seite }}
                style={{ alignItems: 'center', gap: 4, paddingVertical: 10 }}
              >
                <View style={{ width: 48, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: s === seite ? c.selected : 'transparent' }}>
                  <Image source={icon} style={{ width: 24, height: 24, tintColor: s === seite ? c.text : c.sub }} />
                </View>
                <Text style={{ fontSize: 11, color: s === seite ? c.text : c.sub, fontWeight: s === seite ? '600' : '400' }}>{label}</Text>
              </Pressable>
            ))}
            <Text style={{ marginTop: 'auto', paddingHorizontal: 4, paddingVertical: 8, fontSize: 9, color: c.sub, textAlign: 'center' }}>{VERSION.replace('-', '\n')}</Text>
            {fehler && (
              <Pressable onPress={() => Alert.alert('Erkennung gescheitert', fehler)} accessibilityRole="button" accessibilityLabel="Erkennung gescheitert" style={{ alignItems: 'center', paddingBottom: 12 }}>
                <Image source={require('../assets/error.png')} style={{ width: 24, height: 24, tintColor: c.up }} />
              </Pressable>
            )}
          </View>
          <View style={{ flex: 1 }}>{inhalt}</View>
        </View>
      </Animated.View>
    </Modal>
  );
}

/** Mit `inhalt` statt Text: `label` bleibt Name für die Bedienungshilfe. */
function Umschalter<T extends string>({ werte, label, wert, onWahl, c, inhalt }: {
  werte: readonly T[]; label: Record<T, string>; wert: T; onWahl: (w: T) => void; c: Colors; inhalt?: (w: T) => ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.chip, borderRadius: 8, padding: 2, marginHorizontal: 16, marginVertical: 4 }}>
      {werte.map((w) => (
        <Pressable
          key={w}
          onPress={() => onWahl(w)}
          accessibilityRole="button"
          accessibilityLabel={label[w]}
          accessibilityState={{ selected: w === wert }}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6, backgroundColor: w === wert ? c.bg : 'transparent' }}
        >
          {inhalt ? inhalt(w) : <Text style={{ fontSize: 13, color: w === wert ? c.text : c.sub, fontWeight: w === wert ? '600' : '400' }}>{label[w]}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

/** Diagonal geteilt: oben links Vormittag, unten rechts Nachmittag. */
function Kreis({ vormittag, nachmittag }: { vormittag: string; nachmittag: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M4.93 19.07A10 10 0 0 1 19.07 4.93z" fill={vormittag} />
      <Path d="M19.07 4.93A10 10 0 0 1 4.93 19.07z" fill={nachmittag} />
    </Svg>
  );
}
