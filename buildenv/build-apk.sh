#!/bin/sh
# Läuft im Container. Baut im Volume /build statt im eingebundenen Projektordner: beim Entpacken der
# Android-Vorlage über die Docker-Dateifreigabe des Macs gehen die Dateirechte verloren.
set -e
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
cp app/build/outputs/apk/release/app-release.apk "$APK"
ls -la "$APK"
