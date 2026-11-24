// Modulo 3 di scienze-vr: "DNA".
// Un filamento di DNA e' gia' costruito (con le basi A, T, C, G). Lo studente afferra i "pezzi" del
// filamento complementare e li appoggia sulla base giusta: A con T, C con G.
//   - pezzo giusto: si aggancia, compaiono i legami a idrogeno (2 per A-T, 3 per C-G);
//   - pezzo sbagliato: viene rifiutato e torna sul vassoio, con la spiegazione;
//   - quando tutte le coppie sono giuste la doppia elica e' completa e comincia a ruotare.
// Modello semplificato: i due filamenti sono sfasati di 150 gradi (come nel DNA reale, dove ci sono
// solco maggiore e minore) e le dimensioni sono ingrandite.
import * as THREE from 'three';

const N = 12;                        // coppie di basi
const SCALA = 0.17;                  // metri per ogni nanometro reale (ingrandimento didattico)
const SFASAMENTO = 150 * Math.PI / 180;   // angolo tra i due filamenti
const DISTANZA_AGGANCIO = 0.14;      // m: distanza massima dallo slot per agganciare un pezzo

export class ModuloDna {
  /** @param scena, dati = dati/dna.json, pannello = PannelloTesto per il riscontro */
  constructor(scena, dati, pannello) {
    this.scena = scena; this.dati = dati; this.pannello = pannello;
    this.basi = dati.basi;
    const g = dati.dna_forma_B;
    this.R = (g.diametro_nm / 2) * SCALA;                      // raggio dell'elica
    this.passo = g.passo_per_coppia_nm * SCALA;                // salita per coppia
    this.torsione = 2 * Math.PI / g.coppie_per_giro;           // rotazione per coppia
    this.helice = new THREE.Group();                           // contiene la parte fissa (e i pezzi agganciati)
    this.helice.position.set(0, 1.2, -0.95);
    this.helice.visible = false;
    this.tenuta = false;               // true mentre l'elica e' in mano a un controller (non deve ruotare da sola)
    scena.add(this.helice);
    this.pezzi = [];                    // pezzi afferrabili (figli della scena o dell'elica)
    this.slot = [];
    this.avviso = null;
    this.suoni = null;                 // oggetto Audio (opzionale), assegnato dall'app
    this.geoCil = new THREE.CylinderGeometry(1, 1, 1, 8);
    this.geoSfera = new THREE.SphereGeometry(1, 14, 10);
    this.matDorsale = new THREE.MeshStandardMaterial({ color: 0x8fa3b8, roughness: 0.5 });
  }

  get afferrabili() { return this.pezzi; }

  // ---------- Costruzione ----------

  /** Nuovo gioco: sequenza casuale di N basi e pezzi complementari mescolati sul vassoio. */
  avvia() {
    this.pulisci();
    this.riportaElica(); this.helice.visible = true;
    const lettere = Object.keys(this.basi);
    this.sequenza = Array.from({ length: N }, () => lettere[Math.floor(Math.random() * 4)]);

    // Punti dei due filamenti (coordinate locali dell'elica)
    for (let i = 0; i < N; i++) {
      const th = i * this.torsione;
      const p1 = new THREE.Vector3(this.R * Math.cos(th), i * this.passo, this.R * Math.sin(th));
      const p2 = new THREE.Vector3(this.R * Math.cos(th + SFASAMENTO), i * this.passo, this.R * Math.sin(th + SFASAMENTO));
      const m = p1.clone().add(p2).multiplyScalar(0.5);   // punto di incontro delle due basi
      this.slot.push({ p1, p2, m, pezzo: null, legamiH: null, collegamento: null, base: this.sequenza[i], segnaposto: null });
    }
    // Filamento fisso: dorsale + basi
    this.slot.forEach((s, i) => {
      const sf = new THREE.Mesh(this.geoSfera, this.matDorsale); sf.scale.setScalar(0.02); sf.position.copy(s.p1);
      this.helice.add(sf);
      if (i > 0) this.helice.add(this._cilindro(this.slot[i - 1].p1, s.p1, 0.008, this.matDorsale));
      this.helice.add(this._asta(s.p1, s.m, s.base));
      // Segnaposto trasparente dove andra' il pezzo complementare
      s.segnaposto = new THREE.Mesh(this.geoSfera, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
      s.segnaposto.scale.setScalar(0.025); s.segnaposto.position.copy(s.p2);
      this.helice.add(s.segnaposto);
    });

    // Pezzi complementari, in ordine casuale, su 3 file davanti allo studente
    const compl = this.sequenza.map((b) => this.basi[b].complementare);
    for (let i = compl.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [compl[i], compl[j]] = [compl[j], compl[i]]; }
    compl.forEach((b, k) => {
      const pezzo = this._creaPezzo(b);
      const riga = Math.floor(k / 4), col = k % 4;
      pezzo.position.set(-0.5 + col * 0.26, 0.8 + riga * 0.16, -0.5 - riga * 0.05);
      pezzo.userData.casa = pezzo.position.clone();
      this.scena.add(pezzo);
      this.pezzi.push(pezzo);
    });
    this.aggiornaPannello();
  }

  /** Rimette l'elica nella posizione iniziale (comando di ricentramento o nuova sequenza). */
  riportaElica() {
    if (this.helice.parent === this.scena) {
      this.helice.position.set(0, 1.2, -0.95); this.helice.rotation.set(0, 0, 0); this.helice.scale.setScalar(1);
    }
  }

  /** Blocco "elica" per la presa laterale: tutto il filamento con i pezzi agganciati. */
  blocco(colpito) {
    if (!this.helice.visible) return null;
    for (let o = colpito; o; o = o.parent) {
      if (o === this.helice) return { oggetto: this.helice, scalabile: false, fine: () => { this.tenuta = false; }, inizio: () => { this.tenuta = true; } };
    }
    return null;
  }

  pulisci() {
    for (const p of this.pezzi) { p.parent?.remove(p); }
    this.pezzi = [];
    for (const f of [...this.helice.children]) this.helice.remove(f);
    this.slot = []; this.avviso = null; this.helice.visible = false;
  }

  _cilindro(a, b, raggio, mat) {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(this.geoCil, mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    m.scale.set(raggio, d.length(), raggio);
    return m;
  }

  /** Asta colorata della base, dalla dorsale `da` fino al punto di incontro `a`, con la lettera. */
  _asta(da, a, lettera) {
    const dati = this.basi[lettera];
    const g = new THREE.Group();
    // Le purine (A, G) hanno due anelli: le disegniamo piu' spesse delle pirimidine (C, T)
    const raggio = dati.tipo === 'purina' ? 0.016 : 0.010;
    g.add(this._cilindro(da, a, raggio, new THREE.MeshStandardMaterial({ color: dati.colore, roughness: 0.4 })));
    const sprite = this._etichetta(lettera);
    sprite.position.copy(da).lerp(a, 0.6).add(new THREE.Vector3(0, 0.035, 0));
    g.add(sprite);
    return g;
  }

  _etichetta(lettera) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.font = 'bold 100px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 12; x.strokeStyle = '#000'; x.strokeText(lettera, 64, 70);
    x.fillStyle = '#fff'; x.fillText(lettera, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
    s.scale.setScalar(0.05); s.renderOrder = 10;
    s.raycast = () => {};   // le etichette non si puntano (in VR il raycaster non ha camera: gli Sprite darebbero errore)
    return s;
  }

  /** Un pezzo del filamento complementare: sfera della dorsale (origine) + asta verso +x. */
  _creaPezzo(lettera) {
    const dati = this.basi[lettera];
    const lungh = this.slot[0].p1.distanceTo(this.slot[0].m);     // stessa lunghezza dell'asta fissa
    const g = new THREE.Group();
    const sf = new THREE.Mesh(this.geoSfera, this.matDorsale); sf.scale.setScalar(0.02);
    g.add(sf);
    const raggio = dati.tipo === 'purina' ? 0.016 : 0.010;
    const asta = new THREE.Mesh(this.geoCil, new THREE.MeshStandardMaterial({ color: dati.colore, roughness: 0.4 }));
    asta.scale.set(raggio, lungh, raggio);
    asta.rotation.z = -Math.PI / 2;           // asse lungo +x
    asta.position.x = lungh / 2;
    g.add(asta);
    const e = this._etichetta(lettera); e.position.set(lungh * 0.6, 0.035, 0); g.add(e);
    // Area di presa generosa (invisibile): facilita afferrare col controller
    const presa = new THREE.Mesh(new THREE.SphereGeometry(0.06), new THREE.MeshBasicMaterial({ visible: false }));
    presa.position.x = lungh / 2; g.add(presa);
    g.userData = { base: lettera, slot: null, lungh };
    return g;
  }

  // ---------- Interazione ----------

  alAfferra(pezzo) {
    const i = pezzo.userData.slot;
    if (i != null) {                 // il pezzo era agganciato: lo si stacca
      if (pezzo.parent === this.helice) this.scena.attach(pezzo);   // (in VR e' gia' attaccato al controller)
      this._liberaSlot(i);
    }
    this.avviso = null;
    if (i == null) this.suoni?.suono('prendi');
    this.aggiornaPannello();
  }

  alRilascio(pezzo) {
    // Slot libero piu' vicino alla sfera della dorsale del pezzo
    const pos = this.helice.worldToLocal(pezzo.getWorldPosition(new THREE.Vector3()));
    let migliore = -1, dMin = DISTANZA_AGGANCIO;
    this.slot.forEach((s, i) => {
      const d = pos.distanceTo(s.p2);
      if (!s.pezzo && d < dMin) { dMin = d; migliore = i; }
    });
    if (migliore >= 0) {
      const s = this.slot[migliore], b = pezzo.userData.base;
      if (this.basi[s.base].complementare === b) this._aggancia(pezzo, migliore);
      else {
        this.avviso = { testo: `No: ${this.basi[s.base].nome} (${s.base}) si appaia con ${this.basi[s.base].complementare} (${this.basi[this.basi[s.base].complementare].nome}), non con ${b} (${this.basi[b].nome}).`, colore: '#ff6b6b' };
        this.suoni?.suono('errore');
        pezzo.position.copy(pezzo.userData.casa);   // torna sul vassoio
        pezzo.quaternion.identity();
      }
    }
    this.aggiornaPannello();
  }

  _aggancia(pezzo, i) {
    const s = this.slot[i];
    this.helice.attach(pezzo);
    pezzo.position.copy(s.p2);
    // Orienta l'asta verso il punto di incontro, con "su" lungo l'asse dell'elica
    const x = new THREE.Vector3().subVectors(s.m, s.p2).normalize();
    const su = new THREE.Vector3(0, 1, 0); su.addScaledVector(x, -su.dot(x)).normalize();
    pezzo.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, su, new THREE.Vector3().crossVectors(x, su)));
    pezzo.userData.slot = i; s.pezzo = pezzo; s.segnaposto.visible = false;
    // Legami a idrogeno: 2 per A-T, 3 per C-G, come puntini bianchi lungo l'asse dell'elica
    const n = this.basi[s.base].legami_idrogeno;
    s.legamiH = new THREE.Group();
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(this.geoSfera, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      p.scale.setScalar(0.007); p.position.copy(s.m).add(new THREE.Vector3(0, (k - (n - 1) / 2) * 0.018, 0));
      s.legamiH.add(p);
    }
    this.helice.add(s.legamiH);
    // Dorsale del secondo filamento: collega con i pezzi vicini gia' agganciati
    for (const j of [i - 1, i + 1]) {
      const t = this.slot[j];
      if (t && t.pezzo) {
        const k = Math.min(i, j);
        const c = this._cilindro(this.slot[k].p2, this.slot[k + 1].p2, 0.008, this.matDorsale);
        this.helice.add(c); this.slot[k].collegamento = c;
      }
    }
    this.suoni?.suono(this.completa ? 'successo' : 'aggancio');
    this.avviso = { testo: `Giusto! ${s.base} e ${pezzo.userData.base} formano ${n} legami a idrogeno.`, colore: '#6fe38a' };
  }

  _liberaSlot(i) {
    const s = this.slot[i];
    s.pezzo.userData.slot = null; s.pezzo = null; s.segnaposto.visible = true;
    if (s.legamiH) { this.helice.remove(s.legamiH); s.legamiH = null; }
    for (const k of [i - 1, i]) {     // collegamenti della dorsale che toccavano questo slot
      const l = this.slot[k]?.collegamento;
      if (l) { this.helice.remove(l); this.slot[k].collegamento = null; }
    }
    this.helice.rotation.y = 0;
  }

  get completa() { return this.slot.length > 0 && this.slot.every((s) => s.pezzo); }

  // ---------- Pannello e ciclo ----------

  aggiornaPannello() {
    const fatte = this.slot.filter((s) => s.pezzo).length;
    const righe = [
      { testo: 'Completa la doppia elica', dimensione: 56, grassetto: true },
      { testo: 'Appoggia ogni pezzo sulla base che gli si appaia: A con T, C con G.', dimensione: 42, colore: '#9ecbff' },
      { testo: `Coppie corrette: ${fatte} su ${N}`, dimensione: 48, grassetto: true },
    ];
    if (this.completa) {
      righe.push({ testo: 'Doppia elica completa, bravo!', dimensione: 52, grassetto: true, colore: '#6fe38a' });
      righe.push({ testo: 'A-T: 2 legami a idrogeno · C-G: 3 legami a idrogeno. Le basi grosse (A, G) sono purine, quelle sottili (C, T) pirimidine.', dimensione: 38 });
    } else if (this.avviso) righe.push({ testo: this.avviso.testo, dimensione: 42, colore: this.avviso.colore });
    this.pannello.imposta(righe);
  }

  /** Da chiamare a ogni fotogramma: a elica completa, la fa girare lentamente. t in secondi. */
  aggiorna(t) {
    if (this.completa && !this.tenuta) this.helice.rotation.y = t * 0.5;
  }
}
