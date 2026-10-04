#!/bin/sh
# Läuft im Container. Baut im Volume /build statt im eingebundenen Projektordner: beim Entpacken der
# Android-Vorlage über die Docker-Dateifreigabe des Macs gehen die Dateirechte verloren.
set -e
mkdir -p /build/app
rsync -a --delete --exclude node_modules --exclude android --exclude dist /work/app/ /build/app/
cd /build/app
npm ci --no-audit --no-fund
npx expo prebuild --platform android --no-install --clean
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
mkdir -p /work/app/dist
cp app/build/outputs/apk/release/app-release.apk /work/app/dist/blutdruck.apk
ls -la /work/app/dist/blutdruck.apk
