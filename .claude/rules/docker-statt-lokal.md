# Werkzeuge in Docker statt lokal installieren

Braucht Build, Test oder ein Werkzeug eine Laufzeit oder ein SDK, das auf dem Mac fehlt,
installier es nicht lokal: leg es in ein Docker-Image und einen Compose-Dienst, aufrufbar über
`make`.

**Grund:** Der Nutzer will möglichst wenig zusätzliche Software auf seinem MacBook.

## Anwendung

- **Ankerbeispiel:** Android SDK und Gradle im `linux/amd64`-Container unter Rosetta, obwohl
  langsamer als nativ.
- **Geht es in Docker nicht, frag** und nenne den Grund. Typisch: iOS-Build (braucht Xcode),
  Android-Emulator (braucht Hardware-Virtualisierung), USB-Zugriff auf Geräte.
- **Natives Image vor emuliertem,** wo das Werkzeug es zulässt; Emulation nur, wo eine
  Komponente nur für x86_64 existiert.
