#!/bin/sh
# Stichprobe aus <ordner> als Hermes-Bytecode übersetzen wie im Release-Build, unter Hermes und
# zum Vergleich unter Node laufen lassen. Aufruf: tools/hermes-lauf.sh <ordner> <arbeitsordner> <anzahl>
set -e
src=$1 dir=$2 n=$3
mkdir -p "$dir"
node -e '
const fs = require("fs");
const [src, dir, n] = process.argv.slice(1);
const names = fs.readdirSync(src).filter((x) => /\.jpg$/i.test(x)).sort();
const k = Math.max(1, Math.floor(names.length / n));
const pick = names.filter((_, i) => i % k === 0).slice(0, n);
fs.writeFileSync(dir + "/fotos.js", "globalThis.FOTOS=" + JSON.stringify(pick.map((x) => fs.readFileSync(src + "/" + x, "base64"))) + ";\n");
' "$src" "$dir" "$n"
npx --yes esbuild tools/hermes-lauf.ts --bundle --format=iife --target=es2020 --log-level=warning --outfile="$dir/lauf.js"
cat "$dir/fotos.js" "$dir/lauf.js" > "$dir/alles.js"
hermesc -O -emit-binary -out "$dir/alles.hbc" "$dir/alles.js"
printf 'Hermes: '; hermes "$dir/alles.hbc"
printf 'Node:   '; node "$dir/alles.js"
