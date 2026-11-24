// Audio condiviso: musica ambient di sottofondo ed effetti sonori, tutto GENERATO IN CODICE con Web Audio
// (nessun file audio, nessuna licenza da rispettare, niente da scaricare).
// Il browser permette l'audio solo dopo un gesto dell'utente: chiamare `sblocca()` da un clic/pressione.
export class Audio {
  constructor() {
    this.ctx = null;
    this.musicaAttiva = true;        // il pulsante "Audio" accende/spegne musica ed effetti
    this._avviata = false;
  }

  /** Crea/riattiva l'audio (da chiamare dentro un gesto dell'utente). Sicura da chiamare piu' volte. */
  sblocca() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = this.musicaAttiva ? 1 : 0;
        this.master.connect(this.ctx.destination);
        this.musica = this.ctx.createGain(); this.musica.gain.value = 0.22;   // la musica resta bassa, sotto gli effetti
        // Eco morbido per dare spazio ai suoni (ritardo con retroazione)
        const ritardo = this.ctx.createDelay(1.0); ritardo.delayTime.value = 0.42;
        const retro = this.ctx.createGain(); retro.gain.value = 0.38;
        ritardo.connect(retro); retro.connect(ritardo);
        this.musica.connect(this.master); this.musica.connect(ritardo); ritardo.connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this._avviata) { this._avviata = true; this._avviaMusica(); }
    } catch (e) { /* audio non disponibile: l'app funziona lo stesso */ }
  }

  /** Accende o spegne tutto l'audio. Restituisce il nuovo stato. */
  alterna() {
    this.musicaAttiva = !this.musicaAttiva;
    if (this.master) this.master.gain.setTargetAtTime(this.musicaAttiva ? 1 : 0, this.ctx.currentTime, 0.2);
    return this.musicaAttiva;
  }

  // ---------- Musica: pad lento che cambia accordo + campanelle casuali ----------

  _avviaMusica() {
    // Accordi (Hz): La minore 9, Fa maggiore 7, Do maggiore, Sol maggiore: calmi, adatti allo studio
    const accordi = [
      [110.0, 164.81, 220.0, 261.63, 329.63],
      [87.31, 130.81, 174.61, 220.0, 329.63],
      [130.81, 196.0, 261.63, 329.63, 392.0],
      [98.0, 146.83, 196.0, 246.94, 392.0],
    ];
    const pentatonica = [440.0, 523.25, 587.33, 659.25, 783.99, 880.0];   // La minore pentatonica
    let i = 0;
    const cambia = () => {
      if (!this.ctx) return;
      this._pad(accordi[i % accordi.length], 14);
      i++;
    };
    cambia();
    this._timerPad = setInterval(cambia, 10000);       // gli accordi si sovrappongono (dissolvenze lunghe)
    const campanella = () => {
      if (this.ctx && this.musicaAttiva) {
        this._nota(pentatonica[Math.floor(Math.random() * pentatonica.length)], 0, 3.2, 'sine', 0.35, this.musica);
      }
      this._timerCamp = setTimeout(campanella, 3000 + Math.random() * 5000);
    };
    this._timerCamp = setTimeout(campanella, 4000);
  }

  /** Un accordo di "pad": onde dolci con attacco e rilascio lenti, filtrate. */
  _pad(freqs, durata) {
    const t = this.ctx.currentTime;
    const filtro = this.ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 900;
    filtro.connect(this.musica);
    for (const f of freqs) {
      const o = this.ctx.createOscillator(); o.type = Math.random() < 0.5 ? 'sine' : 'triangle';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);   // leggerissima stonatura: suono piu' caldo
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 4);
      g.gain.setValueAtTime(0.07, t + durata - 5);
      g.gain.linearRampToValueAtTime(0, t + durata);
      o.connect(g); g.connect(filtro);
      o.start(t); o.stop(t + durata + 0.1);
    }
  }

  // ---------- Effetti sonori ----------

  /** Una nota con attacco rapido e caduta esponenziale. inizio in secondi da adesso. */
  _nota(freq, inizio, durata, tipo = 'sine', vol = 0.2, uscita = null, freqFine = null) {
    const t = this.ctx.currentTime + inizio;
    const o = this.ctx.createOscillator(); o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (freqFine) o.frequency.exponentialRampToValueAtTime(freqFine, t + durata);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    o.connect(g); g.connect(uscita || this.master);
    o.start(t); o.stop(t + durata + 0.05);
  }

  /** Riproduce un effetto: 'click', 'prendi', 'legame', 'errore', 'successo', 'tick', 'aggancio'. */
  suono(nome) {
    if (!this.ctx || !this.musicaAttiva || this.ctx.state !== 'running') return;
    switch (nome) {
      case 'click':    this._nota(880, 0, 0.08, 'sine', 0.18); break;
      case 'tick':     this._nota(660, 0, 0.06, 'triangle', 0.14); break;
      case 'prendi':   this._nota(330, 0, 0.09, 'triangle', 0.16, null, 440); break;
      case 'legame':   this._nota(523.25, 0, 0.16, 'triangle', 0.2); this._nota(783.99, 0.09, 0.22, 'triangle', 0.2); break;
      case 'aggancio': this._nota(392, 0, 0.12, 'triangle', 0.2); this._nota(587.33, 0.07, 0.2, 'sine', 0.18); break;
      case 'errore':   this._nota(200, 0, 0.28, 'sawtooth', 0.1, null, 120); break;
      case 'successo': [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => this._nota(f, k * 0.12, 0.5, 'triangle', 0.2)); break;
    }
  }
}
