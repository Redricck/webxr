// Modulo "Legami" di scienze-vr (dentro la tavola periodica): come si legano gli atomi, a livello di elettroni.
// Lo studente prende gli atomi (nucleo + elettroni esterni), li avvicina e li rilascia vicini: parte una breve animazione.
//  - COVALENTE (H2, HCl, H2O): ogni coppia di atomi mette in comune una coppia di elettroni (orbitano attorno a entrambi i nuclei).
//    Se un atomo e' piu' elettronegativo la coppia sta piu' vicina a lui (legame polare: δ+ e δ-).
//  - IONICO (NaCl, MgO): uno o due elettroni passano da un atomo all'altro: nascono ioni di carica opposta che si attraggono.
// I dati (livelli di elettroni, elettronegativita') vengono da dati/tavola.json; i testi e la scelta dei casi sono scritti da Claude.
// Geometrie leggere: per atomo 1 nucleo, 1 guscio trasparente, 1 anello e al massimo 8 elettroni.
import * as THREE from 'three';
import { colore } from './tavola.js';
import { PannelloTesto } from 'comune/pannello.js';

const R = 0.09;              // raggio dell'anello degli elettroni esterni (m)
const D_COV = 0.15;          // distanza tra i nuclei in un legame covalente
const D_ION_INIZIO = 0.30;   // distanza degli ioni subito dopo il passaggio dell'elettrone
const D_ION = 0.21;          // distanza finale tra gli ioni
const SOGLIA = 0.32;         // distanza massima dal primo atomo per far partire il legame

/** Casi proposti. `trasferimenti`: [da, a, quanti elettroni]; `legami`: coppie di atomi che condividono una coppia. */
export const CASI = {
  H2: { nome: 'Idrogeno', formula: 'H₂', atomi: ['H', 'H'], tipo: 'covalente', legami: [[0, 1]] },
  HCl: { nome: 'Acido cloridrico', formula: 'HCl', atomi: ['Cl', 'H'], tipo: 'covalente', legami: [[0, 1]] },
  H2O: { nome: 'Acqua', formula: 'H₂O', atomi: ['O', 'H', 'H'], tipo: 'covalente', legami: [[0, 1], [0, 2]] },
  NaCl: { nome: 'Sale da cucina', formula: 'NaCl', atomi: ['Na', 'Cl'], tipo: 'ionico', trasferimenti: [[0, 1, 1]] },
  MgO: { nome: 'Ossido di magnesio', formula: 'MgO', atomi: ['Mg', 'O'], tipo: 'ionico', trasferimenti: [[0, 1, 2]] },
};

const ease = (x) => x * x * (3 - 2 * x);
const virg = (v) => String(+v.toFixed(2)).replace('.', ',');

export class ModuloLegami {
  /** @param scena, dati = contenuto di dati/tavola.json */
  constructor(scena, dati) {
    this.scena = scena; this.dati = dati;
    this.attivo = false; this.caso = null; this.fase = 'idle'; this.legato = false;
    this.atomi = []; this.elettroni = []; this.legamiCov = []; this.trasf = [];
    this.rot = 0;
    this.suoni = null;
    this.pannello = new PannelloTesto(0.95, 0.52, 1024);
    this.pannello.mesh.position.set(0, 1.78, -0.95);
    this.pannello.mesh.visible = false;
    scena.add(this.pannello.mesh);
    this.geoNucleo = new THREE.SphereGeometry(0.022, 16, 12);
    this.geoGuscio = new THREE.SphereGeometry(0.052, 16, 12);
    this.geoElettrone = new THREE.SphereGeometry(0.011, 10, 8);
    this.geoAnello = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.cos(i / 48 * Math.PI * 2) * R, Math.sin(i / 48 * Math.PI * 2) * R, 0)));
    this.matElettrone = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xaa5500, emissiveIntensity: 0.8 });
    this.geoPresa = new THREE.SphereGeometry(0.11);
    this.matPresa = new THREE.MeshBasicMaterial({ visible: false });
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._q = new THREE.Quaternion();
  }

  /** Atomi afferrabili: solo prima che il legame si formi. */
  get afferrabili() { return this.attivo && !this.legato ? this.atomi : []; }

  el(simbolo) { return this.dati.find((e) => e.simbolo === simbolo); }

  // ---------- Costruzione ----------

  mostra(si) {
    this.attivo = si;
    this.pannello.mesh.visible = si;
    this._pulisci();
    if (!si) this.caso = null;
  }

  _pulisci() {
    for (const a of this.atomi) a.parent?.remove(a);
    for (const e of this.elettroni) e.mesh.parent?.remove(e.mesh);
    this.atomi = []; this.elettroni = []; this.legamiCov = []; this.trasf = []; this.legato = false; this.fase = 'idle';
  }

  /** Prepara un caso: crea gli atomi sul "bancone" con i loro elettroni esterni. */
  avvia(chiave) {
    this._pulisci();
    this.caso = chiave;
    const c = CASI[chiave];
    const n = c.atomi.length;
    c.atomi.forEach((simbolo, i) => {
      const dati = this.el(simbolo);
      const g = new THREE.Group();
      const col = new THREE.Color(colore(dati.categoria));
      g.add(new THREE.Mesh(this.geoNucleo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35 })));
      const guscio = new THREE.Mesh(this.geoGuscio, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22 }));
      g.add(guscio);
      const anello = new THREE.LineLoop(this.geoAnello, new THREE.LineBasicMaterial({ color: 0x9fb4d8 }));
      g.add(anello);
      g.add(new THREE.Mesh(this.geoPresa, this.matPresa));   // area di presa generosa (invisibile)
      const etichetta = this._etichetta(simbolo, '#ffffff'); etichetta.position.set(0, 0.16, 0); g.add(etichetta);
      const valenza = dati.livelli[dati.livelli.length - 1];
      g.userData = { simbolo, dati, valenza, slots: simbolo === 'H' ? 2 : 8, guscio, anello, etichetta, usati: 0, carica: 0 };
      // Posizione di partenza sul bancone, distribuiti lungo x (se sono 3 l'atomo centrale sta in mezzo)
      const x = n === 2 ? (i === 0 ? -0.3 : 0.3) : (i === 0 ? 0 : (i === 1 ? -0.38 : 0.38));
      g.position.set(x, 1.3 - (n === 3 && i > 0 ? 0.1 : 0), -0.8);
      this.scena.add(g);
      this.atomi.push(g);
      for (let k = 0; k < valenza; k++) {
        const mesh = new THREE.Mesh(this.geoElettrone, this.matElettrone);
        this.scena.add(mesh);
        this.elettroni.push({ mesh, atomo: g, slot: k, mix: 0, tipo: 'anello' });
      }
    });
    this._pannelloIniziale();
  }

  /** Scritta con il simbolo (e la carica) sopra l'atomo. */
  _etichetta(testo, colorec) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.font = 'bold 72px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 12; x.strokeStyle = '#000'; x.strokeText(testo, 128, 66);
    x.fillStyle = colorec; x.fillText(testo, 128, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    s.scale.set(0.12, 0.06, 1); s.renderOrder = 10;
    s.raycast = () => {};   // le scritte non si puntano
    return s;
  }
  _cambiaEtichetta(atomo, testo, col) {
    const nuova = this._etichetta(testo, col); nuova.position.copy(atomo.userData.etichetta.position);
    atomo.remove(atomo.userData.etichetta); atomo.add(nuova); atomo.userData.etichetta = nuova;
  }

  // ---------- Pannello ----------

  _pannelloIniziale() {
    const c = CASI[this.caso];
    const righe = [
      { testo: `${c.nome} (${c.formula})`, dimensione: 62, grassetto: true, colore: '#ffd166' },
      { testo: 'Prendi gli atomi e avvicinali finché si toccano, poi lasciali. Guarda cosa fanno gli elettroni esterni (arancioni).', dimensione: 40, colore: '#9ecbff' },
    ];
    for (const a of this.atomi) {
      const d = a.userData.dati;
      righe.push({ testo: `${d.nome} (${d.simbolo}): ${a.userData.valenza} ${a.userData.valenza === 1 ? 'elettrone esterno' : 'elettroni esterni'}`, dimensione: 38 });
    }
    righe.push({ testo: 'Ogni atomo "vuole" il livello esterno pieno: 2 elettroni per l\'idrogeno, 8 per gli altri.', dimensione: 36, colore: '#9ecbff' });
    this.pannello.imposta(righe);
  }

  _pannelloFinale() {
    const c = CASI[this.caso], d = this.atomi.map((a) => a.userData.dati);
    const en = (x) => (x.elettronegativita == null ? 'n.d.' : virg(x.elettronegativita));
    const righe = [{ testo: `${c.nome} (${c.formula})`, dimensione: 60, grassetto: true, colore: '#ffd166' }];
    const t = {
      H2: ['Legame covalente.', 'Ogni idrogeno ha 1 elettrone esterno. Mettendo in comune la coppia, i due atomi "sentono" 2 elettroni ciascuno e il livello esterno è pieno. Gli elettroni condivisi girano attorno a tutti e due i nuclei.', 'I due atomi sono uguali: la coppia sta a metà strada.'],
      HCl: ['Legame covalente polare.', `H ha 1 elettrone esterno, Cl ne ha 7: condividono una coppia e ciascuno completa il livello. Il cloro è più elettronegativo (${en(d[0])} contro ${en(d[1])}) e attira di più la coppia.`, 'Così Cl è un po\' negativo (δ−) e H un po\' positivo (δ+).'],
      H2O: ['Legami covalenti polari.', `L'ossigeno ha 6 elettroni esterni e gli mancano 2: condivide una coppia con ciascun idrogeno. Restano 2 coppie "libere" sull'ossigeno.`, `L'ossigeno (${en(d[0])}) attira più dell'idrogeno (${en(d[1])}): δ− sull'ossigeno, δ+ sugli idrogeni. Per questo la molecola è piegata (104,5°) e polare.`],
      NaCl: ['Legame ionico.', `Na ha 1 elettrone esterno, Cl ne ha 7. Il sodio (${en(d[0])}) lo cede al cloro (${en(d[1])}): nascono Na⁺ (positivo) e Cl⁻ (negativo).`, 'Cariche opposte si attraggono: questa attrazione è il legame. Nel sale ci sono tantissimi ioni che formano un cristallo.'],
      MgO: ['Legame ionico.', `Mg ha 2 elettroni esterni, O ne ha 6. Il magnesio cede i suoi 2 elettroni all'ossigeno: nascono Mg²⁺ e O²⁻.`, 'Le cariche sono doppie, quindi l\'attrazione è molto forte: l\'ossido di magnesio fonde a temperatura altissima.'],
    }[this.caso];
    righe.push({ testo: t[0], dimensione: 48, grassetto: true, colore: '#6fe38a' });
    righe.push({ testo: t[1], dimensione: 37 });
    righe.push({ testo: t[2], dimensione: 37, colore: '#cfe2ff' });
    this.pannello.imposta(righe);
  }

  // ---------- Interazione ----------

  alAfferra() { this.suoni?.suono('prendi'); }

  /** Atomo rilasciato: se tutti gli altri sono vicini al primo, parte il legame. */
  alRilascio() {
    if (!this.attivo || this.legato || this.atomi.length < 2) return;
    const p0 = this.atomi[0].getWorldPosition(new THREE.Vector3());
    if (this.atomi.slice(1).every((a) => a.getWorldPosition(this._v).distanceTo(p0) < SOGLIA)) this._iniziaLegame(p0);
  }

  _iniziaLegame(ancora) {
    const c = CASI[this.caso];
    this.legato = true; this.fase = 'unisci'; this.t0 = performance.now();
    // Posizioni finali degli atomi attorno all'ancora (il primo atomo)
    const L = c.tipo === 'ionico' ? D_ION_INIZIO : D_COV;
    const rel = [];
    if (this.atomi.length === 3) {            // acqua: angolo di 104,5 gradi
      const m = 52.25 * Math.PI / 180;
      rel.push([0, 0], [-L * Math.sin(m), -L * Math.cos(m)], [L * Math.sin(m), -L * Math.cos(m)]);
    } else rel.push([-L / 2, 0], [L / 2, 0]);
    // Con 2 atomi: si mettono ai lati del punto medio di dove sono stati portati; con 3 (acqua): attorno al primo
    const centro = this.atomi.length === 2
      ? this.atomi[0].getWorldPosition(new THREE.Vector3()).add(this.atomi[1].getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5)
      : ancora;
    this.atomi.forEach((a, i) => {
      this.scena.attach(a); a.quaternion.identity();
      a.userData.da = a.position.clone();
      a.userData.a = new THREE.Vector3(centro.x + rel[i][0], centro.y + rel[i][1], ancora.z);
    });
    this._preparaElettroni(c);
    this.suoni?.suono('legame');
    this.pannello.imposta([{ testo: 'Gli atomi si avvicinano...', dimensione: 54, grassetto: true, colore: '#ffd166' }]);
  }

  _preparaElettroni(c) {
    const libero = (a) => this.elettroni.filter((e) => e.atomo === a && e.tipo === 'anello').sort((x, y) => y.slot - x.slot)[0];
    if (c.tipo === 'covalente') {
      for (const [i, j] of c.legami) {
        const A = this.atomi[i], B = this.atomi[j];
        const ea = libero(A); ea.tipo = 'cond';
        const eb = libero(B); eb.tipo = 'cond';
        const enA = A.userData.dati.elettronegativita ?? 2, enB = B.userData.dati.elettronegativita ?? 2;
        const diff = enB - enA;      // >0: la coppia si sposta verso B
        const w = 0.5 + Math.max(-0.18, Math.min(0.18, diff * 0.1));
        ea.legame = eb.legame = { A, B, w }; ea.fase = 0; eb.fase = Math.PI;
      }
    } else {
      this.trasf = [];
      for (const [da, a, q] of c.trasferimenti) {
        const D = this.atomi[da], A = this.atomi[a];
        for (let k = 0; k < q; k++) {
          const e = this.elettroni.filter((x) => x.atomo === D && x.tipo === 'anello').sort((x, y) => y.slot - x.slot)[0];
          e.tipo = 'passa'; e.verso = A; e.slotNuovo = A.userData.valenza + A.userData.usati; A.userData.usati++;
          this.trasf.push(e);
        }
        D.userData.carica = q; A.userData.carica = -q;
      }
    }
  }

  // ---------- Animazione ----------

  /** Posizione (mondo) di uno slot dell'anello di un atomo, tenendo conto della rotazione dell'anello. */
  _slot(atomo, slot, fuori) {
    const phi = this.rot + slot * Math.PI * 2 / atomo.userData.slots;
    atomo.getWorldPosition(fuori); atomo.getWorldQuaternion(this._q);
    return fuori.add(this._w.set(Math.cos(phi) * R, Math.sin(phi) * R, 0).applyQuaternion(this._q));
  }

  aggiorna(t) {
    if (!this.attivo) return;
    const ora = performance.now();
    this.rot = t * 0.5;
    for (const a of this.atomi) a.userData.anello.rotation.z = this.rot;
    this._passo(ora);
    // Posizione degli elettroni
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    for (const e of this.elettroni) {
      this._slot(e.atomo, e.slot, p);
      if (e.tipo === 'cond') {
        const { A, B, w } = e.legame;
        const pa = A.getWorldPosition(this._v).clone(), pb = B.getWorldPosition(this._v).clone();
        const u = pb.clone().sub(pa); const len = u.length() || 1; u.divideScalar(len);
        const n = new THREE.Vector3(0, 1, 0); n.addScaledVector(u, -n.dot(u)); if (n.length() < 0.1) n.set(1, 0, 0); n.normalize();
        const M = pa.clone().lerp(pb, w);
        const th = t * 2.4 + e.fase;
        q.copy(M).addScaledVector(u, Math.cos(th) * (len * 0.5 + 0.03)).addScaledVector(n, Math.sin(th) * 0.045);
        e.mesh.position.copy(p).lerp(q, e.mix);
      } else if (e.tipo === 'passa') {
        this._slot(e.verso, e.slotNuovo, q);
        e.mesh.position.copy(p).lerp(q, e.mix).addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(e.mix * Math.PI) * 0.06);   // piccolo arco
      } else e.mesh.position.copy(p);
    }
  }

  /** Avanza le fasi dell'animazione: unisci -> elettroni -> (avvicina, solo ionico) -> fine. */
  _passo(ora) {
    if (this.fase === 'unisci') {
      const s = ease(Math.min(1, (ora - this.t0) / 900));
      for (const a of this.atomi) a.position.lerpVectors(a.userData.da, a.userData.a, s);
      if (s >= 1) { this.fase = 'elettroni'; this.t0 = ora; }
    } else if (this.fase === 'elettroni') {
      const s = ease(Math.min(1, (ora - this.t0) / 2400));
      for (const e of this.elettroni) if (e.tipo === 'cond' || e.tipo === 'passa') e.mix = s;
      const ionico = CASI[this.caso].tipo === 'ionico';
      if (ionico) for (const a of this.atomi) if (a.userData.carica > 0) { a.userData.guscio.scale.setScalar(1 - 0.35 * s); a.userData.anello.visible = s < 0.7; }
      if (s >= 1) {
        for (const e of this.trasf) { e.atomo = e.verso; e.slot = e.slotNuovo; e.tipo = 'anello'; e.mix = 0; }   // l'elettrone ora fa parte dell'altro atomo
        this.fase = ionico ? 'avvicina' : 'fine'; this.t0 = ora;
        if (ionico) this._ioni(); else { this._polarita(); this._pannelloFinale(); this.suoni?.suono('successo'); }
      }
    } else if (this.fase === 'avvicina') {
      const s = ease(Math.min(1, (ora - this.t0) / 900));
      const A = this.atomi[0], B = this.atomi[1];
      const mid = A.userData.a.clone().add(B.userData.a).multiplyScalar(0.5), u = B.userData.a.clone().sub(A.userData.a).normalize();
      const d = D_ION_INIZIO + (D_ION - D_ION_INIZIO) * s;
      A.position.copy(mid).addScaledVector(u, -d / 2); B.position.copy(mid).addScaledVector(u, d / 2);
      if (s >= 1) { this.fase = 'fine'; this._pannelloFinale(); this.suoni?.suono('successo'); }
    }
  }

  /** Colora gli ioni e scrive le cariche. */
  _ioni() {
    const sup = { 1: '', 2: '²' };
    for (const a of this.atomi) {
      const q = a.userData.carica, s = a.userData.simbolo;
      a.userData.guscio.material.color.setHex(q > 0 ? 0x4da3ff : 0xff6b6b);
      a.userData.guscio.material.opacity = 0.3;
      if (q > 0) this._cambiaEtichetta(a, `${s}${sup[q]}⁺`, '#8cc4ff');
      else { a.userData.slots = 8; this._cambiaEtichetta(a, `${s}${sup[-q]}⁻`, '#ff9c9c'); }
    }
  }

  /** Nei legami polari scrive δ+ / δ- sugli atomi. */
  _polarita() {
    if (this.caso === 'H2') return;
    const meno = this.atomi[0];      // Cl e O (primo atomo) sono i piu' elettronegativi
    this._cambiaEtichetta(meno, `${meno.userData.simbolo} δ⁻`, '#ff9c9c');
    for (const a of this.atomi.slice(1)) this._cambiaEtichetta(a, `${a.userData.simbolo} δ⁺`, '#8cc4ff');
  }
}
