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

Die App liest das Medisana mit grüner START/STOP-Taste (aktuell, Großteil der Fotos).

Zurückgestellt, bis die Geräte wieder genutzt werden (ERKENNUNG.md):

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
- **Meldung nach dem Import:** Ist das letzte importierte Foto erledigt, nennt eine Snackbar getrennt,
  wie viele übernommen, schon vorhanden und verworfen wurden. Nach einer Aufnahme kommt keine.

### Datenschutz

- **Texterkennung läuft vollständig lokal auf dem Smartphone,** ohne Online-Dienst.
- **Fotos und Tabellendaten verlassen den Entwicklungsrechner nicht,** werden also nicht in eine
  Cloud gelegt. Auswertungen dazu laufen lokal (Docker).

### Speicherung

- Lokale Datenbank in der App.
- **Datensicherung:** die SQLite-Datei sichern und wieder einspielen
  ([DATENSICHERUNG.md](DATENSICHERUNG.md)).
- **Export:** CSV, Excel (XLSX: erst Tagesmittel je Tageshälfte, dann alle Einzelmessungen) oder
  Bericht als PDF (je Monat eine Seite mit Diagramm und Tagesmitteln); jedes Format in einen Ordner
  oder über das Teilen-Blatt, etwa nach Google Drive.

### Später

- **Evtl. automatischer Cloud-Sync;** heute geht die Tabelle von Hand über das Teilen-Blatt.

## Offene Punkte

Siehe [TECHNOLOGIE.md](TECHNOLOGIE.md).
