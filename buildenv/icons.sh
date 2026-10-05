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
# Knöpfe der Startseite: 3-fach für 32 dp
png add-a-photo                96   96 add-a-photo.png
png add-photo-alternate        96   96 add-photo-alternate.png
# Knöpfe der Prüfansicht: 3-fach für 32 dp
png check                      96   96 check.png
png delete                     96   96 delete.png
png close                      96   96 close.png
# Seitenleiste: 3-fach für 24 dp
png menu                       72   72 menu.png
png download                   72   72 download.png
png upload-file                72   72 upload-file.png
png csv                        72   72 csv.png
png table-view                 72   72 table-view.png
png add-to-drive               72   72 add-to-drive.png
