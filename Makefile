COMPOSE := docker compose
ANDROID := $(COMPOSE) run --rm android
NODE    := $(COMPOSE) run --rm node

.PHONY: help images install apk serve-apk typecheck test

help: ## Befehle anzeigen
	@awk -F':.*## ' '/^[a-z-]+:.*## / { printf "  make %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

images: ## Docker-Images bauen
	$(COMPOSE) build

install: ## npm-Abhängigkeiten der App installieren
	$(ANDROID) npm ci

apk: ## Release-APK bauen: app/dist/blutdruck.apk
	$(ANDROID) /work/buildenv/build-apk.sh

serve-apk: ## APK im WLAN anbieten: http://<IP des Macs>:8000/blutdruck.apk
	$(COMPOSE) run --rm -p 8000:8000 -w /work/app/dist node npx --yes http-server -p 8000

typecheck: ## TypeScript prüfen
	$(NODE) npx tsc --noEmit

test: typecheck ## Unit-Tests (künstliche Daten, ohne Fotos)
	$(NODE) sh -c 'npx --yes tsx --test tests/*.test.ts'
