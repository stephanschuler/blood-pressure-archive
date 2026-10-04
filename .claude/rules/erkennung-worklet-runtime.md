# Erkennung in eigener Worklet-Runtime

`recognize()` in `app/src/foto.ts` übergibt die JPEG-Bytes per `runOnRuntimeAsync` an eine eigene
Runtime von `react-native-worklets` (Bundle Mode). Die Erkennung braucht je Foto Hunderte
Millisekunden; im JS-Thread hing die App bei jedem Tippen, solange weitere Fotos erkannt wurden.

- **`app/src/erkennung/` importiert nichts aus `react-native` oder Expo-Modulen.** Die Runtime
  lädt den Code ein zweites Mal; eine zweite React-Native-Instanz bricht die App.
- **Der Worklet, der die Erkennung aufruft, steht in `src/foto.ts`.** Nur dessen relative Imports
  gibt `app/babel.config.js` frei (`importForwarding.relativePaths`). Anderer Ort: dort eintragen.
- **Nacheinander, nicht parallel** (`App.tsx`, `lastReading`): sonst liegen alle Fotos zugleich in
  voller Größe im Speicher.
- **Metro-Patch je Metro-Version** (`app/patches/`, aus `react-native-worklets/bundleMode/patches`
  im Worklets-Repo). Nach einem Expo-Update prüfen, ob `npm ci` ihn noch anwendet; ohne ihn bricht
  das Bündeln mit „Failed to get the SHA-1".
- **Prüfen auf dem Handy:** Die Oberflächentests ersetzen `recognize()` durch eine Attrappe und
  sehen die Runtime nicht.
