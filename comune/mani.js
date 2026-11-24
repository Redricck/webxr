// Mostra in VR i controller oppure le mani, se il visore sta usando l'hand tracking.
//  - Controller: modello 3D reale del dispositivo (es. Pico 4), preso dai profili WebXR copiati in comune/profili
//    (nessun download da Internet). Se il modello non si carica resta un controller stilizzato fatto a mano.
//  - Mani: 25 sfere, una per ogni articolazione. Condiviso da tutte le app.
import * as THREE from 'three';
import { XRControllerModelFactory } from './lib/three/jsm/webxr/XRControllerModelFactory.js';

/** Controller stilizzato: impugnatura, anello superiore e grilletto. Il suo "davanti" e' -z. */
function creaModelloController() {
  const g = new THREE.Group();
  const grigio = new THREE.MeshStandardMaterial({ color: 0x2d333b, roughness: 0.5 });
  const accento = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x1a5f80, roughness: 0.4 });
  const impugnatura = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.11, 14), grigio);
  impugnatura.rotation.x = Math.PI / 2 - 0.5;          // inclinata come nei controller reali
  impugnatura.position.set(0, -0.005, 0.02);
  const anello = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 8, 20), accento);
  anello.position.set(0, 0.015, -0.045);
  anello.rotation.x = Math.PI / 2 - 0.4;
  const grilletto = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), accento);
  grilletto.position.set(0, -0.02, -0.025);
  g.add(impugnatura, anello, grilletto);
  return g;
}

/**
 * Aggiunge alla scena i modelli di controller e mani.
 * Restituisce { aggiorna() }: da chiamare a ogni fotogramma per muovere le sfere delle mani.
 */
export function creaVisualiInput(renderer, scena) {
  const mani = [], modelliVeri = [];
  const fabbrica = new XRControllerModelFactory();
  fabbrica.setPath(new URL('./profili', import.meta.url).href);   // profili e modelli copiati nel progetto
  const geoSfera = new THREE.SphereGeometry(1, 8, 6);
  const matMano = new THREE.MeshStandardMaterial({ color: 0xffd9b8, roughness: 0.7 });
  for (let i = 0; i < 2; i++) {
    // Controller: il "grip" e' la posizione dell'impugnatura (non esiste se l'utente usa le mani)
    const grip = renderer.xr.getControllerGrip(i);
    const semplice = creaModelloController();          // di ripiego, finche' (o se) il modello vero non arriva
    grip.add(semplice);
    const modello = fabbrica.createControllerModel(grip);   // scarica il profilo giusto (pico-4...) dalla cartella locale
    grip.add(modello);
    modelliVeri.push({ modello, semplice });
    scena.add(grip);
    // Mani: una sfera per articolazione (25), aggiornate da aggiorna()
    const mano = renderer.xr.getHand(i);
    const sfere = new THREE.InstancedMesh(geoSfera, matMano, 25);   // (non piu' usate: vedi sotto)
    sfere.frustumCulled = false;
    sfere.count = 0;
    mano.add(sfere);
    scena.add(mano);
    mani.push({ mano, sfere });
  }
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  // Mani disegnate direttamente dai giunti del fotogramma (cosi' funzionano anche se il tipo di input
  // cambia a sessione gia' avviata, es. si posano i controller): fino a 2 mani x 25 giunti.
  const sfereMani = new THREE.InstancedMesh(geoSfera, matMano, 50);
  sfereMani.frustumCulled = false; sfereMani.count = 0;
  scena.add(sfereMani);
  const stato = { mani: 0, giunti: 0 };   // per la diagnosi nelle impostazioni
  return {
    stato,
    aggiorna(frame) {
      // Quando il modello vero e' pronto si nasconde quello stilizzato
      for (const { modello, semplice } of modelliVeri) if (modello.motionController && modello.children.length > 0 && semplice.visible) semplice.visible = false;
      const sess = renderer.xr.getSession && renderer.xr.getSession();
      const rif = renderer.xr.getReferenceSpace && renderer.xr.getReferenceSpace();
      let n = 0; stato.mani = 0;
      if (frame && sess && rif) {
        for (const src of sess.inputSources) {
          if (!src.hand) continue;
          stato.mani++;
          for (const giunto of src.hand.values()) {
            const p = frame.getJointPose(giunto, rif);
            if (!p || n >= 50) continue;
            const t = p.transform.position;
            pos.set(t.x, t.y, t.z);
            sc.setScalar(Math.max(p.radius || 0.008, 0.006));
            sfereMani.setMatrixAt(n++, m.compose(pos, q.identity(), sc));
          }
        }
      }
      sfereMani.count = n; stato.giunti = n;
      sfereMani.instanceMatrix.needsUpdate = true;
    },
  };
}
