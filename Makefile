COMPOSE := docker compose
ANDROID := $(COMPOSE) run --rm android
NODE    := $(COMPOSE) run --rm node
OCR     := $(COMPOSE) run --rm ocr
OUT     := daten/messlauf
PARTS   := 12
# Adresse des Macs im WLAN, für Handy-URLs; überschreibbar: make serve-apk LAN_IP=…
LAN_IP  ?= $(shell ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
export LAN_IP

.PHONY: help images install apk serve-apk lan-ip typecheck test test-archiv klein

help: ## Befehle anzeigen
	@awk -F':.*## ' '/^[a-z-]+:.*## / { printf "  make %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

images: ## Docker-Images bauen
	$(COMPOSE) build

install: ## npm-Abhängigkeiten der App installieren
	$(ANDROID) npm ci

apk: ## Release-APK bauen: app/dist/blutdruck.apk
	$(ANDROID) /work/buildenv/build-apk.sh

serve-apk: lan-ip ## APK im WLAN anbieten; zeigt die URL fürs Handy, Ende mit Ctrl+C
	@echo "Auf dem Handy öffnen: http://$(LAN_IP):8000/blutdruck.apk"
	@$(COMPOSE) run --rm -p 8000:8000 -w /work/app/dist node npx --yes http-server -p 8000 -s

lan-ip:
	@test -n "$(LAN_IP)" || { echo "WLAN-Adresse des Macs nicht gefunden; setze LAN_IP=…"; exit 1; }

typecheck: ## TypeScript prüfen
	$(NODE) npx tsc --noEmit

test: typecheck ## Unit-Tests (künstliche Daten, ohne Fotos)
	$(NODE) sh -c 'npx --yes tsx --test tests/*.test.ts'

klein: ## Fotos aus daten/ verkleinert ablegen, Eingabe für test-archiv
	$(OCR) python export_klein.py

test-archiv: klein ## Erkennung am Fotoarchiv messen; schlägt fehl, wenn die Qualität sinkt
	$(NODE) sh -c 'rm -rf /work/$(OUT)/ts && mkdir -p /work/$(OUT)/ts \
	  && for i in $$(seq 0 $$(($(PARTS) - 1))); do \
	       npx --yes tsx tools/messlauf.ts /work/$(OUT)/klein $$i $(PARTS) /work/$(OUT)/ts/teil$$i.csv & done; wait'
	$(OCR) python auswertung_ts.py --pruefen
