# Blutdruck-App – Anforderungen

## Ausgangslage

- Blutdruck wird mehrfach täglich mit einem Messgerät gemessen.
- Das Messgerät hat keine Schnittstelle für den Datenexport.
- Bisher: Display-Inhalt wird von Hand in eine Excel-Tabelle übertragen, das Display zusätzlich
  fotografiert und die Fotos werden aufbewahrt.

## Plattform

- **Name:** Blood Pressure Archive, Paketkennung `de.g4n.bloodpressurearchive`.

- Smartphone-App für **Android und iOS** aus **einer gemeinsamen Codebasis**.
- **Zuerst nur Android.** Die Wahl des Frameworks darf iOS später nicht verbauen.
- Entwicklungsrechner: MacBook. Möglichst wenig zusätzliche Software lokal installieren,
  möglichst viel des Build-Prozesses über **Docker** abbilden.
- **Build lokal auf dem MacBook,** kein Cloud-Build-Dienst.

## Messgeräte

Die App liest alle Geräte, die im Fotoarchiv vorkommen:

- Medisana mit grüner START/STOP-Taste (aktuell, Großteil der Fotos)
- Beurer mit Bluetooth
- älteres Medisana

## Funktionen

### Messung erfassen

Eine **Messung** besteht aus **2 bis 4 Messpunkten**: je 1–2 vom linken und vom rechten Arm,
kurz hintereinander. Bisher wird in die Tabelle ungefähr der Durchschnitt einer Messung
eingetragen. Der Arm wird nicht gespeichert; er erklärt nur, warum es mehrere Messpunkte je
Zeitpunkt gibt. Messpunkte mit weniger als 20 Minuten Abstand zum vorigen gehören zu einer
Messung. Jeder Messpunkt besteht aus:

| Feld          | Herkunft                         |
|---------------|----------------------------------|
| Systolisch    | aus dem Foto erkannt             |
| Diastolisch   | aus dem Foto erkannt             |
| Puls          | aus dem Foto erkannt             |
| Messzeitpunkt | „jetzt" bzw. Foto-Metadaten      |

- **Texterkennung:** Die App erkennt den Display-Inhalt auf dem Foto und liest die drei Werte
  systolisch, diastolisch und Puls aus.
- **Foto aus der App:** Die App nimmt das Foto direkt auf. Messzeitpunkt ist der Aufnahmezeitpunkt
  („jetzt"). Das Foto muss nicht dauerhaft auf dem Gerät bleiben; nach dem Auslesen darf es
  gelöscht werden.
- **Vorhandene Fotos einlesen:** Bereits existierende Fotos lassen sich importieren. Der
  Messzeitpunkt stammt aus den Metadaten des Fotos (EXIF).
- **Doppelter Import:** Gibt es einen Messpunkt mit denselben drei Werten zur selben Sekunde schon,
  entsteht kein zweiter. Liest die Erkennung genau diese Werte, entfällt die Bestätigung.

### Datenschutz

- **Texterkennung läuft vollständig lokal auf dem Smartphone,** ohne Online-Dienst.
- **Fotos und Tabellendaten verlassen den Entwicklungsrechner nicht,** werden also nicht in eine
  Cloud gelegt. Auswertungen dazu laufen lokal (Docker).

### Speicherung

- Vorerst: lokale Datenbank in der App.

### Später

- **Export** in mehreren Formaten: SQLite-Datei, CSV-Datei, Excel-Datei.
- **Evtl. Cloud-Sync,** z. B. der Export-Formate nach Google Drive.

## Offene Punkte

Siehe [TECHNOLOGIE.md](TECHNOLOGIE.md).
