# webXR - regole per Claude

Progetto unico per le app didattiche XR (realtà virtuale/aumentata nel browser) per il visore Pico 4 della scuola e altri dispositivi. Cartella: `C:\Users\Samsung\webXR`. Il proprietario è Riccardo; lingua di app, commenti e messaggi: **italiano**.

## Struttura
- `progetto/`: istruzioni (leggi `00-LEGGIMI`, `01-regole-comuni`, `02-elenco-app`, `03-prossimo-passo`).
- `comune/`: parti condivise tra le app (`xr-supporto.js`, `controller.js`, `pannello.js`, libreria `lib/three`, dati in `dati/`, `test.html`).
- `scienze-vr/`: prima app (moduli: molecole, tavola periodica, DNA).
- Ogni nuova app: una sua cartella accanto a queste, e una riga in `progetto/02-elenco-app.md`.

## Regole tecniche
- WebXR nel browser. Parti da `immersive-vr`; usa `immersive-ar`/hit-test solo dopo `isSessionSupported` (il Pico 4 base potrebbe non supportarli).
- three.js **senza build**: moduli ES + importmap, libreria copiata in `comune/lib/three` (mai da CDN: la rete della scuola).
- Ogni app deve funzionare anche su **desktop** (mouse e tastiera) per provare senza visore.
- Prestazioni da visore mobile: geometrie semplici, pochi oggetti, niente effetti pesanti. Controller con grilletto e presa; hand tracking solo come extra.
- Dati scientifici **da dataset aperti** (non a memoria): controllare la licenza, copiarli nel progetto e annotare l'attribuzione in `comune/dati/LICENZE-DATI.md`.
- Nessun tracciamento, nessun account, nessun dato degli studenti.
- Codice chiaro e **commentato in italiano**. Le parti condivise vanno in `comune`, non copiate nelle app.

## Pubblicazione e prova
- Repository git, pubblicazione su GitHub Pages (HTTPS necessario per WebXR). Vedi `PUBBLICAZIONE.md`.
- Il Pico 4 lo prova Riccardo. Claude non può provarlo: quando serve una verifica sul visore, dire in modo breve cosa guardare.

## Modo di lavorare
- Prima di scrivere codice: piano in poche righe e decisioni che spettano a Riccardo. Non fare domande su dettagli tecnici decidibili.
- Un'app e un modulo per volta, con l'ok di Riccardo tra un passo e l'altro. `progetto/03-prossimo-passo.md` si aggiorna a ogni fase.

## Questioni aperte
- Licenza del dataset `PeriodicTableJSON.json`: nessuna licenza formale nel repository (dati da Wikipedia, CC BY-SA). Ok per uso scolastico; riverificare prima di diffusione pubblica.
- Nomi italiani degli elementi e delle categorie (`scienze-vr/dati/estrai-tavola.py`): sono una traduzione scritta da Claude, non un dato del dataset. Da ricontrollare.
- Modulo DNA (`scienze-vr/dati/dna.json`): regole di appaiamento e parametri dell'elica sono valori di manuale, non da un dataset scaricato (rete non permessa). Da verificare con una fonte aperta.
- Nel modulo molecole il legame ha sempre l'ordine massimo possibile (C+O = doppio): lo studente non sceglie singolo/doppio.
- Hand tracking: sul Pico 4 di Riccardo (browser Pico) l'hand tracking NON arriva alla pagina: con il tracciamento attivo e i controller spenti il pannello dice "Mani viste: 0" (provato 2026-11-24, v10). L'app lo supporta come extra (ossa, pizzico dai giunti, Input auto/mani/controller) ma i controller restano il modo principale; 'solo mani' non esclude i controller se non si vedono mani.
- Mai provato sul Pico 4: tutto verificato solo su desktop (Chromium).

## Interazione in VR (comune/controller.js, comune/mani.js)
Grilletto = pulsanti e oggetti piccoli; presa laterale = blocchi (molecola intera, elica DNA, schede); levetta = distanza/rotazione; due mani = ruota/scala; tasto A/B = ricentra (`ricentraVista` in `comune/xr-supporto.js`). Le app passano a `GestoreControllerXR` le opzioni `grandi` e `blocco`.

Audio: `comune/audio.js`, tutto generato in codice (musica ambient + effetti), si sblocca al primo gesto. Controller: modelli reali (profili WebXR) copiati in `comune/profili`, mani come sfere (`comune/mani.js`).

## Stato dei moduli di scienze-vr
- `molecole.js` (modulo 1), `tavola.js` (modulo 2), `dna.js` (modulo 3), `main.js` (menu VR e collegamento). Pulsanti 3D in `comune/menu.js`.
