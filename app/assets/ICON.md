# App-Icon

Motiv: **Kamerasucher mit Herz.** Das Icon zeigt, was die App tut: das Messgerät fotografieren,
den Blutdruck ablesen.

## Merkmale

| Merkmal | Festlegung |
|---|---|
| Hintergrund | dunkles Schiefergrau `#263238`, vollflächig |
| Sucherecken | vier weiße L-Winkel mit runden Enden, wie im Kamerasucher |
| Aufnahmepunkt | roter Punkt oben links im Sucher, wie ein Blitz- oder Aufnahmelicht |
| Kantenmarken | vier kurze weiße Striche mittig an allen Seiten, zusammen ein Fadenkreuz |
| Fadenkreuzlinien | oben und unten je eine feine, gestrichelte, halbtransparente Linie von der Marke zum Herz |
| Herz | rot `#E53946`, mittig, einfarbig ohne Umriss |
| Pulslinie | **Schnitt durchs Herz**, keine zusätzliche Linie: EKG-Kurve (P-Welle, QRS-Zacke, T-Welle) in Hintergrundfarbe |
| Lage der Pulslinie | knapp unter der Herzmitte; die Spitze der QRS-Zacke **berührt die Kerbe oben am Herz nicht** |

## Maße

Raster 512 × 512, Ursprung oben links.

| Element | Werte |
|---|---|
| Sucherecken | Rahmen 112–400, Schenkel 64, Strich 18 |
| Kantenmarken | jeweils 96–116 bzw. 396–416 auf der Mittelachse, Strich 8 |
| Fadenkreuzlinien | x = 256, y 124–160 und 352–388, Strich 3, Deckkraft 0,5, Strichmuster 4/6 |
| Aufnahmepunkt | Mitte (152, 152), Radius 10 |
| Herz | Breite 190, Mitte (256, 256) |
| Pulslinie | Grundlinie y = 274, Ausschlag 62, Strich 12; Spitze bei y ≈ 212, Herzkerbe bei y ≈ 197 |

## Ableitungen

- **Android, adaptiv:** Vordergrund ist das Motiv ohne Hintergrund, auf 72 % verkleinert, damit
  die Sucherecken auch in der runden Maske ganz sichtbar bleiben. Hintergrund ist die Farbe aus
  `app.json`. Der Pulsschnitt ist durchsichtig.
- **Android, einfarbig (Themen-Icon):** dasselbe in Weiß, Schnitt durchsichtig.
- **Startbildschirm:** Vordergrund des adaptiven Icons auf `#263238`, über `expo-splash-screen`.
- **Ladeanimation** während der Erkennung: das Icon als Kachel mit 128 dp. Die Pulslinie läuft
  im Schnitt von rechts nach links, ein Schlag je Sekunde, zwischen den Schlägen flach. Der
  Aufnahmepunkt blinkt im Takt. Sie läuft über den nativen Treiber.

## Dateien

Quellen in `svg/`. `make icons` erzeugt daraus die PNGs in diesem Ordner; welche Datei in
welcher Größe, steht in `buildenv/icons.sh`.

Knopf-Symbole der Startseite (`add-a-photo`, `add-photo-alternate`): Material Symbols Outlined,
gefüllt, von Google, Apache 2.0, unverändert. Die App zeigt sie weiß auf einem Kreis im
Herz-Rot `#E53946`.
