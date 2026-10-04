import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { insertMesspunkt, listMessungen, migrate, type Messung } from './src/db';
import type { Reading } from './src/erkennung/messwerte';
import { discard, importPhotos, recognize, takePhoto, type Foto } from './src/foto';

migrate();

type Offen = { foto: Foto; reading: Reading | null };

export default function App() {
  const [messungen, setMessungen] = useState<Messung[]>(listMessungen);
  const [queue, setQueue] = useState<Foto[]>([]);
  const [offen, setOffen] = useState<Offen | null>(null);

  // nächstes Foto der Warteschlange erkennen
  useEffect(() => {
    if (offen || !queue.length) return;
    const foto = queue[0];
    setOffen({ foto, reading: null });
    // Erkennung blockiert den JS-Thread: erst die Anzeige „Erkenne …" zeichnen lassen
    setTimeout(() => {
      recognize(foto)
        .then((reading) => setOffen({ foto, reading }))
        .catch(() => setOffen({ foto, reading: { values: [null, null, null], uncertain: [false, false, false] } }));
    }, 50);
  }, [queue, offen]);

  const next = () => {
    if (offen) discard(offen.foto);
    setOffen(null);
    setQueue((q) => q.slice(1));
    setMessungen(listMessungen());
  };

  if (offen) {
    return (
      <View style={styles.screen}>
        {offen.reading ? (
          <Bestaetigung key={offen.foto.uri} offen={offen} rest={queue.length - 1} onDone={next} />
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={styles.hint}>Erkenne …</Text>
          </View>
        )}
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Blutdruck</Text>
      <View style={styles.row}>
        <Button label="Foto aufnehmen" onPress={async () => setQueue(await takePhoto())} />
        <Button label="Fotos importieren" onPress={async () => setQueue(await importPhotos())} />
      </View>
      <FlatList
        data={messungen}
        keyExtractor={(m) => String(m.punkte[0].id)}
        ListEmptyComponent={<Text style={styles.hint}>Noch keine Messungen.</Text>}
        renderItem={({ item: m }) => (
          <View style={styles.item}>
            <Text style={styles.zeit}>{new Date(m.punkte[0].zeit).toLocaleString('de-DE')}</Text>
            <Text style={styles.werte}>
              {m.sys}/{m.dia} · Puls {m.puls}
            </Text>
            <Text style={styles.hint}>
              {m.punkte.map((p) => `${p.sys}/${p.dia}/${p.puls}`).join('  ')}
            </Text>
          </View>
        )}
      />
      <StatusBar style="auto" />
    </View>
  );
}

function Bestaetigung({ offen, rest, onDone }: { offen: Offen; rest: number; onDone: () => void }) {
  const { foto, reading } = offen;
  const [werte, setWerte] = useState(reading!.values.map((v) => (v === null ? '' : String(v))));
  const zahlen = werte.map((w) => (/^\d{2,3}$/.test(w) ? Number(w) : null));
  const gueltig = zahlen.every((z) => z !== null);

  const speichern = () => {
    insertMesspunkt({ zeit: foto.zeit.toISOString(), sys: zahlen[0]!, dia: zahlen[1]!, puls: zahlen[2]! });
    onDone();
  };

  return (
    <View style={styles.flex}>
      <Image source={{ uri: foto.uri }} style={styles.foto} resizeMode="contain" />
      <Text style={styles.zeit}>
        {foto.zeit.toLocaleString('de-DE')}
        {foto.zeitAusExif ? '' : ' (Zeitpunkt nicht im Foto, jetzt angenommen)'}
      </Text>
      <View style={styles.row}>
        {['SYS', 'DIA', 'PUL'].map((label, i) => (
          <View key={label} style={styles.flex}>
            <Text style={styles.hint}>{label}</Text>
            <TextInput
              value={werte[i]}
              onChangeText={(t) => setWerte((w) => w.map((x, j) => (j === i ? t : x)))}
              keyboardType="number-pad"
              maxLength={3}
              style={[styles.input, (reading!.uncertain[i] || zahlen[i] === null) && styles.unsicher]}
            />
          </View>
        ))}
      </View>
      <View style={styles.row}>
        <Button label="Verwerfen" onPress={onDone} />
        <Button label="Speichern" onPress={speichern} disabled={!gueltig} />
      </View>
      {rest > 0 && <Text style={styles.hint}>Noch {rest} weitere Fotos</Text>}
    </View>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 16 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  button: { flex: 1, backgroundColor: '#1f6feb', borderRadius: 8, padding: 14, alignItems: 'center' },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16 },
  item: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  zeit: { color: '#555', marginVertical: 4 },
  werte: { fontSize: 22, fontWeight: '600' },
  hint: { color: '#777', marginTop: 4 },
  foto: { width: '100%', height: 280, backgroundColor: '#eee' },
  input: { fontSize: 32, borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 8, textAlign: 'center' },
  unsicher: { backgroundColor: '#fff3b0', borderColor: '#d4a017' },
});
