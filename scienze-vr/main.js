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
const VERSIONE = 12;
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
scena.background = new THREE.Color(0x0f1a2e);   // colore del cielo fuori dalla stanza (non si vede, ma serve in AR/uscita)
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 50);
camera.position.set(0, 1.6, 0.6);               // vista desktop; in VR la camera la muove il visore

scena.add(new THREE.HemisphereLight(0xeaf2ff, 0x3a3f58, 1.25));   // luce d'ambiente fredda dall'alto, calda-scura dal basso
const luce = new THREE.DirectionalLight(0xfff2de, 1.7); luce.position.set(1.5, 3, 2); scena.add(luce);   // luce principale leggermente calda
const luceFredda = new THREE.DirectionalLight(0x8fb8ff, 0.5); luceFredda.position.set(-2, 1.5, -1); scena.add(luceFredda);   // controluce azzurra
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
const titolo = new PannelloTesto(1.0, 0.58, 1024);
titolo.imposta([
  { testo: 'Scienze VR', dimensione: 84, grassetto: true },
  { testo: 'Grilletto: premi un pulsante, prendi un atomo o un pezzo', dimensione: 34, colore: '#9ecbff' },
  { testo: 'Presa laterale: prendi la molecola intera, l\'elica o una scheda', dimensione: 34, colore: '#9ecbff' },
  { testo: 'Levetta: avvicina/allontana (su-giù) e ruota (destra-sinistra)', dimensione: 34, colore: '#9ecbff' },
  { testo: 'Tasto A/B (X/Y): ricentra la vista. Due mani: ruoti e ingrandisci', dimensione: 34, colore: '#9ecbff' },
  { testo: 'Mani: pizzica pollice+indice (premi/afferra), pollice+medio (blocchi)', dimensione: 34, colore: '#7dffc0' },
]);
titolo.mesh.position.set(0, 1.95, -1.1); gruppoMenu.add(titolo.mesh);
// Stelle migliori ottenute nelle sfide (salvate nel browser): si vedono nel menu
const prog = new Impostazioni('scienze-vr-progressi', { molecole: 0, tavola: 0, dna: 0 });
const stelleTxt = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const stelleDa = (punti, max) => (punti >= max * 0.9 ? 3 : punti >= max * 0.6 ? 2 : punti >= max * 0.3 ? 1 : 0);
const btnMenu = {};
btnMenu.molecole = pulsante('1  Costruisci la molecola', 0.7, 0.16, new THREE.Vector3(0, 1.55, -1.0), () => apriMolecole('H2O'), gruppoMenu);
btnMenu.tavola = pulsante('2  Tavola periodica', 0.7, 0.16, new THREE.Vector3(0, 1.35, -1.0), () => apriTavola(), gruppoMenu);
btnMenu.dna = pulsante('3  DNA', 0.7, 0.16, new THREE.Vector3(0, 1.15, -1.0), () => apriDna(), gruppoMenu);
const ETICHETTE_MENU = { molecole: '1  Molecole', tavola: '2  Tavola periodica', dna: '3  DNA' };
function aggiornaMenu() { for (const k of Object.keys(btnMenu)) btnMenu[k].imposta('normale', `${ETICHETTE_MENU[k]}   ${stelleTxt(prog.get(k))}`); }
function registraStelle(chiave, stelle) { if (stelle > prog.get(chiave)) { prog.imposta(chiave, stelle); aggiornaMenu(); } }
aggiornaMenu();
// Il gruppo menu ruota/si sposta attorno al proprio centro: origine al centro dei pulsanti
gruppoMenu.position.set(0, 1.55, -1.05);
for (const f of gruppoMenu.children) f.position.sub(gruppoMenu.position);

// Gruppo "molecole": pannello di riscontro + barra di pulsanti
const gruppoMol = new THREE.Group(); scena.add(gruppoMol);
gruppoMol.add(pannello.mesh);
const bottoniMolecola = {};
Object.keys(molecoleNote).filter((k) => !k.startsWith('_')).forEach((formula, i) => {
  const riga = i < 5 ? 0 : 1, col = i % 5;   // due file di 5 pulsanti
  bottoniMolecola[formula] = pulsante(formula.replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[c]), 0.18, 0.12,
    new THREE.Vector3(-0.55 + col * 0.2, 0.85 + riga * 0.14, -0.55 - riga * 0.05), () => apriMolecole(formula), gruppoMol, -0.6);
});
pulsante('Ricomincia', 0.28, 0.12, new THREE.Vector3(0.5, 0.85, -0.55), () => modulo.avvia(null), gruppoMol, -0.6);
const btnSfidaMol = pulsante('Sfida', 0.24, 0.12, new THREE.Vector3(0.52, 0.99, -0.6), () => {
  if (modulo.sfida) { modulo.fermaSfida(); btnSfidaMol.imposta('normale', 'Sfida'); }
  else { modulo.avviaSfida(5); btnSfidaMol.imposta('selezionato', 'Sfida: esci'); for (const b of Object.values(bottoniMolecola)) b.imposta('normale'); }
}, gruppoMol, -0.6);
modulo.alFineSfida = (punti, max) => { registraStelle('molecole', stelleDa(punti, max)); btnSfidaMol.imposta('normale', 'Sfida'); };
pulsante('Ricentra', 0.24, 0.12, new THREE.Vector3(-0.78, 0.85, -0.55), () => controller.richiediRicentra(), gruppoMol, -0.6);
pulsante('Menu', 0.2, 0.12, new THREE.Vector3(0.78, 0.85, -0.55), () => apriMenu(), gruppoMol, -0.6);

// Pulsante "Menu" anche nella tavola periodica
const gruppoTav = new THREE.Group(); scena.add(gruppoTav);
pulsante('Menu', 0.2, 0.12, new THREE.Vector3(0.78, 0.85, -0.55), () => apriMenu(), gruppoTav, -0.6);
pulsante('Ricentra', 0.24, 0.12, new THREE.Vector3(0.5, 0.85, -0.55), () => controller.richiediRicentra(), gruppoTav, -0.6);
const btnFamiglie = pulsante('Famiglie', 0.3, 0.12, new THREE.Vector3(-0.1, 0.85, -0.55), () => {
  if (tavola.sfida) return;
  const cat = tavola.prossimaFamiglia(); btnFamiglie.imposta(cat ? 'selezionato' : 'normale', 'Famiglie');
}, gruppoTav, -0.6);
const btnSfidaTav = pulsante('Sfida', 0.22, 0.12, new THREE.Vector3(0.2, 0.85, -0.55), () => {
  if (tavola.sfida) { tavola.fermaSfida(); btnSfidaTav.imposta('normale', 'Sfida'); }
  else { tavola.avviaSfida(5); btnSfidaTav.imposta('selezionato', 'Esci'); btnFamiglie.imposta('normale', 'Famiglie'); }
}, gruppoTav, -0.6);
tavola.alFineSfida = (punti, max) => { registraStelle('tavola', stelleDa(punti, max)); btnSfidaTav.imposta('normale', 'Sfida'); };
tavola.celle.forEach((c) => tutti.push(c));   // anche le caselle si premono col raggio

// Gruppo "DNA": pannello e pulsanti
const gruppoDna = new THREE.Group(); scena.add(gruppoDna);
gruppoDna.add(pannelloDna.mesh);
pulsante('Nuova sequenza', 0.36, 0.12, new THREE.Vector3(0.45, 0.65, -0.5), () => dna.avvia(), gruppoDna, -0.6);
const btnModoDna = pulsante('Replicazione', 0.4, 0.12, new THREE.Vector3(-0.32, 0.65, -0.5), () => {
  const nuovo = dna.modo === 'replicazione' ? 'trascrizione' : 'replicazione';
  btnModoDna.imposta('normale', nuovo === 'replicazione' ? 'Replicazione' : 'Trascrizione RNA'); dna.avvia(nuovo);
}, gruppoDna, -0.6);
dna.alCompleta = (modo, stelle) => registraStelle('dna', stelle);
pulsante('Menu', 0.2, 0.12, new THREE.Vector3(0.78, 0.65, -0.5), () => apriMenu(), gruppoDna, -0.6);
pulsante('Ricentra', 0.24, 0.12, new THREE.Vector3(0.1, 0.65, -0.5), () => controller.richiediRicentra(), gruppoDna, -0.6);

// --- Impostazioni (rotellina sempre visibile): audio, volumi, posizione, distanza, mani ---
const imp = new Impostazioni('scienze-vr-impostazioni', { audio: true, volMusica: 0.6, volEffetti: 0.8, seduto: true, distanza: 'normale', input: 'auto', alza: 0 });
audio.impostaAttivo(imp.get('audio')); audio.impostaVolumi(imp.get('volMusica'), imp.get('volEffetti'));
const DISTANZE = { vicino: 0.5, normale: 0, lontano: -0.3 };   // metri di avvicinamento alla scena al ricentramento
const gruppoImp = new THREE.Group(); scena.add(gruppoImp); gruppoImp.visible = false;
const titoloImp = new PannelloTesto(0.5, 0.1, 512);
titoloImp.imposta([{ testo: 'Impostazioni', dimensione: 60, grassetto: true }]);
titoloImp.mesh.position.set(0, 1.86, -0.8); gruppoImp.add(titoloImp.mesh);
const statoMani = new PannelloTesto(0.5, 0.22, 512);       // diagnosi dell'hand tracking
statoMani.mesh.position.set(0, 0.74, -0.8); gruppoImp.add(statoMani.mesh);
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
  const modo = imp.get('input');
  bImp.mani.imposta(modo === 'auto' ? 'normale' : 'selezionato', 'Input: ' + { auto: 'auto', mani: 'solo mani', controller: 'solo controller' }[modo]);
  const cm = Math.round(imp.get('alza') * 100);
  bImp.alza.imposta('disattivo', 'Altezza ' + (cm > 0 ? '+' : '') + cm + ' cm');
  audio.impostaAttivo(on); audio.impostaVolumi(imp.get('volMusica'), imp.get('volEffetti'));
  controller.modoInput = modo; visuali.visibili = modo !== 'controller';
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
bImp.mani = pressImp('Input', 0.5, 0, 6, () => { const o = ['auto', 'mani', 'controller']; imp.imposta('input', o[(o.indexOf(imp.get('input')) + 1) % 3]); aggiornaImp(); });
pressImp('Ricentra ora', 0.24, -0.13, 7, () => controller.richiediRicentra());
pressImp('Chiudi', 0.24, 0.13, 7, () => { gruppoImp.visible = false; });
// Il pannello ruota/si sposta attorno al proprio centro (si puo' prendere con la presa laterale)
// Sfondo scuro del pannello (si puo' afferrare ovunque con la presa laterale per spostarlo)
const sfondoImp = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.42), new THREE.MeshBasicMaterial({ color: 0x0b1220, transparent: true, opacity: 0.8 }));
sfondoImp.position.set(0, 1.26, Z_IMP - 0.01); gruppoImp.add(sfondoImp);
// Il pannello si apre davanti allo sguardo (in VR un po' rimpicciolito), poi resta fermo e si puo' spostare
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _dir = new THREE.Vector3();
function posizionaPannelloImp() {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;   // in VR serve la camera del visore
  cam.getWorldPosition(_cp); cam.getWorldQuaternion(_cq);
  _dir.set(0, 0, -1).applyQuaternion(_cq); _dir.y = 0;
  if (_dir.lengthSq() < 1e-4) _dir.set(0, 0, -1);
  _dir.normalize();
  const vr = renderer.xr.isPresenting, dist = 1.0;
  gruppoImp.position.set(_cp.x + _dir.x * dist, _cp.y - 0.05, _cp.z + _dir.z * dist);
  gruppoImp.rotation.set(0, Math.atan2(-_dir.x, -_dir.z), 0);
  gruppoImp.scale.setScalar(vr ? 1.0 : 0.8);   // in VR grande, per leggerlo bene
}
for (const f of gruppoImp.children) f.position.sub(new THREE.Vector3(0, 1.4, Z_IMP));
// Rotellina: e' l'ULTIMO pulsante di ogni schermata (menu, molecole, tavola, DNA), vicino agli altri. Si crea con aggiungiRotellina().
function apriImpostazioni() { gruppoImp.visible = !gruppoImp.visible; if (gruppoImp.visible) posizionaPannelloImp(); }
function aggiungiRotellina(gruppo, pos, inclina = 0, lato = 0.12) {
  const r = new Pulsante3D('', lato, lato, apriImpostazioni, 'ingranaggio');
  r.mesh.position.copy(pos); r.mesh.rotation.x = inclina;
  gruppo.add(r.mesh); tutti.push(r.mesh);
  return r;
}
// Su desktop la stessa funzione e' nel pulsante in alto a destra (vedi index.html)
document.getElementById('impostazioni')?.addEventListener('click', apriImpostazioni);

// Rotellina come ultimo pulsante di ogni schermata
aggiungiRotellina(gruppoMenu, new THREE.Vector3(0, 0.92, -1.0).sub(gruppoMenu.position), 0, 0.16);
aggiungiRotellina(gruppoMol, new THREE.Vector3(0.96, 0.85, -0.55), -0.6);
aggiungiRotellina(gruppoTav, new THREE.Vector3(0.96, 0.85, -0.55), -0.6);
aggiungiRotellina(gruppoDna, new THREE.Vector3(0.96, 0.65, -0.5), -0.6);

function apriDna() {
  gruppoMenu.visible = false; gruppoMol.visible = false; gruppoTav.visible = false; gruppoDna.visible = true;
  modulo.pulisci(); tavola.mostra(false); dna.avvia(dna.modo);
  btnModoDna.imposta('normale', dna.modo === 'replicazione' ? 'Replicazione' : 'Trascrizione RNA');
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.4, -0.8), 1.4, 0, 0.12);
  guida('<b>DNA.</b> Trascina i pezzi sulla base giusta: A con T, C con G. Puoi riprenderli per staccarli. Trascina lo sfondo per ruotare. Visore: grilletto o presa per afferrare.');
}
function apriTavola() {
  gruppoMenu.visible = false; gruppoMol.visible = false; gruppoTav.visible = true; gruppoDna.visible = false;
  modulo.pulisci(); dna.pulisci(); tavola.mostra(true);
  btnSfidaTav.imposta('normale', 'Sfida'); btnFamiglie.imposta('normale', 'Famiglie');
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.55, -1.0), 1.9, 0, 0.1);
  guida('<b>Tavola periodica.</b> Clicca un elemento per vedere le informazioni e il modello dell\'atomo (gli elettroni esterni sono arancioni). Visore: punta e premi il grilletto.');
}
function apriMolecole(formula) {
  gruppoMenu.visible = false; gruppoMol.visible = true; gruppoTav.visible = false; gruppoDna.visible = false; tavola.mostra(false); dna.pulisci();
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.3, -0.7), 1.35, 0, 0.23);
  guida('<b>Costruisci la molecola.</b> Trascina un atomo e avvicinalo a un altro per legarli; trascina lo sfondo per ruotare, rotella per lo zoom. Visore: grilletto o presa per afferrare.');
  for (const [f, b] of Object.entries(bottoniMolecola)) b.imposta(f === formula ? 'selezionato' : 'normale');
  modulo.sfida = null; btnSfidaMol.imposta('normale', 'Sfida');
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
    onInizio: () => {   // all'ingresso in VR: vista centrata e all'altezza giusta; si ripete dopo che il tracciamento si e' assestato
      controller.richiediRicentraStabile();   // un solo ricentro, a testa ferma
    },
    onFine: () => controller.rilasciaTutto(),
  }));
}

// Diagnosi dell'hand tracking: mostra nel pannello Impostazioni se il visore lo ha concesso e se vede le mani
let ultimoStatoMani = '';
function aggiornaStatoMani() {
  const sess = renderer.xr.getSession && renderer.xr.getSession();
  let righe;
  if (!sess) righe = [['Entra in VR per', '#ffffff'], ['verificare le mani', '#ffffff'], ['Versione ' + VERSIONE, '#9ecbff']];
  else {
    const concesso = sess.enabledFeatures ? sess.enabledFeatures.includes('hand-tracking') : null;
    const src = [...sess.inputSources];
    const nMani = src.filter((i) => i.hand).length, nCtrl = src.length - nMani;
    righe = [[`Mani viste: ${nMani}  Controller: ${nCtrl}`, nMani ? '#7dff9b' : '#ffd37d'],
             [concesso === false ? 'Hand tracking NON concesso' : 'Hand tracking: concesso', concesso === false ? '#ff8080' : '#ffffff'],
             [nMani ? 'Pizzica indice+pollice' : 'Mostra le mani al visore', '#ffffff'], ['Versione ' + VERSIONE, '#9ecbff']];
  }
  const testo = righe.map((r) => r[0]).join('|');
  if (testo !== ultimoStatoMani) { ultimoStatoMani = testo; statoMani.imposta(righe.map(([t, c]) => ({ testo: t, dimensione: 40, colore: c }))); }
}
renderer.setAnimationLoop((t, frame) => { if (gruppoImp.visible) aggiornaStatoMani(); controller.aggiorna(frame); visuali.aggiorna(frame); modulo.aggiorna(); tavola.aggiorna(t / 1000); dna.aggiorna(t / 1000); renderer.render(scena, camera); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Per i test automatici da console / script (non serve all'utente).
window.__scienzeVr = { audio, titolo, gruppoMenu, bloccoDi, grandi: () => [...schede, titolo.mesh, tavola.atomo, dna.helice], modulo, tavola, dna, apriDna, camera, scena, THREE, tutti, apriMolecole, apriMenu, apriTavola };
