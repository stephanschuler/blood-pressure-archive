# Blutdruck-App – Technologie

Stand: Oktober 2026. Anforderungen: [ANFORDERUNGEN.md](ANFORDERUNGEN.md).

## Entscheidungen

| Bereich            | Wahl                                                                  |
|--------------------|-----------------------------------------------------------------------|
| Framework          | React Native mit Expo, TypeScript                                     |
| Plattform          | zuerst nur Android; iOS später                                        |
| Build              | lokal in Docker (`linux/amd64`-Container), kein Cloud-Build-Dienst    |
| Test               | APK von Hand aufs Handy; nativer Android-Emulator auf dem Mac         |
| Kamera / Import    | `expo-image-picker` (`exif: true`); ohne EXIF-Zeit gilt „jetzt"       |
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
- `make apk`: baut das Release-APK nach `app/dist/blutdruck-<version>-<hash>.apk` (`buildenv/build-apk.sh`).
  Gebaut wird im Docker-Volume `blutdruck-build`, nicht im Projektordner: Beim Entpacken der
  Android-Vorlage über die Docker-Dateifreigabe des Macs gehen Dateirechte verloren.
- Erster Build: knapp 17 Minuten, APK 25 MB (nur `arm64-v8a`). Expo SDK 57, React Native 0.86.
- **Versionierung:** Android meldet `<version>-<hash>`, etwa `0.0.1-4aea666`. `version` steht in
  `app/app.json`; `make apk` reicht den Commit-Hash als `GIT_HASH` in den Container, und
  `app/app.config.ts` setzt daraus `android.version`. Der Hash gilt für den letzten Commit,
  uncommittete Änderungen sieht man ihm nicht an. `versionCode` bleibt 1.

### APK aufs Handy

- Release-APK bauen (enthält den JS-Code), mit `make serve-apk` im WLAN bereitstellen
  (`http-server` im Container, mit Zugriffsprotokoll) und im Handy-Browser laden. Einmalig
  „Installation aus unbekannten Quellen" erlauben.
- **Version und Commit-Hash im Dateinamen.** Chrome auf dem Handy installierte trotz
  `Cache-Control: no-cache` und `?v=`-Parameter die alte APK aus dem Cache, sobald sie über die
  Dateiliste geöffnet wurde; das Zugriffsprotokoll zeigte keinen Abruf. Ein neuer Name je Build
  umgeht jeden Cache.
- Welche APK installiert ist, zeigt *Einstellungen → Apps → Blood Pressure Archive → Version*.
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

Entstehung und heutige Funktionsweise im Zusammenhang: [ERKENNUNG.md](ERKENNUNG.md).

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
  In der App: reines TypeScript (`app/src/erkennung/`); `react-native-fast-opencv` geprüft und
  verworfen.
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

### Open-Source-OCR auf den Zahlenzeilen

Eingabe: die drei Zahlenzeilen aus Stufe 1, entschrägt, schwarz auf weiß; für Tesseract verkleinert
und mit geschlossenen Segmentlücken. Gemessen an der Handerfassung und an 300 zufälligen Fotos, die
das alte Verfahren liest.

| Leser                         | Handerfassung (330): richtig / falsch | einfach (300): richtig / falsch |
|-------------------------------|---------------------------------------|---------------------------------|
| Tesseract `eng`               | 2 / 0                                 | 3 / 1                           |
| Tesseract `7seg` (tessdata_ssd) | 95 / 12                             | 187 / 0                         |
| Tesseract `ssd`               | 99 / 15                               | 183 / 7                         |
| Tesseract `ssd_int`           | 99 / 17                               | 183 / 6                         |
| Tesseract `letsgodigital`     | 21 / 25                               | 48 / 34                         |
| ssocr                         | 45 / 9                                | 125 / 1                         |
| PaddleOCR (PP-OCRv5 mobile)   | 67 / 55                               | 93 / 59                         |
| zum Vergleich: Stufe 1 + Raster | 159 / 12                            | –                               |

- Alle Bibliotheken liegen klar hinter dem eigenen Segmentverfahren; auf einfachen Fotos liest die
  beste (`7seg`) nur 62 %.
- PaddleOCR liest am häufigsten still falsch; für Siebensegment-Ziffern ungeeignet.

### Klassisch gehärtet: Kombination und Mehrdeutigkeitsprüfung

Ohne KI. Zwei Raster-Ketten: grüne Taste und Displayränder, beide mit festem Ziffernraster.

- **Kombination „ein Verfahren genügt":** liest eine Kette, gilt ihr Wert; lesen beide und
  widersprechen sich, wird abgewiesen.
- **Typische Fehler:** ein ausgeschaltetes Segment gilt als eingeschaltet (5→6, 6→8, 1→7), meist
  durch Schattenkanten, Kabel oder Geistersegmente.
- **Mehrdeutigkeitsprüfung** (in der App `segments.ts:decode`, Parameter `margin`): liegt das
  Segment am nächsten an der Schwelle näher als `margin` × Schwelle, und ergäbe es umgeschaltet
  ebenfalls eine gültige Ziffer, gilt das Feld als unsicher.

| Abstand (`margin`) | gelesen (1.510) | Handerfassung (330): richtig / falsch |
|--------------------|-----------------|---------------------------------------|
| 0 (aus)            | 87,5 %          | 158 / 14                              |
| 0,1                | 87,3 %          | 150 / 10                              |
| 0,2                | 85,7 %          | 140 / 7                               |
| 0,3                | 83,4 %          | 130 / 5                               |
| 0,5                | 70,0 %          | 88 / 1                                |

**Für die App:** unsichere Felder nicht abweisen, sondern vorbelegt und hervorgehoben in der
Bestätigungsmaske zeigen. Dann bleibt die Lesequote bei 87,5 %, und die Hälfte der falschen Werte
(bei 0,2) ist markiert statt still.

### Fehlerfälle angesehen (14 still falsche Fotos)

- **7× kleine Pulsziffern bei Dunkelheit:** ein Geistersegment überschreitet die Schwelle (6→8,
  5→6, 0→8). Abhilfe: Schwelle der Pulszeile 0,5 statt 0,4 × stärkstes Segment (`segments.ts:RATIO`).
  Gegenprobe außerhalb der Handerfassung: 20 Pulswerte ändern sich, 17 davon liegen danach näher an
  der Tabelle, 3 weiter weg.
- **5× Kabel oder Fingerschatten** über einer Ziffer (4→9, 3→8, 4→1, DIA 132 statt 93). Abhilfe
  teilweise: Plausibilitätsregel SYS − DIA ≥ 15 (`segments.ts:plausible`). Rest bleibt; in der App hilft
  der Vergleich mit den anderen Messpunkten derselben Messung.
- **≥ 1× Tippfehler in der Handerfassung** (`20260113_065457.jpg`: Display zeigt DIA 93, erfasst 92).

| Kombination beider Raster-Ketten                 | gelesen (1.510) | Handerfassung: richtig / falsch |
|--------------------------------------------------|-----------------|---------------------------------|
| vorher                                           | 87,5 %          | 159 / 13                        |
| Pulsschwelle 0,5 + SYS − DIA ≥ 15                | 87,0 %          | 159 / 7                         |
| zusätzlich Mehrdeutigkeitsprüfung 0,2            | 86,1 %          | 157 / 5                         |

(Handerfassung mit korrigiertem Tippfehler.)

### Erkennung in der App (TypeScript)

`app/src/erkennung/`: reines TypeScript ohne OpenCV, läuft in der App (Hermes) und in Node.
`image.ts` (Bildoperationen), `display.ts` (Taste und Displayränder), `segments.ts` (Raster,
Segmente, Plausibilität), `messwerte.ts` (Kombination, Markierung „unsicher" mit Abstand 0,2).

- Eingabe wie in der App: Foto EXIF-gedreht, lange Seite 1.200 px, JPEG. In der App verkleinert
  `expo-image-manipulator` (Glide wendet die EXIF-Drehung an), `jpeg-js` dekodiert.
- **Eigene Threads:** Dekodieren und Lesen laufen in Runtimes von `react-native-worklets`
  0.10.1 (Bundle Mode, experimentell), nicht im JS-Thread. Im JS-Thread hing die Oberfläche, solange
  weitere Fotos im Voraus erkannt wurden. Hermes kennt keine Web Worker; die übrigen Thread-Pakete
  (`react-native-threads`, `react-native-multithreading`) sind seit 2022 tot, `react-native-worklets-core`
  hat keinen Bundle Mode und verlangt `'worklet'` in jeder Funktion, auch in `jpeg-js`.
  Einrichtung: `app/babel.config.js`, `app/metro.config.js`, Metro-Patch in `app/patches/`.
  Drei Runtimes lesen parallel (`RUNTIMES` in `app/src/foto.ts`), verkleinert wird nacheinander.
  Fallstricke: `.claude/rules/erkennung-worklet-runtime.md`.
- Messung am Archiv (`make test-archiv`, 4.10.2026):

| Kennzahl                                         | Wert                                  |
|--------------------------------------------------|---------------------------------------|
| gelesen (1.510)                                  | 87,7 % (Python: 87,0 %)               |
| Handerfassung (330): richtig / falsch            | 171 / 8, davon 4 als unsicher markiert |
| beide lesen, gleicher Wert wie Python            | 1.289 von 1.291                       |
| Zeit je Foto in Node (allein)                    | etwa 0,3 s                            |
| Lesen je Foto unter Hermes, Mac (`make hermes`)  | 2,7 s (vor dem Umbau für Hermes 4,5 s) |
| Lesen je Foto auf dem Galaxy S22, vor dem Umbau  | 8,0 s (dazu 1,0 s Verkleinern, Dekodieren) |

- `make test-archiv` schlägt fehl unter 87,0 % gelesen oder bei mehr als 4 unmarkiert falschen
  Werten in der Handerfassung (`ocr-prototyp/auswertung_ts.py`).
- **Hermes ist ohne JIT etwa 10-mal langsamer als Node;** das S22 noch einmal 1,7-mal langsamer als
  Hermes am Mac. `make hermes` misst eine Stichprobe von 20 Fotos unter derselben Hermes-Version
  wie die App (aus dem Quellcode gebaut, `buildenv/hermes.Dockerfile`). Profil:
  `hermes -sample-profiling=chrome -profiling-out=… alles.hbc`.
- `make test`: Unit-Tests mit künstlichen Daten (`app/tests/`), ohne Fotos; dürfen ins Repo.
- Beschleunigt: Kantenfilter einmal für alle drei Schwellen (0,8 → 0,45 s, Ergebnis unverändert).
  Verworfen: Display-Kandidaten auf halber Auflösung (0,33 s, aber 84,3 % statt 87,7 % gelesen).
- Beschleunigt für Hermes, Ergebnis bitgleich: `components`, `dilate3`, `close` (separabel),
  `gaussianBlur`, `remap` ohne Funktionsaufruf, Objekt oder Destrukturierung je Pixel (4,5 → 2,7 s).
  Verworfen: grüne Maske in `findButton` nur einmal berechnen (1 %, im Rauschen).

### Plausibilität und Bestätigung

- Plausibilität der Erkennung (`segments.ts:plausible`): SYS 70–250, DIA 40–150, Puls 40–180,
  SYS − DIA ≥ 15. Ein Tripel außerhalb verwirft die Erkennung ganz; von Hand ist jeder zwei- bis
  dreistellige Wert möglich.
- **Bestätigungsmaske ist Pflicht:** das Foto über drei editierbaren Feldern; unsichere, leere und
  ungültige Felder hervorgehoben, Speichern erst nach Bestätigung.

## Daten

### Kamera und Import

- Die Aufnahme aus der App landet im App-Cache, nicht in der Galerie. Nach der Auswertung selbst
  löschen (`expo-file-system`).
- **Galerie-Import:** `expo-image-picker` mit `exif: true`, Mehrfachauswahl über
  `allowsMultipleSelection`. `allowsEditing` (Zuschneiden) verwirft EXIF.
- Der Android Photo Picker schwärzt nur den Standort, der Zeitstempel bleibt erhalten. Bilder aus
  Google Photos verlieren einen großen Teil der Metadaten.
- **Ohne EXIF-Zeit:** `DateTimeOriginal`, sonst `DateTime`; fehlt beides, gilt „jetzt", und die
  Bestätigung weist darauf hin.

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
