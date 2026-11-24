// Pulsanti 3D (disegnati su canvas), condivisi da tutte le app. Si premono col raggio del controller
// o con il mouse (vedi `premibili` / `onPremi` in controller.js). L'azione sta in mesh.userData.azione.
import * as THREE from 'three';

// 'disattivo' = non premibile; 'spento' = premibile ma rappresenta una funzione spenta (es. Audio: no)
// Palette comune dell'app: [colore chiaro in alto, colore scuro in basso, bordo]
const COLORI = {
  normale: ['#4aa8ff', '#2166d8', '#a9d6ff'],
  selezionato: ['#37d39a', '#168a68', '#b4f1da'],
  disattivo: ['#4a5470', '#363e56', '#6a7595'],
  spento: ['#b8667a', '#8a3f55', '#e9b2c0'],
};
export const FONT = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";

export class Pulsante3D {
  /**
   * @param testo   scritta (puo' andare a capo con \n)
   * @param w,h     dimensioni in metri
   * @param azione  funzione chiamata alla pressione
   */
  constructor(testo, w, h, azione, icona = null) {
    this.testo = testo;
    this.icona = icona;          // 'ingranaggio' per disegnare una rotellina al posto del testo
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
    const [alto, basso, bordo] = COLORI[this.stato] || COLORI.normale;
    x.clearRect(0, 0, canvas.width, canvas.height);
    const gr = x.createLinearGradient(0, 0, 0, canvas.height); gr.addColorStop(0, alto); gr.addColorStop(1, basso);
    x.fillStyle = gr; x.beginPath(); x.roundRect(3, 3, canvas.width - 6, canvas.height - 6, 44); x.fill();
    x.lineWidth = 6; x.strokeStyle = bordo; x.globalAlpha = 0.85; x.stroke(); x.globalAlpha = 1;
    // Riflesso chiaro nella meta' alta, per dare volume
    x.fillStyle = 'rgba(255,255,255,0.14)'; x.beginPath(); x.roundRect(12, 10, canvas.width - 24, canvas.height * 0.42, [36, 36, 12, 12]); x.fill();
    if (this.icona === 'ingranaggio' && !this.testo) { this._ingranaggio(x, canvas.width / 2, canvas.height / 2, canvas.height * 0.36); this.texture.needsUpdate = true; return; }
    // Icona + testo: la rotellina disegnata prima della parola
    const spazio = this.icona === 'ingranaggio' ? canvas.height * 0.95 : 0;
    if (spazio) this._ingranaggio(x, canvas.height * 0.62, canvas.height / 2, canvas.height * 0.27);
    x.fillStyle = this.stato === 'disattivo' ? '#b4bcd2' : '#fff';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const centroX = (spazio + canvas.width) / 2, largaMax = canvas.width - spazio;
    const righe = this.testo.split('\n');
    let dim = Math.min(76, (canvas.height * 0.7) / righe.length);
    x.font = `bold ${dim}px ${FONT}`;
    x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
    // Riduce la scritta finche' la riga piu' lunga entra nel pulsante
    const larga = Math.max(...righe.map((r) => x.measureText(r).width));
    if (larga > largaMax * 0.9) { dim *= largaMax * 0.9 / larga; x.font = `bold ${dim}px ${FONT}`; }
    righe.forEach((r, i) => x.fillText(r, centroX, canvas.height / 2 + (i - (righe.length - 1) / 2) * dim * 1.2));
    this.texture.needsUpdate = true;
  }
}

/** Disegna una rotellina (ingranaggio) bianca: 8 denti attorno a un cerchio con un foro. */
Pulsante3D.prototype._ingranaggio = function (x, cx, cy, r) {
  x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
  for (let i = 0; i < 8; i++) {
    x.save(); x.translate(cx, cy); x.rotate(i * Math.PI / 4);
    x.fillRect(-r * 0.2, -r * 1.12, r * 0.4, r * 0.45);
    x.restore();
  }
  x.beginPath(); x.arc(cx, cy, r * 0.85, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'destination-out';
  x.beginPath(); x.arc(cx, cy, r * 0.38, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'source-over';
};

/** Esegue l'azione di un pulsante (se non e' disattivo). */
export function premi(mesh) {
  if (mesh.userData.azione && !mesh.userData.disattivo) mesh.userData.azione();
}
