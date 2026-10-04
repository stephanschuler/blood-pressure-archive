import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Appearance, BackHandler, Easing, Image, Pressable, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteMesspunkt, einspielen, getSetting, hasMesspunkt, insertMesspunkt, listMessungen, migrate, setSetting, sichern, zaehlen, type Messung } from './src/db';
import { dateiOeffnen, dateiname, inOrdnerSpeichern } from './src/datensicherung';
import type { Reading } from './src/erkennung/messwerte';
import { discard, importPhotos, recognize, takePhoto, type Foto } from './src/foto';
import type { Messpunkt } from './src/messung';
import { Seitenleiste, type Eintrag } from './src/seitenleiste';
import { Startseite } from './src/startseite';
import { COLORS, parseTheme, type Colors, type Theme } from './src/theme';

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
  const [gesamt, setGesamt] = useState(0);
  const [offen, setOffen] = useState<Offen | null>(null);
  const [theme, setTheme] = useState<Theme>(() => parseTheme(getSetting('theme')));
  const [menue, setMenue] = useState(false);
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
  const enqueue = (fotos: Foto[]) => {
    setGesamt(fotos.length);
    setQueue(fotos);
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

  const waehleTheme = (t: Theme) => {
    setSetting('theme', t);
    Appearance.setColorScheme(t);
    setTheme(t);
  };

  const askDelete = (p: Messpunkt) =>
    Alert.alert('Messpunkt löschen?', `${p.sys}/${p.dia}, Puls ${p.puls}\n${new Date(p.zeit).toLocaleString('de-DE')}`, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { deleteMesspunkt(p.id); setMessungen(listMessungen()); } },
    ]);

  // jeder Fehler sichtbar: sonst verlässt sich der Nutzer auf eine Sicherung, die es nicht gibt
  const versuchen = (titel: string, aktion: () => Promise<unknown>) => () => aktion().catch((e) => Alert.alert(titel, String(e)));
  const eintraege: Eintrag[] = [
    {
      abschnitt: 'Datensicherung', label: 'Speichern', icon: require('./assets/download.png'),
      onPress: versuchen('Nicht gesichert', async () => {
        if (await inOrdnerSpeichern(dateiname('sqlite'), 'application/octet-stream', sichern())) Alert.alert('Gesichert', `${zaehlen()} Messpunkte.`);
      }),
    },
    {
      abschnitt: 'Datensicherung', label: 'Einspielen', icon: require('./assets/upload-file.png'),
      onPress: versuchen('Nicht eingespielt', async () => {
        const bytes = await dateiOeffnen();
        if (!bytes) return;
        let r: ReturnType<typeof einspielen>;
        try {
          r = einspielen(bytes);
        } catch {
          return Alert.alert('Nicht eingespielt', 'Keine Datensicherung dieser App.');
        }
        if (r === 'zu neu') return Alert.alert('Nicht eingespielt', 'Die Sicherung stammt von einer neueren App-Version.');
        setMessungen(listMessungen());
        Alert.alert('Eingespielt', `${r.gelesen} Messpunkte gelesen, ${r.neu} neu übernommen.`);
      }),
    },
  ];

  const screen = { flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 16 };

  if (offen) {
    return (
      <View style={screen}>
        {offen.reading ? (
          <Bestaetigung key={offen.foto.uri} offen={offen} nr={gesamt - queue.length + 1} gesamt={gesamt} onDone={next} c={c} />
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
        <Pressable onPress={() => setMenue(true)} accessibilityRole="button" accessibilityLabel="Menü" style={{ padding: 10, marginLeft: -10 }}>
          <Image source={require('./assets/menu.png')} style={{ width: 24, height: 24, tintColor: c.text }} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 28, fontWeight: '600', color: c.text }}>Blutdruck</Text>
      </View>
      <Startseite messungen={messungen} c={c} onDelete={askDelete} />
      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
        {/* Aufnehmen rechts: häufiger gebraucht, für den rechten Daumen */}
        <IconButton label="Fotos importieren" icon={require('./assets/add-photo-alternate.png')} onPress={async () => enqueue(await importPhotos())} />
        <IconButton label="Foto aufnehmen" icon={require('./assets/add-a-photo.png')} onPress={async () => enqueue(await takePhoto())} />
      </View>
      <Seitenleiste offen={menue} onClose={() => setMenue(false)} theme={theme} onTheme={waehleTheme} eintraege={eintraege} c={c} />
      <StatusBar style="auto" />
    </View>
  );
}

function Bestaetigung({ offen, nr, gesamt, onDone, c }: { offen: Offen; nr: number; gesamt: number; onDone: () => void; c: Colors }) {
  const { foto, reading } = offen;
  const [werte, setWerte] = useState(reading!.values.map((v) => (v === null ? '' : String(v))));
  const [fokus, setFokus] = useState<number | null>(null);
  const felder = useRef<(TextInput | null)[]>([]);
  const zahlen = werte.map((w) => (/^\d{2,3}$/.test(w) ? Number(w) : null));
  const gueltig = zahlen.every((z) => z !== null);
  const markiert = zahlen.map((z, i) => reading!.uncertain[i] || z === null);

  const speichern = () => {
    insertMesspunkt({ zeit: foto.zeit.toISOString(), sys: zahlen[0]!, dia: zahlen[1]!, puls: zahlen[2]! });
    onDone();
  };

  const weiter = (i: number) => {
    const unten = markiert.findIndex((m, j) => m && j > i);
    if (unten >= 0) felder.current[unten]?.focus();
    else if (gueltig) speichern();
    else felder.current[zahlen.indexOf(null)]?.focus();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>Foto {nr} von {gesamt}</Text>
        <Text style={{ color: c.sub }}>
          {foto.zeit.toLocaleString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
      {!foto.zeitAusExif && (
        <Text style={{ color: c.text, backgroundColor: c.uncertain, fontSize: 13, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 }}>
          Zeitpunkt nicht im Foto, jetzt angenommen
        </Text>
      )}
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.photo, marginVertical: 8 }}>
        <View style={{ width: `${(100 * nr) / gesamt}%`, height: 4, borderRadius: 2, backgroundColor: '#E53946' }} />
      </View>
      <Image source={{ uri: foto.uri }} style={{ width: '100%', flex: 1, backgroundColor: c.photo }} resizeMode="contain" />
      <View style={{ borderWidth: 2, borderColor: c.text, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, marginTop: 12 }}>
        {['SYS', 'DIA', 'PUL'].map((label, i) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
            <Text style={{ width: 40, color: c.sub }}>{label}</Text>
            <TextInput
              ref={(r) => { felder.current[i] = r; }}
              accessibilityLabel={label}
              value={werte[i]}
              onChangeText={(t) => setWerte((w) => w.map((x, j) => (j === i ? t : x)))}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus={i === markiert.indexOf(true)}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => weiter(i)}
              onFocus={() => setFokus(i)}
              onBlur={() => setFokus(null)}
              style={{
                flex: 1, fontSize: i < 2 ? 44 : 32, textAlign: 'right', paddingVertical: 2, paddingHorizontal: 8,
                borderWidth: 2, borderRadius: 8, color: c.text,
                backgroundColor: markiert[i] ? c.uncertain : 'transparent',
                borderColor: fokus === i ? c.focus : 'transparent',
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingTop: 8 }}>
        <IconButton label="Verwerfen" icon={require('./assets/delete.png')} onPress={onDone} />
        <IconButton label="Speichern" icon={require('./assets/check.png')} onPress={speichern} disabled={!gueltig} />
      </View>
    </View>
  );
}

function IconButton({ label, icon, onPress, disabled }: { label: string; icon: number; onPress: () => void; disabled?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 8 }}>
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#E53946', alignItems: 'center', justifyContent: 'center', elevation: 4, opacity: disabled ? 0.4 : 1 }}>
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
