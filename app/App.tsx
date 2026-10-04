import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Appearance, BackHandler, Easing, FlatList, Image, Pressable, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteMesspunkt, getSetting, hasMesspunkt, insertMesspunkt, listMessungen, migrate, setSetting, type Messung } from './src/db';
import type { Reading } from './src/erkennung/messwerte';
import { discard, importPhotos, recognize, takePhoto, type Foto } from './src/foto';
import type { Messpunkt } from './src/messung';
import { COLORS, THEME_LABEL, nextTheme, parseTheme, type Colors, type Theme } from './src/theme';

migrate();

Appearance.setColorScheme(parseTheme(getSetting('theme')));

type Offen = { foto: Foto; reading: Reading | null };

/** Schon gespeichert, etwa bei einem zweiten Import desselben Fotos: keine Bestätigung nötig. */
const bekannt = (foto: Foto, { values: [sys, dia, puls] }: Reading) =>
  sys !== null && dia !== null && puls !== null && hasMesspunkt({ zeit: foto.zeit.toISOString(), sys, dia, puls });

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const c = COLORS[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const [messungen, setMessungen] = useState<Messung[]>(listMessungen);
  const [queue, setQueue] = useState<Foto[]>([]);
  const [offen, setOffen] = useState<Offen | null>(null);
  const [theme, setTheme] = useState<Theme>(() => parseTheme(getSetting('theme')));
  // Foto in Arbeit; ein Erkennungsergebnis für ein schon verworfenes Foto wird ignoriert
  const active = useRef<Foto | null>(null);
  const readings = useRef(new Map<Foto, Promise<Reading>>());
  // nacheinander statt parallel: sonst liegen alle Fotos zugleich in voller Größe im Speicher
  const lastReading = useRef<Promise<unknown>>(Promise.resolve());

  const recognizeOnce = (foto: Foto) => {
    let p = readings.current.get(foto);
    if (!p) {
      p = lastReading.current
        .then(() => recognize(foto))
        .catch(() => ({ values: [null, null, null], uncertain: [false, false, false] }));
      readings.current.set(foto, p);
      lastReading.current = p;
    }
    return p;
  };

  // alle Fotos der Warteschlange erkennen, das erste zur Entscheidung vorlegen
  useEffect(() => {
    queue.forEach(recognizeOnce);
    if (offen || !queue.length) return;
    const foto = queue[0];
    active.current = foto;
    setOffen({ foto, reading: null });
    recognizeOnce(foto).then((reading) => {
      if (active.current !== foto) return;
      if (bekannt(foto, reading)) drop(foto);
      else setOffen({ foto, reading });
    });
  }, [queue, offen]);

  const drop = (foto: Foto) => {
    discard(foto);
    readings.current.delete(foto);
    active.current = null;
    setOffen(null);
    setQueue((q) => q.slice(1));
    setMessungen(listMessungen());
  };
  const next = () => offen && drop(offen.foto);

  // Android-Zurück-Taste verwirft das Foto, statt die App zu beenden
  useEffect(() => {
    if (!offen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      next();
      return true;
    });
    return () => sub.remove();
  }, [offen]);

  const switchTheme = () => {
    const t = nextTheme(theme);
    setSetting('theme', t);
    Appearance.setColorScheme(t);
    setTheme(t);
  };

  const askDelete = (p: Messpunkt) =>
    Alert.alert('Messpunkt löschen?', `${p.sys}/${p.dia}, Puls ${p.puls}\n${new Date(p.zeit).toLocaleString('de-DE')}`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { deleteMesspunkt(p.id); setMessungen(listMessungen()); } },
    ]);

  const screen = { flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 16 };

  if (offen) {
    return (
      <View style={screen}>
        {offen.reading ? (
          <Bestaetigung key={offen.foto.uri} offen={offen} rest={queue.length - 1} onDone={next} c={c} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Loader />
            <Text style={{ color: c.sub, marginTop: 12 }}>Erkenne …</Text>
          </View>
        )}
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={screen}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ flex: 1, fontSize: 28, fontWeight: '600', color: c.text }}>Blutdruck</Text>
        <Pressable onPress={switchTheme} style={{ padding: 8 }}>
          <Text style={{ color: c.sub }}>Darstellung: {THEME_LABEL[theme]}</Text>
        </Pressable>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={messungen}
        keyExtractor={(m) => String(m.punkte[0].id)}
        ListEmptyComponent={<Text style={{ color: c.sub }}>Noch keine Messungen.</Text>}
        ListFooterComponent={messungen.length ? <Text style={{ color: c.sub, marginVertical: 12 }}>Messpunkt lange drücken, um ihn zu löschen.</Text> : null}
        renderItem={({ item: m }) => (
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }}>
            <Text style={{ color: c.sub }}>{new Date(m.punkte[0].zeit).toLocaleString('de-DE')}</Text>
            <Text style={{ fontSize: 22, fontWeight: '600', color: c.text, marginVertical: 2 }}>
              {m.sys}/{m.dia} · Puls {m.puls}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {m.punkte.map((p) => (
                <Pressable key={p.id} onLongPress={() => askDelete(p)} style={{ backgroundColor: c.chip, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                  <Text style={{ color: c.sub }}>{p.sys}/{p.dia}/{p.puls}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
        {/* Aufnehmen rechts: häufiger gebraucht, für den rechten Daumen */}
        <IconButton label="Fotos importieren" icon={require('./assets/add-photo-alternate.png')} onPress={async () => setQueue(await importPhotos())} />
        <IconButton label="Foto aufnehmen" icon={require('./assets/add-a-photo.png')} onPress={async () => setQueue(await takePhoto())} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

function Bestaetigung({ offen, rest, onDone, c }: { offen: Offen; rest: number; onDone: () => void; c: Colors }) {
  const { foto, reading } = offen;
  const [werte, setWerte] = useState(reading!.values.map((v) => (v === null ? '' : String(v))));
  const zahlen = werte.map((w) => (/^\d{2,3}$/.test(w) ? Number(w) : null));
  const gueltig = zahlen.every((z) => z !== null);

  const speichern = () => {
    insertMesspunkt({ zeit: foto.zeit.toISOString(), sys: zahlen[0]!, dia: zahlen[1]!, puls: zahlen[2]! });
    onDone();
  };

  return (
    <View style={{ flex: 1 }}>
      <Image source={{ uri: foto.uri }} style={{ width: '100%', height: 280, backgroundColor: c.photo }} resizeMode="contain" />
      <Text style={{ color: c.sub, marginVertical: 6 }}>
        {foto.zeit.toLocaleString('de-DE')}
        {foto.zeitAusExif ? '' : ' (Zeitpunkt nicht im Foto, jetzt angenommen)'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {['SYS', 'DIA', 'PUL'].map((label, i) => (
          <View key={label} style={{ flex: 1 }}>
            <Text style={{ color: c.sub, marginBottom: 4 }}>{label}</Text>
            <TextInput
              value={werte[i]}
              onChangeText={(t) => setWerte((w) => w.map((x, j) => (j === i ? t : x)))}
              keyboardType="number-pad"
              maxLength={3}
              style={{
                fontSize: 32, borderWidth: 1, borderRadius: 8, padding: 8, textAlign: 'center', color: c.text,
                backgroundColor: reading!.uncertain[i] || zahlen[i] === null ? c.uncertain : c.field,
                borderColor: reading!.uncertain[i] || zahlen[i] === null ? '#d4a017' : c.fieldLine,
              }}
            />
          </View>
        ))}
      </View>
      {rest > 0 && <Text style={{ color: c.sub, marginTop: 8 }}>Noch {rest} weitere Fotos</Text>}
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
        <Button label="Verwerfen" onPress={onDone} c={c} />
        <Button label="Speichern" onPress={speichern} disabled={!gueltig} c={c} />
      </View>
    </View>
  );
}

function Button({ label, onPress, disabled, c }: { label: string; onPress: () => void; disabled?: boolean; c: Colors }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1, backgroundColor: c.button, borderRadius: 8, padding: 14, alignItems: 'center', opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ color: '#fff', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ label, icon, onPress }: { label: string; icon: number; onPress: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 8 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#E53946', alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
        <Image source={icon} style={{ width: 32, height: 32, tintColor: '#fff' }} />
      </Pressable>
    </View>
  );
}

// Maße aus assets/svg/loader-*.svg: 512er Raster auf 128 dp, Schlagabstand 230.
function Loader() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [t]);
  const layer = { position: 'absolute', width: 128, height: 128 } as const;
  return (
    <View style={{ width: 128, height: 128, borderRadius: 28, overflow: 'hidden', backgroundColor: '#263238' }}>
      <Image source={require('./assets/loader-herz.png')} style={layer} />
      <Animated.Image
        source={require('./assets/loader-puls.png')}
        style={[layer, { width: 192, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, -57.5] }) }] }]}
      />
      <Image source={require('./assets/loader-viewfinder.png')} style={layer} />
      <Animated.View
        style={{
          position: 'absolute', left: 35.5, top: 35.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#E53946',
          opacity: t.interpolate({ inputRange: [0, 0.6, 0.61, 1], outputRange: [1, 1, 0.15, 0.15] }),
        }}
      />
    </View>
  );
}
