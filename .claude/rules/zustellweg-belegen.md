# Erst den Zustellweg belegen, dann Abhilfe bauen

Meldest du „die Änderung ist nicht da" — auf dem Handy, im Browser, auf dem Server —, belege
zuerst, was dort ankommt. Erst dann eine Abhilfe bauen.

**Grund:** Ohne Beleg rät jede Abhilfe an einer Ursache, die vielleicht gar nicht vorliegt, und
jede Runde kostet dich einen Build und einen Test von Hand. Ankerfall: erst Cache-Header, dann
ein `?v=`-Parameter — beides ohne Wirkung. Das Zugriffsprotokoll des Download-Servers zeigte in
einer Minute, dass das Handy die APK nie abgerufen hatte; Chrome installierte sie aus dem Cache.

## Anwendung

Prüfe die Kette Glied für Glied, jedes mit einem Beleg statt einer Annahme:

1. **Artefakt:** Enthält das gebaute Ergebnis die Änderung? Entpacken, Version auslesen.
2. **Zustellung:** Ruft das Ziel genau dieses Artefakt ab? Zugriffsprotokoll, Zeitstempel, Größe.
3. **Ziel:** Läuft dort die neue Version? Versionsangabe, Hash, Build-Zeit.

Fehlt einem Glied die Beobachtbarkeit — Server ohne Log, Build ohne Version —, schaffe sie zuerst.

## Erst committen, dann bauen

Baue die APK erst, wenn die Änderung committet ist. Der Dateiname trägt den Hash von `HEAD`
(`blutdruck-<version>-<hash>.apk`); ungeschriebene Änderungen landen sonst in einer APK mit dem
Namen der vorigen, und das Handy holt sie wieder aus dem Cache.
