// Rilevamento del supporto WebXR, pulsante "Entra in VR/AR" e ricentramento della vista. Condiviso da tutte le app.
import * as THREE from 'three';

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

/**
 * Ricentra la vista: porta lo studente al centro della scena, rivolto verso la scena (-z), e alla giusta altezza.
 * Serve quando si e' seduti (testa piu' in basso) o ci si e' spostati/girati. Se la testa e' piu' bassa di
 * `altezzaMinima` la si "alza" a quell'altezza (cosi' gli oggetti, pensati per occhi a 1,5-1,6 m, restano comodi).
 * Va chiamata con il `frame` XR corrente. Restituisce true se ha funzionato.
 */
export function ricentraVista(renderer, frame, altezzaMinima = 1.5) {
  const rif = renderer.xr.getReferenceSpace();
  if (!rif || !frame) return false;
  const posa = frame.getViewerPose(rif);
  if (!posa) return false;
  const p = posa.transform.position, o = posa.transform.orientation;
  // Direzione orizzontale in cui guarda la testa (se guarda in giu' il piu' possibile, si tiene l'orientamento attuale)
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(o.x, o.y, o.z, o.w));
  const piatta = Math.hypot(dir.x, dir.z);
  const yaw = piatta > 0.3 ? Math.atan2(-dir.x, -dir.z) : 0;
  const altezza = Math.max(p.y, altezzaMinima);
  const T = new XRRigidTransform({ x: p.x, y: p.y - altezza, z: p.z }, { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
  renderer.xr.setReferenceSpace(rif.getOffsetReferenceSpace(T));
  return true;
}
