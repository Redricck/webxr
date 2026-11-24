// Mostra in VR i controller (modello semplice) oppure le mani, se il visore sta usando l'hand tracking.
// Nessun file esterno da scaricare: il modello del controller e' fatto con tre forme semplici
// e le mani sono 25 sfere, una per ogni articolazione. Condiviso da tutte le app.
import * as THREE from 'three';

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
  const mani = [];
  const geoSfera = new THREE.SphereGeometry(1, 8, 6);
  const matMano = new THREE.MeshStandardMaterial({ color: 0xffd9b8, roughness: 0.7 });
  for (let i = 0; i < 2; i++) {
    // Controller: il "grip" e' la posizione dell'impugnatura (non esiste se l'utente usa le mani)
    const grip = renderer.xr.getControllerGrip(i);
    grip.add(creaModelloController());
    scena.add(grip);
    // Mani: una sfera per articolazione (25), aggiornate da aggiorna()
    const mano = renderer.xr.getHand(i);
    const sfere = new THREE.InstancedMesh(geoSfera, matMano, 25);
    sfere.frustumCulled = false;
    sfere.count = 0;
    mano.add(sfere);
    scena.add(mano);
    mani.push({ mano, sfere });
  }
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  return {
    aggiorna() {
      for (const { mano, sfere } of mani) {
        const giunti = Object.values(mano.joints || {}).filter((j) => j.visible);
        sfere.count = Math.min(giunti.length, 25);
        for (let k = 0; k < sfere.count; k++) {
          const j = giunti[k];
          pos.setFromMatrixPosition(j.matrix);
          sc.setScalar(j.jointRadius || 0.008);
          sfere.setMatrixAt(k, m.compose(pos, q.identity(), sc));
        }
        sfere.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
