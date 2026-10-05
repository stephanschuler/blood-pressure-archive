#!/bin/sh
# Läuft im Container. Baut im Volume /build statt im eingebundenen Projektordner: beim Entpacken der
# Android-Vorlage über die Docker-Dateifreigabe des Macs gehen die Dateirechte verloren.
set -e
# vor dem Build: ohne Schlüssel wären 17 Minuten umsonst
test -f /signatur/release.keystore || { echo "Kein Release-Schlüssel in /signatur; einmalig: make signatur"; exit 1; }
mkdir -p /build/app
rsync -a --delete --exclude node_modules --exclude android --exclude dist /work/app/ /build/app/
cd /build/app
# wie Android sie meldet (app.config.ts); die Seitenleiste zeigt sie
export EXPO_PUBLIC_VERSION=$(node -p "require('./app.json').expo.version")-${GIT_HASH:-dev}
npm ci --no-audit --no-fund
npx expo prebuild --platform android --no-install --clean
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
mkdir -p /work/app/dist
# Version und Hash im Dateinamen: jeder Build hat eine neue Download-Adresse, kein Browser-Cache greift.
APK=/work/app/dist/blutdruck-$EXPO_PUBLIC_VERSION.apk
rm -f /work/app/dist/*.apk
# Gradle signiert mit dem debug.keystore der Vorlage: öffentlich, und ein anderer Schlüssel erzwingt
# Deinstallieren samt Datenbank. Daher neu mit dem eigenen.
"$(ls -d $ANDROID_HOME/build-tools/* | tail -1)/apksigner" sign --ks /signatur/release.keystore \
  --ks-pass file:/signatur/passwort --v4-signing-enabled false --out "$APK" app/build/outputs/apk/release/app-release.apk
ls -la "$APK"
