// Rilevamento del supporto WebXR e pulsante "Entra in VR/AR". Condiviso da tutte le app.

/**
 * Chiede al browser cosa supporta. Non lancia mai errori: restituisce sempre un oggetto
 * { webxr, https, vr, ar, errore }.
 */
export async function rilevaSupportoXR() {
  const r = { webxr: 'xr' in navigator, https: window.isSecureContext, vr: false, ar: false, errore: null };
  if (!r.webxr) return r;
  try { r.vr = await navigator.xr.isSessionSupported('immersive-vr'); }
  catch (e) { r.errore = String(e); }
  try { r.ar = await navigator.xr.isSessionSupported('immersive-ar'); }
  catch (e) { r.errore = (r.errore ? r.errore + ' | ' : '') + String(e); }
  return r;
}

/**
 * Crea un pulsante che avvia/termina una sessione XR.
 * @param renderer  THREE.WebGLRenderer con renderer.xr.enabled = true
 * @param modo      'immersive-vr' oppure 'immersive-ar'
 * @param opzioni   { etichetta, onInizio(sessione), onFine() , funzioniOpzionali: [...] }
 */
export function creaPulsanteXR(renderer, modo, opzioni = {}) {
  const etichetta = opzioni.etichetta || (modo === 'immersive-vr' ? 'Entra in VR' : 'Entra in AR');
  const pulsante = document.createElement('button');
  pulsante.className = 'pulsante-xr';
  pulsante.textContent = etichetta;
  let sessione = null;

  // "local-floor" ci da' il pavimento come altezza zero; "hand-tracking" e' solo un extra.
  const opzionali = opzioni.funzioniOpzionali || ['local-floor', 'bounded-floor', 'hand-tracking'];

  pulsante.addEventListener('click', async () => {
    if (sessione) { sessione.end(); return; }
    try {
      sessione = await navigator.xr.requestSession(modo, { optionalFeatures: opzionali });
      await renderer.xr.setSession(sessione);
      pulsante.textContent = 'Esci';
      sessione.addEventListener('end', () => {
        sessione = null;
        pulsante.textContent = etichetta;
        if (opzioni.onFine) opzioni.onFine();
      });
      if (opzioni.onInizio) opzioni.onInizio(sessione);
    } catch (e) {
      sessione = null;
      alert('Impossibile avviare la sessione: ' + e.message);
    }
  });
  return pulsante;
}
