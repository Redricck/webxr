// Modulo 2 di scienze-vr: "Tavola periodica".
// Tavola grande in 3D (118 caselle) davanti allo studente. Si punta un elemento e si preme il grilletto (o si clicca col mouse):
// compaiono le informazioni di base e un modello semplice dell'atomo (nucleo, livelli, elettroni).
import * as THREE from 'three';
import { PannelloTesto } from 'comune/pannello.js';

const PASSO = 0.105;          // distanza tra i centri delle caselle (m)
const LATO = 0.098;           // lato della casella (m)
const POS = new THREE.Vector3(0, 0, -1.35);   // la tavola sta davanti allo studente, a 1,35 m

// Colori per categoria (scelta grafica mia: tinte ben distinguibili)
const COLORI = {
  'metallo alcalino': '#e8696b', 'metallo alcalino-terroso': '#f0a15a', 'metallo di transizione': '#e6cf5e',
  'metallo post-transizione': '#8fcf7a', 'semimetallo': '#4fc3a8', 'non metallo': '#5aa9e6',
  'gas nobile': '#a58be0', 'lantanide': '#e58bc0', 'attinide': '#c76f9e',
};
const colore = (cat) => COLORI[cat.replace(' (previsto)', '')] || '#888';

export class ModuloTavola {
  /** @param scena, dati = contenuto di dati/tavola.json */
  constructor(scena, dati) {
    this.dati = dati;
    this.gruppo = new THREE.Group();
    this.gruppo.visible = false;
    scena.add(this.gruppo);
    this.tabella = new THREE.Group();   // contiene le 118 caselle: si puo' afferrare e spostare tutta insieme
    this.tabella.position.set(0, 1.75, POS.z);   // l'origine e' al centro della tavola: ruota e si ingrandisce attorno al suo centro
    this.gruppo.add(this.tabella);
    this.suoni = null;             // oggetto Audio (opzionale), assegnato dall'app
    this.celle = [];               // mesh delle caselle (sono i "premibili")
    this.selezionata = null;
    this._costruisciTavola();

    // Pannello informazioni: sta davanti alla tavola, a sinistra, cosi' il testo e' piu' vicino e leggibile
    this.pannello = new PannelloTesto(0.8, 0.55, 1024);
    this.pannello.mesh.position.set(-0.45, 1.05, -0.95);
    this.gruppo.add(this.pannello.mesh);

    // Modello dell'atomo, a destra del pannello
    this.atomo = new THREE.Group();
    this.atomo.position.set(0.5, 1.05, -0.95);
    this.atomo.rotation.x = -0.35;
    this.gruppo.add(this.atomo);
    this.geoElettrone = new THREE.SphereGeometry(0.013, 10, 8);
    this.livelli = [];             // gruppi che ruotano, uno per livello
  }

  _x(colonna) { return POS.x + (colonna - 9.5) * PASSO; }
  _y(riga) { return 2.25 - (riga - 1) * PASSO; }

  _costruisciTavola() {
    for (const e of this.dati) {
      const cella = this._disegnaCella(e);
      // Lantanidi e attinidi (righe 9-10) sono staccati dal corpo principale da un piccolo spazio
      const riga = e.riga >= 9 ? e.riga - 0.6 : e.riga;
      cella.position.set(this._x(e.colonna), this._y(riga) - this.tabella.position.y, 0);   // coordinate relative al centro
      cella.userData.elemento = e;
      cella.userData.azione = () => this.seleziona(cella);   // letto da premi() in comune/menu.js
      this.tabella.add(cella);
      this.celle.push(cella);
    }
  }

  _disegnaCella(e) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = colore(e.categoria); x.beginPath(); x.roundRect(0, 0, 128, 128, 14); x.fill();
    x.fillStyle = '#111'; x.textAlign = 'left'; x.textBaseline = 'top';
    x.font = '26px sans-serif'; x.fillText(String(e.numero), 8, 6);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 62px sans-serif'; x.fillText(e.simbolo, 64, 74);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(LATO, LATO), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  }

  // ---------- Selezione e informazioni ----------

  seleziona(cella) {
    this.suoni?.suono('tick');
    if (this.selezionata) { this.selezionata.scale.setScalar(1); this.selezionata.position.z = 0; }
    this.selezionata = cella;
    cella.scale.setScalar(1.18); cella.position.z = 0.03;   // la casella scelta "esce" dalla tavola
    const e = cella.userData.elemento;
    const virg = (v, d = 3) => (v == null ? 'n.d.' : String(+v.toFixed(d)).replace('.', ','));
    const esterni = e.livelli[e.livelli.length - 1];
    this.pannello.imposta([
      { testo: `${e.nome} (${e.simbolo})`, dimensione: 68, grassetto: true, colore: colore(e.categoria) },
      { testo: `Numero atomico: ${e.numero}`, dimensione: 42 },
      { testo: `Massa atomica: ${virg(e.massa)} u`, dimensione: 42 },
      { testo: `Categoria: ${e.categoria}`, dimensione: 42 },
      { testo: `Stato a temperatura ambiente: ${e.fase}`, dimensione: 42 },
      { testo: `Livelli: ${e.livelli.join(', ')} elettroni (esterni: ${esterni})`, dimensione: 42 },
      { testo: `Configurazione: ${e.configurazione}`, dimensione: 42 },
      { testo: `Elettronegatività: ${virg(e.elettronegativita, 2)}`, dimensione: 42 },
    ]);
    this._costruisciAtomo(e);
  }

  /** Modello di Bohr: nucleo al centro, un anello per livello, elettroni sugli anelli. */
  _costruisciAtomo(e) {
    // Elimina il modello precedente (le geometrie degli anelli sono create qui, quindi vanno liberate)
    for (const f of [...this.atomo.children]) {
      this.atomo.remove(f);
      f.traverse((o) => { if (o.geometry && o.geometry !== this.geoElettrone) o.geometry.dispose(); });
    }
    this.livelli = [];
    const n = e.livelli.length;
    const col = new THREE.Color(colore(e.categoria));

    const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3 }));
    this.atomo.add(nucleo);
    const matElettrone = new THREE.MeshStandardMaterial({ color: 0x4da3ff, emissive: 0x1a4a88 });
    const matEsterno = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0x8a4a00 });   // elettroni esterni (di valenza)

    e.livelli.forEach((quanti, k) => {
      const r = 0.07 + (n > 1 ? (k / (n - 1)) * 0.23 : 0.03);
      const g = new THREE.Group();
      const pts = [];
      for (let i = 0; i < 64; i++) pts.push(new THREE.Vector3(Math.cos(i / 64 * 6.2832) * r, Math.sin(i / 64 * 6.2832) * r, 0));
      g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8899bb })));
      const esterno = k === n - 1;
      for (let i = 0; i < quanti; i++) {
        const el = new THREE.Mesh(this.geoElettrone, esterno ? matEsterno : matElettrone);
        const a = i / quanti * 6.2832;
        el.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
        g.add(el);
      }
      g.userData.velocita = 0.9 / (k + 1);   // i livelli interni girano piu' veloci
      this.atomo.add(g);
      this.livelli.push(g);
    });
  }

  // ---------- Ciclo di vita ----------

  mostra(si) {
    this.gruppo.visible = si;
    if (si && !this.selezionata) this.seleziona(this.celle[0]);   // parte da H
  }

  /** Da chiamare a ogni fotogramma: fa girare gli elettroni. t in secondi. */
  aggiorna(t) {
    if (!this.gruppo.visible) return;
    for (const g of this.livelli) g.rotation.z = t * g.userData.velocita;
  }
}
