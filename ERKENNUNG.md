# Erkennung der Blutdruckwerte: Entstehung und Funktionsweise

Quellen: Code und Doku aus Git, Gesprächsverläufe. Der Python-Prototyp lag nie im Repo; dort
steht nur der Archivtest (`ocr-prototyp/`). Zeiten in Ortszeit (UTC+2). In diesem Dokument
stehen absichtlich keine Messwerte, keine Fotonamen und keine Datum-Wert-Paare, nur Kennzahlen.

---

## 1. Kurzfassung

Die App liest das Display des Medisana-Messgeräts klassisch, ohne trainierte KI und ohne
Online-Dienst. Das Foto wird auf 1.200 px lange Seite verkleinert und in eigenen Worklet-Runtimes
dekodiert, bis zu drei Fotos zugleich, damit die Oberfläche bedienbar bleibt. Zwei unabhängige Wege suchen
das Display und entzerren es auf 330 × 400 px: über die grüne START/STOP-Taste und über die
Displayränder (Kantenvierecke, bewertet nach der Zahl ziffernartiger Flecken). In beiden
entzerrten Bildern misst ein festes Ziffernraster je Siebensegment-Segment, wie viel dunkler es
ist als seine direkte Umgebung, im hellsten Farbkanal. Eine Schwelle je Ziffer entscheidet, welche
Segmente leuchten. Eine Tabelle übersetzt das Segmentmuster in eine Ziffer. Ein Ergebnis gilt nur,
wenn es plausibel ist. Lesen beide Wege, müssen sie übereinstimmen. Felder, deren Segmentmuster
knapp an der Schwelle kippen könnte, markiert die App als „unsicher“ und hebt sie in der
Bestätigungsmaske hervor.

**Archivtest (`make test-archiv`, 1.510 Fotos):** 87,7 % gelesen. Von 330 Fotos mit bekanntem
Wert: 171 richtig, 8 falsch, davon 4 als unsicher markiert.

---

## 2. Der Weg dorthin

### Übersicht

| Zeit | Schritt | Ergebnis | Entscheidung |
|------|---------|----------|--------------|
| 10:55 | Recherche Siebensegment-OCR | generische OCR ungeeignet | eigene Segmentlesung, Modell als Rückfallebene |
| 11:30 | Befund an 20 Fotos | ein Gerät, grüne Taste als Anker | Prototyp in Python/OpenCV |
| 11:39 | Messlauf 1 (Taste + Raster) | 74,4 % gelesen | Abweisungen untersuchen |
| 11:43 | Messlauf 2 (hellster Kanal, Schwelle je Ziffer) | 80,5 % | Handerfassung, dann Modell |
| 12:05–14:21 | Handerfassung durch den Nutzer | 307 Fotos | Grundlage aller exakten Zahlen |
| 14:30 | trainiertes Ziffernmodell | 92,2 % auf Testfotos | nur Vergleichswert |
| 14:42 | Tastensuche in drei Stufen | 81,5 %, 12 Fotos ohne Taste | übernommen |
| 14:48 | andere Geräte | 5 bzw. 2–3 Fotos | zurückgestellt |
| 15:01 | Display über Ränder (Stufe 1) + Raster | 85,0 % | übernommen |
| 15:21 | Tesseract, ssocr, PaddleOCR | alle klar schlechter | verworfen |
| 15:27 | OCR + kleines Sprachmodell (Idee) | nicht gemessen | verworfen zugunsten klassischer Härtung |
| 15:31 | Kombination beider Ketten, Mehrdeutigkeit | 87,5 % | übernommen |
| 15:34 | Pulsschwelle 0,5, SYS − DIA ≥ 15 | 87,0 %, 159 / 7 | übernommen |
| 15:37 | `react-native-fast-opencv` vs. reines TypeScript | – | reines TypeScript |
| 15:40–16:02 | Portierung, Archivtest mit Grenzwerten | 87,7 % (Python 87,0 %) | übernommen |
| 16:13 | Beschleunigung | 0,8 → 0,45 s je Foto | übernommen; halbe Auflösung verworfen |
| 18:14 | Regel: Erkennung blockiert JS-Thread | – | später überholt |
| 18:43 | Vorab-Erkennung aller Fotos | Oberfläche hängt | Ursache: JS-Thread |
| 19:05 | Worklet-Runtime (Bundle Mode) | 87,7 %, unverändert | übernommen, auf `main` |

### 2.1 Recherche (ab 10:55)

- **Was:** Drei Recherche-Agenten; einer zur Texterkennung von Siebensegment-Displays.
- **Befund:** Apple Vision unterstützt Siebensegment-Ziffern laut Apple nicht; ML Kit und
  Tesseract scheitern laut Issues und Studie. Spezialisierte Modelle erreichen in Studien an
  Blutdruckmessgeräten 98–99 %. `ssocr` ist klassisch, braucht aber einen sauberen
  Zeilenausschnitt.
- **Entscheidung:** Erster Kandidat ist die Segment-Abtastung bei festem Layout, Rückfallebene ein
  eigenes kleines Modell (TFLite). Cloud-LLM scheidet aus Datenschutzgründen aus.
- **Dateien:** keine; Ergebnis in `TECHNOLOGIE.md`, Abschnitt „Ansatz“.

### 2.2 Befund am Fotoarchiv (11:27–11:31)

- **Was:** Der Nutzer gab 20 Fotos nach Claudes Wahl frei (gleichmäßig über das Archiv verteilt).
  Alles Weitere nur über Kennzahlen aus lokalen Skripten.
- **Befund:** 1.510 Fotos. Fast alle zeigen ein Medisana mit festem Layout: drei Zeilen SYS, DIA,
  PUL, darüber Datum und Uhrzeit. Die Uhr des Geräts ist nicht gestellt; der Messzeitpunkt kommt
  deshalb nur aus EXIF. Die grüne START/STOP-Taste rechts neben dem Display ist im Bild eindeutig.
  Störungen: Abstand (Display füllt 20–70 % des Bildes), Drehung, Perspektive, Spiegelungen,
  sichtbare inaktive Segmente („Geisterziffern“, teils farbig).
- **Entscheidung:** Taste als Anker.

### 2.3 Entzerrung über die grüne Taste (11:31–11:35)

- **Was:** Taste über einen HSV-Grünbereich finden, daraus einen groben Ausschnitt um das Display
  schneiden, darin die vier Glaskanten suchen und perspektivisch entzerren.
- **Lehre:** Die erste Fassung maß die Lage des Displays in Tastenbreiten. Bei Nahaufnahmen ist die
  Taste am Bildrand angeschnitten, ihre Breite taugt nicht. Seitdem misst alles in Tastenhöhen
  (`UNIT = 150` px je Tastenhöhe).
- **Prüfung:** Ein Mittelwertbild der 20 entzerrten Displays (`dev_mean.py`) zeigte ein
  deckungsgleiches Ziffernraster. Daran wurden die Ziffernzellen abgelesen.
- **Dateien:** `display.py`, `dev_montage.py`, `dev_mean.py`.

### 2.4 Segmentlesung, Messlauf 1 (11:35–11:39)

- **Was:** Festes Raster je Ziffer, je Segment Dunkelheit messen, Nachschlagetabelle.
- **Ergebnis:** Erster Durchlauf 8 von 20 Stichproben ganz richtig; die Pulszeile lag daneben.
  Nach Nachjustieren der Pulszellen 16 / 20 richtig, 4 abgewiesen, 0 falsch.
- **Messlauf 1 am Archiv (1.510 Fotos):** 74,4 % vollständig und plausibel gelesen; Taste auf 19
  Fotos nicht gefunden. Abgleich mit der Tabelle des Nutzers (Durchschnitt je Messung): Tabellenwert
  im Bereich der gelesenen Werte ± 3 bei 91,8 % der Messungen (alle drei Felder). 2 Verdachtsfälle
  auf still falsche Werte.
- **Befund:** Die Lücke sind Abweisungen (rund 26 %), kaum falsche Werte.
- **Dateien:** `segments.py`, `messlauf.py`, `dev_read.py`, `dev_debug.py`. Im Transkript taucht
  eine Funktion `otsu` auf, also eine Schwelle je Bild über alle Segmentwerte; sie wurde in Lauf 2
  entfernt.

### 2.5 Verbesserte Segmentlesung, Messlauf 2 (11:40–11:43)

- **Was:** 20 abgewiesene Fotos angesehen (als Übersichtsbilder). Drei Änderungen:
  - **Hellster Farbkanal** statt Grauwert: farbige Geistersegmente werden hell, aktive schwarze
    Segmente bleiben dunkel.
  - **Segment gegen seine direkte Umgebung** statt gegen das ganze Bild; der Abstand zur Umgebung
    wächst mit der Ziffernhöhe (`0.13 × Zellhöhe` statt fest 7 px).
  - **Schwelle je Ziffer** statt je Bild: ein Schatten hebt alle Segmente einer Ziffer gemeinsam an.
- **Ergebnis:** 80,5 % gelesen; Tabellenabgleich 93,7 %; Verdacht auf stille Fehler 7. Von 1.104
  Fotos, die beide Läufe lesen, 7 mit unterschiedlichem Wert.
- **Befund der Stichprobe (20 abgewiesene):** 4 andere Geräte, 7 Hand- oder Handyschatten, 5 Kabel
  über den Ziffern, 2 farbige Geistersegmente. Fotos entstehen ohne Rücksicht auf Qualität; ein
  Sucherrahmen in der App würde kaum helfen.
- **Dateien:** `segments.py`, `dev_reject_montage.py`, `dev_sweep.py`.

### 2.6 Handerfassung (11:47–14:21)

- **Was:** Lokale Erfassungsseite (`erfassen.py`, nur localhost) für alle abgewiesenen, zwischen
  den Läufen schwankenden und verdächtigen Fotos. Der Prototyp belegt die Felder vor.
- **Umfang:** 307 Fotos, 2 als unlesbar markiert. Zusammen mit den von Claude abgelesenen
  Stichproben (`dev-labels.csv`, `reject-labels.csv`) ergeben sich die „330 Fotos mit bekanntem
  Wert“, gegen die alle späteren Zahlen laufen.
- **Wichtig:** Die Handerfassung enthält absichtlich die schweren Fälle. Falsch-Zahlen dort liegen
  höher als im Archivdurchschnitt.
- **Ablage:** dauerhaft in `daten/labels/` (per `.gitignore` aus jedem Repo ausgeschlossen); die
  Datei gehört dem Nutzer. Ein Tippfehler darin wurde später nur auf Nachfrage korrigiert.
- **Lehre:** Das Gerätefeld der Erfassung ist unzuverlässig: bei schwach beleuchteten
  Medisana-Fotos stand oft die Vorbelegung „Beurer“. Das Gerät bestimmt seitdem die Tastensuche.

### 2.7 Trainiertes Ziffernmodell (14:22–14:47)

- **Was:** Zweistufig: Lage und Ziffernpositionen wie bisher, je Ziffernfeld entscheidet ein
  kleines CNN (3 Faltungsschichten, PyTorch, CPU) zwischen 0–9 und „leer“. Training mit
  künstlichen Schatten, Kabeln, Lage- und Kontrastschwankungen.
- **Daten:** 914 Fotos bis 31.1.2026 (235 von Hand erfasst, Rest in beiden Läufen gleich gelesen);
  Test auf rund 500 Fotos ab 1.2.2026.
- **Ergebnis (nach der toleranteren Tastensuche):**

  | Verfahren auf Testfotos | gelesen | schwer (78): richtig / falsch / abgewiesen |
  |-------------------------|---------|-------------------------------------------|
  | Segmentverfahren        | 87,0 %  | 0 / 0 / 78                                |
  | Modell, Schwelle 0,5    | 95,0 %  | 56 / 0 / 22                               |
  | Modell, Schwelle 0,8    | 92,2 %  | 49 / 0 / 29                               |
  | Modell, Schwelle 0,9    | 89,6 %  | 42 / 0 / 36                               |

  Zwischen zwei Trainingsläufen schwanken die Werte um etwa ±1 Prozentpunkt. Auf den einfachen
  Testfotos zeigt Übereinstimmung mit dem Segmentverfahren nur Konsistenz, keine Richtigkeit:
  deren Werte stammen selbst vom Segmentverfahren. Kombination beider Verfahren brachte nichts.
- **Entscheidung:** Nur Vergleichswert. Der Nutzer lehnt selbst trainierte KI ab (`CLAUDE.md`:
  „Keine selbst trainierte KI ohne ausdrücklichen Wunsch“). Seine Begründung steht nicht im
  Transkript; dort ist nur Claudes Bestätigung belegt: „Das trainierte Modell bleibt vorerst als
  Vergleichswert liegen, in der App wird es nur auf deinen Wunsch verwendet.“
- **Lehre:** Der Zwischenspeicher der ausgeschnittenen Ziffern (`cells.npz`) hielt nach einer
  Änderung der Entzerrung alte Ausschnitte. Er muss nach solchen Änderungen gelöscht werden.
- **Dateien:** `cells.py`, `train.py`, Dockerfile mit PyTorch.

### 2.8 Tastensuche für schwaches Licht und andere Geräte (14:32–14:47)

- **Was:** 10 Fotos ohne gefundene Taste angesehen. 7 zeigten das aktuelle Medisana bei schwachem
  oder gelblichem Licht (Taste blassgrün), nur 3 ein anderes Gerät.
- **Erster Versuch:** Formprüfung auch für die strenge Suche. Ergebnis 7 Fotos gewonnen,
  7 verloren: angeschnittene Tasten fielen durch.
- **Lösung, drei Stufen:** strenges Grün mit Formprüfung (aufrechtes Rechteck,
  Seitenverhältnis 1,2–2,4), dann blasses Grün mit Formprüfung und Mindestfüllung 0,65, zuletzt
  strenges Grün ohne Formprüfung für angeschnittene Tasten.
- **Ergebnis:** 81,5 % gelesen, 12 Fotos ohne Taste; kein anderes Gerät wird für das Medisana
  gehalten.
- **Dateien:** `display.py`, `dev_sheet.py` (Übersichtsbilder; `dev_devices.py` und
  `dev_sweep_button.py` wurden im Gespräch angelegt, stehen aber nicht im Commit).

### 2.9 Andere Geräte zurückgestellt (14:48)

- **Befund:** Beurer 5 Fotos (Oktober und Dezember 2025), älteres Medisana 2–3 Fotos (Oktober
  2025). Nach Dezember 2025 kein anderes Gerät mehr.
- **Entscheidung:** zurückgestellt. Ein Layout ließe sich bauen, aber nicht ehrlich prüfen:
  getestet würde an denselben wenigen Fotos, an denen es eingestellt wurde.

### 2.10 Mehrstufige Kette ohne grüne Taste (14:57–15:05)

- **Was:** Vorschlag des Nutzers („dein mehrstufiger Ansatz“). **Stufe 1** sucht konvexe
  Vierecke passender Größe und Form in den Kanten des ganzen Bildes und wählt das, dessen
  Entzerrung die meisten ziffernartigen Flecken enthält. **Stufe 2** liest im entzerrten Display,
  entweder mit freier Ziffernsuche oder mit dem festen Medisana-Raster.
- **Ergebnis:**

  | Kette (1.510 Fotos)          | gelesen | Handerfassung (330): richtig / falsch / abgewiesen |
  |------------------------------|---------|----------------------------------------------------|
  | grüne Taste + Raster         | 81,5 %  | 42 / 12 / 276                                      |
  | Stufe 1 + freie Ziffernsuche | 71,1 %  | 110 / 4 / 216                                      |
  | **Stufe 1 + festes Raster**  | 85,0 %  | 159 / 12 / 159                                     |
  | mindestens eine Raster-Kette | 89,7 %  | –                                                  |

  Stufe 1 findet ein Display auf 1.503 von 1.510 Fotos, auch bei schwachem Licht.
- **Entscheidung:** festes Raster behalten; die freie Ziffernsuche scheitert an Geisterziffern
  (zusätzliche Stellen) und unbekannten Segmentmustern. Beide Raster-Ketten widersprechen sich auf
  28 von 1.112 gemeinsam gelesenen Fotos: Ansatz für die spätere Kombination.
- **Lehre:** Die Fleckenprüfung ließ die Ziffer 1 zuerst durchfallen (Seitenverhältnis ab 0,2);
  seitdem ab 0,1.
- **Dateien:** `stufe1.py`, `stufe2.py`, `messlauf2.py`, `dev_stufe1.py`, `dev_read2.py`,
  `dev_why.py`.

### 2.11 Open-Source-OCR: Tesseract, ssocr, PaddleOCR (15:06–15:21)

- **Was:** Die drei Zahlenzeilen aus Stufe 1, entschrägt, schwarz auf weiß; für Tesseract
  verkleinert und mit geschlossenen Segmentlücken. Gemessen an der Handerfassung und an 300
  zufälligen, vom alten Verfahren gelesenen Fotos.
- **Ergebnis:**

  | Leser                           | Handerfassung: richtig / falsch | einfach (300): richtig / falsch |
  |---------------------------------|---------------------------------|---------------------------------|
  | Tesseract `eng`                 | 2 / 0                           | 3 / 1                           |
  | Tesseract `7seg` (tessdata_ssd) | 95 / 12                         | 187 / 0                         |
  | Tesseract `ssd`                 | 99 / 15                         | 183 / 7                         |
  | Tesseract `ssd_int`             | 99 / 17                         | 183 / 6                         |
  | Tesseract `letsgodigital`       | 21 / 25                         | 48 / 34                         |
  | ssocr                           | 45 / 9                          | 125 / 1                         |
  | PaddleOCR (PP-OCRv5 mobile)     | 67 / 55                         | 93 / 59                         |
  | zum Vergleich: Stufe 1 + Raster | 159 / 12                        | –                               |

- **Entscheidung:** verworfen. Die beste Bibliothek liest auf einfachen Fotos nur 62 %; PaddleOCR
  liest am häufigsten still falsch. Tesseract und PaddleOCR sind zudem selbst trainierte Netze,
  nur von anderen trainiert.
- **Dateien:** `ocr_libs.py`, `ocr_paddle.py`, `ocr.Dockerfile`, `paddle.Dockerfile`.

### 2.12 Idee: OCR plus kleines Sprachmodell (15:27)

- **Vorschlag des Nutzers:** OCR liefert Text mit beliebigen Leerzeichen, ein kleines lokales
  Sprachmodell ordnet SYS, DIA und Puls zu.
- **Claudes Einschätzung:** Leerzeichen sind nicht das Problem; das Messskript wirft schon alles
  außer Ziffern weg. Die Fehler sind falsch gelesene Ziffern, die ein Sprachmodell ohne Bild nicht
  zurückholt. Erwartung höchstens die OCR-Quote (etwa 62 % auf einfachen Fotos). Kandidaten wären
  150–500 MB groß, wieder KI, und könnten Zahlen erfinden.
- **Entscheidung:** klassisch härten. Gemessen wurde die Idee nicht.

### 2.13 Härtung: Kombination, Mehrdeutigkeit, Pulsschwelle, Plausibilität (15:29–15:34)

- **Kombination „ein Weg genügt“:** Liest eine Kette, gilt ihr Wert; lesen beide und widersprechen
  sich, wird abgewiesen. Ergebnis 87,5 % gelesen.
- **Mehrdeutigkeitsprüfung (`margin`):** Liegt das Segment, das der Schwelle am nächsten ist,
  näher als `margin × Schwelle` daran, und ergäbe es umgeschaltet ebenfalls eine gültige Ziffer,
  gilt das Feld als unsicher.

  | `margin` | gelesen | Handerfassung: richtig / falsch |
  |----------|---------|---------------------------------|
  | 0 (aus)  | 87,5 %  | 158 / 14                        |
  | 0,1      | 87,3 %  | 150 / 10                        |
  | 0,2      | 85,7 %  | 140 / 7                         |
  | 0,3      | 83,4 %  | 130 / 5                         |
  | 0,5      | 70,0 %  | 88 / 1                          |

  **Entscheidung für die App:** nicht abweisen, sondern markieren. Die Lesequote bleibt, und bei
  0,2 ist rund die Hälfte der falschen Werte markiert statt still.
- **Fehlerfälle angesehen** (Übersichten der 14 still falschen Fotos):
  - 7× kleine Pulsziffern bei Dunkelheit: ein Geistersegment überschreitet die Schwelle
    (6→8, 5→6, 0→8). Abhilfe: Schwelle der Pulszeile 0,5 statt 0,4 × stärkstes Segment.
    Gegenprobe außerhalb der Handerfassung: von 20 geänderten Pulswerten liegen 17 danach näher an
    der Tabelle, 3 weiter weg.
  - 5× Kabel oder Fingerschatten über einer Ziffer (4→9, 3→8, 4→1, einmal eine scheinbare Hunderterstelle im DIA).
    Abhilfe teilweise: Plausibilitätsregel SYS − DIA ≥ 15. Der Rest bleibt.
  - Mindestens 1× Tippfehler in der Handerfassung.
- **Ergebnis:**

  | Kombination beider Raster-Ketten       | gelesen | Handerfassung: richtig / falsch |
  |----------------------------------------|---------|---------------------------------|
  | vorher                                 | 87,5 %  | 159 / 13                        |
  | Pulsschwelle 0,5 + SYS − DIA ≥ 15      | 87,0 %  | 159 / 7                         |
  | zusätzlich Mehrdeutigkeitsprüfung 0,2  | 86,1 %  | 157 / 5                         |

  (mit korrigiertem Tippfehler)
- **Dateien:** `segments.py` (`decode`, `RATIO`, `MARGIN`), `messlauf.py` (`plausible`),
  `dev_margin.py`, `dev_pul.py`, `dev_wrong.py`. Zwischenspeicher `measures.pkl` (Segmentwerte
  beider Ketten je Foto).

### 2.14 `react-native-fast-opencv` gegen reines TypeScript (15:35–15:37)

- **Was:** `react-native-fast-opencv` installiert und seine Schnittstellen gelesen.
- **Abwägung:** OpenCV-Bindings liefen nur auf dem Handy und wären dort nur von Hand
  testbar. Reines TypeScript läuft auch in Node und lässt sich in Docker am ganzen Archiv messen.
- **Entscheidung:** reines TypeScript; `react-native-fast-opencv` entfällt. Die nötigen
  OpenCV-Funktionen wurden nachgebaut (Abschnitt 3).

### 2.15 Portierung und Abgleich gegen den Prototyp (15:37–16:02)

- **Was:** `image.ts` (OpenCV-Nachbauten), `segments.ts`, `display.ts`, `messwerte.ts`.
  Eingabe wie in der App: `export_klein.py` legt alle Fotos EXIF-gedreht, lange Seite 1.200 px,
  JPEG-Qualität 92 ab.
- **Abgleich:** `app/tools/messlauf.ts` liest das Archiv in Node (12 Prozesse parallel) und
  schreibt je Foto eine CSV-Zeile. `referenz.py` erzeugt aus `measures.pkl` das Python-Ergebnis
  mit denselben Vorgaben. `auswertung_ts.py` vergleicht beide und die Handerfassung, gibt nur
  Kennzahlen aus.
- **Ergebnis:** TypeScript 87,7 % gelesen (Python 87,0 %); wo beide lesen, gleicher Wert auf
  1.289 von 1.291 Fotos. Handerfassung 171 richtig, 8 falsch, davon 4 als unsicher markiert.
- **Unterschied bei der Markierung:** Ein erster Entwurf markierte ein Feld, wenn die
  kombinierte, plausibilitätsgeprüfte Lesung mit `MARGIN` fehlte oder dort abwich. Heute gilt ein Feld als sicher, sobald
  mindestens eine Kette es auch mit Mehrdeutigkeitsprüfung gleich liest.
- **Dateien:** `referenz.py`, `auswertung_ts.py`, `export_klein.py`; App-seitig
  `app/tools/messlauf.ts`, `app/tools/profil.ts`.

### 2.16 Archivtest mit Grenzwerten (15:58–16:02)

- `make test-archiv` = `make klein` + Node-Messlauf + `auswertung_ts.py --pruefen`.
- **Grenzwerte** in `ocr-prototyp/auswertung_ts.py`: mindestens 87,0 % gelesen, höchstens 4
  unmarkiert falsche Werte in der Handerfassung. Laut `CLAUDE.md` anheben, wenn die Erkennung
  besser wird; senken nur auf Nachfrage.
- `make test` prüft die Logik mit künstlichen Daten ohne Fotos (Abschnitt 3.11).

### 2.17 Beschleunigung (16:12–16:16)

- **Messwerkzeug:** `app/tools/profil.ts` misst die Zeit je Schritt an einem Foto. Der größte
  Posten war die Displaysuche über Kanten (`viaEdges`).
- **Übernommen:** Canny für alle drei Schwellenpaare in einem Durchgang: Gradient und
  Maximumsuche einmal, nur die Verknüpfung schwacher und starker Kanten je Paar. 0,8 → 0,45 s je
  Foto in Node, Ergebnis unverändert. Daneben im Transkript: `adaptiveDark` auf ein Summenbild
  umgestellt; dessen Einzelwirkung ist nicht belegt.
- **Verworfen:** Displaykandidaten auf halber Auflösung suchen und aus dem vollen Bild entzerren.
  0,33 s je Foto, aber 84,3 % statt 87,7 % gelesen. Der Archivtest hat das abgefangen; deshalb
  verlangt `CLAUDE.md` ihn vor „fertig“. Ein Kommentar in `display.ts:viaEdges` hält die Lehre fest.

### 2.18 Erkennung im JS-Thread (bis 18:43)

- Zunächst lief `recognize()` synchron im JS-Thread, hinter einer Ladeanzeige („Erkenne …“).
- Die Ladeanimation musste deshalb nativ laufen (`Animated` mit `useNativeDriver`); Regel
  `js-thread-erkennung.md` (Commit „App-Icon, Splash und Ladeanimation auf nativem Treiber“).
- **Vorab-Erkennung** (Commit „Alle Fotos vorab erkennen, nicht erst nach der Entscheidung“,
  Wunsch des Nutzers): Alle importierten Fotos werden nacheinander erkannt, während der Nutzer
  das aktuelle bestätigt. Nacheinander, nicht parallel: sonst lägen alle Fotos zugleich in voller
  Größe im Speicher.
- **Folge:** Beim Tippen auf „Speichern“ hing die App, solange das nächste Foto erkannt wurde.
  Im Archivtest dauert ein Foto im Median 0,7 s, höchstens 1,4 s (12 Prozesse parallel); auf dem
  Handy ist die Zeit nicht gemessen.

### 2.19 Erkennung in der Worklet-Runtime (18:57–19:19)

- **Recherche:** Hermes hat einen JS-Thread, keine Web Worker; Service Worker gibt es in React
  Native nicht. Expo bietet nur Hintergrundjobs, keinen Rechen-Thread.
- **Alternativen:**

  | Weg | Bewertung |
  |-----|-----------|
  | `react-native-worklets`, Standardmodus | jede Funktion braucht `'worklet'`, auch in `jpeg-js`: rund 740 Zeilen Erkennung plus Fremdbibliothek umschreiben |
  | **`react-native-worklets`, Bundle Mode** | ganzes Bundle in der Runtime, Code unverändert; experimentell, verlangt Babel-, Metro-Konfiguration und Metro-Patch |
  | `react-native-worklets-core` (Margelo) | kaum gepflegt, kein Bundle Mode |
  | `react-native-threads`, `react-native-multithreading` | seit 2022 tot |
  | Erkennung in Kotlin | echte Threads, aber Neuschreiben; unverhältnismäßig |
  | Erkennung in Schritte zerlegen, dazwischen an die Oberfläche abgeben | keine Abhängigkeit, Hänger nur kürzer |
  | erst auf dem Handy messen | klärt nur die Größe des Problems |

- **Entscheidung:** Versuch mit Bundle Mode auf einem Branch. `react-native-worklets` 0.10.1
  (die Version aus Expo SDK 57), Metro-Patch aus dem Worklets-Repo (für Metro 0.84.4 geschrieben,
  auf 0.84.5 sauber angewendet), `patch-package`.
- **Ergebnis:** `make test` grün, `make test-archiv` unverändert 87,7 %, APK-Build ohne den
  „SHA-1“-Fehler. Der Nutzer prüfte auf dem Handy: „Passt, nehmen wir so.“ Fast-Forward nach
  `main`, Regel umbenannt zu `erkennung-worklet-runtime.md` (beides Commit „Erkennung in eigener
  Worklet-Runtime statt im JS-Thread“).
- Die 50-ms-Pause vor jeder Erkennung, die vorher der Oberfläche Luft verschaffte, entfiel.

---

## 3. Wie das Verfahren heute funktioniert

### 3.1 Ablauf auf einen Blick

```
Foto (Kamera oder Galerie)
  │ foto.ts:recognize            expo-image-manipulator: EXIF-Drehung, lange Seite 1.200 px, JPEG 0,92
  │                              Base64 → Uint8Array
  ▼ runOnRuntimeAsync(…) ── eine von bis zu drei Worklet-Runtimes ──────────────────────────
  │ image.ts:decodeJpeg          jpeg-js → RGB
  │ messwerte.ts:readValues
  │   ├─ display.ts:viaButton    grüne Taste → grober Ausschnitt → Glaskanten → 330×400
  │   └─ display.ts:viaEdges     Kantenvierecke → Entzerrung → Fleckenzahl → bestes 330×400
  │   je Ergebnis: segments.ts:measures → decode(margin 0) → plausible
  │   Kombination, dann Markierung „unsicher“ mit decode(margin 0,2)
  ▼
Reading { values: [sys, dia, puls] | null, uncertain: [bool, bool, bool] }
  → Bestätigungsmaske: unsichere und leere Felder gelb, Speichern erst nach Bestätigung
```

### 3.2 Laden und Verkleinern (`app/src/foto.ts:recognize`)

- Kamera: `launchCameraAsync` mit `quality: 0.9`, Zeitpunkt „jetzt“. Galerie: Mehrfachauswahl mit
  `exif: true`, Zeitpunkt aus EXIF (`exif.ts:exifTime`), sonst „jetzt“ mit Hinweis.
- `ImageManipulator.manipulate(uri).renderAsync()` lädt das Bild; laut `TECHNOLOGIE.md` wendet
  Glide dabei die EXIF-Drehung an. Danach `resize` auf 1.200 px an der langen Seite und
  `saveAsync` als JPEG (`compress: 0.92`, Base64). Die Zwischendatei wird sofort gelöscht.
- Base64 → `Uint8Array`, Übergabe an eine freie Runtime (`belegen`, bis `RUNTIMES` = 3, angelegt
  bei Bedarf mit `createWorkletRuntime`), dort `decodeJpeg` (`jpeg-js`, `formatAsRGBA: false`) und
  `readValues`.
- Der Archivtest bekommt dieselbe Eingabeform über `export_klein.py` (PIL: `exif_transpose`,
  `thumbnail(1200)`, Qualität 92).

### 3.3 Farbkanäle (`app/src/erkennung/image.ts`)

| Funktion | Zweck | Formel |
|----------|-------|--------|
| `hsvRange` | Grünmaske der Taste | HSV wie `cv2.COLOR_RGB2HSV`: H in 0–180 (Grad/2), S = 255·(max−min)/max, V = max |
| `grayscale` | Kanten, Glaskanten | 0,299 R + 0,587 G + 0,114 B, gerundet |
| `channelMax` | Ziffernflecken (`display.ts:glyphCount`) | max(R, G, B) |
| `segments.ts:brightness` | Segmente | max(R, G, B) + 1 gegen Division durch 0 |

Der hellste Kanal ist die zentrale Lehre aus Messlauf 2: Geistersegmente sind farbig und werden
darin hell, aktive Segmente sind schwarz und bleiben dunkel.

### 3.4 Weg 1: grüne Taste (`display.ts:findButton`, `buttonCandidate`)

- Maske: `hsvRange`, dann morphologisches Schließen 15 × 15 (`image.ts:close`). Flächen über
  `components` (8er-Nachbarschaft), je Fläche konvexe Hülle (`hull`, Andrew) und kleinstes
  umschließendes Rechteck (`minAreaRect`).
- Mindestfläche: 0,2 % der Bildfläche; gewählt wird die größte Fläche, die die Formprüfung besteht.
- **Drei Stufen**, die erste mit Treffer gewinnt:

  | Stufe | HSV unten | HSV oben | Formprüfung |
  |-------|-----------|----------|-------------|
  | 1 strenges Grün | (40, 80, 60) | (90, 255, 255) | Seitenverhältnis 1,2–2,4, Füllung > 0 |
  | 2 blasses Grün (schwaches Licht) | (35, 30, 30) | (95, 255, 255) | Seitenverhältnis 1,2–2,4, Füllung > 0,65 |
  | 3 angeschnittene Taste | (40, 80, 60) | (90, 255, 255) | keine |

  Stufe 1 mit Formprüfung zuerst, weil andere grüne Flächen (Ampelskala, Hintergrund) größer sein
  können.
- Ergebnis: Mittelpunkt, Breite, Höhe (lange Kante) und Winkel der langen Kante.

### 3.5 Weg 1: Ausschnitt und Glaskanten (`display.ts:cropRegion`, `edgeLine`, `viaButton`)

- **Maße in Tastenhöhen** (`UNIT = 150` px je Tastenhöhe im Ausschnitt). Der Ausschnitt wird um
  den Tastenmittelpunkt gedreht und skaliert: x von −2,6 bis −0,1 Tastenhöhen ab linker
  Tastenkante, y von −0,9 bis 2,0 ab Oberkante (`REGION`), also 375 × 435 px.
- **Glaskanten** (`GLASS`, in Tastenhöhen im Ausschnitt): links 0,41, rechts 2,24, oben 0,31,
  unten 2,56; gesucht in einem Band von ±0,3 (`BAND`).
- Je Kante neun Streifen quer zur Kante, verteilt über 20–80 % der Länge; je Streifen
  Mittelwert über 20 Zeilen bzw. Spalten. Gesucht wird die stärkste Hell-dunkel-Flanke (links,
  oben) bzw. Dunkel-hell-Flanke (rechts, unten).
- Ausreißer: nur Punkte innerhalb 0,05 × `UNIT` (7,5 px) vom Median; dann Geradenausgleich
  (kleinste Quadrate). Die vier Geraden schneiden sich in den Ecken, `warpQuad` entzerrt auf
  330 × 400 (`OUT_W`, `OUT_H`).

### 3.6 Weg 2: Display über seine Ränder (`display.ts:candidates`, `glyphCount`, `viaEdges`)

- Grauwert, Gauß 5 × 5 (`gaussianBlur`, σ aus OpenCV-Formel, Rand `REFLECT_101`).
- Canny mit 3 × 3-Sobel, L1-Gradient, drei Schwellenpaare (20/60, 40/120, 80/200), dann
  3 × 3-Dilatation.
- Konturersatz für `cv2.findContours`: Flächen der Kantenmaske (8er) **und** ihre Löcher
  (invertierte Maske, 4er). Je Fläche ab 2 % Bildfläche (Rahmen): Hülle → Douglas-Peucker mit
  ε = 2 % des Umfangs (`approxPoly`). Nur Vierecke mit 2–70 % der Bildfläche und
  Breite/Höhe 0,55–1,2. Fast gleiche Kandidaten (alle Ecken < 4 px entfernt) werden nur einmal
  geprüft.
- Bewertung je Kandidat: entzerren auf 330 × 400, hellster Kanal, adaptive Mittelwertschwelle
  (Block 41, c = 12, dunkler als Umgebung), Schließen 5 × 7. Ziffernartig ist ein Fleck mit
  Höhe 12–40 % der Displayhöhe, Breite/Höhe 0,1–0,9 und Füllung > 15 %.
- Gewählt wird der Kandidat mit den meisten Flecken; mindestens 3, sonst kein Display.

### 3.7 Zeilen und Ziffernzellen (`segments.ts:SYS`, `DIA`, `PUL`, `segmentLines`)

Festes Raster des Medisana im 330 × 400-Bild, abgelesen am Mittelwertbild der Stichproben.
Je Zelle: linke und rechte Kante oben, y oben / Mitte / unten, Schrägung über die volle Höhe.

| Zeile | Stellen | y oben / Mitte / unten | Schrägung | Besonderheit |
|-------|---------|------------------------|-----------|--------------|
| SYS | 3 | 57 / 107 / 161 | −12 px | Hunderter nur Segmente b, c |
| DIA | 3 | 192 / 245 / 299 | −12 px | Hunderter nur Segmente b, c |
| PUL | 2 | 330 / 357 / 389 | −8 px | keine Hunderterstelle |

`segmentLines` legt je Segment eine Linie (a, g, d waagrecht; b, c, f, e schräg) und die
Messrichtung quer dazu fest.

### 3.8 Segmentmessung (`segments.ts:measure`, `lineMean`)

- Je Segment 9 Abtastpunkte auf der Linie, t = 0,25 … 0,75 (Segmentenden bleiben außen vor).
- Die Linie wird quer um −5 … +5 px verschoben; die dunkelste Lage gilt (`shift = 5`): fängt
  kleine Fehler der Entzerrung ab.
- Umgebung: Mittelwert derselben Linie im Abstand `gap = round(0,13 × (yb − yt))` beidseits quer;
  der hellere der beiden Werte gilt als Hintergrund. Das ergibt 14 px bei SYS und DIA, 8 px bei PUL.
- **Messwert je Segment:** `max(0, 1 − Segment / Hintergrund)`, also der relative Kontrast.
  Robust gegen Schatten, weil Segment und Umgebung gemeinsam abdunkeln.

### 3.9 Schwelle, Dekodierung, Mehrdeutigkeit (`segments.ts:decode`)

- **Schwelle je Ziffer:** `thr = max(FLOOR, RATIO[Zeile] × stärkstes Segment der Ziffer)` mit
  `FLOOR = 0,12` und `RATIO = [0,4, 0,4, 0,5]` für SYS, DIA, PUL. Die höhere Pulsschwelle hält
  Geistersegmente der kleinen Pulsziffern bei Dunkelheit draußen.
- Segment an, wenn Messwert > `thr`. Muster → Ziffer über `DIGITS`:

  | Muster | Ziffer | | Muster | Ziffer |
  |--------|--------|-|--------|--------|
  | abcdef | 0 | | acdefg | 6 |
  | bc | 1 | | abc, abcf | 7 |
  | abdeg | 2 | | abcdefg | 8 |
  | abcdg | 3 | | abcdfg, abcfg | 9 |
  | bcfg | 4 | | | |
  | acdfg | 5 | | | |

  Die Varianten „7 mit f“ und „9 ohne d“ bildet das Display je nach Gerät unterschiedlich ab.
- **Leere Stelle** ist nur erlaubt, solange noch keine Ziffer ungleich 0 gelesen wurde (führende
  Stelle). Unbekanntes Muster → Feld `null`. Ergebnis 0 → `null`.
- **Mehrdeutigkeit** (nur bei `margin > 0`): Das Segment mit dem kleinsten Abstand
  |Messwert − thr| wird gesucht. Ist der Abstand < `margin × thr` und ergäbe das umgeschaltete
  Muster ebenfalls eine gültige Ziffer (oder eine erlaubte Leerstelle), wird das Feld `null`.

### 3.10 Plausibilität, Kombination, Zuordnung, Rückweisung

- **Zuordnung zu Sys/Dia/Puls** ergibt sich allein aus der Lage im Raster: oben SYS, Mitte DIA,
  unten PUL. Datum und Uhrzeit oberhalb werden nicht gelesen.
- **Plausibilität** (`segments.ts:plausible`), hart, für das ganze Tripel: alle drei Felder
  gelesen, SYS 70–250, DIA 40–150, Puls 40–180, SYS − DIA ≥ 15.
- **Kombination** (`messwerte.ts:readValues`): Beide Ketten werden mit `margin = 0` dekodiert und
  auf Plausibilität geprüft. Liefert nur eine ein Tripel, gilt es. Liefern beide eines, müssen alle
  drei Felder gleich sein, sonst Rückweisung.
- **Markierung „unsicher“:** Beide Ketten werden zusätzlich mit `MARGIN = 0,2` dekodiert (ohne
  Plausibilitätsprüfung). Ein Feld ist sicher, wenn mindestens eine Kette dort denselben Wert
  liefert, sonst unsicher.
- **Rückweisung:** kein plausibles Tripel oder Widerspruch → alle drei Felder `null`. Eine
  Ausnahme in der Runtime fängt `App.tsx` ab und liefert ebenfalls drei leere Felder.
- **In der App:** unsichere und leere Felder gelb hinterlegt; gespeichert wird erst nach
  Bestätigung durch den Nutzer.

### 3.11 Wo es läuft und wie lange

- **Worklet-Runtimes** `erkennung0`–`erkennung2` von `react-native-worklets` 0.10.1 im Bundle Mode.
  Einrichtung: `app/babel.config.js` (`bundleMode: true`, `strictGlobal: true`,
  `importForwarding.relativePaths: ['src/foto.ts']`), `app/metro.config.js`
  (`getBundleModeMetroConfig`), Metro-Patch `app/patches/metro+0.84.5.patch` über `patch-package`.
- **Fallstricke** (`.claude/rules/erkennung-worklet-runtime.md`): `src/erkennung/` importiert
  nichts aus `react-native` oder Expo (die Runtime lädt den Code ein zweites Mal); der Worklet
  steht in `src/foto.ts`; Verkleinern nacheinander, Lesen höchstens `RUNTIMES` zugleich; Patch nach jedem
  Expo-Update prüfen.
- **Laufzeit:**

  | Umgebung | Zeit je Foto | Quelle |
  |----------|--------------|--------|
  | Node, ein Foto allein | etwa 0,3 s | `TECHNOLOGIE.md`, `profil.ts` |
  | Node, Archivtest (12 Prozesse parallel laut `Makefile`) | Median 0,7 s, max. 1,4 s | Transkript ef0c017b |
  | Hermes am Mac, nur Lesen (`make hermes`) | 2,7 s | `TECHNOLOGIE.md` |
  | Galaxy S22, nur Lesen, vor dem Umbau für Hermes | 8,0 s, dazu 1,0 s Verkleinern und Dekodieren | `TECHNOLOGIE.md` |

### 3.12 Qualitätssicherung

| Prüfung | Inhalt | Daten |
|---------|--------|-------|
| `make test` → `app/tests/image.test.ts` | JPEG-Rundlauf: Maße, RGB, Farben; Hülle und kleinstes Rechteck eines gedrehten Rechtecks; Douglas-Peucker ergibt 4 Ecken; Schließen; HSV wie OpenCV; Perspektive exakt, Entzerrung trifft das Viereck | künstlich |
| `make test` → `app/tests/segments.test.ts` | gezeichnetes Display mit hellen Geistersegmenten wird richtig gelesen; Geistersegment knapp an der Schwelle macht das Pulsfeld bei `margin 0,2` unsicher; Plausibilität inkl. SYS − DIA < 15 | künstlich |
| `make test` → `app/tests/messwerte.test.ts` | künstliche Szene: beide Wege lesen dasselbe; Ränder allein, auch gedreht; Widerspruch → keiner; ohne Gerät nichts | künstlich |
| `make test` → `app/tests-ui/App.test.tsx` | Oberfläche, `recognize()` als Attrappe | künstlich |
| `make test` → `app/tests-ui/foto.test.ts` | `recognize()`: höchstens drei zugleich, Verkleinern nacheinander, Runtime frei nach Fehler; Runtime und Manipulator als Attrappe | künstlich |
| `make test-archiv` | 1.510 Fotos, Grenzwerte ≥ 87,0 % gelesen, ≤ 4 unmarkiert falsch; Vergleich mit Python, wenn `referenz.csv` vorliegt | lokal, `daten/` |

Die künstlichen Displays halten Geistersegmente unter der Untergrenze von 12 % Kontrast; sonst
liest eine leere Hunderterstelle als 1. Auf echten Fotos leistet das der hellste Farbkanal.

---

## 4. Grenzen und offene Punkte

### Bekannte Fehlerfälle

- **Kabel und Fingerschatten über einer Ziffer:** schalten ein Segment scheinbar ein (4→9, 3→8,
  4→1). SYS − DIA ≥ 15 fängt einen Teil ab. Rest bleibt; vom Stand des Archivtests sind 4 von 8
  falschen Werten in der Handerfassung nicht markiert.
- **Geistersegmente bei Dunkelheit,** vor allem in der Pulszeile (6→8, 5→6, 0→8); Pulsschwelle 0,5
  mildert, beseitigt nicht.
- **Rückweisungen:** 12,3 % des Archivs bleiben ungelesen; der Nutzer tippt sie in der
  Bestätigungsmaske ab.
- **Werte außerhalb des Rasters (aus dem Code abgeleitet, nicht am Archiv gemessen):**
  - SYS ab 200: die Hunderterstelle hat nur die Segmente b und c; eine 2 ergibt ein unbekanntes
    Muster, das Feld wird abgewiesen. Die Plausibilitätsgrenze 250 ist damit nicht erreichbar.
  - Puls ab 100: die Pulszeile hat nur zwei Zellen (`cells.py` vermerkt das ausdrücklich). Ob
    die Hunderterstelle dann außerhalb liegt und still zwei Ziffern als Puls gelesen werden, ist
    nicht geprüft. Die Plausibilitätsgrenze 180 ist nicht erreichbar.

### Geräte

| Gerät | Fotos im Archiv | Stand |
|-------|-----------------|-------|
| Medisana mit grüner Taste | alle übrigen | gelesen |
| Beurer (mit Bluetooth) | 5 | nicht unterstützt, zurückgestellt |
| älteres Medisana | 2–3 | nicht unterstützt, zurückgestellt |

Weg 2 (Ränder) braucht keine Taste, liest aber mit dem festen Medisana-Raster; für andere Geräte
fehlt ein Layout. `ANFORDERUNGEN.md` verlangt dagegen alle drei Geräte.

### Offen, nicht gemessen

- **Skalierung im Handy gegen PIL:** Der Archivtest verkleinert mit PIL, die App mit
  `expo-image-manipulator`. Ob beide gleich genug sind, ist nicht geprüft.
- **Bundle Mode ist experimentell;** der Metro-Patch gilt je Metro-Version.

### Was als Nächstes läge

- **Archivtest umziehen:** `make test-archiv` hängt als Einziges noch an `ocr-prototyp/`:
  `export_klein.py` (Eingabe), `auswertung_ts.py` (Grenzwerte, Prüfung) und das Docker-Image des
  Dienstes `ocr`. Ein Ort wie `app/tools/` passte besser zum Inhalt. Der Vergleich mit Python
  läuft gegen die vorhandene `daten/messlauf/referenz.csv`. Neu erzeugen lässt sie sich nicht;
  `referenz.py` und `measures.pkl` lagen nie im Repo.
- **Messpunkte einer Messung gegeneinander prüfen:** Ein still falscher Wert weicht meist von den
  anderen Fotos derselben Messung ab (`TECHNOLOGIE.md`). Im Code ist das nicht umgesetzt; in der
  Bestätigung ließe es sich als zusätzliche Markierung nutzen.
- **Layouts für Beurer und älteres Medisana,** falls die Geräte wieder genutzt werden; dann mit
  neuen Fotos zum Prüfen.
- **Raster für dreistellige Pulswerte und SYS ab 200,** falls solche Werte vorkommen.

### Prototyp-Dateien im Überblick

Nicht im Repo, bis auf `auswertung_ts.py`, `export_klein.py` und `Dockerfile` des Archivtests.

| Datei | Rolle |
|-------|-------|
| `display.py` | Laden, Tastensuche, Glaskanten, Entzerrung (Weg 1) |
| `stufe1.py` | Display über Ränder (Weg 2) |
| `stufe2.py` | freie Ziffernsuche (verworfen) |
| `segments.py` | Raster, Segmentmessung, Dekodierung |
| `messlauf.py`, `messlauf2.py` | Messläufe am Archiv, Tabellenabgleich |
| `erfassen.py` | Erfassungsseite der Handerfassung |
| `cells.py`, `train.py` | Ziffernmodell (nur Vergleichswert) |
| `ocr_libs.py`, `ocr_paddle.py`, `ocr.Dockerfile`, `paddle.Dockerfile` | OCR-Vergleich (verworfen) |
| `referenz.py`, `auswertung_ts.py`, `export_klein.py` | Abgleich TypeScript gegen Python, Archivtest |
| `dev_*.py` | Übersichtsbilder und Einzelmessungen (Mittelwertbild, Abweisungen, Margin, Pulsschwelle, Fehlerfälle) |
| `Dockerfile` | Python 3.12 mit Pillow; OpenCV 4.10, NumPy und PyTorch (CPU) auskommentiert |
