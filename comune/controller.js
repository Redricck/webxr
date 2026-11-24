// Gestione degli oggetti afferrabili, condivisa da tutte le app.
//  - GestoreControllerXR: controller del visore (grilletto o presa per afferrare).
//  - ControlliDesktop:   mouse (trascina oggetti, ruota/zoom la vista) per provare senza visore.
// Le due classi usano le stesse funzioni di callback: onAfferra(oggetto) e onRilascia(oggetto).
import * as THREE from 'three';

/** Risale dal mesh colpito fino all'oggetto "afferrabile" registrato. */
function radiceAfferrabile(oggetto, lista) {
  let o = oggetto;
  while (o && !lista.includes(o)) o = o.parent;
  return o || null;
}


export class GestoreControllerXR {
  /**
   * @param renderer, scena
   * @param afferrabili  funzione che restituisce l'array degli oggetti afferrabili
   *                     (devono essere figli diretti della scena)
   * @param opzioni      { onAfferra, onRilascia, raggioPresa (m), distanzaRaggio (m) }
   */
  constructor(renderer, scena, afferrabili, opzioni = {}) {
    this.scena = scena;
    this.afferrabili = afferrabili;
    this.onAfferra = opzioni.onAfferra || (() => {});
    this.onRilascia = opzioni.onRilascia || (() => {});
    this.premibili = opzioni.premibili || (() => []);   // pulsanti 3D: si premono puntandoli col raggio
    this.onPremi = opzioni.onPremi || (() => {});
    this.raggioPresa = opzioni.raggioPresa ?? 0.12;     // presa "a mano": oggetto vicino al controller
    this.distanzaRaggio = opzioni.distanzaRaggio ?? 3;  // presa "a distanza" col raggio
    this.raycaster = new THREE.Raycaster();
    this.controller = [];

    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i);
      c.userData = { tenuto: null, sorgente: null, premuti: new Set(), linea: null, punta: null };
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
      // Sia grilletto (select) sia presa (squeeze) afferrano: l'utente usa quello che preferisce.
      for (const tipo of ['select', 'squeeze']) {
        c.addEventListener(tipo + 'start', () => this._premuto(c, tipo));
        c.addEventListener(tipo + 'end', () => this._rilasciato(c, tipo));
      }
      scena.add(c);
      this.controller.push(c);
    }
  }

  _premuto(c, tipo) {
    c.userData.premuti.add(tipo);
    if (c.userData.tenuto) return;
    if (tipo === 'select') {   // se il primo oggetto colpito dal raggio e' un pulsante, lo si preme
      const colpo = this._primoColpo(c);
      if (colpo && this.premibili().includes(colpo.object)) { this._vibra(c, 0.2, 25); this.onPremi(colpo.object); return; }
    }
    const oggetto = this._trova(c);
    if (!oggetto) return;
    c.attach(oggetto); // attach conserva la posizione nel mondo
    c.userData.tenuto = oggetto;
    // Presa a distanza (col raggio): l'oggetto viene "tirato" davanti alla mano, cosi' si muove con precisione
    if (oggetto.position.length() > this.raggioPresa) oggetto.position.set(0, 0, -0.12);
    this._vibra(c, 0.4, 40);
    this.onAfferra(oggetto);
  }

  _rilasciato(c, tipo) {
    c.userData.premuti.delete(tipo);
    // Si lascia l'oggetto solo quando sono rilasciati sia grilletto sia presa.
    if (c.userData.premuti.size > 0 || !c.userData.tenuto) return;
    const oggetto = c.userData.tenuto;
    c.userData.tenuto = null;
    this.scena.attach(oggetto);
    this.onRilascia(oggetto);
  }

  /** Cerca prima l'oggetto piu' vicino alla mano, poi quello puntato col raggio. */
  _trova(c) {
    const lista = this.afferrabili();
    const pos = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
    let migliore = null, dMin = this.raggioPresa;
    const p = new THREE.Vector3();
    for (const o of lista) {
      if (this.controller.includes(o.parent)) continue; // gia' in mano a un controller
      const d = o.getWorldPosition(p).distanceTo(pos);
      if (d < dMin) { dMin = d; migliore = o; }
    }
    if (migliore) return migliore;
    const m = new THREE.Matrix4().extractRotation(c.matrixWorld);
    this.raycaster.ray.origin.copy(pos);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
    this.raycaster.far = this.distanzaRaggio;
    const colpi = this.raycaster.intersectObjects(lista.filter((o) => !this.controller.includes(o.parent)), true);
    return colpi.length ? radiceAfferrabile(colpi[0].object, lista) : null;
  }

  /**
   * Primo oggetto colpito dal raggio del controller tra pulsanti visibili e oggetti afferrabili
   * (null se non colpisce nulla entro distanzaRaggio). Restituisce { object, distance, point }.
   */
  _primoColpo(c) {
    c.updateWorldMatrix(true, false);
    const visibile = (m) => { for (let o = m; o; o = o.parent) if (!o.visible) return false; return true; };
    const bersagli = this.premibili().filter(visibile)
      .concat(this.afferrabili().filter((o) => !this.controller.includes(o.parent) && visibile(o)));
    if (!bersagli.length) return null;
    this.raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).transformDirection(c.matrixWorld);
    this.raycaster.far = this.distanzaRaggio;
    const colpi = this.raycaster.intersectObjects(bersagli, true);
    return colpi.length ? colpi[0] : null;
  }

  /**
   * Da chiamare a ogni fotogramma: accorcia il raggio fino al primo oggetto colpito, cosi' non
   * attraversa pulsanti e oggetti. Il puntino si ferma sull'oggetto (giallo se si puo' premere/afferrare).
   */
  aggiorna() {
    for (const c of this.controller) {
      const { linea, punta, tenuto } = c.userData;
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

  _vibra(c, intensita, ms) {
    const att = c.userData.sorgente?.gamepad?.hapticActuators?.[0];
    if (att && att.pulse) att.pulse(intensita, ms);
  }

  /** Se un controller tiene un oggetto durante la fine sessione, lo lascia. */
  rilasciaTutto() {
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
