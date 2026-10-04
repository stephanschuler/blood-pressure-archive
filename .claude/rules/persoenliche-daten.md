# Persönliche Daten erst nach Rückfrage in den Kontext

Enthält eine Datei des Nutzers persönliche Daten — Gesundheit, Finanzen, Ausweise, private
Kommunikation, Fotos von Personen oder Messwerten —, frag, bevor ihr Inhalt in den Kontext
gelangt: kein Read, kein `cat`, keine Skriptausgabe mit Einzelwerten, kein Bild.

**Grund:** Alles im Kontext geht an die Anthropic-API. Ob es den Rechner verlassen darf,
entscheidet der Nutzer, nicht der Arbeitsfluss. Ankerfall: eine Blutdrucktabelle, deren Kopfzeilen
und neun Datenzeilen ausgegeben waren, bevor geklärt war, ob die Werte das dürfen.

## Anwendung

- **Struktur ohne Inhalt erkunden:** Zeilen und Spalten zählen, Spaltennamen, Dateitypen,
  Dateigrößen. Dateinamen nur, wenn sie selbst nichts preisgeben.
- **Skripte geben nur Kennzahlen aus.** Einzelergebnisse schreiben sie in Dateien, die Claude
  nicht liest.
- **Eine Freigabe gilt für ihren Umfang,** etwa „20 Fotos", nicht pauschal. Ist sie verbraucht,
  neu fragen.
- **Ist Inhalt schon im Kontext gelandet, melde es** — was, wie viel — statt es zu übergehen.
