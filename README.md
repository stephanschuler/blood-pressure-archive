# Blood Pressure Archive

Android-App, die Blutdruckwerte vom Foto eines Messgeräts abliest und lokal archiviert.

Das Messgerät hat keine Schnittstelle für den Datenexport. Bisher wurde jede Messung von Hand in
eine Excel-Tabelle übertragen und das Display zur Sicherheit zusätzlich fotografiert. Die App
nimmt diese Arbeit ab: Foto aufnehmen, Werte prüfen, speichern.

## Wie es funktioniert

1. **Foto:** direkt in der App aufnehmen oder vorhandene Fotos aus der Galerie importieren.
   Messzeitpunkt ist der Aufnahmezeitpunkt bzw. das Datum aus den EXIF-Daten.
2. **Erkennung:** Die App findet das Display, entzerrt es und liest die Siebensegment-Ziffern für
   systolisch, diastolisch und Puls. Klassische Bildverarbeitung in TypeScript, ohne KI-Modell
   und ohne Online-Dienst.
3. **Bestätigung:** das Foto über den erkannten Werten; unsichere und leere Felder sind markiert.
   Gespeichert wird erst nach Bestätigung.
4. **Archiv:** Messpunkte im Abstand von weniger als 20 Minuten bilden eine Messung (typisch 2–4,
   linker und rechter Arm). Gespeichert in einer SQLite-Datenbank auf dem Handy.

## Datenschutz

Die Erkennung läuft vollständig auf dem Handy. Fotos und Messwerte des Archivs in `daten/`
verlassen den Entwicklungsrechner nicht und liegen in keinem Repository.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `app/` | die App: Expo, React Native, TypeScript; Erkennung in `app/src/erkennung/` |
| `buildenv/` | Docker-Images und Skripte für Build und Werkzeuge |
| `ocr-prototyp/` | Archivtest: Fotos verkleinern und Ergebnisse auswerten (Python) |
| `daten/` | Fotoarchiv und Handerfassung, nur lokal |

## Loslegen

Voraussetzung ist Docker Desktop mit Rosetta-Emulation für amd64; alles Weitere läuft in
Containern. `make help` listet alle Befehle.

```sh
make images      # Docker-Images bauen
make install     # npm-Abhängigkeiten installieren
make test        # Typprüfung, Unit- und Oberflächentests
make apk         # Release-APK nach app/dist/blutdruck-<version>-<hash>.apk
make serve-apk   # APK im WLAN anbieten, zum Installieren auf dem Handy
```

`make test-archiv` misst die Erkennung am Fotoarchiv und braucht deshalb `daten/`.

## Weiterlesen

- [ANFORDERUNGEN.md](ANFORDERUNGEN.md): was die App können soll
- [TECHNOLOGIE.md](TECHNOLOGIE.md): Technikwahl, Build, Messergebnisse der Erkennung, verworfene Wege
- [ERKENNUNG.md](ERKENNUNG.md): wie die Erkennung entstand und wie sie heute funktioniert
- [app/assets/ICON.md](app/assets/ICON.md): Gestaltung von App-Icon und Ladeanimation
