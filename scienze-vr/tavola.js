// Modulo 2 di scienze-vr: "Tavola periodica".
// Tavola grande in 3D (118 caselle) davanti allo studente. Si punta un elemento e si preme il grilletto (o si clicca col mouse):
// compaiono le informazioni di base e un modello semplice dell'atomo (nucleo, livelli, elettroni).
import * as THREE from 'three';
import { PannelloTesto } from 'comune/pannello.js';
import { mescola } from './molecole.js';

const PASSO = 0.105;          // distanza tra i centri delle caselle (m)
const LATO = 0.098;           // lato della casella (m)
const POS = new THREE.Vector3(0, 0, -1.35);   // la tavola sta davanti allo studente, a 1,35 m

// Colori per categoria (scelta grafica mia: tinte ben distinguibili)
const COLORI = {
  'metallo alcalino': '#e8696b', 'metallo alcalino-terroso': '#f0a15a', 'metallo di transizione': '#e6cf5e',
  'metallo post-transizione': '#8fcf7a', 'semimetallo': '#4fc3a8', 'non metallo': '#5aa9e6',
  'gas nobile': '#a58be0', 'lantanide': '#e58bc0', 'attinide': '#c76f9e',
};
// Descrizioni delle famiglie (testi scritti da Claude per questo programma didattico: da far controllare a un insegnante)
const FAMIGLIE = {
  'metallo alcalino': 'Gruppo 1. Metalli morbidi e molto reattivi: hanno 1 elettrone esterno e lo cedono facilmente (es. il sodio reagisce con l\'acqua).',
  'metallo alcalino-terroso': 'Gruppo 2. Metalli abbastanza reattivi con 2 elettroni esterni (es. calcio e magnesio).',
  'metallo di transizione': 'Metalli duri e buoni conduttori (ferro, rame, oro...). Formano molti composti colorati.',
  'metallo post-transizione': 'Metalli piu\' teneri e meno reattivi (alluminio, stagno, piombo).',
  'semimetallo': 'Hanno proprieta\' intermedie tra metalli e non metalli (silicio, germanio): sono la base dei chip.',
  'non metallo': 'Non conducono bene calore ed elettricita\'. Comprendono idrogeno, carbonio, azoto, ossigeno e gli alogeni.',
  'gas nobile': 'Gruppo 18. Hanno il livello esterno completo, quindi quasi non reagiscono (elio, neon, argon...).',
  'lantanide': 'Le "terre rare": metalli lucenti, molto usati in magneti e schermi.',
  'attinide': 'Metalli pesanti, spesso radioattivi (uranio, plutonio).',
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
    this.famiglia = -1;            // indice della famiglia evidenziata (-1 = nessuna)
    this.sfida = null;             // { round, totale, punti, domande, tentativi, finita }
    this.alFineSfida = null;       // (punti, massimo) chiamata a fine sfida
    this._timer = null;
  }

  // ---------- Famiglie: evidenzia una categoria e spiega ----------

  /** Passa alla famiglia successiva (poi di nuovo a "tutte"). */
  prossimaFamiglia() {
    const nomi = Object.keys(FAMIGLIE);
    this.famiglia = this.famiglia + 1 >= nomi.length ? -1 : this.famiglia + 1;
    this._evidenzia(this.famiglia < 0 ? null : nomi[this.famiglia]);
    if (this.famiglia < 0) { if (this.selezionata) this.seleziona(this.selezionata); return null; }
    const cat = nomi[this.famiglia], n = this.dati.filter((e) => e.categoria.replace(' (previsto)', '') === cat).length;
    this.pannello.imposta([
      { testo: cat.charAt(0).toUpperCase() + cat.slice(1), dimensione: 68, grassetto: true, colore: colore(cat) },
      { testo: `${n} elementi in questa famiglia (le altre caselle sono scure).`, dimensione: 42, colore: '#9ecbff' },
      { testo: FAMIGLIE[cat], dimensione: 44 },
      { testo: 'Premi di nuovo "Famiglie" per la prossima.', dimensione: 36, colore: '#9ecbff' },
    ]);
    return cat;
  }
  _evidenzia(cat) {
    for (const c of this.celle) {
      const ok = !cat || c.userData.elemento.categoria.replace(' (previsto)', '') === cat;
      c.material.color.setHex(ok ? 0xffffff : 0x303846);
    }
  }

  // ---------- Sfida: 5 domande da risolvere toccando le caselle ----------
  avviaSfida(totale = 5) {
    this.famiglia = -1; this._evidenzia(null);
    const base = this.dati.filter((e) => e.numero <= 54);
    const cats = Object.keys(FAMIGLIE).filter((c) => !['lantanide', 'attinide'].includes(c));
    const tipi = mescola(['nome', 'numero', 'simbolo', 'famiglia', 'nome', 'famiglia']).slice(0, totale);
    const domande = tipi.map((t) => {
      const e = base[Math.floor(Math.random() * base.length)];
      if (t === 'nome') return { testo: `Tocca l'elemento: ${e.nome}`, ok: (x) => x.numero === e.numero };
      if (t === 'numero') return { testo: `Tocca l'elemento con numero atomico ${e.numero}`, ok: (x) => x.numero === e.numero };
      if (t === 'simbolo') return { testo: `Tocca l'elemento con simbolo ${e.simbolo}`, ok: (x) => x.numero === e.numero };
      const cat = cats[Math.floor(Math.random() * cats.length)];
      return { testo: `Tocca un elemento della famiglia: ${cat}`, ok: (x) => x.categoria.replace(' (previsto)', '') === cat };
    });
    this.sfida = { round: 0, totale: domande.length, punti: 0, domande, tentativi: 0, finita: false, bloccata: false };
    this._mostraDomanda();
  }
  fermaSfida() { clearTimeout(this._timer); this.sfida = null; if (this.selezionata) this.seleziona(this.selezionata); }
  _mostraDomanda(extra = null) {
    const sf = this.sfida;
    if (sf.finita) {
      const max = sf.totale * 2, st = sf.punti >= max * 0.9 ? 3 : sf.punti >= max * 0.6 ? 2 : sf.punti >= max * 0.3 ? 1 : 0;
      this.pannello.imposta([
        { testo: 'Sfida finita!', dimensione: 70, grassetto: true, colore: '#ffd166' },
        { testo: `Punti: ${sf.punti} su ${max}`, dimensione: 60, grassetto: true },
        { testo: '★'.repeat(st) + '☆'.repeat(3 - st), dimensione: 100, colore: '#ffd166' },
        { testo: 'Premi "Sfida" per rifarla.', dimensione: 40, colore: '#9ecbff' },
      ]);
      return;
    }
    const righe = [
      { testo: `Domanda ${sf.round + 1} di ${sf.totale} · punti ${sf.punti}`, dimensione: 44, colore: '#ffd166', grassetto: true },
      { testo: sf.domande[sf.round].testo, dimensione: 60, grassetto: true },
    ];
    if (extra) righe.push(extra);
    this.pannello.imposta(righe);
  }
  /** Chiamata a ogni selezione: in sfida controlla la risposta e dice se mostrare le informazioni dell'elemento. */
  _rispondi(cella) {
    const sf = this.sfida;
    if (!sf || sf.finita || sf.bloccata) return !sf?.bloccata;
    const e = cella.userData.elemento;
    if (sf.domande[sf.round].ok(e)) {
      sf.punti += sf.tentativi === 0 ? 2 : 1;
      this.suoni?.suono('successo');
      sf.bloccata = true;
      this._mostraDomanda({ testo: `Giusto! È ${e.nome} (${e.simbolo}).`, dimensione: 50, colore: '#6fe38a', grassetto: true });
      this._timer = setTimeout(() => { sf.round++; sf.tentativi = 0; sf.bloccata = false; if (sf.round >= sf.totale) { sf.finita = true; this.alFineSfida?.(sf.punti, sf.totale * 2); } this._mostraDomanda(); }, 2200);
    } else {
      sf.tentativi++;
      this.suoni?.suono('errore');
      if (sf.tentativi >= 2) {   // secondo errore: si passa oltre senza punti
        sf.bloccata = true;
        this._mostraDomanda({ testo: `No, hai scelto ${e.nome}. Si passa alla prossima.`, dimensione: 46, colore: '#ff6b6b' });
        this._timer = setTimeout(() => { sf.round++; sf.tentativi = 0; sf.bloccata = false; if (sf.round >= sf.totale) { sf.finita = true; this.alFineSfida?.(sf.punti, sf.totale * 2); } this._mostraDomanda(); }, 2200);
      } else this._mostraDomanda({ testo: `No, quello è ${e.nome} (${e.simbolo}). Riprova!`, dimensione: 46, colore: '#ff6b6b' });
    }
    return false;   // in sfida non si mostrano le informazioni (rivelerebbero la risposta)
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
    if (this.sfida && this._rispondi(cella) === false) { this._costruisciAtomo(cella.userData.elemento); return; }
    if (this.famiglia >= 0) { this.famiglia = -1; this._evidenzia(null); }   // scegliendo un elemento si esce dalla vista famiglie
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
    clearTimeout(this._timer); this.sfida = null; this.famiglia = -1; this._evidenzia(null);
    this.gruppo.visible = si;
    if (si && !this.selezionata) this.seleziona(this.celle[0]);   // parte da H
  }

  /** Da chiamare a ogni fotogramma: fa girare gli elettroni. t in secondi. */
  aggiorna(t) {
    if (!this.gruppo.visible) return;
    for (const g of this.livelli) g.rotation.z = t * g.userData.velocita;
  }
}
