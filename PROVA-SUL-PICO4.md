# Come provare l'app sul Pico 4

## 1. Metti le pagine su Internet (una volta sola, poi basta `git push`)
Segui `PUBBLICAZIONE.md`: alla fine avrai un indirizzo tipo `https://redricck.github.io/webxr/`.

## 2. Sul visore
1. Indossa il Pico 4 e apri il **Browser**.
2. Scrivi l'indirizzo: `https://redricck.github.io/webxr/comune/test.html`
   - Controlla le righe SI/NO. `immersive-vr` deve essere **SI**. Premi **Entra in VR**: devi vedere un cubo che gira davanti a te e un pannello con le funzioni attive.
   - Per uscire dalla VR premi il tasto Pico (o il pulsante Esci).
3. Poi apri `https://redricck.github.io/webxr/scienze-vr/` e premi **Entra in VR**.
4. Nel menu **punta col raggio azzurro** un pulsante e premi il **grilletto**.
   - **Molecole:** afferra un atomo (grilletto o tasto laterale/presa, da vicino o puntandolo) e avvicinalo a un altro. Scegli la molecola dai pulsanti in basso.
   - **Tavola periodica:** punta un elemento e premi il grilletto: a sinistra compaiono le informazioni, a destra l'atomo.
   - **DNA:** appoggia ogni pezzo sulla base giusta (A-T, C-G). Per staccare un pezzo, riprendilo.
   - Pulsante **Menu** per tornare indietro.

## Comandi nel visore
- **Grilletto:** preme il pulsante puntato; prende l'atomo o il pezzo di DNA (anche da lontano: viene tirato davanti alla mano).
- **Presa laterale:** prende il "blocco" puntato: la **molecola intera** (se ha dei legami), l'**elica del DNA** o una **scheda** di testo. Si possono avvicinare, allontanare e girare con la mano.
- **Levetta:** con un oggetto in mano, su/giù lo allontana/avvicina, destra/sinistra lo ruota.
- **Due mani:** prendi con entrambe lo stesso blocco: allargando le mani ingrandisci una scheda, girando le mani ruoti il blocco.
- **Tasto A/B (X/Y) o pulsante "Ricentra":** ricentra la vista (utile da seduti o dopo essersi girati) e riporta schede ed elica al loro posto. Succede anche da solo all'ingresso in VR.
- Si vedono i controller (o le mani, se usi l'hand tracking).

## 3. Cosa guardare e riferirmi
- Il testo si legge bene? L'altezza di tavola e pannelli e' comoda?
- Il raggio azzurro e la vibrazione ci sono? Riesci ad afferrare gli atomi piccoli (idrogeno)?
- Qualche scatto o rallentamento (soprattutto nella tavola periodica)?
- Se un pulsante o un oggetto e' fuori portata, di quanto?

## Alternativa senza internet (dal tuo PC)
Con il visore collegato al PC via USB e il debug USB attivo (Impostazioni > Sviluppatore):
```
cd C:\Users\Samsung\webXR
python -m http.server 8000
adb reverse tcp:8000 tcp:8000
```
Poi nel Browser del Pico apri `http://localhost:8000/scienze-vr/` (su `localhost` WebXR funziona anche senza HTTPS).
