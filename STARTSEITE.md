# Startseite: Übersicht der Messungen

## Begriffe

- **Messung:** Messpunkte mit jeweils weniger als 20 Minuten Abstand zum vorigen
  (`gruppieren()` in `app/src/messung.ts`). Ihr Zeitpunkt ist der des ersten Messpunkts, ihre
  Werte sind die gerundeten Mittel der Messpunkte.
- **Vormittag / Nachmittag:** Eine Messung gehört zum Vormittag, wenn ihr Zeitpunkt vor 12:00 Uhr
  Ortszeit liegt, sonst zum Nachmittag.
- **Ø 7 Tage:** Mittel über alle Messungen von heute und den sechs Kalendertagen davor. Jede
  Messung zählt gleich, egal wie viele Messpunkte sie hat.
- **Kalenderwoche:** nach ISO 8601, Montag bis Sonntag.
- **Trendpfeil:** zeigt die Differenz eines Werts zu einem Bezugswert, in mmHg bzw. Schlägen:
  `▲4` höher, `▼4` niedriger, `•0` gleich.

## Aufbau von oben nach unten

```
┌──────────────────────────────────────┐
│ ☰ Blutdruck    ∅ 7-Tage:    │ [◔◕▾]  │  Titelzeile mit Kennzahl
│                139/82, ♥73  │        │  und Tageshälfte
├──────────────────────────────────────┤
│ ╱╲_╱╲  ╱‾╲_   ┊░░░░░░░│ 140          │  ┐ stehender Kopf,
│ ╲_╱ ╲╱    ╲_  ┊░░░░░░░│  80          │  │ scrollt nicht mit
│                    SYS   DIA   PUL    │  ┘
├──────────────────────────────────────┤
│ Oktober 2026                          │  Monatskopf, haftet
│ ┌──┐ 28.09.–04.10.  139    82    73   │  Wochenzeile: graue Karte
│ │KW│ 11 Messungen    ▼8    •0    ▲2   │  mit KW-Blatt
│ │40│                                  │
│ └──┘                                  │
│ ┌──┐ ◔ 07:59 (2)  123    84    67     │  Tag mit Kalenderblatt,
│ │So│               ▼16   ▲2    ▼6     │  darin die Messungen
│ │ 4│                                  │
│ │Ok│                                  │
│ └──┘                                  │
│ ┌──┐ ◕ 21:46 (4)  148    74    82     │  aufgeklappte Messung
│ │Sa│               ▲9    ▼8    ▲9     │
│ │ 3│ ┌ 21:46   150    72    86   ┐    │  Messpunkte
│ └──┘ │ 21:47   145    77    81   │    │
│      └ Antippen zum Bearbeiten …  ┘   │
│                  …                    │
├──────────────────────────────────────┤
│  (Von Hand) (Importieren) (Aufnehmen) │  Knöpfe
└──────────────────────────────────────┘
```

Der Titel „Blutdruck“ steht in 24 statt 28 dp, damit Kennzahl und Auswahl daneben Platz haben.

### 1. Auswahl Tageshälfte

Dropdown am rechten Rand der Titelzeile, nur mit Symbolen (siehe unten): Vormittag, Nachmittag,
Beide. „Beide“ zeigt beide Symbole verkleinert und versetzt. Vorgabe ist „Beide“. Ein senkrechter
Strich trennt das Dropdown von der Kennzahl.

Die Auswahl filtert alles darunter: Kennzahl, Diagramm, Wochenzeilen, Liste. Sie bleibt über einen
Neustart der App erhalten, wie die Darstellung.

### 2. Kennzahl

Mittig zwischen Titel und Strich, zweizeilig: oben klein `∅ 7-Tage:`, linksbündig über dem
SYS-Wert, darunter `139/82, ♥73`. SYS rot, DIA blau, Puls kleiner: das ♥ in Herz-Rot, die Zahl grau.

- SYS/DIA und Puls als Ø 7 Tage der gewählten Tageshälfte.
- Keine Messung in den 7 Tagen: `–`.

### 3. Diagramm

- **Zeitraum:** 21 Tage; er folgt der Liste. Die Tage, die in der Liste sichtbar sind, stehen in
  der Mitte, hellrot hinterlegt. Ganz oben endet er heute, ganz unten beginnt er am ältesten Tag.
  Er folgt der Mitte der sichtbaren Tage, kurz animiert; über mehr als 21 Tage springt er.
- **Bänder:** je Tageshälfte eine blasse Fläche zwischen SYS- und DIA-Linie, Fläche und beide
  Linien in der Farbe der Tageshälfte; keine Punkte. Bei gefilterter Ansicht nur die gewählte Hälfte.
- **Hinterlegt:** die 7 Tage der Kennzahl grau, beschriftet „Ø 7 Tage“.
- **Raster:** gestrichelte Linien bei 80 und 140 mmHg, rechts beschriftet. Skala fest von 60 bis
  170 mmHg.
- **Achse:** unten das Datum jedes Montags.
- **Größe:** volle Breite, 44 dp Zeichenfläche plus Achsbeschriftung. Das Diagramm ist nicht
  bedienbar: kein Antippen, kein Zoom.

### 4. Spaltenkopf

`SYS DIA PUL` klein und grau, rechtsbündig über den Wertspalten der Liste. Er gehört zum
stehenden Kopf.

### 5. Monatskopf

`Oktober 2026` fett mit roter Linie darunter (Herz-Rot `#E53946`). Er haftet beim Scrollen
unter dem stehenden Kopf, bis der nächste Monat ihn verdrängt.

Rechts trägt er ein Kalendersymbol. **Antippen** öffnet den Datumswähler des Systems, vorbelegt
mit dem obersten sichtbaren Tag, begrenzt auf älteste Messung bis heute. Nach der Wahl springt die
Liste zu dem Tag, er leuchtet kurz rot auf. Hat der Tag keine Messung, springt sie zum nächstälteren
und zeigt unten knapp drei Sekunden: `Keine Messung am 14.05.2024, nächste davor: Mo 13.05.2024`.

### 6. Wochenzeile

Vor dem ersten Tag jeder Kalenderwoche, nicht aufklappbar:

- links ein KW-Blatt wie das Kalenderblatt der Tage: grauer Streifen „KW“, darunter die Nummer,
  auch im Dunkelmodus hell. Daneben der Zeitraum `28.09.–04.10.`, darunter klein `11 Messungen`.
  Die Zeile ist eine graue Karte, die Werte sind gedämpft.
- in den drei Wertspalten das Mittel der Woche (gewählte Tageshälfte), darunter je ein Pfeil zur
  Vorwoche. Hat die Vorwoche keine Messung, steht statt des Pfeils ein Strich.

Liegt ein Monatswechsel in der Woche, steht die Wochenzeile nur einmal, beim neuesten Tag. Der
Monatskopf folgt dann zwischen den Tagen.

### 7. Tag

Links ein **Kalenderblatt** (36 dp breit): oben auf rotem Streifen der Wochentag (`So`), darunter
groß der Tag (`4`), darunter klein der Monat (`Okt`). Daneben die Messungen des Tages
untereinander, neueste oben. Tage ohne Messung erscheinen nicht.

### 8. Messung

Eine Zeile:

- Symbol der Tageshälfte, Uhrzeit und dahinter die Zahl der Messpunkte in einer kleinen grauen Pille,
  alle drei auf Höhe der Werte; ohne eigenen Aufklapp-Hinweis, die ganze Zeile klappt auf
- SYS, DIA, PUL fett (18 dp), darunter je ein Pfeil gegen die vorige Messung derselben Tageshälfte,
  auch über Tage ohne Messung hinweg; auch unter „Beide“ Vormittag gegen Vormittag. Die erste Messung
  einer Tageshälfte hat keinen Pfeil.

**Antippen** klappt die Messpunkte auf: grauer Kasten, je Messpunkt Uhrzeit, SYS, DIA, PUL, darunter
der Hinweis „Antippen zum Bearbeiten, lange drücken zum Löschen“. **Langes Drücken** auf einen
Messpunkt fragt nach und löscht ihn. **Antippen** öffnet ihn in der Werteingabe der
Prüfansicht, ohne Foto und Fortschritt, Kopf „Messpunkt bearbeiten“ mit seiner Zeit; die Zeit lässt
sich wie dort antippen und ändern. Gleicht er nach dem Speichern einem anderen Messpunkt derselben
Zeit, bleibt einer. Links stehen „Löschen“ mit Rückfrage und „Abbrechen“ (`close`), rechts
„Speichern“; die Zurück-Taste bricht ebenfalls ab. Mehrere Messungen dürfen zugleich aufgeklappt
sein. Zu Beginn ist keine aufgeklappt.

### Knöpfe

Von links: **Von Hand eintragen** (`edit`), Importieren, Aufnehmen; Aufnehmen bleibt rechts für den
rechten Daumen. Von Hand öffnet die Werteingabe wie beim Bearbeiten, Kopf „Messpunkt eintragen“,
Felder leer, Zeit „jetzt“ auf die volle Minute und änderbar; links nur „Abbrechen“.

### 9. Henkel

Keine Leiste neben der Liste: Eine Kurvenleiste nahm 40 dp weg und brachte zu wenig.

- **Form:** rote halbe Pille an der Bildkante, 14 × 56 dp, darin weiße Auf-ab-Pfeile. Sie
  überdeckt keine Werte.
- **Position:** steht auf Höhe des obersten sichtbaren Tags; jeder Tag mit Messung hat gleich viel
  Weg, oben der neueste, unten der älteste. Oben und unten bleiben 56 dp frei, oben, damit der
  Henkel den Kalenderknopf des Monatskopfs nicht verdeckt.
- **Ruhe und Ausfahren:** in Ruhe ragen 3 dp ins Bild, mit 60 % Deckkraft. Scrollt die Liste,
  fährt der Henkel in 300 ms ganz heraus und nach 1,5 s wieder ein.
- **Ziehen:** springt von Tag zu Tag, ohne Messung zum nächstälteren. Liegt der Finger mehr als
  60 dp links vom Rand, geht es Tag für Tag, je 10 dp Fingerweg; beim Wechsel zählt der Henkel vom
  aktuellen Tag aus weiter. Links daneben ein Tooltip mit dem Datum, etwa „Mi 10.04.2024“, in
  `tooltip`/`tooltipText` aus `COLORS`: hell dunkelgrau, dunkel hellgrau. Tag für Tag springt die
  Liste mit, höchstens einmal je Frame. Grob wandern nur Henkel und Tooltip; die Liste springt,
  wenn der Finger 150 ms auf einem Tag ruht, und beim Loslassen. Das Diagramm zieht erst beim
  Loslassen nach.
- **Haptik:** ein kurzer Tick bei jedem Tageswechsel unter dem Finger.
- **Bedienungshilfe:** einstellbares Element „Zeitleiste“; hoch und runter wechselt den Monat.
- **Offen:** ob Androids Zurück-Geste am Bildschirmrand das senkrechte Ziehen stört; nur auf dem
  Gerät zu prüfen.

### 10. Raster

Die Liste kennt die Höhe jedes Elements vorab (`getItemLayout`, `app/src/raster.ts`) und springt
ohne Schätzung an jeden Tag. Dafür hat jeder Text eine feste Zeilenhöhe; die Höhen wachsen mit der
Schriftgröße des Systems.

In der Seitenleiste wählbar, Vorgabe 52:

| Raster | Kopf | Woche | Messung | Messpunkt, Hinweis |
|---|---|---|---|---|
| 48 | 48 | 48 | 48 | 24 |
| 52 | 52 | 52 | 52 | 26 |
| 56 | 56 | 56 | 56 | 28 |

Ein Tag ist die Summe seiner Messungen samt aufgeklapptem Kasten; die Trennlinie liegt darüber,
ohne eigene Höhe, und das KW-Blatt steht mittig in der Wochenkarte.

## Symbole der Tageshälften

Eine Sonne auf ihrem Tagesbogen, 16 dp in der Liste, 18 dp im Dropdown: ein gestrichelter
Halbkreis über einer Horizontlinie, die Sonne als gefüllter Punkt.

- **Vormittag:** Sonne links auf dem Bogen, noch vor dem Mittag.
- **Nachmittag:** Sonne rechts auf dem Bogen, nach dem Mittag.

Ihre Farben wählt die Seitenleiste unter „Akzente“ (`DATENSICHERUNG.md`).

Die Symbole stehen im Dropdown der Tageshälfte und in jeder Messungszeile.

## Farben

In `COLORS` (`app/src/theme.ts`), je Hell und Dunkel:

| Zweck | Hell | Dunkel |
|---|---|---|
| SYS-Wert der Kennzahl | `#c62828` | `#ef6b6b` |
| DIA-Wert der Kennzahl | `#1f6feb` | `#58a6ff` |
| Pfeil höher | `#d32f2f` | `#ef5350` |
| Pfeil niedriger | `#2e9d5b` | `#4cc27a` |

Differenzen bis ±2 bleiben grau (`sub`), auch mit Pfeil. Beim Puls färben die Pfeile genauso wie
beim Blutdruck.

## Leere Zustände

- Noch keine Messung: Kennzahl `–`, kein Diagramm, Text „Noch keine Messungen.“
- Gefilterte Hälfte ohne Messungen: Kennzahl `–`, leeres Diagramm mit Raster, Text „Keine Messungen
  am Vormittag.“ bzw. „… am Nachmittag.“
