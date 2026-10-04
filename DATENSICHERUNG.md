# Datensicherung und Tabelle: Export und Import

## Seitenleiste

```
┌──────────────────────────────────────┐
│ ☰ Blutdruck                          │  Titelzeile mit ☰
├───────────────────────┐              │
│ ♥ Blutdruck           │░░░░░░░░░░░░░░│
│ Darstellung           │░░ Startseite │
│ [System][Hell][Dunkel]│░░ abgedunkelt│
│ Datensicherung        │░░░░░░░░░░░░░░│
│ ⤓ Speichern           │░░░░░░░░░░░░░░│
│ ⤒ Einspielen          │░░░░░░░░░░░░░░│
│ Tabelle               │░░░░░░░░░░░░░░│
│ ▦ Als CSV speichern   │░░░░░░░░░░░░░░│
│ ▦ Als XLSX speichern  │░░░░░░░░░░░░░░│
│ △ In Google Drive …   │░░░░░░░░░░░░░░│
│ Version 0.0.1-3815a01 │░░░░░░░░░░░░░░│
└───────────────────────┴──────────────┘
```

- **☰** steht links vor „Blutdruck“.
- Die Leiste fährt von links herein, 268 dp breit, der Rest wird abgedunkelt. Sie schließt bei
  Tipp daneben, mit der Zurück-Taste und nach jeder Aktion.
- **Kopf:** App-Icon, „Blutdruck“.
- **Darstellung:** Umschalter System | Hell | Dunkel. Wirkt sofort und wird gespeichert.
- **Datensicherung:** Speichern (`download`), Einspielen (`upload_file`).
- **Tabelle:** Als CSV speichern (`csv`), Als XLSX speichern (`table_view`), In Google Drive ablegen
  (`add_to_drive`).
- **Fuß:** die Version, wie Android sie meldet (`0.0.1-3815a01`); ohne APK-Build „Entwicklung“.
- Icons aus den Material Symbols, wie die vorhandenen Knöpfe.
- Auch bei leerer App erreichbar: Auf einem neuen Handy ist Einspielen der erste Schritt.

## Datensicherung speichern

- Android fragt nach dem Ordner. Dort entsteht `blutdruck-JJJJ-MM-TT.sqlite`.
- Inhalt ist eine Kopie der App-Datenbank samt Einstellungen (`serializeSync()` von
  expo-sqlite): in sich stimmig, auch wenn gerade geschrieben wird.
- Danach die Meldung „Gesichert: 412 Messpunkte.“ Bricht der Nutzer die Ordnerwahl ab, passiert
  nichts.

## Datensicherung einspielen

- Android-Dateiauswahl ohne Typfilter: SQLite-Dateien haben keinen verlässlichen MIME-Typ.
- Die Datei wird nur im Speicher geöffnet (`deserializeDatabaseSync()`), nichts landet auf Platte.
- **Prüfung:**
  - Keine SQLite-Datei, oder Schemastand 0: „Keine Datensicherung dieser App.“
  - Schemastand neuer als die App: „Die Sicherung stammt von einer neueren App-Version.“
  - Schemastand älter: Die Migrationen laufen an der Kopie im Speicher.
- **Übernahme:** Die Sicherung ergänzt den Bestand. Jeder Messpunkt geht in einer Transaktion
  durch `insertMesspunkt()`, Doppelte werden übersprungen. Messpunkte mit Werten, die keine
  ganzen Zahlen sind, werden ausgelassen. Einstellungen werden nicht übernommen.
- Keine Rückfrage vorher, weil Ergänzen nichts verliert. Danach die Meldung
  „412 Messpunkte gelesen, 3 neu übernommen.“
- Ein inzwischen gelöschter Messpunkt kommt zurück, wenn die Sicherung ihn noch enthält.

## Tabelle (CSV und XLSX)

- Eine Zeile je Messpunkt, älteste zuerst.
- Kopfzeile `Zeit,SYS,DIA,Puls`. Die Zeit steht in Ortszeit als `2026-10-04 07:59`. Komma als
  Trenner, UTF-8.
- **Als CSV speichern:** Ordnerwahl wie beim Sichern, Datei `blutdruck-JJJJ-MM-TT.csv`.
- **XLSX:** dieselben Spalten. Die Zeit ist eine Tageszahl in Ortszeit mit Format
  `yyyy-mm-dd hh:mm`, damit Sheets sie als Datum führt: Aus der CSV las Sheets die Zeit nur als Text.
  Erzeugt mit `fflate`, ohne Tabellen-Bibliothek und ohne Expo-Importe, damit testbar.
- **Als XLSX speichern:** Ordnerwahl wie beim Sichern, Datei `blutdruck-JJJJ-MM-TT.xlsx`.
- **In Google Drive ablegen:** Die XLSX geht in den Cache der App, und `expo-sharing` öffnet das
  Teilen-Blatt von Android. Dort „In Drive speichern“ wählen. Jede Ablage ist eine neue Datei. In
  Drive öffnet „Mit Google Sheets öffnen“ sie als Tabelle.
