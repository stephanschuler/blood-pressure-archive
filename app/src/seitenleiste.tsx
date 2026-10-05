// Seitenleiste nach DATENSICHERUNG.md: Darstellung, Datensicherung, Tabelle, Version.
import { Fragment, useEffect, useRef } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEMES, THEME_LABEL, type Colors, type Theme } from './theme';

export type Eintrag = { abschnitt: string; label: string; detail?: string; icon: number; onPress: () => void };

const BREITE = 268;
// setzt buildenv/build-apk.sh; Metro und Tests kennen sie nicht
const VERSION = process.env.EXPO_PUBLIC_VERSION ?? 'Entwicklung';

export function Seitenleiste({ offen, onClose, theme, onTheme, eintraege, messzeit, fehler, c }: {
  offen: boolean; onClose: () => void; theme: Theme; onTheme: (t: Theme) => void; eintraege: Eintrag[]; messzeit: string | null; fehler: string | null; c: Colors;
}) {
  const insets = useSafeAreaInsets();
  const x = useRef(new Animated.Value(-BREITE)).current;
  useEffect(() => {
    if (offen) Animated.timing(x, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [offen]);
  const schliessen = () => Animated.timing(x, { toValue: -BREITE, duration: 150, useNativeDriver: true }).start(onClose);
  const titel = { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, fontSize: 12, fontWeight: '600', color: c.sub } as const;

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
        <Text style={titel}>Darstellung</Text>
        <View style={{ flexDirection: 'row', backgroundColor: c.chip, borderRadius: 8, padding: 2, marginHorizontal: 16, marginVertical: 4 }}>
          {THEMES.map((t) => (
            <Pressable
              key={t}
              onPress={() => onTheme(t)}
              accessibilityRole="button"
              accessibilityState={{ selected: t === theme }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6, backgroundColor: t === theme ? c.bg : 'transparent' }}
            >
              <Text style={{ fontSize: 13, color: t === theme ? c.text : c.sub, fontWeight: t === theme ? '600' : '400' }}>{THEME_LABEL[t]}</Text>
            </Pressable>
          ))}
        </View>
        {[...new Set(eintraege.map((e) => e.abschnitt))].map((a) => (
          <Fragment key={a}>
            <Text style={titel}>{a}</Text>
            {eintraege.filter((e) => e.abschnitt === a).map((e) => (
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
          </Fragment>
        ))}
        <View style={{ marginTop: 'auto', padding: 16, gap: 12, borderTopWidth: 1, borderColor: c.line }}>
          {fehler && <Text style={{ fontSize: 11, color: c.up }}>Erkennung gescheitert: {fehler}</Text>}
          <Text style={{ fontSize: 11, color: c.sub }}>{messzeit && `${messzeit}\n\n`}Version {VERSION}</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}
