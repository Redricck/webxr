// Impostazioni dell'utente salvate nel browser (localStorage): nessun dato personale, nessun invio in rete.
// Se il salvataggio non e' disponibile (es. navigazione privata) le impostazioni valgono solo per la sessione.
export class Impostazioni {
  /** @param chiave nome sotto cui salvare, @param predefiniti valori iniziali { nome: valore } */
  constructor(chiave, predefiniti) {
    this.chiave = chiave;
    this.valori = { ...predefiniti };
    try {
      const salvato = JSON.parse(localStorage.getItem(chiave) || '{}');
      for (const k of Object.keys(predefiniti)) if (typeof salvato[k] === typeof predefiniti[k]) this.valori[k] = salvato[k];
    } catch (e) { /* nessun salvataggio disponibile */ }
  }

  get(nome) { return this.valori[nome]; }

  imposta(nome, valore) {
    this.valori[nome] = valore;
    try { localStorage.setItem(this.chiave, JSON.stringify(this.valori)); } catch (e) { /* ok */ }
  }
}
