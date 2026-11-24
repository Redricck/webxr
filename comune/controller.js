// Gestione degli oggetti afferrabili, condivisa da tutte le app.
//  - GestoreControllerXR: controller del visore. Comandi:
//      GRILLETTO  = preme il pulsante puntato; afferra l'oggetto puntato (atomo, pezzo di DNA, scheda)
//      PRESA LATERALE = afferra il "blocco" puntato: molecola intera, elica del DNA, scheda
//      LEVETTA su/giu = avvicina/allontana l'oggetto tenuto; destra/sinistra = lo ruota
//      DUE MANI sullo stesso blocco = lo ruotano (e lo ingrandiscono, se e' una scheda)
//      TASTO A/B (X/Y) = ricentra la vista e riporta schede ed elica al loro posto
//  - ControlliDesktop:   mouse (trascina oggetti, ruota/zoom la vista) per provare senza visore.
// Le due classi usano le stesse funzioni di callback: onAfferra(oggetto) e onRilascia(oggetto).
import * as THREE from 'three';
import { ricentraVista } from './xr-supporto.js';

/** Risale dal mesh colpito fino all'oggetto "afferrabile" registrato. */
function radiceAfferrabile(oggetto, lista) {
  let o = oggetto;
  while (o && !lista.includes(o)) o = o.parent;
  return o || null;
}


export class GestoreControllerXR {
  /**
   * @param renderer, scena
   * @param afferrabili  funzione che restituisce l'array degli oggetti afferrabili "piccoli"
   *                     (atomi, pezzi di DNA: figli della scena o di un gruppo)
   * @param opzioni      {
   *   onAfferra(o), onRilascia(o)   oggetti piccoli
   *   premibili(): pulsanti 3D,  onPremi(mesh)
   *   grandi(): oggetti grandi puntabili (schede, elica) per la presa del blocco
   *   blocco(colpito): data una parte colpita, restituisce null oppure
   *       { oggetto, scalabile, fine() }  = cosa spostare tenendo la presa laterale
   *   onRicentra(): chiamata quando si preme il tasto di ricentramento
   *   raggioPresa (m), distanzaRaggio (m) }
   */
  constructor(renderer, scena, afferrabili, opzioni = {}) {
    this.renderer = renderer;
    this.scena = scena;
    this.afferrabili = afferrabili;
    this.onAfferra = opzioni.onAfferra || (() => {});
    this.onRilascia = opzioni.onRilascia || (() => {});
    this.premibili = opzioni.premibili || (() => []);   // pulsanti 3D: si premono puntandoli col raggio
    this.onPremi = opzioni.onPremi || (() => {});
    this.grandi = opzioni.grandi || (() => []);
    this.bloccoDi = opzioni.blocco || (() => null);
    this.onRicentra = opzioni.onRicentra || (() => {});
    this.raggioPresa = opzioni.raggioPresa ?? 0.12;     // presa "a mano": oggetto vicino al controller
    this.distanzaRaggio = opzioni.distanzaRaggio ?? 3;  // presa "a distanza" col raggio
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 0.005;   // le linee (anelli dell'atomo) si colpiscono solo da vicino
    this.controller = [];
    this.dueMani = null;            // stato della presa con due mani
    this.maniAttive = true;         // se false, i comandi dati con le mani (hand tracking) vengono ignorati
    this.opzioniRicentra = { altezzaFissa: 1.8, altezzaMinima: 0, avanti: 0, alza: 0 };   // modificabili dalle impostazioni
    this.daRicentrare = false;      // se true, ricentra appena arriva il primo fotogramma
    this.ultimoTempo = performance.now();

    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i);
      c.userData = { tenuto: null, blocco: null, sorgente: null, premuti: new Set(), linea: null, punta: null, tastoPrima: false };
      // Raggio visibile: linea sottile davanti al controller + puntino all'estremita'.
      const linea = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -this.distanzaRaggio)]),
        new THREE.LineBasicMaterial({ color: 0x66ccff })
      );
      c.add(linea);
      c.userData.linea = linea;
      const palla = new THREE.Mesh(new THREE.SphereGeometry(0.012), new THREE.MeshBasicMaterial({ color: 0x66ccff }));
      c.add(palla); // segna dove il raggio tocca un oggetto (si sposta, vedi aggiorna())
      c.userData.punta = palla;
      c.addEventListener('connected', (e) => { c.userData.sorgente = e.data; });
      for (const tipo of ['select', 'squeeze']) {
        c.addEventListener(tipo + 'start', () => this._premuto(c, tipo));
        c.addEventListener(tipo + 'end', () => this._rilasciato(c, tipo));
      }
      scena.add(c);
      this.controller.push(c);
    }
  }

  /** Chiede di ricentrare la vista al prossimo fotogramma (usato all'ingresso in VR). */
  richiediRicentra() { this.daRicentrare = true; }

  // ---------- Pressione e rilascio ----------

  _premuto(c, tipo) {
    if (c.userData.sorgente?.hand && !this.maniAttive) return;   // mani disattivate nelle impostazioni
    c.userData.premuti.add(tipo);
    if (c.userData.tenuto) return;

    const colpo = this._primoColpo(c);
    // 1) Grilletto su un pulsante: lo preme
    if (tipo === 'select' && colpo && this.premibili().includes(colpo.object)) {
      this._vibra(c, 0.2, 25); this.onPremi(colpo.object); return;
    }
    // 2) Un blocco gia' tenuto dall'altra mano: presa a due mani
    const altro = this.controller.find((x) => x !== c && x.userData.blocco);
    if (altro && colpo && this._dentro(colpo.object, altro.userData.blocco.oggetto)) { this._iniziaDueMani(altro, c); return; }

    // 3) Cosa si e' toccato/puntato: prima oggetti piccoli vicini alla mano, poi quello che il raggio colpisce
    const piccoli = this.afferrabili().filter((o) => !this.controller.includes(o.parent));
    const vicino = this._piccoloVicino(c, piccoli);
    const bersaglio = vicino || (colpo ? colpo.object : null);
    if (!bersaglio) return;
    const piccolo = vicino || radiceAfferrabile(bersaglio, piccoli);

    // 4) Presa laterale (o oggetto grande puntato col grilletto): si prende il blocco, se esiste
    if (tipo === 'squeeze' || !piccolo) {
      const b = this.bloccoDi(bersaglio);
      if (b) { this._afferraBlocco(c, b); return; }
    }
    // 5) Altrimenti oggetto piccolo singolo
    if (!piccolo) return;
    c.attach(piccolo); // attach conserva la posizione nel mondo
    c.userData.tenuto = piccolo;
    // Presa a distanza (col raggio): l'oggetto viene "tirato" davanti alla mano, cosi' si muove con precisione
    if (piccolo.position.length() > this.raggioPresa) piccolo.position.set(0, 0, -0.12);
    this._vibra(c, 0.4, 40);
    this.onAfferra(piccolo);
  }

  _afferraBlocco(c, b) {
    const o = b.oggetto;
    b.genitore = o.parent;
    if (b.inizio) b.inizio();
    c.attach(o);                 // l'oggetto grande resta dov'e' rispetto alla mano (niente "tirata")
    // Se il blocco chiede di essere avvicinato (es. atomo della tavola) e sta piu' lontano, lo si porta davanti alla mano
    if (b.avvicina && o.position.length() > b.avvicina) o.position.setLength(b.avvicina);
    c.userData.tenuto = o; c.userData.blocco = b;
    this._vibra(c, 0.5, 60);
  }

  _rilasciato(c, tipo) {
    c.userData.premuti.delete(tipo);
    // Si lascia l'oggetto solo quando sono rilasciati sia grilletto sia presa.
    if (c.userData.premuti.size > 0 || !c.userData.tenuto) return;
    const oggetto = c.userData.tenuto, b = c.userData.blocco;
    c.userData.tenuto = null; c.userData.blocco = null;

    if (this.dueMani && (this.dueMani.a === c || this.dueMani.b === c)) {   // finisce la presa a due mani
      const resta = this.dueMani.a === c ? this.dueMani.b : this.dueMani.a;
      this.dueMani = null;
      resta.userData.tenuto = oggetto; resta.userData.blocco = b;
      resta.attach(oggetto);            // continua con la mano che e' rimasta
      return;
    }
    if (b) {                             // blocco: torna al suo genitore originale
      b.genitore.attach(oggetto);
      if (b.fine) b.fine();
      return;
    }
    this.scena.attach(oggetto);
    this.onRilascia(oggetto);
  }

  // ---------- Due mani ----------

  _iniziaDueMani(a, b) {
    // a tiene gia' il blocco: lo stacca dalla mano e lo muove in base a entrambe
    const o = a.userData.tenuto, blocco = a.userData.blocco;
    this.scena.attach(o);
    b.userData.tenuto = o; b.userData.blocco = blocco;
    const pa = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
    const pb = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const v0 = pb.clone().sub(pa);
    const med = pa.clone().add(pb).multiplyScalar(0.5);
    this.dueMani = {
      a, b, oggetto: o, blocco, v0, lung0: Math.max(v0.length(), 0.05),
      scala0: o.scale.x, q0: o.quaternion.clone(),
      scarto0: o.position.clone().sub(med),
    };
    this._vibra(b, 0.5, 60);
  }

  _aggiornaDueMani() {
    const d = this.dueMani; if (!d) return;
    const pa = new THREE.Vector3().setFromMatrixPosition(d.a.matrixWorld);
    const pb = new THREE.Vector3().setFromMatrixPosition(d.b.matrixWorld);
    const v = pb.clone().sub(pa);
    const med = pa.clone().add(pb).multiplyScalar(0.5);
    // Rotazione: quella che porta il vettore tra le mani iniziale su quello attuale
    const dq = new THREE.Quaternion().setFromUnitVectors(d.v0.clone().normalize(), v.clone().normalize());
    const k = d.blocco.scalabile ? THREE.MathUtils.clamp(v.length() / d.lung0, 0.3, 4) : 1;   // scala: solo schede
    d.oggetto.quaternion.copy(dq).multiply(d.q0);
    d.oggetto.scale.setScalar(d.scala0 * k);
    d.oggetto.position.copy(med).add(d.scarto0.clone().multiplyScalar(k).applyQuaternion(dq));
  }

  // ---------- Ricerca di cosa si punta ----------

  /** true se `o` e' `radice` o un suo discendente. */
  _dentro(o, radice) { for (let x = o; x; x = x.parent) if (x === radice) return true; return false; }

  _visibile(m) { for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; }

  /** Oggetto piccolo (atomo, pezzo) entro il raggio di presa dalla mano, o null. */
  _piccoloVicino(c, lista) {
    const pos = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
    const p = new THREE.Vector3();
    let migliore = null, dMin = this.raggioPresa;
    for (const o of lista) {
      const d = o.getWorldPosition(p).distanceTo(pos);
      if (d < dMin) { dMin = d; migliore = o; }
    }
    return migliore;
  }

  /**
   * Primo oggetto colpito dal raggio del controller tra pulsanti visibili, oggetti piccoli e oggetti grandi
   * (null se non colpisce nulla entro distanzaRaggio). Restituisce { object, distance, point }.
   */
  _primoColpo(c) {
    c.updateWorldMatrix(true, false);
    const bersagli = this.premibili().filter((m) => this._visibile(m))
      .concat(this.afferrabili().filter((o) => !this.controller.includes(o.parent) && this._visibile(o)))
      .concat(this.grandi().filter((o) => this._visibile(o)));
    if (!bersagli.length) return null;
    this.raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).transformDirection(c.matrixWorld);
    this.raycaster.far = this.distanzaRaggio;
    // Si ignorano i discendenti dell'oggetto che questa stessa mano sta tenendo
    const colpi = this.raycaster.intersectObjects(bersagli, true).filter((h) => !c.userData.tenuto || !this._dentro(h.object, c.userData.tenuto));
    return colpi.length ? colpi[0] : null;
  }

  // ---------- Ciclo di vita ----------

  /**
   * Da chiamare a ogni fotogramma (con il `frame` XR): accorcia il raggio fino al primo oggetto colpito,
   * muove gli oggetti tenuti con la levetta, gestisce il tasto di ricentramento e la presa a due mani.
   */
  aggiorna(frame) {
    const ora = performance.now(), dt = Math.min((ora - this.ultimoTempo) / 1000, 0.1);
    this.ultimoTempo = ora;

    if (this.daRicentrare && frame && this.renderer.xr.isPresenting) {
      if (ricentraVista(this.renderer, frame, this.opzioniRicentra)) { this.daRicentrare = false; this.onRicentra(); }
    }
    this._aggiornaDueMani();

    for (const c of this.controller) {
      const { linea, punta, tenuto } = c.userData;
      const gp = c.userData.sorgente?.gamepad;

      // Tasto A/B (X/Y): ricentra la vista
      const premuto = !!(gp && (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed));
      if (premuto && !c.userData.tastoPrima && frame) { ricentraVista(this.renderer, frame, this.opzioniRicentra); this.onRicentra(); }
      c.userData.tastoPrima = premuto;

      // Levetta: oggetto tenuto piu' vicino/lontano (su/giu) e ruotato (destra/sinistra)
      if (tenuto && gp && !this.dueMani) {
        const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0] || 0;
        const ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1] || 0;
        if (Math.abs(ay) > 0.15) {                 // spingere in avanti = allontana
          if (tenuto.position.lengthSq() < 1e-6) tenuto.position.set(0, 0, -0.1);
          tenuto.position.setLength(THREE.MathUtils.clamp(tenuto.position.length() - ay * 1.0 * dt, 0.08, 4));
        }
        if (Math.abs(ax) > 0.15) this._ruotaVerticale(c, tenuto, -ax * 1.8 * dt);
      }

      // Raggio: si ferma sul primo oggetto colpito
      if (!c.visible) continue;
      let dist = this.distanzaRaggio, colpito = false;
      if (tenuto) dist = 0.05;                       // oggetto in mano: raggio cortissimo
      else {
        const colpo = this._primoColpo(c);
        if (colpo) { dist = colpo.distance; colpito = true; }
      }
      linea.scale.z = dist / this.distanzaRaggio;    // la linea e' lunga distanzaRaggio: la si accorcia
      punta.position.z = -dist;
      punta.material.color.setHex(colpito ? 0xffd34d : 0x66ccff);
      linea.material.color.setHex(colpito ? 0xffd34d : 0x66ccff);
    }
  }

  /** Ruota l'oggetto tenuto attorno all'asse verticale del mondo passante per il suo centro. */
  _ruotaVerticale(c, o, angolo) {
    const qc = new THREE.Quaternion(); c.getWorldQuaternion(qc);
    const qo = new THREE.Quaternion(); o.getWorldQuaternion(qo);
    const nuova = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angolo).multiply(qo);
    o.quaternion.copy(qc.invert().multiply(nuova));
  }

  _vibra(c, intensita, ms) {
    const att = c.userData.sorgente?.gamepad?.hapticActuators?.[0];
    if (att && att.pulse) att.pulse(intensita, ms);
  }

  /** Se un controller tiene un oggetto durante la fine sessione, lo lascia. */
  rilasciaTutto() {
    this.dueMani = null;
    for (const c of this.controller) { c.userData.premuti.clear(); if (c.userData.tenuto) this._rilasciato(c, 'x'); }
  }
}

export class ControlliDesktop {
  /**
   * @param canvas, camera, scena, afferrabili (funzione)
   * @param opzioni { onAfferra, onRilascia, bersaglio: Vector3 (punto attorno a cui ruota la vista), enabled: () => bool }
   * Comandi: trascina un oggetto con il mouse; trascina lo sfondo per ruotare; rotella per zoom.
   */
  constructor(canvas, camera, scena, afferrabili, opzioni = {}) {
    this.canvas = canvas; this.camera = camera; this.scena = scena; this.afferrabili = afferrabili;
    this.onAfferra = opzioni.onAfferra || (() => {});
    this.onRilascia = opzioni.onRilascia || (() => {});
    this.attivo = opzioni.attivo || (() => true);
    this.premibili = opzioni.premibili || (() => []);   // pulsanti 3D cliccabili col mouse
    this.onPremi = opzioni.onPremi || (() => {});
    this.bersaglio = opzioni.bersaglio || new THREE.Vector3(0, 1.2, -0.8);
    this.raycaster = new THREE.Raycaster();
    this.tenuto = null;
    this.piano = new THREE.Plane();
    this.scarto = new THREE.Vector3();
    // Coordinate sferiche della camera attorno al bersaglio
    const d = camera.position.clone().sub(this.bersaglio);
    this.raggio = d.length();
    this.azimut = Math.atan2(d.x, d.z);
    this.elevazione = Math.asin(d.y / this.raggio);
    this._aggiornaCamera();

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this._giu(e));
    canvas.addEventListener('pointermove', (e) => this._muovi(e));
    canvas.addEventListener('pointerup', (e) => this._su(e));
    canvas.addEventListener('wheel', (e) => {
      if (!this.attivo()) return;
      e.preventDefault();
      this.raggio = THREE.MathUtils.clamp(this.raggio * (1 + Math.sign(e.deltaY) * 0.08), 0.5, 6);
      this._aggiornaCamera();
    }, { passive: false });
  }

  /** Cambia il punto guardato e la distanza della vista desktop (ogni modulo ha la sua). */
  impostaVista(bersaglio, raggio, azimut = 0, elevazione = 0.1) {
    this.bersaglio.copy(bersaglio); this.raggio = raggio; this.azimut = azimut; this.elevazione = elevazione;
    this._aggiornaCamera();
  }

  _aggiornaCamera() {
    const { raggio: r, azimut: a, elevazione: el } = this;
    this.camera.position.set(
      this.bersaglio.x + r * Math.cos(el) * Math.sin(a),
      this.bersaglio.y + r * Math.sin(el),
      this.bersaglio.z + r * Math.cos(el) * Math.cos(a));
    this.camera.lookAt(this.bersaglio);
  }

  _punto(e) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  _giu(e) {
    if (!this.attivo()) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.ultimo = { x: e.clientX, y: e.clientY };
    this.raycaster.setFromCamera(this._punto(e), this.camera);
    const visibili = this.premibili().filter((m) => { for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; });
    const pul = this.raycaster.intersectObjects(visibili, false);
    if (pul.length) { this.ultimo = null; this.onPremi(pul[0].object); return; }
    const lista = this.afferrabili();
    const colpi = this.raycaster.intersectObjects(lista, true);
    const o = colpi.length ? radiceAfferrabile(colpi[0].object, lista) : null;
    if (o) {
      this.tenuto = o;
      this.onAfferra(o);   // prima del calcolo dello scarto: il modulo puo' staccare l'oggetto da un genitore
      // Il trascinamento avviene su un piano parallelo allo schermo passante per il punto colpito.
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      this.piano.setFromNormalAndCoplanarPoint(dir, colpi[0].point);
      this.scarto.copy(o.position).sub(colpi[0].point);
    }
  }

  _muovi(e) {
    if (!this.attivo() || !this.ultimo) return;
    if (this.tenuto) {
      this.raycaster.setFromCamera(this._punto(e), this.camera);
      const p = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.piano, p)) this.tenuto.position.copy(p.add(this.scarto));
    } else {
      this.azimut -= (e.clientX - this.ultimo.x) * 0.006;
      this.elevazione = THREE.MathUtils.clamp(this.elevazione + (e.clientY - this.ultimo.y) * 0.006, -1.2, 1.3);
      this._aggiornaCamera();
    }
    this.ultimo = { x: e.clientX, y: e.clientY };
  }

  _su(e) {
    this.ultimo = null;
    if (this.tenuto) { const o = this.tenuto; this.tenuto = null; this.onRilascia(o); }
  }
}
