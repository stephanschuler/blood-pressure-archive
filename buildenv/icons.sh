#!/bin/sh
# Läuft im Container. Erzeugt die PNGs in app/assets/ aus den Quellen in app/assets/svg/.
set -e
cd /work/app/assets
png() { rsvg-convert -w "$2" -h "$3" "svg/$1.svg" -o "$4"; }
png icon                     1024 1024 icon.png
png icon                       48   48 favicon.png
png android-icon-foreground   512  512 android-icon-foreground.png
png android-icon-foreground  1024 1024 splash-icon.png
png android-icon-monochrome   432  432 android-icon-monochrome.png
# Ladeanimation: 3-fach für 128 dp
png loader-herz               384  384 loader-herz.png
png loader-puls               576  384 loader-puls.png
png loader-viewfinder         384  384 loader-viewfinder.png
