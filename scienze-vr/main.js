// scienze-vr: avvio dell'app. Menu iniziale in VR + modulo 1 (molecole). Gli altri moduli arriveranno nei passi successivi.
import * as THREE from 'three';
import { rilevaSupportoXR, creaPulsanteXR } from 'comune/xr-supporto.js';
import { GestoreControllerXR, ControlliDesktop } from 'comune/controller.js';
import { PannelloTesto } from 'comune/pannello.js';
import { creaVisualiInput } from 'comune/mani.js';
import { Audio } from 'comune/audio.js';
import { Impostazioni } from 'comune/impostazioni.js';
import { spostaVerticale } from 'comune/xr-supporto.js';
// Numero di versione mostrato nel pannello Impostazioni: serve a capire se il visore ha caricato l'ultima pubblicazione
const VERSIONE = 8;
import { Pulsante3D, premi } from 'comune/menu.js';
import { ModuloMolecole } from './molecole.js';
import { ModuloTavola } from './tavola.js';
import { ModuloDna } from './dna.js';
import { creaLaboratorio } from './laboratorio.js';

// --- Dati scientifici (da dataset, vedi comune/dati/LICENZE-DATI.md) ---
const elementi = await (await fetch('./dati/elementi.json')).json();
const molecoleNote = await (await fetch('./dati/molecole.json')).json();
const datiTavola = await (await fetch('./dati/tavola.json')).json();
const datiDna = await (await fetch('./dati/dna.json')).json();

// --- Renderer, scena, camera ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const scena = new THREE.Scene();
scena.background = new THREE.Color(0xdfe6ec);   // colore del cielo fuori dalla stanza (non si vede, ma serve in AR/uscita)
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50);
camera.position.set(0, 1.6, 0.6);               // vista desktop; in VR la camera la muove il visore

scena.add(new THREE.HemisphereLight(0xffffff, 0x333355, 1.5));
const luce = new THREE.DirectionalLight(0xffffff, 1.6); luce.position.set(1, 3, 2); scena.add(luce);
scena.add(creaLaboratorio());   // sfondo: stanza di laboratorio (pavimento, pareti, bancone)

// --- Pannello del riscontro (davanti e sopra gli atomi) ---
const pannello = new PannelloTesto(1.0, 0.5, 1280);
pannello.mesh.position.set(0, 1.8, -1.0);
scena.add(pannello.mesh);

// --- Modulo molecole ---
const modulo = new ModuloMolecole(scena, elementi, molecoleNote, pannello);

// --- Modulo DNA ---
const pannelloDna = new PannelloTesto(0.75, 0.7, 1024);
pannelloDna.mesh.position.set(-0.85, 1.4, -0.85);
pannelloDna.mesh.rotation.y = 0.6;          // girato verso lo studente
scena.add(pannelloDna.mesh);
const dna = new ModuloDna(scena, datiDna, pannelloDna);

// --- Modulo tavola periodica ---
const tavola = new ModuloTavola(scena, datiTavola);

// --- Audio: musica ambient + effetti (si sblocca al primo gesto dell'utente) ---
const audio = new Audio();
modulo.suoni = audio; dna.suoni = audio; tavola.suoni = audio;
for (const ev of ['pointerdown', 'keydown', 'click']) addEventListener(ev, () => audio.sblocca());   // desktop e pulsante "Entra in VR"

const guida = (html) => { document.getElementById('guida').innerHTML = html; };   // testo di aiuto per il desktop

// --- Pulsanti 3D: per scegliere la molecola, ricominciare e tornare al menu ---
const tutti = [];   // tutti i pulsanti (per il rilevamento dei clic)
function pulsante(testo, w, h, pos, azione, gruppo, inclina = 0) {
  const p = new Pulsante3D(testo, w, h, azione);
  p.mesh.position.copy(pos);
  p.mesh.rotation.x = inclina;
  gruppo.add(p.mesh); tutti.push(p.mesh);
  return p;
}

// Gruppo "menu": schermata iniziale in VR
const gruppoMenu = new THREE.Group(); scena.add(gruppoMenu);
const titolo = new PannelloTesto(1.0, 0.5, 1024);
titolo.imposta([
  { testo: 'Scienze VR', dimensione: 84, grassetto: true },
  { testo: 'Grilletto: premi un pulsante, prendi un atomo o un pezzo', dimensione: 34, colore: '#9ecbff' },
  { testo: 'Presa laterale: prendi la molecola intera, l\'elica o una scheda', dimensione: 34, colore: '#9ecbff' },
  { testo: 'Levetta: avvicina/allontana (su-giù) e ruota (destra-sinistra)', dimensione: 34, colore: '#9ecbff' },
  { testo: 'Tasto A/B (X/Y): ricentra la vista. Due mani: ruoti e ingrandisci', dimensione: 34, colore: '#9ecbff' },
]);
titolo.mesh.position.set(0, 1.95, -1.1); gruppoMenu.add(titolo.mesh);
pulsante('1  Costruisci la molecola', 0.7, 0.16, new THREE.Vector3(0, 1.55, -1.0), () => apriMolecole('H2O'), gruppoMenu);
pulsante('2  Tavola periodica', 0.7, 0.16, new THREE.Vector3(0, 1.35, -1.0), () => apriTavola(), gruppoMenu);
pulsante('3  DNA', 0.7, 0.16, new THREE.Vector3(0, 1.15, -1.0), () => apriDna(), gruppoMenu);
// Il gruppo menu ruota/si sposta attorno al proprio centro: origine al centro dei pulsanti
gruppoMenu.position.set(0, 1.55, -1.05);
for (const f of gruppoMenu.children) f.position.sub(gruppoMenu.position);

// Gruppo "molecole": pannello di riscontro + barra di pulsanti
const gruppoMol = new THREE.Group(); scena.add(gruppoMol);
gruppoMol.add(pannello.mesh);
const bottoniMolecola = {};
Object.keys(molecoleNote).filter((k) => !k.startsWith('_')).forEach((formula, i) => {
  bottoniMolecola[formula] = pulsante(formula.replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[c]), 0.2, 0.12,
    new THREE.Vector3(-0.45 + i * 0.22, 0.85, -0.55), () => apriMolecole(formula), gruppoMol, -0.6);
});
pulsante('Ricomincia', 0.28, 0.12, new THREE.Vector3(0.5, 0.85, -0.55), () => modulo.avvia(null), gruppoMol, -0.6);
pulsante('Ricentra', 0.24, 0.12, new THREE.Vector3(-0.78, 0.85, -0.55), () => controller.richiediRicentra(), gruppoMol, -0.6);
pulsante('Menu', 0.2, 0.12, new THREE.Vector3(0.78, 0.85, -0.55), () => apriMenu(), gruppoMol, -0.6);

// Pulsante "Menu" anche nella tavola periodica
const gruppoTav = new THREE.Group(); scena.add(gruppoTav);
pulsante('Menu', 0.2, 0.12, new THREE.Vector3(0.78, 0.85, -0.55), () => apriMenu(), gruppoTav, -0.6);
pulsante('Ricentra', 0.24, 0.12, new THREE.Vector3(0.5, 0.85, -0.55), () => controller.richiediRicentra(), gruppoTav, -0.6);
tavola.celle.forEach((c) => tutti.push(c));   // anche le caselle si premono col raggio

// Gruppo "DNA": pannello e pulsanti
const gruppoDna = new THREE.Group(); scena.add(gruppoDna);
gruppoDna.add(pannelloDna.mesh);
pulsante('Nuova sequenza', 0.36, 0.12, new THREE.Vector3(0.45, 0.65, -0.5), () => dna.avvia(), gruppoDna, -0.6);
pulsante('Menu', 0.2, 0.12, new THREE.Vector3(0.78, 0.65, -0.5), () => apriMenu(), gruppoDna, -0.6);
pulsante('Ricentra', 0.24, 0.12, new THREE.Vector3(0.1, 0.65, -0.5), () => controller.richiediRicentra(), gruppoDna, -0.6);

// --- Impostazioni (rotellina sempre visibile): audio, volumi, posizione, distanza, mani ---
const imp = new Impostazioni('scienze-vr-impostazioni', { audio: true, volMusica: 0.6, volEffetti: 0.8, seduto: true, distanza: 'normale', mani: true, alza: 0 });
audio.impostaAttivo(imp.get('audio')); audio.impostaVolumi(imp.get('volMusica'), imp.get('volEffetti'));
const DISTANZE = { vicino: 0.5, normale: 0, lontano: -0.3 };   // metri di avvicinamento alla scena al ricentramento
const gruppoImp = new THREE.Group(); scena.add(gruppoImp); gruppoImp.visible = false;
const titoloImp = new PannelloTesto(0.5, 0.1, 512);
titoloImp.imposta([{ testo: 'Impostazioni  (v. ' + VERSIONE + ')', dimensione: 50, grassetto: true }]);
titoloImp.mesh.position.set(0, 1.86, -0.8); gruppoImp.add(titoloImp.mesh);
const statoMani = new PannelloTesto(0.5, 0.16, 512);       // diagnosi dell'hand tracking
statoMani.mesh.position.set(0, 0.745, -0.8); gruppoImp.add(statoMani.mesh);
const rigaImp = (i) => 1.74 - i * 0.115;
const Z_IMP = -0.8;
const bImp = {};
const pressImp = (testo, w, x, riga, azione) => pulsante(testo, w, 0.1, new THREE.Vector3(x, rigaImp(riga), Z_IMP), azione, gruppoImp);
const pc = (v) => Math.round(v * 100) + '%';
function aggiornaImp() {
  const on = imp.get('audio');
  bImp.audio.imposta(on ? 'normale' : 'spento', on ? 'Audio: sì' : 'Audio: no');
  bImp.musica.imposta('disattivo', 'Musica ' + pc(imp.get('volMusica')));
  bImp.effetti.imposta('disattivo', 'Effetti ' + pc(imp.get('volEffetti')));
  bImp.posizione.imposta('normale', imp.get('seduto') ? 'Posizione: seduto' : 'Posizione: in piedi');
  bImp.distanza.imposta('normale', 'Distanza: ' + imp.get('distanza'));
  const m = imp.get('mani');
  bImp.mani.imposta(m ? 'normale' : 'spento', m ? 'Mani: sì' : 'Mani: no');
  const cm = Math.round(imp.get('alza') * 100);
  bImp.alza.imposta('disattivo', 'Altezza ' + (cm > 0 ? '+' : '') + cm + ' cm');
  audio.impostaAttivo(on); audio.impostaVolumi(imp.get('volMusica'), imp.get('volEffetti'));
  controller.maniAttive = m;
  // Seduto: occhi "virtuali" a 1,8 m, cosi' i contenuti stanno poco sotto lo sguardo. In piedi: altezza reale.
  controller.opzioniRicentra.altezzaFissa = imp.get('seduto') ? 1.8 : null;
  controller.opzioniRicentra.altezzaMinima = imp.get('seduto') ? 0 : 1.2;
  controller.opzioniRicentra.alza = imp.get('alza');
  controller.opzioniRicentra.avanti = DISTANZE[imp.get('distanza')];
}
const cambiaVol = (nome, d) => { imp.imposta(nome, Math.min(1, Math.max(0, Math.round((imp.get(nome) + d) * 10) / 10))); aggiornaImp(); audio.suono('tick'); };
bImp.audio = pressImp('Audio', 0.5, 0, 0, () => { audio.sblocca(); imp.imposta('audio', !imp.get('audio')); aggiornaImp(); audio.suono('click'); });
pressImp('−', 0.1, -0.2, 1, () => cambiaVol('volMusica', -0.1)); bImp.musica = pressImp('Musica', 0.3, 0, 1, () => {}); pressImp('+', 0.1, 0.2, 1, () => cambiaVol('volMusica', 0.1));
pressImp('−', 0.1, -0.2, 2, () => cambiaVol('volEffetti', -0.1)); bImp.effetti = pressImp('Effetti', 0.3, 0, 2, () => {}); pressImp('+', 0.1, 0.2, 2, () => cambiaVol('volEffetti', 0.1));
bImp.posizione = pressImp('Posizione', 0.5, 0, 3, () => { imp.imposta('seduto', !imp.get('seduto')); aggiornaImp(); });
// Altezza dei contenuti: si applica subito (solo in su/giu', la vista non si gira) e resta salvata
const cambiaAlza = (d) => { const v = Math.round((imp.get('alza') + d) * 100) / 100; if (Math.abs(v) > 0.5) return; imp.imposta('alza', v); aggiornaImp(); spostaVerticale(renderer, d); audio.suono('tick'); };
pressImp('▼', 0.1, -0.2, 4, () => cambiaAlza(-0.05)); bImp.alza = pressImp('Altezza', 0.3, 0, 4, () => {}); pressImp('▲', 0.1, 0.2, 4, () => cambiaAlza(0.05));
bImp.distanza = pressImp('Distanza', 0.5, 0, 5, () => { const o = Object.keys(DISTANZE); imp.imposta('distanza', o[(o.indexOf(imp.get('distanza')) + 1) % o.length]); aggiornaImp(); });
bImp.mani = pressImp('Mani', 0.5, 0, 6, () => { imp.imposta('mani', !imp.get('mani')); aggiornaImp(); });
pressImp('Ricentra ora', 0.24, -0.13, 7, () => controller.richiediRicentra());
pressImp('Chiudi', 0.24, 0.13, 7, () => { gruppoImp.visible = false; });
// Il pannello ruota/si sposta attorno al proprio centro (si puo' prendere con la presa laterale)
// Sfondo scuro del pannello (si puo' afferrare ovunque con la presa laterale per spostarlo)
const sfondoImp = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.3), new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.8 }));
sfondoImp.position.set(0, 1.3, Z_IMP - 0.01); gruppoImp.add(sfondoImp);
// Il pannello si apre davanti allo sguardo (in VR un po' rimpicciolito), poi resta fermo e si puo' spostare
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _dir = new THREE.Vector3();
function posizionaPannelloImp() {
  camera.getWorldPosition(_cp); camera.getWorldQuaternion(_cq);
  _dir.set(0, 0, -1).applyQuaternion(_cq); _dir.y = 0;
  if (_dir.lengthSq() < 1e-4) _dir.set(0, 0, -1);
  _dir.normalize();
  const vr = renderer.xr.isPresenting, dist = vr ? 0.8 : 1.0;
  gruppoImp.position.set(_cp.x + _dir.x * dist, _cp.y - 0.08, _cp.z + _dir.z * dist);
  gruppoImp.rotation.set(0, Math.atan2(-_dir.x, -_dir.z), 0);
  gruppoImp.scale.setScalar(vr ? 0.6 : 0.8);
}
for (const f of gruppoImp.children) f.position.sub(new THREE.Vector3(0, 1.4, Z_IMP));
// Rotellina: in VR resta sempre in alto a destra nel campo visivo (segue la testa con un leggero ritardo).
// Su desktop c'e' il pulsante HTML in alto a destra (vedi index.html).
const rotellina = new Pulsante3D('', 0.08, 0.08, () => { gruppoImp.visible = !gruppoImp.visible; if (gruppoImp.visible) posizionaPannelloImp(); }, 'ingranaggio');
scena.add(rotellina.mesh); tutti.push(rotellina.mesh);
rotellina.mesh.visible = false;
const OFFSET_ROTELLINA = new THREE.Vector3(0.2, 0.15, -0.6);   // destra, su, davanti (m) rispetto agli occhi
const _bersaglio = new THREE.Vector3();
function aggiornaRotellina() {
  const vr = renderer.xr.isPresenting;
  if (!vr) { rotellina.mesh.visible = false; return; }
  camera.getWorldPosition(_cp); camera.getWorldQuaternion(_cq);
  _bersaglio.copy(OFFSET_ROTELLINA).applyQuaternion(_cq).add(_cp);
  if (!rotellina.mesh.visible) rotellina.mesh.position.copy(_bersaglio);   // prima volta: subito al suo posto
  rotellina.mesh.visible = true;
  rotellina.mesh.position.lerp(_bersaglio, 0.12);                         // poi la insegue con dolcezza
  rotellina.mesh.lookAt(_cp);                                               // sempre girata verso gli occhi
}
// Su desktop la stessa funzione e' nel pulsante in alto a destra (vedi index.html)
document.getElementById('impostazioni')?.addEventListener('click', () => { gruppoImp.visible = !gruppoImp.visible; if (gruppoImp.visible) posizionaPannelloImp(); });

function apriDna() {
  gruppoMenu.visible = false; gruppoMol.visible = false; gruppoTav.visible = false; gruppoDna.visible = true;
  modulo.pulisci(); tavola.mostra(false); dna.avvia();
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.4, -0.8), 1.4, 0, 0.12);
  guida('<b>DNA.</b> Trascina i pezzi sulla base giusta: A con T, C con G. Puoi riprenderli per staccarli. Trascina lo sfondo per ruotare. Visore: grilletto o presa per afferrare.');
}
function apriTavola() {
  gruppoMenu.visible = false; gruppoMol.visible = false; gruppoTav.visible = true; gruppoDna.visible = false;
  modulo.pulisci(); dna.pulisci(); tavola.mostra(true);
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.55, -1.0), 1.9, 0, 0.1);
  guida('<b>Tavola periodica.</b> Clicca un elemento per vedere le informazioni e il modello dell\'atomo (gli elettroni esterni sono arancioni). Visore: punta e premi il grilletto.');
}
function apriMolecole(formula) {
  gruppoMenu.visible = false; gruppoMol.visible = true; gruppoTav.visible = false; gruppoDna.visible = false; tavola.mostra(false); dna.pulisci();
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.3, -0.7), 1.35, 0, 0.23);
  guida('<b>Costruisci la molecola.</b> Trascina un atomo e avvicinalo a un altro per legarli; trascina lo sfondo per ruotare, rotella per lo zoom. Visore: grilletto o presa per afferrare.');
  for (const [f, b] of Object.entries(bottoniMolecola)) b.imposta(f === formula ? 'selezionato' : 'normale');
  modulo.avvia(null, undefined, formula);
}
function apriMenu() {
  modulo.pulisci(); tavola.mostra(false); dna.pulisci();
  gruppoMol.visible = false; gruppoTav.visible = false; gruppoDna.visible = false; gruppoMenu.visible = true;
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.4, -1.0), 1.5, 0, 0.1);
  guida('<b>Scienze VR.</b> Scegli un\'attività cliccando il pulsante.');
}
let vistaDesktop = null;   // assegnata sotto, dopo aver creato i controlli desktop
apriMenu();

// Si puo' afferrare solo gli atomi; i pulsanti si premono (non si afferrano).
const afferrabili = () => [...modulo.afferrabili, ...dna.afferrabili];
const alAfferra = (o) => (dna.pezzi.includes(o) ? dna.alAfferra(o) : modulo.alAfferra(o));
const alRilascio = (o) => (dna.pezzi.includes(o) ? dna.alRilascio(o) : modulo.alRilascio(o));
const alPremi = (mesh) => {
  audio.sblocca();
  if (!mesh.userData.nessunSuono && !mesh.userData.elemento) audio.suono('click');   // le caselle della tavola hanno il loro suono
  premi(mesh);
};

// --- Oggetti grandi spostabili con la presa laterale: schede e blocchi (molecola, elica) ---
const dentro = (o, radice) => { for (let x = o; x; x = x.parent) if (x === radice) return true; return false; };
const schede = [pannello.mesh, pannelloDna.mesh, tavola.pannello.mesh];
// Blocchi grandi spostabili con la presa laterale: tutto il menu, la tavola, il modello dell'atomo
const gruppiBlocco = [gruppoMenu, gruppoImp, tavola.tabella, tavola.atomo];
// Posizione iniziale di schede e blocchi, per poterli riportare al loro posto con il tasto di ricentramento
const iniziali = [...schede, ...gruppiBlocco].map((m) => ({ m, p: m.position.clone(), r: m.rotation.clone(), s: m.scale.clone() }));
function riportaOggetti() {
  for (const { m, p, r, s } of iniziali) { m.position.copy(p); m.rotation.copy(r); m.scale.copy(s); }
  dna.riportaElica();
}
function bloccoDi(colpito) {
  const molecola = modulo.blocco(colpito); if (molecola) return molecola;
  const elica = dna.blocco(colpito); if (elica) return elica;
  const scheda = schede.find((m) => dentro(colpito, m));
  if (scheda) return { oggetto: scheda, scalabile: true };
  if (dentro(colpito, tavola.atomo)) return { oggetto: tavola.atomo, scalabile: true, avvicina: 0.35 };   // l'atomo si avvicina alla mano
  const gruppo = gruppiBlocco.find((g) => dentro(colpito, g));
  return gruppo ? { oggetto: gruppo, scalabile: true } : null;
}

// --- Ingressi: controller del visore + mouse su desktop ---
const visuali = creaVisualiInput(renderer, scena);     // modelli dei controller / mani in VR
const controller = new GestoreControllerXR(renderer, scena, afferrabili, {
  onAfferra: (o) => { audio.sblocca(); alAfferra(o); }, onRilascia: alRilascio,
  premibili: () => tutti, onPremi: alPremi,
  grandi: () => [...schede, titolo.mesh, tavola.atomo, dna.helice, sfondoImp], blocco: bloccoDi,
  onRicentra: riportaOggetti,
});
aggiornaImp();   // applica le impostazioni salvate (audio, mani, posizione, distanza)
vistaDesktop = new ControlliDesktop(renderer.domElement, camera, scena, afferrabili, {
  onAfferra: alAfferra, onRilascia: alRilascio,
  premibili: () => tutti, onPremi: alPremi,
  bersaglio: new THREE.Vector3(0, 1.3, -0.7),
  attivo: () => !renderer.xr.isPresenting,
});

// --- Pulsante VR (solo se il visore supporta immersive-vr) ---
const supporto = await rilevaSupportoXR();
if (supporto.vr) {
  document.getElementById('pulsanti').prepend(creaPulsanteXR(renderer, 'immersive-vr', {
    onInizio: () => controller.richiediRicentra(),   // all'ingresso in VR: vista centrata e all'altezza giusta
    onFine: () => controller.rilasciaTutto(),
  }));
}

// Diagnosi dell'hand tracking: mostra nel pannello Impostazioni se il visore lo ha concesso e se vede le mani
let ultimoStatoMani = '';
function aggiornaStatoMani() {
  const sess = renderer.xr.getSession && renderer.xr.getSession();
  let testo = 'Mani: entra in VR per verificare';
  if (sess) {
    const concesso = sess.enabledFeatures ? sess.enabledFeatures.includes('hand-tracking') : null;
    const n = visuali.stato.mani;
    testo = concesso === false ? 'Hand tracking NON concesso dal browser'
      : n > 0 ? `Mani viste: ${n} (giunti ${visuali.stato.giunti}). Pizzica per afferrare`
      : 'Nessuna mano vista: spegni i controller e mostra le mani';
  }
  if (testo !== ultimoStatoMani) { ultimoStatoMani = testo; statoMani.imposta([{ testo, dimensione: 44, colore: '#ffffff' }]); }
}
renderer.setAnimationLoop((t, frame) => { aggiornaRotellina(); if (gruppoImp.visible) aggiornaStatoMani(); controller.aggiorna(frame); visuali.aggiorna(frame); modulo.aggiorna(); tavola.aggiorna(t / 1000); dna.aggiorna(t / 1000); renderer.render(scena, camera); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Per i test automatici da console / script (non serve all'utente).
window.__scienzeVr = { audio, titolo, gruppoMenu, bloccoDi, grandi: () => [...schede, titolo.mesh, tavola.atomo, dna.helice], modulo, tavola, dna, apriDna, camera, scena, THREE, tutti, apriMolecole, apriMenu, apriTavola };
