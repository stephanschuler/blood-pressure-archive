# Blood Pressure Archive

Android-App (Expo, TypeScript), die Blutdruckwerte vom Display-Foto eines Messgeräts liest.
Anforderungen: `ANFORDERUNGEN.md`. Technik, Messergebnisse, verworfene Wege: `TECHNOLOGIE.md`.
Befehle: `make help`.

## Daten in `daten/`

Fotos und Tabelle sind Gesundheitsdaten des Nutzers; [[persoenliche-daten]] gilt verschärft.

- **Inhalt nie in den Kontext:** kein Read auf Fotos, keine Werte aus Tabelle oder `labels/`
  ausgeben. Skripte melden nur Kennzahlen; Einzelergebnisse gehen nach `daten/messlauf/`
  und werden nicht gelesen.
- **Fotos ansehen nur mit Freigabe je Charge,** Anzahl nennen. Die Freigabe vom 4.10.2026
  (50 Fotos) ist verbraucht.
- **`daten/labels/handerfassung.csv` gehört dem Nutzer:** ändern nur auf Nachfrage.
- `daten/` trägt eine `.gitignore` mit `*`: nichts davon in ein Repo oder eine Cloud.

## Erkennung

- **Keine selbst trainierte KI** ohne ausdrücklichen Wunsch: Der Nutzer lehnt sie ab. Die App
  liest klassisch über Segmente.
- **Kein Online-Dienst** für die Erkennung.
- **Fertig erst nach `make test` und `make test-archiv`.** Der Archivtest hat eine Beschleunigung
  abgefangen, die 3 Prozentpunkte Lesequote kostete.
- **Grenzwerte des Archivtests** (`ocr-prototyp/auswertung_ts.py`) anheben, wenn die Erkennung
  besser wird; senken nur auf Nachfrage.

## Build

- **APK nur über `make apk`:** gebaut wird im Docker-Volume, weil die Docker-Dateifreigabe des Macs
  beim Entpacken der Android-Vorlage Dateirechte verliert.
- **`app/android/` wird erzeugt** (Continuous Native Generation): nie von Hand anlegen oder ändern.
