"""Controlla che ogni molecola obiettivo abbia sul tavolo gli atomi giusti (piu' qualche esca) e legami coerenti con le valenze.
Uso: python strumenti/verifica-molecole.py
"""
import json, re, sys
from collections import Counter
from pathlib import Path
r = Path(__file__).resolve().parent.parent / "scienze-vr" / "dati"
mol = json.load(open(r / "molecole.json", encoding="utf-8"))
VAL = {"H": 1, "C": 4, "N": 3, "O": 2}   # valenze (ottetto), come in molecole.js
ok = True
for f, d in mol.items():
    if f.startswith("_"): continue
    serve = Counter()
    for sim, n in re.findall(r"([A-Z][a-z]?)(\d*)", f): serve[sim] += int(n or 1)
    ce = Counter(d["atomi_iniziali"])
    mancano = {k: v - ce[k] for k, v in serve.items() if ce[k] < v}
    esche = sum((ce - serve).values())
    # somma delle valenze: deve essere pari e permettere una molecola connessa
    tot = sum(VAL[k] * v for k, v in serve.items())
    problemi = []
    if mancano: problemi.append(f"mancano atomi {mancano}")
    if esche < 1: problemi.append("nessuna esca")
    if tot % 2: problemi.append("valenze dispari")
    print(f"{f:5} servono {dict(serve)} sul tavolo {dict(ce)} esche {esche} valenze {tot}", "OK" if not problemi else "ERRORE: " + "; ".join(problemi))
    ok &= not problemi
sys.exit(0 if ok else 1)
