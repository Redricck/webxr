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
  // cambia a sessione gia' avviata, es. si posano i controller). Ogni mano: 25 sfere (giunti) + cilindri (ossa).
  const DITA = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
  const CATENA = (d) => (d === 'thumb' ? ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip']
    : ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip']).map((n) => d + '-' + n);
  const OSSA = [];   // coppie di giunti collegati
  for (const d of DITA) { const c = CATENA(d); OSSA.push(['wrist', c[0]]); for (let i = 0; i < c.length - 1; i++) OSSA.push([c[i], c[i + 1]]); }
  const matPelle = new THREE.MeshStandardMaterial({ color: 0xf1c9a5, roughness: 0.6, emissive: 0x3a2a1c });
  const sfereMani = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), matPelle, 50);
  const geoOsso = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); geoOsso.rotateX(Math.PI / 2);   // lungo z, lunghezza 1
  const ossaMani = new THREE.InstancedMesh(geoOsso, matPelle, 2 * OSSA.length);
  for (const im of [sfereMani, ossaMani]) { im.frustumCulled = false; im.count = 0; scena.add(im); }
  // Indicatore del pizzico: pallino tra pollice e indice (azzurro = vicino, verde = pizzicato)
  const indicatori = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.9 })); m.visible = false; scena.add(m); return m; });
  const stato = { mani: 0, giunti: 0 };   // per la diagnosi nelle impostazioni
  const V = [new THREE.Vector3(), new THREE.Vector3()], z = new THREE.Vector3(0, 0, 1), qo = new THREE.Quaternion(), un = new THREE.Vector3();
  const pose = new Map();
  return {
    stato, visibili: true,
    aggiorna(frame) {
      // Quando il modello vero e' pronto si nasconde quello stilizzato
      for (const { modello, semplice } of modelliVeri) if (modello.motionController && modello.children.length > 0 && semplice.visible) semplice.visible = false;
      const sess = renderer.xr.getSession && renderer.xr.getSession();
      const rif = renderer.xr.getReferenceSpace && renderer.xr.getReferenceSpace();
      let ns = 0, no = 0, h = 0; stato.mani = 0;
      indicatori.forEach((i) => { i.visible = false; });
      if (frame && sess && rif) {
        for (const src of sess.inputSources) {
          if (!src.hand) continue;
          stato.mani++;
          pose.clear();
          for (const [nome, giunto] of src.hand.entries()) {
            const p = frame.getJointPose(giunto, rif);
            if (!p) continue;
            const t = p.transform.position;
            pose.set(nome, { pos: new THREE.Vector3(t.x, t.y, t.z), r: Math.max(p.radius || 0.008, 0.006) });
          }
          if (!this.visibili) continue;
          for (const { pos, r } of pose.values()) if (ns < 50) sfereMani.setMatrixAt(ns++, m.compose(pos, q.identity(), sc.setScalar(r * 0.95)));
          for (const [a, b] of OSSA) {
            const pa = pose.get(a), pb = pose.get(b);
            if (!pa || !pb || no >= ossaMani.instanceMatrix.count) continue;
            const lung = pa.pos.distanceTo(pb.pos);
            if (lung < 1e-4) continue;
            un.subVectors(pb.pos, pa.pos).normalize();
            qo.setFromUnitVectors(z, un);
            const r = Math.min(pa.r, pb.r) * 0.9;
            ossaMani.setMatrixAt(no++, m.compose(pos.copy(pa.pos).add(pb.pos).multiplyScalar(0.5), qo, sc.set(r, r, lung)));
          }
          // Pallino di pizzico tra la punta del pollice e dell'indice
          const pt = pose.get('thumb-tip'), pi = pose.get('index-finger-tip');
          if (pt && pi && h < 2) {
            const ind = indicatori[h++];
            ind.position.copy(pt.pos).add(pi.pos).multiplyScalar(0.5);
            ind.material.color.setHex(pt.pos.distanceTo(pi.pos) < 0.025 ? 0x44ff88 : 0x66ccff);
            ind.visible = true;
          }
        }
      }
      sfereMani.count = ns; ossaMani.count = no; stato.giunti = ns;
      sfereMani.instanceMatrix.needsUpdate = true; ossaMani.instanceMatrix.needsUpdate = true;
    },
  };
}
