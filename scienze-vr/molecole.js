// Modulo 1 di scienze-vr: "Costruisci la molecola".
// Atomi 3D che si afferrano; rilasciandoli vicino a un altro atomo si forma un legame.
// Regole didattiche:
//  - ogni atomo ha una valenza (numero di legami che puo' fare), letta da dati/elementi.json;
//  - quando due atomi si legano, il legame ha ordine = il massimo possibile
//    (min tra i legami liberi dei due atomi): C e O danno C=O, H e O danno H-O;
//  - se uno dei due atomi e' gia' completo il legame viene rifiutato ("troppi legami");
//  - tirando un atomo lontano dal compagno e rilasciandolo il legame si rompe.
import * as THREE from 'three';

const SCALA_RAGGIO = 0.0012;      // metri per ogni picometro di raggio covalente (ingrandimento didattico)
const FATTORE_LEGAME = 1.35;      // lunghezza legame = somma dei raggi * fattore
const FATTORE_ROTTURA = 1.6;      // oltre questa distanza (in lunghezze di legame) il legame si rompe
const MARGINE_AGGANCIO = 0.09;    // m: distanza oltre la lunghezza del legame entro cui due atomi si legano
const ORDINE_FORMULA = ['C', 'N', 'H', 'O']; // convenzione di scrittura: CH4, NH3, H2O, CO2
const PEDICI = '₀₁₂₃₄₅₆₇₈₉';

export class ModuloMolecole {
  /**
   * @param scena       THREE.Scene
   * @param elementi    contenuto di dati/elementi.json
   * @param molecoleNote contenuto di dati/molecole.json
   * @param pannello    PannelloTesto su cui scrivere il riscontro
   */
  constructor(scena, elementi, molecoleNote, pannello) {
    this.scena = scena; this.elementi = elementi; this.note = molecoleNote; this.pannello = pannello;
    this.atomi = [];
    this.legami = [];            // { a, b, ordine, gruppo }
    this.obiettivo = 'H2O';
    this.avviso = null;          // messaggio temporaneo { testo, fino }
    this.ultimo = null;          // ultimo atomo toccato: decide quale molecola descrivere
    this.geoSfera = new THREE.SphereGeometry(1, 24, 16);
    this.geoCilindro = new THREE.CylinderGeometry(1, 1, 1, 10);
  }

  /** Atomi afferrabili (usati dai gestori di input). */
  get afferrabili() { return this.atomi; }

  /** Posiziona gli atomi di partenza per un obiettivo, ad es. 'H2O' = O al centro e due H ai lati. */
  avvia(simboli, centro = new THREE.Vector3(0, 1.2, -0.7), obiettivo = this.obiettivo) {
    this.pulisci();
    if (!simboli) simboli = this.note[obiettivo].atomi_iniziali;   // elenco da dati/molecole.json
    this.obiettivo = obiettivo;
    const n = simboli.length;
    simboli.forEach((s, i) => {
      const x = (i - (n - 1) / 2) * Math.min(0.32, 1.1 / n);
      const y = (i % 2) * 0.12;   // sfalsati in altezza per non sovrapporsi
      this.creaAtomo(s, centro.clone().add(new THREE.Vector3(x, y, 0)));
    });
    this.aggiornaPannello();
  }

  pulisci() {
    for (const l of this.legami) l.gruppo.parent?.remove(l.gruppo);   // parent: potrebbero essere dentro un blocco tenuto in mano
    for (const a of this.atomi) a.parent?.remove(a);
    this.atomi = []; this.legami = []; this.ultimo = null; this.avviso = null;
  }

  creaAtomo(simbolo, posizione) {
    const dati = this.elementi[simbolo];
    const raggio = dati.raggio_covalente_pm * SCALA_RAGGIO;
    const g = new THREE.Group();
    const sfera = new THREE.Mesh(this.geoSfera, new THREE.MeshStandardMaterial({ color: dati.colore_cpk, roughness: 0.5 }));
    sfera.scale.setScalar(raggio);
    g.add(sfera);
    // Etichetta con il simbolo, sempre rivolta verso chi guarda
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._testoSimbolo(simbolo, dati.colore_cpk), depthTest: false }));
    sprite.scale.setScalar(raggio * 1.2);
    sprite.renderOrder = 10;
    sprite.raycast = () => {};   // le etichette non si puntano (in VR il raycaster non ha camera: gli Sprite darebbero errore)
    g.add(sprite);
    g.position.copy(posizione);
    g.userData = { simbolo, valenza: dati.valenza, raggio, esterni: dati.elettroni_esterni };
    this.scena.add(g);
    this.atomi.push(g);
    return g;
  }

  _testoSimbolo(testo, colore) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.font = 'bold 84px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    // Testo scuro su atomi chiari e viceversa
    const col = new THREE.Color(colore);
    x.fillStyle = (col.r * 0.3 + col.g * 0.59 + col.b * 0.11) > 0.55 ? '#111' : '#fff';
    x.fillText(testo, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /**
   * Blocco "molecola intera" per la presa laterale: se la parte colpita e' un atomo legato (o un legame),
   * restituisce un gruppo temporaneo con tutta la molecola. Gli atomi non legati si afferrano da soli (null).
   */
  blocco(colpito) {
    let atomo = null;
    for (let o = colpito; o && !atomo; o = o.parent) {
      if (this.atomi.includes(o)) atomo = o;
      else { const l = this.legami.find((x) => x.gruppo === o); if (l) atomo = l.a; }
    }
    if (!atomo) return null;
    const molecola = this.molecolaDi(atomo);
    if (molecola.length < 2) return null;
    const centro = molecola.reduce((s, a) => s.add(a.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).divideScalar(molecola.length);
    const tenuta = new THREE.Group();
    tenuta.position.copy(centro);
    this.scena.add(tenuta);
    for (const a of molecola) tenuta.attach(a);
    for (const l of this.legami) if (molecola.includes(l.a)) tenuta.attach(l.gruppo);
    return {
      oggetto: tenuta, scalabile: false,
      fine: () => {   // ridà atomi e legami alla scena (solo quelli ancora esistenti) e toglie il gruppo
        for (const f of [...tenuta.children]) this.scena.attach(f);
        this.scena.remove(tenuta);
        this.aggiornaPannello();
      },
    };
  }

  // ---------- Legami ----------

  legamiLiberi(atomo) {
    const usati = this.legami.reduce((s, l) => s + ((l.a === atomo || l.b === atomo) ? l.ordine : 0), 0);
    return atomo.userData.valenza - usati;
  }

  lunghezzaLegame(a, b, ordine = 1) {
    return (a.userData.raggio + b.userData.raggio) * FATTORE_LEGAME * (1 - 0.08 * (ordine - 1));
  }

  legamiDi(atomo) { return this.legami.filter((l) => l.a === atomo || l.b === atomo); }

  _creaLegame(a, b, ordine) {
    const gruppo = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6 });
    for (let i = 0; i < ordine; i++) {
      const cil = new THREE.Mesh(this.geoCilindro, mat);
      cil.scale.set(0.009, 1, 0.009);                       // scala y viene data dal gruppo
      cil.position.x = (i - (ordine - 1) / 2) * 0.03;       // legami doppi/tripli: bastoncini paralleli
      gruppo.add(cil);
    }
    this.scena.add(gruppo);
    this.legami.push({ a, b, ordine, gruppo });
  }

  _rimuoviLegame(l) {
    this.scena.remove(l.gruppo);
    this.legami.splice(this.legami.indexOf(l), 1);
  }

  /** Da chiamare a ogni fotogramma: allunga/orienta i bastoncini tra gli atomi. */
  aggiorna() {
    const su = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    for (const l of this.legami) {
      const pa = l.a.getWorldPosition(new THREE.Vector3());
      const pb = l.b.getWorldPosition(new THREE.Vector3());
      d.subVectors(pb, pa);
      const lung = d.length() || 0.001;
      l.gruppo.position.copy(pa).addScaledVector(d, 0.5);
      l.gruppo.quaternion.setFromUnitVectors(su, d.divideScalar(lung));
      l.gruppo.scale.set(1, lung, 1);
    }
    if (this.avviso && performance.now() > this.avviso.fino) { this.avviso = null; this.aggiornaPannello(); }
  }

  // ---------- Interazione ----------

  /** Chiamata quando un atomo viene afferrato. */
  alAfferra(atomo) { this.ultimo = atomo; this.avviso = null; this.aggiornaPannello(); }

  /** Chiamata quando un atomo viene rilasciato: decide rotture, agganci e riscontro. */
  alRilascio(atomo) {
    this.ultimo = atomo;
    const pos = atomo.position;   // l'atomo e' tornato figlio della scena: posizione = mondo

    // 1. Legami esistenti: troppo tirati -> si rompono; altrimenti l'atomo torna alla distanza giusta.
    for (const l of this.legamiDi(atomo)) {
      const altro = l.a === atomo ? l.b : l.a;
      const lung = this.lunghezzaLegame(atomo, altro, l.ordine);
      const dir = new THREE.Vector3().subVectors(pos, altro.position);
      if (dir.length() > lung * FATTORE_ROTTURA) this._rimuoviLegame(l);
      else if (dir.length() > 1e-4) pos.copy(altro.position).addScaledVector(dir.normalize(), lung);
    }

    // 2. Nuovo legame: l'atomo piu' vicino, non gia' legato a questo, entro la distanza di aggancio.
    let candidato = null, dMin = Infinity;
    for (const altro of this.atomi) {
      if (altro === atomo || this.legamiDi(atomo).some((l) => l.a === altro || l.b === altro)) continue;
      const d = pos.distanceTo(altro.position);
      if (d >= this.lunghezzaLegame(atomo, altro) + MARGINE_AGGANCIO) continue;
      // Si preferiscono gli atomi con legami ancora liberi (contano 1 m in meno): uno completo vince solo se e' l'unico vicino.
      const punteggio = d + (this.legamiLiberi(altro) > 0 ? 0 : 1);
      if (punteggio < dMin) { dMin = punteggio; candidato = altro; }
    }
    if (candidato) {
      const liberiA = this.legamiLiberi(atomo), liberiB = this.legamiLiberi(candidato);
      if (liberiA <= 0 || liberiB <= 0) {
        const pieno = liberiA <= 0 ? atomo : candidato;
        this.avviso = { testo: `Troppi legami: ${this._nomeAtomo(pieno)} è già completo e non può legarsi ad altri atomi.`, colore: '#ff6b6b', fino: performance.now() + 6000 };
        // allontana un po' l'atomo rilasciato per segnalare il rifiuto
        const via = new THREE.Vector3().subVectors(pos, candidato.position).normalize();
        pos.copy(candidato.position).addScaledVector(via, this.lunghezzaLegame(atomo, candidato) + MARGINE_AGGANCIO * 1.6);
      } else {
        const ordine = Math.min(liberiA, liberiB, 3);
        const dir = new THREE.Vector3().subVectors(pos, candidato.position).normalize();
        pos.copy(candidato.position).addScaledVector(dir, this.lunghezzaLegame(atomo, candidato, ordine));
        this._creaLegame(atomo, candidato, ordine);
        this._sistemaGeometria(candidato);
        this._sistemaGeometria(atomo);
        this.avviso = null;
      }
    }
    this.aggiornaPannello();
  }

  _nomeAtomo(a) { return this.elementi[a.userData.simbolo].nome.toLowerCase(); }

  /** Atomi collegati a quello dato (la molecola a cui appartiene). */
  molecolaDi(atomo) {
    const visti = new Set([atomo]), coda = [atomo];
    while (coda.length) {
      const x = coda.pop();
      for (const l of this.legamiDi(x)) { const y = l.a === x ? l.b : l.a; if (!visti.has(y)) { visti.add(y); coda.push(y); } }
    }
    return [...visti];
  }

  /** Formula con pedici, es. H₂O. */
  formula(atomi) {
    const n = {};
    for (const a of atomi) n[a.userData.simbolo] = (n[a.userData.simbolo] || 0) + 1;
    const ordine = Object.keys(n).sort((x, y) => {
      const i = ORDINE_FORMULA.indexOf(x), j = ORDINE_FORMULA.indexOf(y);
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || x.localeCompare(y);
    });
    return ordine.map((s) => s + (n[s] > 1 ? [...String(n[s])].map((c) => PEDICI[c]).join('') : '')).join('');
  }

  /** Formula senza pedici, es. H2O: serve per cercarla nelle molecole note. */
  formulaPiana(atomi) {
    return this.formula(atomi).replace(/[₀-₉]/g, (c) => PEDICI.indexOf(c));
  }


  // ---------- Geometria (angoli di legame) ----------

  /**
   * Dispone i vicini di un atomo secondo la teoria VSEPR semplificata:
   * contano i legami e le coppie solitarie dell'atomo (elettroni esterni - valenza, a coppie).
   *   2 vicini: lineare (CO2, 180 gradi) oppure piegata (H2O, 104,5 gradi)
   *   3 vicini: piramidale (NH3, 107 gradi)
   *   4 vicini: tetraedrica (CH4, 109,5 gradi)
   * La molecola resta orientata come l'ha messa lo studente: si ruota solo il necessario.
   */
  _sistemaGeometria(c) {
    const legamiC = this.legamiDi(c);
    const vicini = legamiC.map((l) => (l.a === c ? l.b : l.a));
    if (vicini.length < 2) return;
    const lp = Math.max(0, (c.userData.esterni - c.userData.valenza) / 2);
    const dirs = this._direzioniIdeali(vicini.length, lp);
    if (!dirs) return;
    const attuali = vicini.map((v) => v.position.clone().sub(c.position).normalize());
    // 1) allinea la prima direzione ideale al primo vicino
    const q1 = new THREE.Quaternion().setFromUnitVectors(dirs[0], attuali[0]);
    const rot = dirs.map((v) => v.clone().applyQuaternion(q1));
    // 2) ruota attorno a quell'asse per avvicinare il secondo vicino alla posizione scelta dallo studente
    const asse = attuali[0];
    const proietta = (v) => v.clone().addScaledVector(asse, -v.dot(asse));
    const p1 = proietta(rot[1]), p2 = proietta(attuali[1]);
    if (p1.lengthSq() > 1e-6 && p2.lengthSq() > 1e-6) {
      const verso = new THREE.Vector3().crossVectors(p1, p2).dot(asse) < 0 ? -1 : 1;
      const q2 = new THREE.Quaternion().setFromAxisAngle(asse, p1.angleTo(p2) * verso);
      rot.forEach((v) => v.applyQuaternion(q2));
    }
    // 3) sposta ogni vicino (con tutto cio' che e' attaccato a lui) nella posizione ideale
    vicini.forEach((v, i) => {
      const nuova = c.position.clone().addScaledVector(rot[i], this.lunghezzaLegame(c, v, legamiC[i].ordine));
      const delta = nuova.sub(v.position);
      for (const x of this._ramo(v, c)) x.position.add(delta);
    });
  }

  /** Atomi raggiungibili da v senza passare per `escluso` (compreso v). */
  _ramo(v, escluso) {
    const visti = new Set([v, escluso]), coda = [v], ramo = [];
    while (coda.length) {
      const x = coda.pop(); ramo.push(x);
      for (const l of this.legamiDi(x)) { const y = l.a === x ? l.b : l.a; if (!visti.has(y)) { visti.add(y); coda.push(y); } }
    }
    return ramo;
  }

  /** Direzioni (versori) dei legami per n vicini e lp coppie solitarie; null se non gestito. */
  _direzioniIdeali(n, lp) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
    if (n === 2) {
      const dom = n + lp;
      const ang = (dom === 2 ? 180 : dom === 3 ? 117 : lp >= 2 ? 104.5 : 109.5) * Math.PI / 180;
      return [V(-Math.sin(ang / 2), 0, Math.cos(ang / 2)), V(Math.sin(ang / 2), 0, Math.cos(ang / 2))];
    }
    if (n === 3) {
      // angolo tra i legami: 120 (planare) oppure 107 (piramidale, una coppia solitaria)
      const angolo = lp >= 1 ? 107 : 120;
      const cosA = Math.sqrt(Math.max(0, (Math.cos(angolo * Math.PI / 180) + 0.5) / 1.5)); // coseno dell'angolo con l'asse
      const sinA = Math.sqrt(1 - cosA * cosA);
      return [0, 1, 2].map((k) => V(sinA * Math.cos(k * 2 * Math.PI / 3), sinA * Math.sin(k * 2 * Math.PI / 3), cosA));
    }
    if (n === 4) return [V(1, 1, 1), V(1, -1, -1), V(-1, 1, -1), V(-1, -1, 1)];
    return null;
  }

  // ---------- Riscontro ----------

  aggiornaPannello() {
    const righe = [];
    const obiettivoNome = this.note[this.obiettivo]?.nome || this.obiettivo;
    righe.push({ testo: `Obiettivo: costruisci ${obiettivoNome.toLowerCase()} (${this._pedici(this.obiettivo)})`, dimensione: 50, colore: '#9ecbff' });

    const base = this.ultimo && this.atomi.includes(this.ultimo) ? this.ultimo : null;
    const molecola = base ? this.molecolaDi(base) : [];
    if (molecola.length < 2) {
      righe.push({ testo: 'Afferra un atomo e avvicinalo a un altro per formare un legame.', dimensione: 48 });
    } else {
      const formula = this.formula(molecola);
      const liberi = molecola.filter((a) => this.legamiLiberi(a) > 0);
      if (liberi.length === 0) {
        const noto = this.note[this.formulaPiana(molecola)];
        righe.push({ testo: `Molecola: ${formula}`, dimensione: 76, grassetto: true });
        if (noto) righe.push({ testo: `Corretto! ${noto.nome}`, dimensione: 62, grassetto: true, colore: '#6fe38a' });
        else righe.push({ testo: 'Tutti i legami sono completi, ma non è una delle molecole di questo livello.', dimensione: 48, colore: '#ffd166' });
        if (this.formulaPiana(molecola) === this.obiettivo) righe.push({ testo: 'Obiettivo raggiunto, bravo!', dimensione: 56, colore: '#6fe38a' });
      } else {
        righe.push({ testo: `Molecola in costruzione: ${formula}`, dimensione: 68, grassetto: true });
        const per = {};
        for (const a of liberi) per[a.userData.simbolo] = (per[a.userData.simbolo] || 0) + this.legamiLiberi(a);
        const elenco = Object.entries(per).map(([s, n]) => `${this._nomeEl(s)}: ${n} ${n === 1 ? 'legame libero' : 'legami liberi'}`).join(' · ');
        righe.push({ testo: `Manca qualcosa: ${elenco}`, dimensione: 50, colore: '#ffd166' });
      }
    }
    if (this.avviso) righe.push({ testo: this.avviso.testo, dimensione: 50, colore: this.avviso.colore });
    this.pannello.imposta(righe);
  }

  _nomeEl(s) { return this.elementi[s].nome; }
  _pedici(f) { return f.replace(/\d/g, (c) => PEDICI[c]); }
}
