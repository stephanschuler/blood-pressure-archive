# Expo-APIs in den Docs der installierten Version nachlesen

Bevor du Code an einer Expo- oder React-Native-API schreibst, lies die Docs der Expo-Version aus
`app/package.json`: `https://docs.expo.dev/versions/v<major>.0.0/`. Einstieg samt Korrekturen
verbreiteter Irrtümer: `https://docs.expo.dev/llms.txt`. Nicht aus dem Gedächtnis.

**Grund:** Expo bricht mit jeder SDK-Version APIs; Gelerntes ist oft umbenannt, verschoben oder
entfernt.

- **Pakete mit `npx expo install <paket>`,** nicht `npm install`: es wählt die zum SDK passende
  Version. Aufruf im Container: `docker compose run --rm android npx expo install <paket>`
  [[docker-statt-lokal]].
