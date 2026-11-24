# Dati e librerie di terze parti

## three.js (comune/lib/three)
- Versione r170, file `three.module.min.js` (build ufficiale, pacchetto npm `three@0.170.0`).
- Licenza MIT, vedi `lib/three/LICENSE-three.txt`. © 2010-2024 three.js authors.

## Tavola periodica (comune/dati/PeriodicTableJSON.json)
- Progetto "Periodic-Table-JSON" di Bowserinator: https://github.com/Bowserinator/Periodic-Table-JSON
- Il repository dichiara "Feel free to use it in your projects" ma NON indica una licenza formale.
  I testi riassuntivi e molti valori derivano da Wikipedia (CC BY-SA 3.0/4.0) e dalle fonti
  indicate nel campo `source` di ogni elemento. Le immagini dello spettro hanno attribuzioni proprie
  (es. images-of-elements.com, CC BY 3.0).
- Uso nelle app: solo come dato didattico gratuito a scuola, con questa attribuzione.
  Da riverificare prima di una diffusione pubblica (vedi CLAUDE.md, "Questioni aperte").
- Da questo file si ricavano i dati usati dalle app (es. `scienze-vr/dati/elementi.json`,
  tramite `scienze-vr/dati/estrai-elementi.py`). La valenza e' calcolata dal numero di elettroni
  dell'ultimo livello con la regola dell'ottetto.

## Nomi italiani e categorie (scienze-vr/dati/tavola.json)
- Traduzione scritta da Claude (non e' un dataset): da ricontrollare.

## DNA (scienze-vr/dati/dna.json)
- Regole di appaiamento Watson-Crick e parametri del DNA di forma B (0,34 nm per coppia, 10,5 coppie per giro, diametro 2 nm): valori di manuale, non scaricati da un dataset. Da verificare con una fonte aperta (es. Wikipedia, CC BY-SA).

## Modelli dei controller (comune/profili)
- Pacchetto npm `@webxr-input-profiles/assets` v1.0.20 (profili e modelli 3D dei controller, tra cui Pico 4): https://github.com/immersive-web/webxr-input-profiles
- Licenza MIT, © 2019 Amazon: vedi `comune/profili/LICENSE-webxr-input-profiles.md`.
- Copiato solo il sottoinsieme usato (pico-4, pico-4u, pico-neo3 e il profilo generico di ripiego trigger-squeeze-thumbstick).
- three.js `examples/jsm` (XRControllerModelFactory, GLTFLoader, BufferGeometryUtils, motion-controllers) copiato in `comune/lib/three/jsm` (MIT, vedi `lib/three/LICENSE-three.txt`).

## Audio
- Musica di sottofondo ed effetti sono generati in codice con Web Audio (`comune/audio.js`): nessun file audio e nessuna licenza da rispettare.
