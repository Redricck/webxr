"""Aggiorna il numero di versione di un'app prima di pubblicarla.

Uso:  python strumenti/aggiorna-versione.py scienze-vr 1.14   (versione nello stile dei programmi: maggiore.minore)

Cosa fa:
- in <app>/main.js imposta `const VERSIONE = '1.N';` (mostrato nel pannello Impostazioni);
- in <app>/index.html riscrive l'importmap aggiungendo "?v=N" a tutti i file .js dell'app e di comune/
  (esclusa la libreria three). Cosi' il browser del visore non usa copie vecchie dalla cache.
"""
import json, re, sys
from pathlib import Path

radice = Path(__file__).resolve().parent.parent
app, n = sys.argv[1], sys.argv[2]
assert re.fullmatch(r'\d+\.\d+', n), 'la versione deve essere del tipo 1.14'
cartella = radice / app

voci = {"three": "../comune/lib/three/three.module.min.js"}
for f in sorted((radice / "comune").glob("*.js")):
    # nome "nudo" (import 'comune/x.js') e percorso relativo (import './x.js' da dentro comune)
    voci[f"comune/{f.name}"] = f"../comune/{f.name}?v={n}"
    voci[f"../comune/{f.name}"] = f"../comune/{f.name}?v={n}"
for f in sorted(cartella.glob("*.js")):
    voci[f"./{f.name}"] = f"./{f.name}?v={n}"
voci["comune/"] = "../comune/"   # tutto il resto (lib, profili...) senza versione

html = (cartella / "index.html").read_text(encoding="utf-8")
mappa = json.dumps({"imports": voci}, indent=1, ensure_ascii=False)
html = re.sub(r'<script type="importmap">.*?</script>', f'<script type="importmap">\n{mappa}\n</script>', html, flags=re.S)
html = re.sub(r'src="\./main\.js(\?v=[\d.]+)?"', f'src="./main.js?v={n}"', html)
(cartella / "index.html").write_text(html, encoding="utf-8")

main = (cartella / "main.js").read_text(encoding="utf-8")
main = re.sub(r"const VERSIONE = '?[\d.]+'?;", f"const VERSIONE = '{n}';", main)
(cartella / "main.js").write_text(main, encoding="utf-8")
print(f"{app}: versione {n}")
