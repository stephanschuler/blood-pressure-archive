# Startseite: Übersicht der Messungen

## Begriffe

- **Messung:** Messpunkte mit jeweils weniger als 20 Minuten Abstand zum vorigen
  (`gruppieren()` in `app/src/messung.ts`). Ihr Zeitpunkt ist der des ersten Messpunkts, ihre
  Werte sind die gerundeten Mittel der Messpunkte.
- **Vormittag / Nachmittag:** Eine Messung gehört zum Vormittag, wenn ihr Zeitpunkt vor 12:00 Uhr
  Ortszeit liegt, sonst zum Nachmittag.
- **Ø 7 Tage:** Mittel über alle Messungen von heute und den sechs Kalendertagen davor. Jede
  Messung zählt gleich, egal wie viele Messpunkte sie hat.
- **Vorwoche:** die sieben Kalendertage vor diesen sieben.
- **Kalenderwoche:** nach ISO 8601, Montag bis Sonntag.
- **Trendpfeil:** zeigt die Differenz eines Werts zu einem Bezugswert, in mmHg bzw. Schlägen:
  `▲4` höher, `▼4` niedriger, `•0` gleich.

## Aufbau von oben nach unten

```
┌──────────────────────────────────────┐
│ Blutdruck            Darstellung: Hell│  Titelzeile, unverändert
├──────────────────────────────────────┤
│ [◔ Vormittag][◕ Nachmittag][ Beide  ]│  ┐
│ Ø 7 Tage 139/82 ▼8 •0 · ♥ 73 ▲2       │  │
│ ╱╲_╱╲  ╱‾╲_   ┊░░░░░░░│ 140          │  │ stehender Kopf,
│ ╲_╱ ╲╱    ╲_  ┊░░░░░░░│  80          │  │ scrollt nicht mit
│ ━ SYS ━ DIA ━ ◔ Vorm. ╌ ◕ Nachm.     │  │
│                    SYS   DIA   PUL    │  ┘
├──────────────────────────────────────┤
│ Oktober 2026                          │  Monatskopf, haftet
│ KW 40 Ø Woche       139    82    73   │  Wochenzeile
│ 28.09.–04.10. · 11   ▼8    •0    ▲2   │
│ ┌──┐ › ◔ 07:59    123    84    67     │  Tag mit Kalenderblatt,
│ │So│     2 Pkt.    ▼16   ▲2    ▼6     │  darin die Messungen
│ │ 4│                                  │
│ │Ok│                                  │
│ └──┘                                  │
│ ┌──┐ ⌄ ◕ 21:46    148    74    82     │  aufgeklappte Messung
│ │Sa│     4 Pkt.    ▲9    ▼8    ▲9     │
│ │ 3│   ┌ 21:46   150    72    86 ┐    │  Messpunkte
│ └──┘   │ 21:47   145    77    81 │    │
│        └ Antippen zum Bearbeiten …┘   │
│                  …                    │
├──────────────────────────────────────┤
│       (Importieren)   (Aufnehmen)     │  Knöpfe, unverändert
└──────────────────────────────────────┘
```

### 1. Umschalter Tageshälfte

Drei gleich breite Segmente: **Vormittag**, **Nachmittag**, **Beide**. Vorgabe ist „Beide“. Vor
„Vormittag“ und „Nachmittag“ steht das jeweilige Symbol (siehe unten).

Die Auswahl filtert alles darunter: Kennzahl, Diagramm, Wochenzeilen, Liste. Sie bleibt über einen
Neustart der App erhalten, wie die Darstellung.

### 2. Kennzahl

Eine Zeile auf grauem Grund:

`Ø 7 Tage 139/82 ▼8 •0 · ♥ 73 ▲2   Trend ggü. Vorwoche`

- SYS/DIA und Puls als Ø 7 Tage der gewählten Tageshälfte, im Titel ergänzt um „vormittags“
  bzw. „nachmittags“.
- Die Pfeile vergleichen mit dem Ø der Vorwoche derselben Auswahl.
- Keine Messung in den 7 Tagen: `Ø 7 Tage –`. Keine Messung in der Vorwoche: kein Pfeil.

### 3. Diagramm

- **Zeitraum:** 21 Tage; er folgt der Liste. Die Tage, die in der Liste sichtbar sind, stehen in
  der Mitte, hellrot hinterlegt. Ganz oben endet er heute, ganz unten beginnt er am ältesten Tag.
  Er folgt der Mitte der sichtbaren Tage, kurz animiert; über mehr als 21 Tage springt er.
- **Linien:** SYS rot, DIA blau, je eine Linie für Vormittag (durchgezogen) und Nachmittag
  (gestrichelt). Bei gefilterter Ansicht nur die Linien der gewählten Hälfte.
- **Hinterlegt:** die 7 Tage der Kennzahl grau, beschriftet „Ø 7 Tage“.
- **Raster:** gestrichelte Linien bei 80 und 140 mmHg, rechts beschriftet. Skala fest von 60 bis
  170 mmHg.
- **Achse:** unten das Datum jedes Montags.
- **Legende** in einer Zeile darunter: `━ SYS  ━ DIA  ━ ◔ Vormittag  ╌ ◕ Nachmittag`.
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

- links `KW 40` fett, daneben „Ø Woche“, darunter klein `28.09.–04.10. · 11 Mess.`
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

- `›` als Hinweis zum Aufklappen, aufgeklappt um 90° gedreht
- Symbol der Tageshälfte
- Uhrzeit, darunter klein die Zahl der Messpunkte (`4 Pkt.`)
- SYS, DIA, PUL fett (18 dp), darunter je ein Pfeil gegen die vorige Messung derselben Tageshälfte,
  auch über Tage ohne Messung hinweg; auch unter „Beide“ Vormittag gegen Vormittag. Die erste Messung
  einer Tageshälfte hat keinen Pfeil.

**Antippen** klappt die Messpunkte auf: grauer Kasten, je Messpunkt Uhrzeit, SYS, DIA, PUL, darunter
der Hinweis „Antippen zum Bearbeiten, lange drücken zum Löschen“. **Langes Drücken** auf einen
Messpunkt fragt nach und löscht ihn. **Antippen** öffnet ihn in der Werteingabe der
Prüfansicht, ohne Foto und Fortschritt, Kopf „Messpunkt bearbeiten“ mit seiner Zeit. Speichern
ändert die drei Werte, die Zeit bleibt; gleicht er danach einem anderen Messpunkt derselben Zeit,
bleibt einer. Links steht „Löschen“ mit Rückfrage, die Zurück-Taste bricht ab. Mehrere Messungen dürfen zugleich aufgeklappt sein. Zu Beginn ist keine
aufgeklappt.

### 9. Kurvenleiste

Senkrechte Leiste am rechten Bildschirmrand, 40 dp breit, neben der Liste; die Liste rückt dafür
ein.

- **Inhalt:** SYS und DIA als Kurve der Wochenmittel über die ganze Zeit, oben heute, unten die
  älteste Messung, linear in der Zeit. Gestrichelt 80 und 140 mmHg, waagerechte Linien an jedem
  Jahreswechsel mit `’25` darunter. Die Auswahl der Tageshälfte filtert auch hier.
- **Position:** ein roter Strich markiert den obersten sichtbaren Tag, darauf am linken Rand ein
  roter Griff. Scrollt die Liste, ist der Griff voll sichtbar, sonst halb durchsichtig.
- **Antippen und Ziehen:** springt zum Tag unter dem Finger, ohne Messung zum nächstälteren.
  Die Leiste bleibt dabei 40 dp breit. Links davon eine rote Blase mit dem Datum des Tags, auf dem
  die Liste landet, etwa „Mi 10.04.2024“.
- **Haptik:** ein kurzer Tick bei jedem Monatswechsel unter dem Finger.
- **Bedienungshilfe:** einstellbares Element „Zeitleiste“; hoch und runter wechselt den Monat.

## Symbole der Tageshälften

Eine Sonne auf ihrem Tagesbogen, 16 dp: ein gestrichelter Halbkreis über einer Horizontlinie, die
Sonne als gefüllter Punkt.

- **Vormittag:** Sonne links auf dem Bogen, noch vor dem Mittag, in Orange.
- **Nachmittag:** Sonne rechts auf dem Bogen, nach dem Mittag, in Violett.

Die Symbole stehen im Umschalter, in der Legende des Diagramms und in jeder Messungszeile.

## Farben

In `COLORS` (`app/src/theme.ts`), je Hell und Dunkel:

| Zweck | Hell | Dunkel |
|---|---|---|
| Vormittag | `#d97706` | `#f5a524` |
| Nachmittag | `#6d4fd8` | `#9d86ff` |
| SYS-Linie | `#c62828` | `#ef6b6b` |
| DIA-Linie | `#1f6feb` | `#58a6ff` |
| Pfeil höher | `#d32f2f` | `#ef5350` |
| Pfeil niedriger | `#2e9d5b` | `#4cc27a` |

Differenzen bis ±2 bleiben grau (`sub`), auch mit Pfeil. Beim Puls färben die Pfeile genauso wie
beim Blutdruck.

## Leere Zustände

- Noch keine Messung: kein Diagramm, keine Kennzahl, Text „Noch keine Messungen.“
- Gefilterte Hälfte ohne Messungen: Kennzahl `–`, leeres Diagramm mit Raster, Text „Keine Messungen
  am Vormittag.“ bzw. „… am Nachmittag.“
