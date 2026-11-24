// Pannello di testo 3D (disegnato su un canvas), utile in VR dove non c'e' HTML.
import * as THREE from 'three';

export class PannelloTesto {
  /**
   * @param larghezza,altezza  dimensioni in metri nella scena
   * @param px                 risoluzione del canvas (larghezza in pixel)
   */
  constructor(larghezza = 0.9, altezza = 0.5, px = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = px;
    this.canvas.height = Math.round(px * altezza / larghezza);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(larghezza, altezza),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true })
    );
  }

  /**
   * Riscrive il pannello. righe = [{ testo, colore?, dimensione? , grassetto? }]
   * Le righe troppo lunghe vanno a capo da sole.
   */
  imposta(righe, sfondo = 'rgba(15,25,45,0.85)') {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = sfondo;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 36);
    ctx.fill();
    ctx.textBaseline = 'top';
    let y = 36;
    const margine = 40;
    for (const r of righe) {
      const dim = r.dimensione || 44;
      ctx.font = `${r.grassetto ? 'bold ' : ''}${dim}px sans-serif`;
      ctx.fillStyle = r.colore || '#ffffff';
      for (const linea of this._vaACapo(r.testo, canvas.width - 2 * margine)) {
        ctx.fillText(linea, margine, y);
        y += dim * 1.25;
      }
      y += dim * 0.2;
    }
    this.texture.needsUpdate = true;
  }

  _vaACapo(testo, larghezzaMax) {
    const parole = testo.split(' ');
    const linee = [];
    let corrente = '';
    for (const p of parole) {
      const prova = corrente ? corrente + ' ' + p : p;
      if (this.ctx.measureText(prova).width > larghezzaMax && corrente) { linee.push(corrente); corrente = p; }
      else corrente = prova;
    }
    linee.push(corrente);
    return linee;
  }
}
