# Estrae da comune/dati/PeriodicTableJSON.json gli elementi usati dal modulo "molecole"
# e calcola la valenza dagli elettroni dell'ultimo livello (dato "shells" del dataset).
# Uso:  python estrai-elementi.py      (da questa cartella)
import json

SIMBOLI = ["H", "C", "N", "O"]          # aggiungere qui nuovi elementi
NOMI_IT = {"H": "Idrogeno", "C": "Carbonio", "N": "Azoto", "O": "Ossigeno"}  # traduzione dei nomi

with open("../../comune/dati/PeriodicTableJSON.json", encoding="utf-8") as f:
    tutti = {e["symbol"]: e for e in json.load(f)["elements"]}

def valenza(esterni):
    # Regola dell'ottetto per i non metalli: con n elettroni esterni
    # servono n legami (n <= 4) oppure 8 - n legami (n > 4). L'idrogeno e' un caso: 1.
    return esterni if esterni <= 4 else 8 - esterni

out = {}
for s in SIMBOLI:
    e = tutti[s]
    esterni = e["shells"][-1]
    out[s] = {
        "simbolo": s,
        "nome": NOMI_IT[s],
        "numero_atomico": e["number"],
        "massa": e["atomic_mass"],
        "elettroni_esterni": esterni,
        "valenza": valenza(esterni),
        "raggio_covalente_pm": e["atomic_radii"]["covalent_single"][0],
        "colore_cpk": "#" + e["cpk-hex"],
    }

with open("elementi.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print("Scritto elementi.json:", ", ".join(out))
