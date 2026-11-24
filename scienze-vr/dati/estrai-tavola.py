# Estrae da comune/dati/PeriodicTableJSON.json i dati della tavola periodica usati dal modulo 2.
# I nomi italiani sono una traduzione (non vengono dal dataset): da ricontrollare.
# Uso:  python estrai-tavola.py      (da questa cartella)
import json

NOMI_IT = """Idrogeno Elio Litio Berillio Boro Carbonio Azoto Ossigeno Fluoro Neon Sodio Magnesio Alluminio Silicio
Fosforo Zolfo Cloro Argon Potassio Calcio Scandio Titanio Vanadio Cromo Manganese Ferro Cobalto Nichel Rame Zinco
Gallio Germanio Arsenico Selenio Bromo Kripton Rubidio Stronzio Ittrio Zirconio Niobio Molibdeno Tecnezio Rutenio
Rodio Palladio Argento Cadmio Indio Stagno Antimonio Tellurio Iodio Xeno Cesio Bario Lantanio Cerio Praseodimio
Neodimio Promezio Samario Europio Gadolinio Terbio Disprosio Olmio Erbio Tulio Itterbio Lutezio Afnio Tantalio
Tungsteno Renio Osmio Iridio Platino Oro Mercurio Tallio Piombo Bismuto Polonio Astato Radon Francio Radio Attinio
Torio Protoattinio Uranio Nettunio Plutonio Americio Curio Berchelio Californio Einsteinio Fermio Mendelevio Nobelio
Laurenzio Rutherfordio Dubnio Seaborgio Bohrio Hassio Meitnerio Darmstadtio Roentgenio Copernicio Nihonio Flerovio
Moscovio Livermorio Tennesso Oganesson""".split()
assert len(NOMI_IT) == 118

# Traduzione delle categorie del dataset (le chiavi sono quelle originali in inglese)
CATEGORIE_IT = {
    "alkali metal": "metallo alcalino",
    "alkaline earth metal": "metallo alcalino-terroso",
    "transition metal": "metallo di transizione",
    "post-transition metal": "metallo post-transizione",
    "metalloid": "semimetallo",
    "diatomic nonmetal": "non metallo",
    "polyatomic nonmetal": "non metallo",
    "noble gas": "gas nobile",
    "lanthanide": "lantanide",
    "actinide": "attinide",
}

def categoria_it(c):
    if c in CATEGORIE_IT: return CATEGORIE_IT[c]
    # Elementi superpesanti: nel dataset la categoria e' una previsione ("unknown, probably ...")
    for en, it in CATEGORIE_IT.items():
        if en in c: return it + " (previsto)"
    return "sconosciuta"

FASE_IT = {"Solid": "solido", "Liquid": "liquido", "Gas": "gas"}

with open("../../comune/dati/PeriodicTableJSON.json", encoding="utf-8") as f:
    elementi = [e for e in json.load(f)["elements"] if e["number"] <= 118]

out = []
for e in elementi:
    out.append({
        "numero": e["number"],
        "simbolo": e["symbol"],
        "nome": NOMI_IT[e["number"] - 1],
        "massa": e["atomic_mass"],
        "categoria": categoria_it(e["category"]),
        "fase": FASE_IT.get(e["phase"], e["phase"]),
        "gruppo": e["group"],
        "periodo": e["period"],
        "colonna": e["xpos"],        # posizione nella tavola (1-18)
        "riga": e["ypos"],           # 1-7, lantanidi/attinidi in 9-10
        "livelli": e["shells"],      # elettroni per livello (Bohr)
        "configurazione": e["electron_configuration"],
        "elettronegativita": e["electronegativity_pauling"],
    })
with open("tavola.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print("Scritto tavola.json:", len(out), "elementi")
