# Prüfansicht: erkannte Werte bestätigen

Vorlage ist der Entwurf „A Basis“ aus Runde 2 auf der Design-Leinwand
<https://claude.ai/artifact/TxwJFHoStrbFfsfegEVAkm>. Er kombiniert den Display-Rahmen aus
Entwurf 04, den Fortschrittsbalken aus 22 und die Tastatur aus 18.

Umgesetzt in `Bestaetigung` (`app/App.tsx`): die Ansicht, die nach der Erkennung je Foto
erscheint, bevor ein Messpunkt gespeichert oder das Foto verworfen wird. Felder und Knöpfe
(`Werteingabe`) teilt sie mit dem Bearbeiten eines Messpunkts.

## Ziel

Die drei Werte stehen **untereinander, so wie auf dem Display des Messgeräts**: SYS oben, DIA in
der Mitte, PUL unten. Ein Blick vom Foto auf die Felder vergleicht Zeile für Zeile.

## Aufbau von oben nach unten

Ohne unsicheren Wert, Tastatur zu:

```
┌──────────────────────────────────────┐
│ Foto 3 von 7         4.10.2026, 08:12 │  Kopfzeile
│ ━━━━━━━━━━━━━━━──────────────────────│  Fortschrittsbalken
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │        Foto des Messgeräts       │ │  Foto, füllt den freien Platz
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ ╭──────────────────────────────────╮ │
│ │ SYS                         128  │ │
│ │──────────────────────────────────│ │  Display-Rahmen
│ │ DIA                          84  │ │
│ │──────────────────────────────────│ │
│ │ PUL                          67  │ │
│ ╰──────────────────────────────────╯ │
│       (Verwerfen)    (Speichern)      │  Knöpfe, unverändert
└──────────────────────────────────────┘
```

Mit unsicherem DIA: der Cursor steht in DIA, die Zifferntastatur ist offen, die Ansicht ist so weit
gescrollt, dass DIA knapp über der Tastatur steht.

```
┌──────────────────────────────────────┐
│ │        Foto des Messgeräts       │ │  Foto, oben hinausgescrollt
│ └──────────────────────────────────┘ │
│ ╭──────────────────────────────────╮ │
│ │ SYS                         128  │ │
│ │──────────────────────────────────│ │
│ │ DIA                    ▐░░░ 84|░▌│ │  gelb, blauer Fokusrand
├──────────────────────────────────────┤
│    1        2        3               │  Zifferntastatur des Systems,
│    4        5        6               │  über PUL und den Knöpfen
│    7        8        9               │
│  Weiter     0        ⌫               │
└──────────────────────────────────────┘
```

### 1. Kopfzeile

Links fett `Foto 3 von 7`, rechts in Grau der Zeitpunkt des Fotos ohne Sekunden
(`4.10.2026, 08:12`). Stammt der Zeitpunkt nicht aus dem Foto, steht dort der angenommene
Zeitpunkt, und darunter folgt über die ganze Breite eine zweite Zeile, klein auf
`uncertain`-Gelb: „Zeitpunkt nicht im Foto, jetzt angenommen“.

### 2. Fortschrittsbalken

4 dp hoch, volle Breite, Grund in `photo`-Grau. Darüber in Herz-Rot `#E53946` die bestätigten
Fotos, `(aktuell − 1) / gesamt` (3 von 7 sind 29 %); dahinter hellgrau (`erkannt`) zusätzlich so
viele, wie schon erkannt sind. Der Rest bleibt `photo`-Grau.

**Zählung:** `gesamt` ist die Zahl der Fotos, die mit einem Import oder einer Aufnahme in die
Warteschlange kamen. `aktuell` ist `gesamt − verbleibende + 1`. Fotos, die als bekannt
übersprungen werden (Doppelter Import, siehe `ANFORDERUNGEN.md`), zählen mit; der Balken springt
dann um mehr als einen Schritt.

Ein einzelnes Foto, etwa nach „Foto aufnehmen“, zeigt `Foto 1 von 1`; der Balken
ist grau gefüllt, sobald das Foto erkannt ist, Rot steht auf 0.

Der Ladebildschirm „Erkenne …“ zeigt weder Kopfzeile noch Balken.

### 3. Foto

Volle Breite, `resizeMode="contain"`. Das Foto
nimmt den Platz, den Kopf, Rahmen und Knöpfe übrig lassen. Bei offener Tastatur behält es
seine Größe; die Ansicht wird scrollbar.

### 4. Display-Rahmen

Ein Kasten mit 2 dp Rand in der Textfarbe (`text`), Eckradius 14 dp, innen 12 dp Abstand
seitlich. Darin drei Zeilen, getrennt durch 1 dp Linien in `line`:

| Zeile | Beschriftung | Ziffern |
|---|---|---|
| SYS | links, 40 dp breit, grau (`sub`) | 44 dp, rechtsbündig |
| DIA | wie SYS | 44 dp, rechtsbündig |
| PUL | wie SYS | 32 dp, rechtsbündig |

PUL ist kleiner, wie auf den meisten Geräten. Die Felder selbst haben keinen eigenen Rahmen; der
Kasten ist der Rahmen.

**Unsicher oder ungültig** (`reading.uncertain[i]` oder keine zwei- bis dreistellige
Zahl): Hintergrund des Felds in `uncertain`-Gelb. Die Markierung bleibt bestehen, solange
die Erkennung den Wert unsicher fand, auch nach einer Korrektur.

**Fokus:** 2 dp Rand in der Farbe `focus`, hell `#1a5fb4`, dunkel `#78aeed`.

### 5. Tastatur

Die Zifferntastatur des Systems (`keyboardType="number-pad"`), keine eigene.

- **Öffnet von selbst** nur, wenn ein Wert unsicher oder leer ist. Der Cursor steht dann im
  **ersten** solchen Feld, von oben gezählt.
- **Bleibt zu,** wenn alle drei Werte sicher sind. Antippen eines Felds öffnet sie wie gewohnt.
- **„Weiter“** springt ins nächste Feld darunter, das unsicher, leer oder ungültig ist. Gibt es
  darunter keins, **speichert** „Weiter“, sofern alle drei Felder gültig sind, und das nächste
  Foto erscheint. Ist noch ein Feld darüber ungültig, springt „Weiter“ stattdessen dorthin.

Android legt die Tastatur über die App, statt sie zu verkleinern. Die Ansicht hängt deshalb Platz
in Tastaturhöhe an und scrollt das fokussierte Feld 8 dp über die Tastatur.

### 6. Knöpfe

Unverändert: Verwerfen links, Speichern rechts, Speichern gesperrt, solange ein Feld ungültig ist.
Bei offener Tastatur liegen sie unter ihr: erreichbar durch Scrollen, Speichern auch über „Weiter“.

**Zurück-Taste** verwirft wie „Verwerfen“. Bei einer Aufnahme aus der App fragt sie vorher nach
(„Aufnahme verwerfen?“), auch während der Erkennung: Das Foto wird danach gelöscht, ein
versehentliches Zurück verlöre die Messung. Fotos aus der Galerie bleiben dort und gehen ohne
Rückfrage.

## Farben

In `COLORS` (`app/src/theme.ts`):

| Zweck | Hell | Dunkel |
|---|---|---|
| `focus`, Fokusrand | `#1a5fb4` | `#78aeed` |
| `erkannt`, erkannte Fotos im Balken | `#b5b5b5` | `#6a6a6a` |

Alles andere nutzt die übrigen Farben: `text` für den Rahmen, `line` für die Trennlinien,
`sub` für Beschriftung und Zeitpunkt, `uncertain` für unsichere Felder, `photo` für den Grund des
Balkens.
