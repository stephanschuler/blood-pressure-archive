import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Appearance, BackHandler, Easing, Image, Keyboard, Pressable, ScrollView, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteMesspunkt, einspielen, getSetting, hasMesspunkt, insertMesspunkt, listMessungen, migrate, setSetting, sichern, zaehlen, type Messung } from './src/db';
import { dateiOeffnen, dateiname, inOrdnerSpeichern, teilen } from './src/datensicherung';
import type { Reading } from './src/erkennung/messwerte';
import { discard, importPhotos, messzeit, recognize, takePhoto, type Foto } from './src/foto';
import type { Messpunkt } from './src/messung';
import { Seitenleiste, type Eintrag } from './src/seitenleiste';
import { Startseite } from './src/startseite';
import { csv, xlsx } from './src/tabelle';
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
  const [erkannt, setErkannt] = useState(new Set<Foto>());
  // Foto in Arbeit; ein Erkennungsergebnis für ein schon verworfenes Foto wird ignoriert
  const active = useRef<Foto | null>(null);
  const readings = useRef(new Map<Foto, Promise<Reading>>());
  const recognizeOnce = (foto: Foto) => {
    let p = readings.current.get(foto);
    if (!p) {
      p = recognize(foto).catch(() => ({ values: [null, null, null], uncertain: [false, false, false] }));
      readings.current.set(foto, p);
      p.then(() => setErkannt((s) => new Set(s).add(foto)));
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
    setErkannt(new Set());
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
  const punkte = () => messungen.flatMap((m) => m.punkte);
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
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
    {
      abschnitt: 'Tabelle', label: 'Als CSV speichern', icon: require('./assets/csv.png'),
      onPress: versuchen('Nicht gespeichert', async () => {
        if (await inOrdnerSpeichern(dateiname('csv'), 'text/csv', csv(punkte()))) Alert.alert('Gespeichert', `${zaehlen()} Messpunkte.`);
      }),
    },
    {
      abschnitt: 'Tabelle', label: 'Als XLSX speichern', icon: require('./assets/table-view.png'),
      onPress: versuchen('Nicht gespeichert', async () => {
        if (await inOrdnerSpeichern(dateiname('xlsx'), XLSX, xlsx(punkte()))) Alert.alert('Gespeichert', `${zaehlen()} Messpunkte.`);
      }),
    },
    {
      abschnitt: 'Tabelle', label: 'In Google Drive ablegen', icon: require('./assets/add-to-drive.png'),
      onPress: versuchen('Nicht geteilt', () => teilen(dateiname('xlsx'), XLSX, xlsx(punkte()))),
    },
  ];

  const screen = { flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingHorizontal: 16 };

  if (offen) {
    return (
      <View style={screen}>
        {offen.reading ? (
          <Bestaetigung key={offen.foto.uri} offen={offen} nr={gesamt - queue.length + 1} gesamt={gesamt} bereit={queue.filter((f) => erkannt.has(f)).length} onDone={next} c={c} />
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
      <Seitenleiste offen={menue} onClose={() => setMenue(false)} theme={theme} onTheme={waehleTheme} eintraege={eintraege} messzeit={messzeit()} c={c} />
      <StatusBar style="auto" />
    </View>
  );
}

function Bestaetigung({ offen, nr, gesamt, bereit, onDone, c }: { offen: Offen; nr: number; gesamt: number; bereit: number; onDone: () => void; c: Colors }) {
  const { foto, reading } = offen;
  const [werte, setWerte] = useState(reading!.values.map((v) => (v === null ? '' : String(v))));
  const [fokus, setFokus] = useState<number | null>(null);
  const felder = useRef<(TextInput | null)[]>([]);
  const scroll = useRef<ScrollView>(null);
  const inhalt = useRef<View>(null);
  const [hoehe, setHoehe] = useState(0);
  const [tastatur, setTastatur] = useState(0);
  const tastaturOben = useRef<number | null>(null);
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

  // Android legt die Tastatur über die App, statt sie zu verkleinern: Platz in Tastaturhöhe anhängen
  useEffect(() => {
    const auf = Keyboard.addListener('keyboardDidShow', (e) => {
      tastaturOben.current = e.endCoordinates.screenY;
      setTastatur(e.endCoordinates.height);
    });
    const zu = Keyboard.addListener('keyboardDidHide', () => {
      tastaturOben.current = null;
      setTastatur(0);
    });
    return () => { auf.remove(); zu.remove(); };
  }, []);

  // Unterkante des Felds 8 dp über die Tastatur
  const ausrichten = (i: number) => {
    const oben = tastaturOben.current;
    if (oben === null) return;
    scroll.current?.getNativeScrollRef()?.measureInWindow((_x, top) =>
      felder.current[i]?.measureLayout(inhalt.current!, (_x, y, _w, h) =>
        scroll.current?.scrollTo({ y: Math.max(0, y + h + 8 - (oben - top)) })));
  };

  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      onLayout={(e) => setHoehe(e.nativeEvent.layout.height)}
      // erst hier ist der angehängte Platz gelegt; ein früheres scrollTo würde auf die alte Höhe gekappt
      onContentSizeChange={() => fokus !== null && ausrichten(fokus)}
    >
      <View ref={inhalt} style={{ height: hoehe }}>
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
          <View testID="erkannt" style={{ position: 'absolute', width: `${(100 * (nr - 1 + bereit)) / gesamt}%`, height: 4, borderRadius: 2, backgroundColor: c.erkannt }} />
          <View testID="bestaetigt" style={{ position: 'absolute', width: `${(100 * (nr - 1)) / gesamt}%`, height: 4, borderRadius: 2, backgroundColor: '#E53946' }} />
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
                onFocus={() => { setFokus(i); ausrichten(i); }}
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
      <View style={{ height: tastatur }} />
    </ScrollView>
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
