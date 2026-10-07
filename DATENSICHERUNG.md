# Datensicherung und Tabelle: Export und Import

## Seitenleiste

```
┌──────────────────────────────────────┐
│ ☰ Blutdruck                          │  Titelzeile mit ☰
├────────────────────────────────┐     │
│ ♥ Blutdruck                    │░░░░░│
├───────┬────────────────────────┤░░░░░│
│  ◐    │ Format                 │░░░░░│
│Ausseh.│ ┌────┐ ┌────┐ ┌────┐   │░ Start-
│  ☁    │ │CSV │ │XLSX│ │PDF │   │░ seite
│Sicher.│ └────┘ └════┘ └────┘   │░ abge-
│ (⤓)   │ Ziel                   │░ dunkelt
│Export │ [▰ Ordner][⋖ Teilen]   │░░░░░│
│       │                        │░░░░░│
│       ├────────────────────────┤░░░░░│
│ 1.0.0 │      [ Speichern ]     │░░░░░│
│c525c9d│ Zuletzt am 3.10.2026:  │░░░░░│
│  ⚠    │ XLSX · geteilt         │░░░░░│
└───────┴────────────────────────┴─────┘
```

- **☰** steht links vor „Blutdruck“.
- Die Leiste fährt von links herein, 330 dp breit, der Rest wird abgedunkelt. Sie schließt bei
  Tipp daneben, mit der Zurück-Taste und nach jeder Aktion; eine Wahl schließt sie nicht.
- **Kopf:** App-Icon, „Blutdruck“.
- **Navigationsleiste links,** 76 dp: Aussehen (`palette`), Sicherung (`backup`), Export
  (`download`), je Icon mit Name, die gewählte Seite hinterlegt. Rechts daneben deren Inhalt; die
  Wahl hält, solange die App läuft, Vorgabe Aussehen. Grund: die Abschnitte passten auf kleinen
  Handys nicht mehr untereinander, und die Leiste zeigt zugleich, wo man ist und was es noch gibt.
- **Unten in der Leiste** die Version, wie Android sie meldet (`0.0.1` / `3815a01`, zweizeilig);
  ohne APK-Build „Entwicklung“. Ist die Erkennung seit App-Start gescheitert, darunter ein rotes
  Warnzeichen (`error`); Antippen zeigt den letzten Grund. Sonst sähe ein Ausfall, etwa der
  Worklet-Runtime nach einem Update, nur wie schlechtes Lesen aus.
- **Aussehen:**
  - **Darstellung:** Umschalter System | Hell | Dunkel. Wirkt sofort und wird gespeichert.
  - **Raster:** Umschalter 48 | 52 | 56 für die Liste der Startseite (`STARTSEITE.md`,
    „Raster“). Wirkt sofort und wird gespeichert.
  - **Akzente:** Umschalter mit sechs Paletten für Vormittag und Nachmittag, je als diagonal
    geteilter Kreis ohne Text; Vorgabe „Zwei Grautöne“. Wirkt sofort und wird gespeichert.
    Paletten: `AKZENT_FARBEN` in `app/src/theme.ts`.
- **Sicherung:** Datensicherung Speichern (`download`), Einspielen (`upload_file`).
- **Export:**
  - **Format:** drei Kacheln CSV (`csv`), XLSX (`table_view`), PDF (`picture_as_pdf`); Vorgabe
    XLSX.
  - **Ziel:** Umschalter Ordner (`folder`) | Teilen (`share`); Vorgabe Ordner.
  - Beide Wahlen werden gespeichert (`exportformat`, `exportziel`).
  - **Speichern** sitzt am Fuß der Seite und führt die gewählte Kombination aus: „Ordner“ wie
    beim Sichern, „Teilen“ öffnet das Teilen-Blatt. Darunter der letzte Export, etwa „Zuletzt am
    3.10.2026: XLSX · geteilt“, sonst „Noch nie exportiert“ (`exportiert`). Bricht der Nutzer die
    Ordnerwahl ab, bleibt er unverändert.
- Icons aus den Material Symbols, wie die vorhandenen Knöpfe.
- Auch bei leerer App erreichbar: Auf einem neuen Handy ist Einspielen der erste Schritt.

## Datensicherung speichern

- Android fragt nach dem Ordner. Dort entsteht `blutdruck-JJJJ-MM-TT.sqlite`.
- Inhalt ist eine Kopie der App-Datenbank samt Einstellungen (`serializeSync()` von
  expo-sqlite): in sich stimmig, auch wenn gerade geschrieben wird.
- Danach die Meldung „Gesichert: 412 Messpunkte.“ Bricht der Nutzer die Ordnerwahl ab, passiert
  nichts.
- Unter „Speichern" steht auf der Seite „Sicherung“ der Tag der letzten Sicherung. Gibt es Messpunkte,
  aber keine Sicherung oder ist die letzte älter als 14 Tage, zeigt die Startseite oben
  „Noch keine Datensicherung · Jetzt sichern" bzw. „Letzte Datensicherung am … · Jetzt sichern";
  Antippen sichert.

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
- **CSV:** Datei `blutdruck-JJJJ-MM-TT.csv`.
- **XLSX, Blatt „Messpunkte“** (zweites Blatt): dieselben Spalten. Die Zeit ist eine Tageszahl in Ortszeit mit Format
  `yyyy-mm-dd hh:mm`, damit Sheets sie als Datum führt: Aus der CSV las Sheets die Zeit nur als Text.
  Erzeugt mit `fflate`, ohne Tabellen-Bibliothek und ohne Expo-Importe, damit testbar.
- **XLSX, Blatt „Tagesmittel“** (erstes Blatt): eine Zeile je Tag mit Messung, älteste zuerst. Spalten Datum
  (`yyyy-mm-dd`), dann SYS, DIA, Puls vormittags, dann dieselben nachmittags. Je Hälfte das
  gerundete Mittel ihrer Messungen, jede Messung zählt gleich; Grenze 12 Uhr Ortszeit. Beides wie
  auf der Startseite. Hälfte ohne Messung: Zellen leer.
- **XLSX:** Datei `blutdruck-JJJJ-MM-TT.xlsx`. Über „Teilen“ geht sie in den Cache der App, und
  `expo-sharing` öffnet das Teilen-Blatt von Android, etwa „In Drive speichern“. Jede Ablage ist
  eine neue Datei. In Drive öffnet „Mit Google Sheets öffnen“ sie als Tabelle.

## Bericht (PDF)

- A4 hoch, zum Ausdrucken oder Weitergeben an die Ärztin oder den Arzt.
- **Je Kalendermonat mit Messung eine Seite,** älteste zuerst.
- **Überschrift:** Monat und Jahr („Oktober 2026“). Darunter die Mittel des Monats: gesamt,
  vormittags, nachmittags.
- **Diagramm des Monats:** je Tageshälfte SYS und DIA als Linien mit Band, wie auf der Startseite;
  unten jeder Tag des Monats, Wochenende grau. Die Achse in 20er-Schritten ist auf allen Seiten
  gleich, aus allen Werten, damit die Monate vergleichbar bleiben; 80 und 140 gestrichelt.
- **Tabelle:** jeder Kalendertag des Monats, Tage ohne Messung leer. Je Tageshälfte SYS, DIA und
  Puls in eigenen Spalten, das Mittel wie im XLSX-Blatt „Tagesmittel“.
- **Platz:** Zeilenhöhe fest (`10pt/1.2`), damit 31 Tage auch mit anderer Schrift auf die Seite
  passen. Geprüft mit Chromium: rund drei Zeilen Luft.
- Farben der Tageshälften aus dem gewählten Akzent, helle Variante.
- `app/src/bericht.ts` baut HTML ohne Expo-Importe, damit testbar; `expo-print` macht daraus das
  PDF. Ränder per CSS `@page`: `expo-print` setzt auf Android keine.
- **Datei** `blutdruck-JJJJ-MM-TT.pdf`, in einen Ordner oder über das Teilen-Blatt.
