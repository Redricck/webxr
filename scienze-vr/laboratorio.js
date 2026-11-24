// Sfondo "laboratorio" per scienze-vr: stanza semplice con pavimento a piastrelle, pareti,
// un bancone con qualche vetreria e una lavagna. Pochissimi oggetti (circa 30) e nessuna texture
// pesante: adatto al visore. Nessun elemento e' "premibile" o afferrabile.
import * as THREE from 'three';

/** Piastrelle a scacchi disegnate su un canvas piccolo (si ripetono sul pavimento). */
function texturaPiastrelle() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#6b7885'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#5e6b78'; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 12);
  return t;
}

export function creaLaboratorio() {
  const g = new THREE.Group();
  const mat = (colore, extra = {}) => new THREE.MeshStandardMaterial({ color: colore, roughness: 0.8, ...extra });

  // Pavimento
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(7, 8), new THREE.MeshStandardMaterial({ map: texturaPiastrelle(), roughness: 0.9 }));
  pav.rotation.x = -Math.PI / 2; pav.position.set(0, 0, -1);
  g.add(pav);

  // Pareti (fondo, sinistra, destra, dietro lo studente) e soffitto
  const parete = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(0x9fb4c7, { side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
  };
  parete(7, 3.2, 0, 1.6, -5, 0);                 // fondo
  parete(8, 3.2, -3.5, 1.6, -1, Math.PI / 2);    // sinistra
  parete(8, 3.2, 3.5, 1.6, -1, Math.PI / 2);     // destra
  parete(7, 3.2, 0, 1.6, 3, 0);                  // dietro
  const sof = new THREE.Mesh(new THREE.PlaneGeometry(7, 8), mat(0xdfe6ec, { side: THREE.DoubleSide }));
  sof.rotation.x = Math.PI / 2; sof.position.set(0, 3.2, -1); g.add(sof);

  // Zoccolo scuro lungo la parete di fondo
  const zoc = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.04), mat(0x44505c));
  zoc.position.set(0, 0.06, -4.98); g.add(zoc);

  // Bancone da laboratorio lungo la parete di fondo: base chiara + piano in legno
  const base = new THREE.Mesh(new THREE.BoxGeometry(5, 0.85, 0.7), mat(0x7f8b97));
  base.position.set(0, 0.425, -4.6); g.add(base);
  const piano = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.05, 0.8), mat(0xa9805a));
  piano.position.set(0, 0.875, -4.6); g.add(piano);

  // Vetreria semplice sul bancone: beute (coni), becher (cilindri), provette (cilindri sottili)
  const vetro = (colore) => new THREE.MeshStandardMaterial({ color: colore, transparent: true, opacity: 0.55, roughness: 0.15 });
  const colori = [0x66ccff, 0x7be08a, 0xffd166, 0xf28ab2, 0xb39ddb, 0x66ccff];
  colori.forEach((col, i) => {
    const x = -2 + i * 0.75;
    if (i % 2 === 0) {                 // beuta
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 14), vetro(col)); b.position.set(x, 1.0, -4.6);
      const collo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10), vetro(0xcfe8f5)); collo.position.set(x, 1.16, -4.6);
      g.add(b, collo);
    } else {                           // becher
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.18, 14), vetro(col)); b.position.set(x, 0.99, -4.6);
      g.add(b);
    }
  });
  for (let i = 0; i < 4; i++) {        // portaprovette con provette
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), vetro(colori[i]));
    t.position.set(1.9 + i * 0.05, 0.97, -4.45); g.add(t);
  }

  // Lavagna sulla parete di fondo, sopra il bancone (la tavola periodica sta piu' avanti, non la copre)
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 0.04), mat(0x44505c));
  cornice.position.set(0, 2.1, -4.97); g.add(cornice);
  const lavagna = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.1), new THREE.MeshBasicMaterial({ color: 0x2f4a3f }));
  lavagna.position.set(0, 2.1, -4.945); g.add(lavagna);

  // Armadietti lungo la parete sinistra
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.9), mat(0xc9d3dc));
    a.position.set(-3.2, 0.9, -3.2 + i * 1.0); g.add(a);
  }
  return g;
}
