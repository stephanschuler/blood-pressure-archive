# Blutdruck-App – Technologie

Stand: Oktober 2026. Anforderungen: [ANFORDERUNGEN.md](ANFORDERUNGEN.md).

## Entscheidungen

| Bereich            | Wahl                                                                  |
|--------------------|-----------------------------------------------------------------------|
| Framework          | React Native mit Expo, TypeScript                                     |
| Plattform          | zuerst nur Android; iOS später                                        |
| Build              | lokal in Docker (`linux/amd64`-Container), kein Cloud-Build-Dienst    |
| Test               | APK von Hand aufs Handy; nativer Android-Emulator auf dem Mac         |
| Kamera / Import    | `expo-image-picker` (`exif: true`), Fallback `expo-media-library`     |
| Datenbank          | `expo-sqlite` mit Drizzle (Migrationen)                               |
| Export             | CSV von Hand, XLSX mit SheetJS (CDN-Tarball) oder ExcelJS, SQLite per `VACUUM INTO` |
| Teilen / Drive     | System-Share-Sheet (`expo-sharing`); direkte Drive-API erst bei Bedarf |
| Texterkennung      | on-device, eigene Segment-Erkennung oder eigenes Modell; **kein** Online-Dienst, **keine** generische OCR |

## Framework

| Option                     | Einstieg (Web-Hintergrund) | Bemerkung                            |
|----------------------------|----------------------------|--------------------------------------|
| **React Native + Expo**    | niedrig (TypeScript)       | Entwicklungsschleife ohne adb, reife TFLite-/OpenCV-Bindings |
| Flutter                    | mittel (Dart)              | ein Werkzeug von Anlage bis APK; Hot Reload aus Docker nur über adb per WLAN |
| Kotlin/Compose Multiplatform | hoch                     | für Einsteiger das schwerste Ökosystem |
| .NET MAUI                  | mittel–hoch                | kleine Community, ML-Kit nur Android  |
| Capacitor/Ionic            | sehr niedrig               | Cloud-Teil bei Drittanbieter (Ionic Appflow eingestellt) |

Mit lokalem Build bauen Expo und Flutter dasselbe Gradle-Projekt im selben Container. Für Expo
sprechen die Entwicklungsschleife ohne adb (s. u.), `react-native-fast-tflite` und
`react-native-fast-opencv` sowie TypeScript.

## Build und Test

### Android-Build in Docker

- `npx expo prebuild` erzeugt das native Android-Projekt, `./gradlew assembleRelease` baut das APK.
  Kein Expo-Konto nötig.
- **Container als `linux/amd64` unter Rosetta:** Google liefert `aapt2` für Linux nur als x86_64.
  Docker Desktop: „Use Rosetta for x86_64/amd64 emulation" einschalten. Langsamer als nativ, aber
  funktionsfähig.
- Eigenes Dockerfile (Node + JDK + Android SDK); die verbreiteten Cirrus-Labs-Images werden seit
  Mai 2026 nicht mehr gepflegt.

### APK aufs Handy

- Release-APK bauen (enthält den JS-Code), vom Container per `python3 -m http.server` bereitstellen
  und im Handy-Browser laden. Einmalig „Installation aus unbekannten Quellen" erlauben.
- USB-Kopie bräuchte auf dem Mac ein MTP-Programm (z. B. OpenMTP).
- Jede Änderung kostet so einen Build: gut für Zwischenstände, zu zäh für die tägliche Entwicklung.

### Entwicklungsschleife

- **Expo Go** (Play Store): für alles ohne eigene native Module — Kamera, Datenbank, EXIF. Kein Build.
- **Dev Client:** ab dem ersten eigenen nativen Modul (TFLite/OpenCV). Einmal als Debug-APK bauen;
  danach kommt der JS-Code live vom Metro-Server im Container. Neu gebaut wird nur bei geänderten
  nativen Abhängigkeiten.
- Metro im Container: Port 8081 freigeben, `REACT_NATIVE_PACKAGER_HOSTNAME` auf die LAN-IP des Macs.

### Android-Emulator

- Läuft nicht in Docker (braucht Hardware-Virtualisierung) → nativ auf dem Mac. Schlank:
  Android-Kommandozeilenwerkzeuge über Homebrew plus `emulator` und ein arm64-Systemabbild; bequemer:
  Android Studio.
- APK per Drag & Drop aufs Emulatorfenster installieren.
- Der Emulator erreicht den Mac unter `10.0.2.2`; der Dev Client lädt so von Metro im Container,
  ohne adb.
- Kamera: Webcam des Macs als Emulatorkamera; Fotos per Drag & Drop.

### Später: iOS

- iOS lässt sich nicht in Docker bauen: lokal braucht es Xcode auf dem Mac.
- Apple Developer Program (99 USD/Jahr) ist Pflicht, um die App dauerhaft aufs eigene iPhone zu
  bringen. Die EU-Sideloading-Regeln ändern daran nichts.
- Alternativ ein Cloud-Build-Dienst (EAS Build, Codemagic) — derzeit ausgeschlossen.

## Texterkennung

### Ansatz

- **Generische OCR scheidet aus.** Apple Vision unterstützt Siebensegment-Ziffern laut Apple
  ausdrücklich nicht, ML Kit und Tesseract scheitern nachweislich daran.
- **Cloud-LLM scheidet aus** (Datenschutz-Vorgabe).
- **Erster Kandidat: Segment-Abtastung bei festem Layout.** Grüne Taste finden → Display-Rechteck
  bestimmen → Perspektive korrigieren → je Ziffernposition sieben Segmentflächen abtasten →
  Schwellwert relativ zum Bild (aktiv vs. Geistersegment) → Nachschlagetabelle. Kein Training nötig.
  In der App: `react-native-fast-opencv`.
- **Fallback: eigenes kleines Modell** je Ziffernzelle (TFLite), trainiert auf den Zellen, die die
  Segment-Abtastung ausschneidet. In der App: `react-native-fast-tflite`. Spezialisierte Modelle
  erreichen in Studien an Blutdruckmessgeräten 98–99 %.

### Plausibilität und Bestätigung

- Weiche Grenzen: systolisch 70–250, diastolisch 40–150, Puls 40–180, systolisch > diastolisch.
- **Bestätigungsmaske ist Pflicht:** Display-Ausschnitt neben drei editierbaren Feldern,
  unplausible Felder hervorgehoben, Speichern erst nach Bestätigung.

## Daten

### Kamera und Import

- Die Aufnahme aus der App landet im App-Cache, nicht in der Galerie. Nach der Auswertung selbst
  löschen (`expo-file-system`).
- **Galerie-Import:** `expo-image-picker` mit `exif: true`, Mehrfachauswahl über
  `allowsMultipleSelection`. `allowsEditing` (Zuschneiden) verwirft EXIF.
- Der Android Photo Picker schwärzt nur den Standort, der Zeitstempel bleibt erhalten. Bilder aus
  Google Photos verlieren einen großen Teil der Metadaten.
- **Fallback:** Aufnahmedatum aus der Mediathek: `assetId` → `expo-media-library` → `creationTime`.

### Datenbank

`expo-sqlite` mit Drizzle. `drizzle-kit generate` erzeugt die Migrationen, `useMigrations` spielt
sie beim App-Start ein.

### Export und Cloud

- **SQLite:** Kopie per `VACUUM INTO`, dann teilen.
- **CSV:** wenige Zeilen eigener Code.
- **XLSX:** SheetJS vom CDN, nicht von npm (das npm-Paket `xlsx` 0.18.5 ist veraltet und hat CVEs),
  alternativ ExcelJS.
- **Google Drive über das Share-Sheet:** Android bietet „In Drive speichern". Kein OAuth nötig.
- **Direkter Drive-Upload:** OAuth-Client in der Google Cloud Console, Scope `drive.file`, Consent
  Screen auf „In Produktion", sonst laufen die Tokens nach 7 Tagen ab. Lohnt erst für automatischen
  Sync.

## Lokal auf dem Mac

- Docker Desktop mit Rosetta-Emulation für amd64
- Android-Emulator (Kommandozeilenwerkzeuge oder Android Studio)
- Android-Handy: Installation aus unbekannten Quellen erlauben
- Mac und Handy im selben WLAN (Metro)
