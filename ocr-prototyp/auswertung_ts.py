"""TypeScript-Ergebnisse (app/tools/messlauf.ts) gegen Handerfassung und Python-Referenz. Nur Kennzahlen.

Mit --pruefen: Exit-Code 1, wenn die Qualität unter den Stand vom 5.10.2026 fällt.
"""
import csv, glob, os, sys

MIN_READ = 87.5   # Prozent gelesen
MAX_SILENT = 5    # falsche Werte in der Handerfassung ohne Markierung „unsicher"

KEYS = ("sys", "dia", "puls")
ts = {}
for f in glob.glob("/out/ts/teil*.csv"):
    for r in csv.DictReader(open(f)):
        ts[r["datei"]] = r
ref = {r["datei"]: r for r in csv.DictReader(open("/out/referenz.csv"))} if os.path.exists("/out/referenz.csv") else {}
ex = {}
for f in ("dev-labels.csv", "reject-labels.csv", "handerfassung.csv"):
    for r in csv.DictReader(open("/daten/labels/" + f)):
        if r.get("unlesbar") != "True" and all(r[k] for k in KEYS):
            ex[r["datei"]] = tuple(int(r[k]) for k in KEYS)

val = lambda r: tuple(int(r[k]) for k in KEYS) if r and all(r[k] for k in KEYS) else None
read = {n: val(r) for n, r in ts.items()}
n = len(ts)
rate = 100 * sum(1 for v in read.values() if v) / n
print(f"Fotos {n}, gelesen {sum(1 for v in read.values() if v)} ({rate:.1f} %)")
right = sum(read.get(k) == v for k, v in ex.items())
wrong = [k for k, v in ex.items() if read.get(k) and read[k] != v]
flagged = sum(any(ts[k][f"unsicher_{f}"] == "true" for i, f in enumerate(KEYS) if read[k][i] != ex[k][i]) for k in wrong)
print(f"Handerfassung {len(ex)}: richtig {right}, falsch {len(wrong)} (davon unsicher markiert {flagged})")
if ref:
    both = [k for k in ts if read[k] and val(ref.get(k))]
    print(f"TS und Python lesen beide: {len(both)}, gleich {sum(read[k] == val(ref[k]) for k in both)}; "
          f"nur TS {sum(1 for k in ts if read[k] and not val(ref.get(k)))}, nur Python {sum(1 for k in ts if not read[k] and val(ref.get(k)))}")
marked = sum(1 for r in ts.values() if any(r[f"unsicher_{f}"] == "true" for f in KEYS) and val(r))
ms = sorted(int(r["ms"]) for r in ts.values())
print(f"Gelesen mit mindestens einem unsicheren Feld: {marked}; Zeit je Foto Median {ms[len(ms) // 2]} ms, max {ms[-1]} ms")

if "--pruefen" in sys.argv:
    silent = len(wrong) - flagged
    ok = rate >= MIN_READ and silent <= MAX_SILENT
    print(f"Prüfung: gelesen {rate:.1f} % (mind. {MIN_READ}), still falsch {silent} (höchstens {MAX_SILENT}): {'bestanden' if ok else 'NICHT bestanden'}")
    sys.exit(0 if ok else 1)
