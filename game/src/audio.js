// All sound is synthesised with WebAudio: no audio files, no network. A
// tiny pentatonic pluck for shots, a chime for kills, a low thud for damage,
// a harp arpeggio for wave clears, a fanfare for victory — and a soft night
// drone underneath it all once the player first interacts, so the garden
// hums even between waves. Everything is guarded so a missing or locked
// AudioContext never breaks the game.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let drone = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  /** The night drone: two slow detuned sines, barely there, started once. */
  function startDrone() {
    const ctx = ensure();
    if (!ctx || !master || drone) return;
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2);
      gain.connect(master);
      const voices = [110, 164.81].map((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start();
        return osc;
      });
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      drone = { gain, voices, lfo };
    } catch {
      drone = null;
    }
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = null) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx || !master) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const start = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + seconds);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    } catch {
      // Sound is garnish; a failed note never stops the game.
    }
  }

  return {
    unlock() {
      ensure();
      startDrone();
    },
    toggleMute() {
      muted = !muted;
      if (drone) drone.gain.gain.value = muted ? 0 : 0.05;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone(880, 0.09, 'triangle', 0.5, 0, 1320);
    },
    kill() {
      tone(523.25, 0.12, 'sine', 0.55);
      tone(783.99, 0.16, 'sine', 0.45, 0.05);
    },
    hurt() {
      tone(160, 0.25, 'sawtooth', 0.6, 0, 70);
    },
    bloomHurt() {
      tone(220, 0.2, 'square', 0.35, 0, 110);
    },
    pickup() {
      tone(659.25, 0.1, 'sine', 0.5);
      tone(987.77, 0.18, 'sine', 0.5, 0.07);
    },
    /** A wet little blip: a spitter lobbing a spore at a bloom. */
    spit() {
      tone(300, 0.16, 'sine', 0.4, 0, 140);
    },
    /** A spore popped out of the air. */
    sporePop() {
      tone(740, 0.07, 'triangle', 0.4, 0, 1180);
    },
    waveClear() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.5, i * 0.09));
    },
    waveStart() {
      tone(392, 0.18, 'triangle', 0.45);
      tone(587.33, 0.24, 'triangle', 0.45, 0.1);
    },
    bossRoar() {
      tone(98, 0.6, 'sawtooth', 0.55, 0, 55);
      tone(147, 0.5, 'sawtooth', 0.4, 0.12, 82);
    },
    /** The Queen enrages: a rising snarl over the drone. */
    enrage() {
      tone(130, 0.5, 'sawtooth', 0.5, 0, 260);
      tone(196, 0.4, 'sawtooth', 0.35, 0.08, 320);
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.3, 'triangle', 0.5, i * 0.12));
    },
    gameOver() {
      [392, 329.63, 261.63, 196].forEach((f, i) => tone(f, 0.35, 'triangle', 0.5, i * 0.16));
    },
  };
}
