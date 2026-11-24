// Pulsanti 3D (disegnati su canvas), condivisi da tutte le app. Si premono col raggio del controller
// o con il mouse (vedi `premibili` / `onPremi` in controller.js). L'azione sta in mesh.userData.azione.
import * as THREE from 'three';

const COLORI = { normale: '#2f7cf6', selezionato: '#2f9e5a', disattivo: '#444b5c' };

export class Pulsante3D {
  /**
   * @param testo   scritta (puo' andare a capo con \n)
   * @param w,h     dimensioni in metri
   * @param azione  funzione chiamata alla pressione
   */
  constructor(testo, w, h, azione) {
    this.testo = testo;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512; this.canvas.height = Math.round(512 * h / w);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.texture, transparent: true }));
    this.mesh.userData.azione = azione;
    this.stato = 'normale';
    this.disegna();
  }

  /** stato: 'normale' | 'selezionato' | 'disattivo' (un pulsante disattivo non fa nulla) */
  imposta(stato, testo = this.testo) {
    this.stato = stato; this.testo = testo;
    this.mesh.userData.disattivo = stato === 'disattivo';
    this.disegna();
  }

  disegna() {
    const { canvas } = this, x = canvas.getContext('2d');
    x.fillStyle = COLORI[this.stato]; x.beginPath(); x.roundRect(0, 0, canvas.width, canvas.height, 40); x.fill();
    x.fillStyle = this.stato === 'disattivo' ? '#99a' : '#fff';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const righe = this.testo.split('\n');
    let dim = Math.min(76, (canvas.height * 0.7) / righe.length);
    x.font = `bold ${dim}px sans-serif`;
    // Riduce la scritta finche' la riga piu' lunga entra nel pulsante
    const larga = Math.max(...righe.map((r) => x.measureText(r).width));
    if (larga > canvas.width * 0.9) { dim *= canvas.width * 0.9 / larga; x.font = `bold ${dim}px sans-serif`; }
    righe.forEach((r, i) => x.fillText(r, canvas.width / 2, canvas.height / 2 + (i - (righe.length - 1) / 2) * dim * 1.2));
    this.texture.needsUpdate = true;
  }
}

/** Esegue l'azione di un pulsante (se non e' disattivo). */
export function premi(mesh) {
  if (mesh.userData.azione && !mesh.userData.disattivo) mesh.userData.azione();
}
