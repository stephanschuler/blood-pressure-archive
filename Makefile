COMPOSE := docker compose
ANDROID := $(COMPOSE) run --rm android
NODE    := $(COMPOSE) run --rm node
OCR     := $(COMPOSE) run --rm ocr
HERMES  := $(COMPOSE) run --rm hermes
OUT     := daten/messlauf
PARTS   := 12
# Adresse des Macs im WLAN, für Handy-URLs; überschreibbar: make serve-apk LAN_IP=…
LAN_IP  ?= $(shell ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
export LAN_IP

.PHONY: help images install icons signatur apk serve-apk lan-ip typecheck test test-archiv klein hermes

help: ## Befehle anzeigen
	@awk -F':.*## ' '/^[a-z-]+:.*## / { printf "  make %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

images: ## Docker-Images bauen
	$(COMPOSE) build

install: ## npm-Abhängigkeiten der App installieren
	$(ANDROID) npm ci

icons: ## App-Icons und Ladeanimation aus app/assets/svg/ als PNG erzeugen
	$(COMPOSE) run --rm svg sh /work/buildenv/icons.sh

signatur: ## Release-Schlüssel einmalig anlegen (~/.config/blutdruck); mitsichern: ohne ihn kein Update
	$(ANDROID) sh -c 'test ! -e /signatur/release.keystore || { echo "Schlüssel existiert schon"; exit 1; }; \
	  head -c 24 /dev/urandom | base64 > /signatur/passwort && chmod 600 /signatur/passwort \
	  && keytool -genkeypair -keystore /signatur/release.keystore -storetype PKCS12 -storepass:file /signatur/passwort \
	       -alias release -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Blood Pressure Archive"'

apk: ## Release-APK bauen: app/dist/blutdruck-<version>-<hash>.apk
	$(COMPOSE) run --rm -e GIT_HASH=$$(git rev-parse --short HEAD) android /work/buildenv/build-apk.sh

serve-apk: lan-ip ## APK im WLAN anbieten; zeigt die URL fürs Handy, Ende mit Ctrl+C
	@echo "Auf dem Handy öffnen: http://$(LAN_IP):8000/$$(basename app/dist/blutdruck-*.apk)"
	@$(COMPOSE) run --rm -p 8000:8000 -w /work/app/dist node npx --yes http-server -p 8000 -c-1

lan-ip:
	@test -n "$(LAN_IP)" || { echo "WLAN-Adresse des Macs nicht gefunden; setze LAN_IP=…"; exit 1; }

typecheck: ## TypeScript prüfen
	$(NODE) npx tsc --noEmit

test: typecheck ## Unit- und Oberflächentests (künstliche Daten, ohne Fotos)
	$(NODE) sh -c 'npx --yes tsx --test tests/*.test.ts'
	$(NODE) npx jest

klein: ## Fotos aus daten/ verkleinert ablegen, Eingabe für test-archiv
	$(OCR) python export_klein.py

test-archiv: klein ## Erkennung am Fotoarchiv messen; schlägt fehl, wenn die Qualität sinkt
	$(NODE) sh -c 'rm -rf /work/$(OUT)/ts && mkdir -p /work/$(OUT)/ts \
	  && for i in $$(seq 0 $$(($(PARTS) - 1))); do \
	       npx --yes tsx tools/messlauf.ts /work/$(OUT)/klein $$i $(PARTS) /work/$(OUT)/ts/teil$$i.csv & done; wait'
	$(OCR) python auswertung_ts.py --pruefen

hermes: klein ## Erkennung unter Hermes wie auf dem Handy messen, Stichprobe aus 20 Fotos; Node zum Vergleich
	$(HERMES) tools/hermes-lauf.sh /work/$(OUT)/klein /work/$(OUT)/hermes 20
