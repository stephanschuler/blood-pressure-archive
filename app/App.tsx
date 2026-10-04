import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Appearance, BackHandler, FlatList, Image, Pressable, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteMesspunkt, getSetting, insertMesspunkt, listMessungen, migrate, setSetting, type Messung } from './src/db';
import type { Reading } from './src/erkennung/messwerte';
import { discard, importPhotos, recognize, takePhoto, type Foto } from './src/foto';
import type { Messpunkt } from './src/messung';
import { COLORS, THEME_LABEL, nextTheme, parseTheme, type Colors, type Theme } from './src/theme';

migrate();

Appearance.setColorScheme(parseTheme(getSetting('theme')));

type Offen = { foto: Foto; reading: Reading | null };

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

  // nächstes Foto der Warteschlange erkennen
  useEffect(() => {
    if (offen || !queue.length) return;
    const foto = queue[0];
    active.current = foto;
    setOffen({ foto, reading: null });
    const show = (reading: Reading) => active.current === foto && setOffen({ foto, reading });
    // Erkennung blockiert den JS-Thread: erst die Anzeige „Erkenne …" zeichnen lassen
    setTimeout(() => {
      recognize(foto)
        .then(show)
        .catch(() => show({ values: [null, null, null], uncertain: [false, false, false] }));
    }, 50);
  }, [queue, offen]);

  const next = () => {
    if (offen) discard(offen.foto);
    active.current = null;
    setOffen(null);
    setQueue((q) => q.slice(1));
    setMessungen(listMessungen());
  };

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
            <ActivityIndicator size="large" color={c.button} />
            <Text style={{ color: c.sub, marginTop: 8 }}>Erkenne …</Text>
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
        <Button label="Fotos importieren" onPress={async () => setQueue(await importPhotos())} c={c} />
        <Button label="Foto aufnehmen" onPress={async () => setQueue(await takePhoto())} c={c} />
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
