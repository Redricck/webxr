# Pubblicare le pagine e aprirle sul Pico 4

WebXR funziona solo su HTTPS (o `localhost`). La strada più semplice è GitHub Pages, gratuita.

## Una volta sola
1. Su github.com crea un repository (es. `webxr`), pubblico o privato (Pages gratuito richiede pubblico se l'account è free).
2. Nella cartella `C:\Users\Samsung\webXR`, in un terminale:
   ```
   git init
   git add .
   git commit -m "Prima versione"
   git branch -M main
   git remote add origin https://github.com/Redricck/webxr.git
   git push -u origin main
   ```
3. Sul repository: **Settings > Pages > Build and deployment > Source: Deploy from a branch**, branch `main`, cartella `/ (root)`, Save.
4. Dopo 1-2 minuti le pagine sono su `https://redricck.github.io/webxr/`.

## A ogni modifica
```
git add .
git commit -m "Descrizione"
git push
```
Attendi circa un minuto e ricarica la pagina.

## Aprire sul Pico 4
1. Metti il visore, apri il **Browser** del Pico.
2. Vai a `https://redricck.github.io/webxr/comune/test.html` (supporto XR) oppure `.../scienze-vr/` (l'app).
3. Premi **Entra in VR**. Se il pulsante non c'è, la pagina dice cosa manca.
- Consiglio: nel browser del Pico aggiungi la pagina ai preferiti.

## Prova sul computer (senza visore)
In `C:\Users\Samsung\webXR`: `python -m http.server 8000` e apri `http://localhost:8000/scienze-vr/`. (Non aprire il file con doppio clic: i moduli richiedono un server.)

## Prima di ogni pubblicazione: numero di versione
`python strumenti/aggiorna-versione.py scienze-vr N` (N = versione precedente + 1). Aggiorna il numero mostrato nelle Impostazioni e aggiunge `?v=N` ai file nell'importmap, così il visore non usa copie vecchie.
