# Regole comuni a tutte le app

## Tecnica
- WebXR nel browser. Parti da `immersive-vr`; usa `immersive-ar` o hit-test solo dopo aver verificato con `isSessionSupported`: il Pico 4 base potrebbe non supportarli.
- three.js senza passaggi di build: moduli ES e importmap, con la libreria copiata nel progetto (non da CDN), così funziona anche con la rete della scuola.
- Ogni app deve funzionare anche su desktop con tastiera e mouse, per provare senza visore.
- Prestazioni da visore mobile: geometrie semplici, pochi oggetti, niente effetti pesanti. Controller con grilletto e presa; hand tracking solo come extra.
- Dati scientifici (elementi, valenze, ecc.): da dataset aperti. Controlla la licenza, copiali nel progetto con l'attribuzione. Non generarli a memoria.
- Nessun tracciamento, nessun account, nessun dato degli studenti.
- Codice chiaro e commentato in italiano: lo leggo e lo modifico io.
- Parti condivise tra le app (menu VR, gestione controller, rilevamento supporto XR) in una cartella `comune`, non copiate in ogni app.

## Pubblicazione e prova
- Repository git. Pubblicazione su GitHub Pages (HTTPS, richiesto da WebXR), con un comando o workflow semplice. Dimmi quali passaggi devo fare io.
- Il visore Pico 4 lo provo io e ti riferisco cosa non funziona. Tu non puoi provarlo: quando serve una verifica sul visore, dimmi in modo breve cosa guardare.

## Modo di lavorare
- Prima di scrivere codice, dimmi in poche righe il piano e le decisioni che spettano a me.
- Non farmi domande su dettagli tecnici che puoi decidere tu.
- Un'app e un modulo per volta, con il mio ok tra un passo e l'altro.
- Crea tu `CLAUDE.md` nella cartella del progetto riassumendo queste regole.
