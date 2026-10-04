# Während der Erkennung bewegt sich nur Natives

Die Erkennung läuft synchron im JS-Thread und blockiert ihn für Hunderte Millisekunden je Foto.
Was sich währenddessen auf dem Bildschirm bewegen soll, läuft ohne JS: `Animated` mit
`useNativeDriver: true`, nur `transform` und `opacity`.

**Grund:** Eine JS-getriebene Animation, ein State-Update oder ein Timer steht genau dann still,
wenn er laufen soll. Ankerfall: `Loader` in `app/App.tsx` — Pulslinie und Blinkpunkt hängen an
einem einzigen `Animated.timing`, das `Animated.loop` nativ wiederholt.

- **`Animated.loop` nur um eine einzelne Animation.** Um `sequence` oder `parallel` startet die
  Schleife jede Runde aus dem JS-Thread neu (`AnimatedImplementation.js`, `loopImpl`). Mehrere
  Bewegungen: ein Wert, mehrere `interpolate`.
- **Kein Fortschritt über React-State** während `recognize()`; er erscheint erst danach.
- **Prüfen auf dem Handy:** Die Oberflächentests sehen nicht, ob sich etwas während der
  Erkennung bewegt.
