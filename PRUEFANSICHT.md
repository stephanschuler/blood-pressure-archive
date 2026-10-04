# Prüfansicht: erkannte Werte bestätigen

Vorlage ist der Entwurf „A Basis“ aus Runde 2 auf der Design-Leinwand
<https://claude.ai/artifact/TxwJFHoStrbFfsfegEVAkm>. Er kombiniert den Display-Rahmen aus
Entwurf 04, den Fortschrittsbalken aus 22 und die Tastatur aus 18.

Umgesetzt in `Bestaetigung` (`app/App.tsx`): die Ansicht, die nach der Erkennung je Foto
erscheint, bevor ein Messpunkt gespeichert oder das Foto verworfen wird.

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

Mit unsicherem DIA: der Cursor steht in DIA, die Zifferntastatur ist offen, das Foto schrumpft.

```
┌──────────────────────────────────────┐
│ Foto 3 von 7         4.10.2026, 08:12 │
│ ━━━━━━━━━━━━━━━──────────────────────│
│ ┌──────────────────────────────────┐ │
│ │        Foto des Messgeräts       │ │  Foto, kleiner
│ └──────────────────────────────────┘ │
│ ╭──────────────────────────────────╮ │
│ │ SYS                         128  │ │
│ │──────────────────────────────────│ │
│ │ DIA                    ▐░░░ 84|░▌│ │  gelb, blauer Fokusrand
│ │──────────────────────────────────│ │
│ │ PUL                          67  │ │
│ ╰──────────────────────────────────╯ │
│       (Verwerfen)    (Speichern)      │
├──────────────────────────────────────┤
│    1        2        3               │
│    4        5        6               │  Zifferntastatur des Systems
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

4 dp hoch, volle Breite, Grund in `photo`-Grau. Der gefüllte Teil in Herz-Rot `#E53946` zeigt
`aktuell / gesamt` (3 von 7 sind 43 %).

**Zählung:** `gesamt` ist die Zahl der Fotos, die mit einem Import oder einer Aufnahme in die
Warteschlange kamen. `aktuell` ist `gesamt − verbleibende + 1`. Fotos, die als bekannt
übersprungen werden (Doppelter Import, siehe `ANFORDERUNGEN.md`), zählen mit; der Balken springt
dann um mehr als einen Schritt.

Ein einzelnes Foto, etwa nach „Foto aufnehmen“, zeigt `Foto 1 von 1` und einen vollen Balken.

Der Ladebildschirm „Erkenne …“ zeigt weder Kopfzeile noch Balken.

### 3. Foto

Volle Breite, `resizeMode="contain"`. Das Foto
nimmt den Platz, den Kopf, Rahmen und Knöpfe übrig lassen. Öffnet sich die Tastatur, schrumpft
es; schließt sie sich, wächst es wieder.

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

Damit das Foto schrumpft statt verdeckt zu werden, muss die Ansicht mit der Tastatur kleiner werden.
Ob Android das von selbst tut (`softwareKeyboardLayoutMode`, in `app/app.json` nicht gesetzt) oder
ein `KeyboardAvoidingView` nötig ist, zeigt erst das Handy.

### 6. Knöpfe

Unverändert: Verwerfen links, Speichern rechts, Speichern gesperrt, solange ein Feld ungültig ist.
Sie stehen direkt über der Tastatur, wenn sie offen ist.

## Farben

In `COLORS` (`app/src/theme.ts`):

| Zweck | Hell | Dunkel |
|---|---|---|
| `focus`, Fokusrand | `#1a5fb4` | `#78aeed` |

Alles andere nutzt die übrigen Farben: `text` für den Rahmen, `line` für die Trennlinien,
`sub` für Beschriftung und Zeitpunkt, `uncertain` für unsichere Felder, `photo` für den Grund des
Balkens.
