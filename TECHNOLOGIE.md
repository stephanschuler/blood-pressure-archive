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
| Texterkennung      | on-device, eigene Segment-Erkennung, ohne trainiertes Modell; **kein** Online-Dienst, **keine** generische OCR |

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

### Stand Build (4.10.2026)

- `buildenv/Dockerfile`: Node 22, JDK 17, Android-Kommandozeilenwerkzeuge (amd64). Weitere
  SDK-Teile lädt Gradle beim ersten Build ins Volume `blutdruck-android-sdk`.
- `docker-compose.yml` und `Makefile` im Projekt-Root; `make help` listet alle Befehle.
- `make apk`: baut das Release-APK nach `app/dist/blutdruck.apk` (`buildenv/build-apk.sh`).
  Gebaut wird im Docker-Volume `blutdruck-build`, nicht im Projektordner: Beim Entpacken der
  Android-Vorlage über die Docker-Dateifreigabe des Macs gehen Dateirechte verloren.
- Erster Build: knapp 17 Minuten, APK 25 MB (nur `arm64-v8a`). Expo SDK 57, React Native 0.86.

### APK aufs Handy

- Release-APK bauen (enthält den JS-Code), vom Container per `python3 -m http.server` bereitstellen
  und im Handy-Browser laden. Einmalig „Installation aus unbekannten Quellen" erlauben.
- USB-Kopie bräuchte auf dem Mac ein MTP-Programm (z. B. OpenMTP).
- Jede Änderung kostet so einen Build: gut für Zwischenstände, zu zäh für die tägliche Entwicklung.

### Entwicklungsschleife

- **Expo Go** (Play Store): für alles ohne eigene native Module — Kamera, Datenbank, EXIF. Kein Build.
- **Dev Client:** nicht eingerichtet; jede Änderung geht über die Release-APK (`make apk`,
  `make serve-apk`).

### Android-Emulator

- Läuft nicht in Docker (braucht Hardware-Virtualisierung) → nativ auf dem Mac. Schlank:
  Android-Kommandozeilenwerkzeuge über Homebrew plus `emulator` und ein arm64-Systemabbild; bequemer:
  Android Studio.
- APK per Drag & Drop aufs Emulatorfenster installieren.
- Der Emulator erreicht den Mac unter `10.0.2.2`.
- Kamera: Webcam des Macs als Emulatorkamera; Fotos per Drag & Drop.

### Später: iOS

- iOS lässt sich nicht in Docker bauen: lokal braucht es Xcode auf dem Mac.
- Apple Developer Program (99 USD/Jahr) ist Pflicht, um die App dauerhaft aufs eigene iPhone zu
  bringen. Die EU-Sideloading-Regeln ändern daran nichts.
- Alternativ ein Cloud-Build-Dienst (EAS Build, Codemagic) — derzeit ausgeschlossen.

## Texterkennung

### Befund am Fotoarchiv

20 Stichproben aus `daten/Quelle/` (Juni 2025 bis April 2026):

- **Ein Gerät:** Medisana mit festem Display-Layout. Drei Zeilen: SYS (3 Ziffern), DIA (2–3),
  PUL (2–3). Darüber Datum und Uhrzeit, links eine Balkenanzeige.
- **Die Uhr des Geräts ist nicht gestellt** (z. B. „1M06D 22:13" auf einem Foto vom 9.9.2025).
  Messzeitpunkt deshalb ausschließlich aus EXIF bzw. „jetzt".
- **Anker:** Die grüne START/STOP-Taste ist im Bild eindeutig und liegt immer rechts neben dem Display.
- **Störungen:** wechselnder Abstand (Display füllt 20–70 % des Bildes), leichte Drehung und
  Perspektive, Spiegelungen (Hand, Kabel), sichtbare inaktive Segmente („Geisterziffern", teils
  farbig). Aktive Segmente sind durchweg deutlich dunkler als die inaktiven.
- Die Fotos stammen von einem Samsung Galaxy S22; EXIF enthält `DateTimeOriginal`.

### Ansatz

- **Generische OCR scheidet aus.** Apple Vision unterstützt Siebensegment-Ziffern laut Apple
  ausdrücklich nicht, ML Kit und Tesseract scheitern nachweislich daran.
- **Cloud-LLM scheidet aus** (Datenschutz-Vorgabe).
- **Erster Kandidat: Segment-Abtastung bei festem Layout.** Grüne Taste finden → Display-Rechteck
  bestimmen → Perspektive korrigieren → je Ziffernposition sieben Segmentflächen abtasten →
  Schwellwert relativ zum Bild (aktiv vs. Geistersegment) → Nachschlagetabelle. Kein Training nötig.
  In der App: `react-native-fast-opencv`.
- **Eigenes kleines Modell** je Ziffernzelle (TFLite), trainiert auf den Zellen, die die
  Segment-Abtastung ausschneidet: geprüft, nur Vergleichswert (s. Ziffernleser). Spezialisierte
  Modelle erreichen in Studien an Blutdruckmessgeräten 98–99 %.

### Messlauf

- Prototyp in Python/OpenCV, läuft lokal in Docker. Fotos und Tabelle verlassen den Rechner nicht.
- **Entwicklungssatz:** die 20 Stichproben mit von Hand abgelesenen Werten.
- **Abgleich mit der Tabelle:** Die Tabelle enthält je Zeitslot ungefähr den Durchschnitt einer
  Messung aus 2–4 Messpunkten. Fotos per EXIF-Zeit zu Messungen gruppieren; Treffer, wenn der
  Tabellenwert zwischen kleinstem und größtem erkannten Wert der Gruppe liegt (mit Toleranz).
- **Exakte Fehlerquote:** zusätzlich rund 200 Fotos von Hand erfassen, auf einer lokalen HTML-Seite.
- **Kennzahlen:** exakter Treffer des ganzen Tripels, Genauigkeit je Feld, Ziffern-Verwechslungen
  (1/7, 0/8/6/9), Rückweisungsrate, vor allem die **stille Fehlerrate**: falsche, aber plausible
  Werte.

### Ergebnis erster Messlauf (4.10.2026)

Prototyp: Python/OpenCV in Docker, nicht im Repo.

- **Dauerhafte Daten** in `daten/` (per `.gitignore` aus jedem Repo ausgeschlossen): Fotos und
  Tabelle in `Quelle/`, Handerfassung und abgelesene Werte in `labels/`.
- **Erzeugte Ergebnisse** in `daten/messlauf/` (`ergebnisse.csv`, `auffaellig.csv`); jeder
  Messlauf überschreibt sie.

| Kennzahl                                              | Wert              |
|-------------------------------------------------------|-------------------|
| Fotos                                                 | 1.510             |
| vollständig und plausibel gelesen                     | 1.123 (74,4 %)    |
| Taste nicht gefunden                                  | 19                |
| gelesen, aber unplausibel                             | 7                 |
| Messungen mit Tabelleneintrag und ≥ 1 gelesenem Foto  | 722               |
| Tabellenwert im Bereich der gelesenen Werte ± 3       | SYS 97,2 %, DIA 96,3 %, PUL 96,0 %; alle drei 91,8 % |
| Abweichung Mittel gelesen − Tabelle, Median           | 0 / 0 / 0         |
| Verdacht auf stillen Fehler (> 20 weg von Tabelle und Rest der Messung) | 2 |

- Wird ein Foto gelesen, stimmt es in aller Regel mit der Tabelle überein. Die Lücke sind die
  **Abweisungen (rund 26 %)**, nicht falsche Werte.
- Bekannte Ursachen aus den Stichproben: Hand- oder Kabelschatten auf dem Display, fehlerhafte
  Entzerrung bei starker Perspektive.
- Das Archiv hat meist 1–2 Fotos je Messung (403 Messungen mit einem, 467 mit zwei Fotos).
- Die 20 Stichproben dienten zum Einstellen; auf ihnen liegt der Prototyp bei 16/20 richtig,
  4 abgewiesen, 0 falsch.

### Zweiter Messlauf

Änderungen: Helligkeit aus dem hellsten Farbkanal (farbige Geistersegmente werden hell), Segment
gegen seine direkte Umgebung statt gegen das ganze Bild, Schwelle je Ziffer statt je Bild.

| Kennzahl                                        | Lauf 1  | Lauf 2  |
|-------------------------------------------------|---------|---------|
| vollständig und plausibel gelesen               | 74,4 %  | 80,5 %  |
| Tabellenwert im Bereich ± 3, alle drei Felder   | 91,8 %  | 93,7 %  |
| Verdacht auf stillen Fehler                     | 2       | 7       |
| Fotos, die beide Läufe lesen, mit anderem Wert  | –       | 7 von 1.104 |

- Abgewiesene Stichprobe (20 Fotos): 4 von **anderen Geräten** (Beurer mit Bluetooth, älteres
  Medisana), 7 mit Hand- oder Handyschatten, 5 mit Kabel über den Ziffern, 2 mit farbigen
  Geistersegmenten.
- Die Fotos entstehen während der Messung ohne Rücksicht auf Bildqualität; ein Sucherrahmen in der
  App senkt die Abweisungen daher kaum. Die Erkennung selbst muss robuster werden.

### Ziffernleser (trainiertes Modell)

Zweistufig: Lage und Ziffernpositionen je Gerät wie bisher, je Ziffernfeld entscheidet ein kleines
CNN (3 Faltungsschichten, PyTorch) zwischen 0–9 und „leer". Training mit künstlichen Schatten,
Kabeln, Lage- und Kontrastschwankungen.

Nicht in der App: Sie kommt ohne selbst trainierte KI aus, das Modell bleibt Messlatte.

- **Trainingsdaten:** 914 Fotos bis 31.1.2026, davon 235 von Hand erfasst, der Rest in beiden
  Messläufen gleich gelesen.
- **Test:** 499 Fotos ab 1.2.2026, die das Modell nie gesehen hat. „Schwer" sind 77 Fotos, die das
  Segmentverfahren abgewiesen hatte und die von Hand erfasst sind.

| Verfahren auf Testfotos                     | gelesen | schwer: richtig / falsch / abgewiesen |
|---------------------------------------------|---------|---------------------------------------|
| Segmentverfahren                            | 87,0 %  | 0 / 0 / 78                            |
| Modell, Schwelle 0,5                        | 95,0 %  | 56 / 0 / 22                           |
| **Modell, Schwelle 0,8**                    | 92,2 %  | 49 / 0 / 29                           |
| Modell, Schwelle 0,9                        | 89,6 %  | 42 / 0 / 36                           |

Stand nach toleranterer Tastensuche (s. u.); Trainingsdaten 920 Fotos, Test 500 Fotos. Zwischen
zwei Trainingsläufen mit leicht geänderten Daten schwanken die Werte um etwa ±1 Prozentpunkt und
um 1–2 falsche Werte; der schwere Testsatz ist mit 78 Fotos klein.

- Schwelle = geringste Sicherheit über alle Ziffern eines Fotos, ab der ein Wert gilt.
- Auf den 400 einfachen Testfotos liest das Modell bei 0,8 397 gleich wie das Segmentverfahren, 3
  weist es ab. Das zeigt Übereinstimmung, nicht Richtigkeit: Diese Werte stammen selbst vom
  Segmentverfahren.
- Kombination beider Verfahren brachte nichts.

### Andere Geräte und Tastensuche

- Von 19 Fotos ohne gefundene Taste zeigten viele das **aktuelle Medisana bei schwachem oder
  gelblichem Licht**; die Taste ist dann blassgrün. Die Tastensuche hat dafür eine tolerante Stufe
  mit Formprüfung (aufrechtes Rechteck, Seitenverhältnis 1,2–2,4). Ohne Taste bleiben 12 Fotos.
- **Wirklich andere Geräte:** Beurer (5 Fotos, 18.10. und 2.12.2025), älteres Medisana (2–3 Fotos,
  Oktober 2025). Kein Foto eines anderen Geräts nach Dezember 2025.
- Das Gerät bestimmt die Tastensuche, nicht die Handerfassung: Dort steht bei schwach beleuchteten
  Medisana-Fotos oft die Vorbelegung „Beurer".

### Mehrstufig: Display über seine Ränder (ohne grüne Taste)

Stufe 1: Vierecke passender Größe und Form aus den Kanten des ganzen
Bildes; gewählt wird das, dessen Entzerrung die meisten ziffernartigen Formen enthält. Stufe 2
liest im entzerrten Display — entweder mit freier Ziffernsuche oder mit dem festen Ziffernraster
des Medisana.

| Kette (alle 1.510 Fotos)                     | gelesen | Handerfassung (330): richtig / falsch / abgewiesen |
|----------------------------------------------|---------|----------------------------------------------------|
| bisher: grüne Taste + Raster                 | 81,5 %  | 42 / 12 / 276                                      |
| Stufe 1 + freie Ziffernsuche                 | 71,1 %  | 110 / 4 / 216                                      |
| **Stufe 1 + festes Raster**                  | 85,0 %  | 159 / 12 / 159                                     |
| mindestens eine der beiden Raster-Ketten     | 89,7 %  | –                                                  |

- Stufe 1 findet ein Display auf 1.503 von 1.510 Fotos, auch bei schwachem Licht.
- Die Handerfassung enthält absichtlich die Fotos, bei denen das alte Verfahren schwankte oder
  verdächtig war; die Falsch-Zahlen dort sind deshalb höher als im Archivdurchschnitt.
- Auf Fotos, die beide Raster-Ketten lesen, unterscheiden sie sich in 28 von 1.112 Fällen.
- Freie Ziffernsuche scheitert vor allem an Geisterziffern (zusätzliche Stellen) und an
  unbekannten Segmentmustern.

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
- Mac und Handy im selben WLAN (`make serve-apk`)
