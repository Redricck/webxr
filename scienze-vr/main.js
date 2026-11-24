// scienze-vr: avvio dell'app. Menu iniziale in VR + modulo 1 (molecole). Gli altri moduli arriveranno nei passi successivi.
import * as THREE from 'three';
import { rilevaSupportoXR, creaPulsanteXR } from 'comune/xr-supporto.js';
import { GestoreControllerXR, ControlliDesktop } from 'comune/controller.js';
import { PannelloTesto } from 'comune/pannello.js';
import { creaVisualiInput } from 'comune/mani.js';
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

function apriDna() {
  gruppoMenu.visible = false; gruppoMol.visible = false; gruppoTav.visible = false; gruppoDna.visible = true;
  modulo.pulisci(); tavola.mostra(false); dna.avvia();
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.4, -0.8), 1.4, 0, 0.12);
  guida('<b>DNA.</b> Trascina i pezzi sulla base giusta: A con T, C con G. Puoi riprenderli per staccarli. Trascina lo sfondo per ruotare. Visore: grilletto o presa per afferrare.');
}
function apriTavola() {
  gruppoMenu.visible = false; gruppoMol.visible = false; gruppoTav.visible = true; gruppoDna.visible = false;
  modulo.pulisci(); dna.pulisci(); tavola.mostra(true);
  vistaDesktop?.impostaVista(new THREE.Vector3(0, 1.55, -1.5), 2.0, 0, 0.1);
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
const alPremi = (mesh) => premi(mesh);

// --- Oggetti grandi spostabili con la presa laterale: schede e blocchi (molecola, elica) ---
const dentro = (o, radice) => { for (let x = o; x; x = x.parent) if (x === radice) return true; return false; };
const schede = [pannello.mesh, pannelloDna.mesh, tavola.pannello.mesh];
// Posizione iniziale delle schede, per poterle riportare al loro posto
const posizioniSchede = schede.map((m) => ({ m, p: m.position.clone(), r: m.rotation.clone(), s: m.scale.clone() }));
function riportaOggetti() {
  for (const { m, p, r, s } of posizioniSchede) { m.position.copy(p); m.rotation.copy(r); m.scale.copy(s); }
  dna.riportaElica();
}
function bloccoDi(colpito) {
  const molecola = modulo.blocco(colpito); if (molecola) return molecola;
  const elica = dna.blocco(colpito); if (elica) return elica;
  const scheda = schede.find((m) => dentro(colpito, m));
  return scheda ? { oggetto: scheda, scalabile: true } : null;
}

// --- Ingressi: controller del visore + mouse su desktop ---
const visuali = creaVisualiInput(renderer, scena);     // modelli dei controller / mani in VR
const controller = new GestoreControllerXR(renderer, scena, afferrabili, {
  onAfferra: alAfferra, onRilascia: alRilascio,
  premibili: () => tutti, onPremi: alPremi,
  grandi: () => [...schede, dna.helice], blocco: bloccoDi,
  onRicentra: riportaOggetti,
});
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

renderer.setAnimationLoop((t, frame) => { controller.aggiorna(frame); visuali.aggiorna(); modulo.aggiorna(); tavola.aggiorna(t / 1000); dna.aggiorna(t / 1000); renderer.render(scena, camera); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Per i test automatici da console / script (non serve all'utente).
window.__scienzeVr = { modulo, tavola, dna, apriDna, camera, scena, THREE, tutti, apriMolecole, apriMenu, apriTavola };
