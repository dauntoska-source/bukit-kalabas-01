const VOLUME_STORAGE_KEY = 'nusa_tani_volume_v1';
const MUSIC_VOLUME_STORAGE_KEY = 'nusa_tani_music_volume_v1';
const BGM_SRC = '/assets/aistudio/Lesung___Kotak_Musik_Tani__Versi_2__890a5565.mp3';
const BGM_MAX_RATIO_TO_SFX = 0.8;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private volume = 1.0; // Default Mode Maksimal (100%)
  private musicVolume = 1.0; // Default 100% dari batas maksimal (80% volume SFX)
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private javaneseIntroGain: GainNode | null = null;
  private javaneseIntroTimer: number | null = null;
  private javaneseIntroStep = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
        if (saved !== null) {
          const parsed = parseFloat(saved);
          if (!Number.isNaN(parsed)) {
            this.volume = Math.max(0, Math.min(1, parsed));
          }
        }
        const savedMusic = localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
        if (savedMusic !== null) {
          const parsedMusic = parseFloat(savedMusic);
          if (!Number.isNaN(parsedMusic)) {
            this.musicVolume = Math.max(0, Math.min(1, parsedMusic));
          }
        }
      } catch {
        // ignore storage access issues
      }
    }
  }

  private ensureBgmElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.bgmAudio) {
      const audio = new Audio(BGM_SRC);
      audio.loop = true;
      audio.preload = 'auto';
      this.bgmAudio = audio;
      this.syncBgmVolume();
    }
    return this.bgmAudio;
  }

  private getEffectiveBgmVolume(): number {
    if (this.muted || this.volume <= 0 || this.musicVolume <= 0) return 0;
    return Math.max(0, Math.min(1, this.volume * this.musicVolume * BGM_MAX_RATIO_TO_SFX));
  }

  private syncBgmVolume() {
    if (!this.bgmAudio) return;
    const eff = this.getEffectiveBgmVolume();
    this.bgmAudio.volume = eff;
    this.bgmAudio.muted = eff <= 0;
  }

  public startBgm() {
    const audio = this.ensureBgmElement();
    if (!audio) return;
    this.syncBgmVolume();
    if (this.getEffectiveBgmVolume() <= 0) return;
    if (audio.paused) {
      audio.play().catch(() => {
        // Autoplay may be blocked until first user gesture; retried on interaction
      });
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || this.volume <= 0) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (!this.ctx) return null;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.masterGain) {
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
      compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      const master = this.ctx.createGain();
      // 1.35x master boost with limiter so 100% reaches true maximum loudness without clipping
      master.gain.setValueAtTime(this.muted ? 0 : this.volume * 1.35, this.ctx.currentTime);

      master.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.masterGain = master;
    }

    return this.ctx;
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    return this.masterGain ?? ctx.destination;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : this.volume * 1.35,
        this.ctx.currentTime,
        0.02
      );
    }
    this.syncBgmVolume();
    if (muted) {
      this.stopRainAmbience();
    } else {
      this.startBgm();
    }
  }

  public isMuted() {
    return this.muted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(this.volume));
    } catch {
      // ignore storage issues
    }
    if (this.volume > 0 && this.muted) {
      this.muted = false;
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume * 1.35,
        this.ctx.currentTime,
        0.02
      );
    }
    this.syncBgmVolume();
    if (this.volume <= 0) {
      this.stopRainAmbience();
    } else {
      this.startBgm();
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(this.musicVolume));
    } catch {
      // ignore storage issues
    }
    if (this.musicVolume > 0 && this.muted) {
      this.muted = false;
    }
    this.syncBgmVolume();
    if (this.musicVolume > 0 && this.volume > 0) {
      this.startBgm();
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.38
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playHoe() {
    this.playTone(165, 72, 0.12, 'triangle', 0.58);
  }

  public playPlant() {
    this.playTone(360, 560, 0.1, 'sine', 0.42);
  }

  public playWater() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * 0.2);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    const gain = ctx.createGain();
    gain.gain.value = 0.62;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    noise.start();
  }

  public playChop() {
    this.playTone(195, 65, 0.1, 'square', 0.34);
    setTimeout(() => this.playTone(125, 55, 0.08, 'triangle', 0.42), 30);
  }

  public playHarvest() {
    this.playTone(523.25, 523.25, 0.11, 'triangle', 0.42);
    setTimeout(() => this.playTone(659.25, 659.25, 0.11, 'triangle', 0.44), 55);
    setTimeout(() => this.playTone(783.99, 880, 0.18, 'sine', 0.48), 110);
  }

  public playCoin() {
    this.playTone(987.77, 987.77, 0.08, 'sine', 0.42);
    setTimeout(() => this.playTone(1318.51, 1318.51, 0.18, 'sine', 0.46), 65);
  }

  public playDoor() {
    this.playTone(250, 175, 0.14, 'sine', 0.42);
  }

  public playEat() {
    this.playTone(392, 523, 0.12, 'sine', 0.42);
    setTimeout(() => this.playTone(523, 659, 0.15, 'sine', 0.44), 90);
  }

  public playSleep() {
    this.playTone(440, 330, 0.25, 'sine', 0.36);
    setTimeout(() => this.playTone(330, 261.63, 0.35, 'sine', 0.34), 180);
  }

  public playError() {
    this.playTone(220, 160, 0.14, 'sawtooth', 0.28);
  }

  public playSword() {
    this.playTone(620, 210, 0.13, 'sawtooth', 0.36);
    setTimeout(() => this.playTone(880, 340, 0.08, 'triangle', 0.32), 25);
  }

  public playGunshot() {
    this.playTone(720, 110, 0.11, 'square', 0.42);
    setTimeout(() => this.playTone(180, 55, 0.14, 'sawtooth', 0.45), 15);
  }

  public playRobotHit() {
    this.playTone(150, 75, 0.12, 'square', 0.38);
  }

  public playRobotDefeat() {
    this.playTone(392, 523.25, 0.14, 'triangle', 0.44);
    setTimeout(() => this.playTone(523.25, 659.25, 0.14, 'triangle', 0.46), 80);
    setTimeout(() => this.playTone(659.25, 987.77, 0.26, 'sine', 0.50), 160);
  }

  public playTestSound() {
    this.playHarvest();
  }

  public updateRainAmbience(intensity: 'NONE' | 'LIGHT' | 'HEAVY') {
    if (this.muted || this.volume <= 0 || intensity === 'NONE') {
      this.stopRainAmbience();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    const targetGain = intensity === 'HEAVY' ? 0.22 : 0.11;
    if (!this.rainSource) {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.04 * white) / 1.04;
        lastOut = data[i];
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = intensity === 'HEAVY' ? 1400 : 900;

      const gain = ctx.createGain();
      gain.gain.value = targetGain;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.getOutputNode(ctx));
      source.start();

      this.rainSource = source;
      this.rainGain = gain;
    } else if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.2);
    }
  }

  public stopRainAmbience() {
    if (this.rainSource) {
      try {
        this.rainSource.stop();
        this.rainSource.disconnect();
      } catch {
        // ignore already stopped
      }
      this.rainSource = null;
      this.rainGain = null;
    }
  }

  public isAudioContextBlocked(): boolean {
    if (this.muted || this.volume <= 0 || this.musicVolume <= 0) return false;
    return !this.ctx || this.ctx.state !== 'running';
  }

  public startJavaneseIntroMusic(): boolean {
    if (this.muted || this.volume <= 0 || this.musicVolume <= 0) return false;
    const ctx = this.ensureContext();
    if (!ctx) return false;

    if (this.javaneseIntroTimer !== null) {
      if (this.javaneseIntroGain) {
        this.javaneseIntroGain.gain.setTargetAtTime(
          this.musicVolume * BGM_MAX_RATIO_TO_SFX * 0.72,
          ctx.currentTime,
          0.08
        );
      }
      return ctx.state === 'running';
    }

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(
      this.musicVolume * BGM_MAX_RATIO_TO_SFX * 0.72,
      ctx.currentTime + 0.35
    );
    bus.connect(this.getOutputNode(ctx));
    this.javaneseIntroGain = bus;
    this.javaneseIntroStep = 0;

    // Slendro Javanese pastoral frequencies (1=C4, 2=D4, 3=E4, 5=G4, 6=A4, 1'=C5, 2'=D5, 3'=E5, 5'=G5, 6'=A5)
    const sulingMelody = [
      587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440.0, 392.0,
      440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25,
    ];
    const genderBalungan = [
      261.63, 392.0, 329.63, 392.0, 293.66, 440.0, 329.63, 392.0,
      261.63, 329.63, 293.66, 392.0, 440.0, 392.0, 329.63, 293.66,
    ];

    const scheduleStep = () => {
      if (!this.ctx || !this.javaneseIntroGain || this.muted) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx.state !== 'running') return;

      const c = this.ctx;
      const now = c.currentTime + 0.03;
      const step = this.javaneseIntroStep;
      const idx = step % 16;

      // 1. Suling Bambu (Javanese Bamboo Flute) on even steps & held phrases
      if (idx % 2 === 0 || idx === 5 || idx === 13) {
        const freq = sulingMelody[idx];
        const dur = idx % 2 === 0 ? 0.62 : 0.32;
        const osc = c.createOscillator();
        const overtone = c.createOscillator();
        const vib = c.createOscillator();
        const vibGain = c.createGain();
        const g = c.createGain();
        const filter = c.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, now);

        vib.type = 'sine';
        vib.frequency.setValueAtTime(5.2, now);
        vibGain.gain.setValueAtTime(3.8, now);
        vib.connect(vibGain);
        vibGain.connect(osc.frequency);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1900, now);

        const otGain = c.createGain();
        otGain.gain.setValueAtTime(0.14, now);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.24, now + 0.09);
        g.gain.setValueAtTime(0.21, now + dur * 0.65);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(filter);
        overtone.connect(otGain);
        otGain.connect(filter);
        filter.connect(g);
        g.connect(this.javaneseIntroGain);

        osc.start(now);
        overtone.start(now);
        vib.start(now);
        osc.stop(now + dur + 0.04);
        overtone.stop(now + dur + 0.04);
        vib.stop(now + dur + 0.04);
      }

      // 2. Gender / Saron Barung bronze shimmer
      {
        const bf = genderBalungan[idx];
        const osc1 = c.createOscillator();
        const osc2 = c.createOscillator();
        const g = c.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(bf * 2, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(bf * 4.02, now);

        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.18, now);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.16, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

        osc1.connect(g);
        osc2.connect(g2);
        g2.connect(g);
        g.connect(this.javaneseIntroGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.72);
        osc2.stop(now + 0.72);
      }

      // 3. Lesung & Alu (Traditional Javanese Rice-Pounding Wood Rhythm)
      if (idx % 2 === 0 || idx % 4 === 3) {
        const isDeepThud = idx % 4 === 0;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isDeepThud ? 155 : 460, now);
        osc.frequency.exponentialRampToValueAtTime(isDeepThud ? 76 : 260, now + 0.09);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(isDeepThud ? 0.24 : 0.13, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(g);
        g.connect(this.javaneseIntroGain);
        osc.start(now);
        osc.stop(now + 0.14);
      }

      // 4. Kempul & Gong Ageng every 8 steps
      if (idx === 0 || idx === 8) {
        const gf = idx === 0 ? 98.0 : 130.81;
        const gOsc = c.createOscillator();
        const gHarm = c.createOscillator();
        const gGain = c.createGain();
        const hGain = c.createGain();
        gOsc.type = 'sine';
        gOsc.frequency.setValueAtTime(gf, now);
        gHarm.type = 'sine';
        gHarm.frequency.setValueAtTime(gf * 1.5, now);
        hGain.gain.setValueAtTime(0.32, now);

        gGain.gain.setValueAtTime(0.001, now);
        gGain.gain.linearRampToValueAtTime(0.32, now + 0.06);
        gGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

        gOsc.connect(gGain);
        gHarm.connect(hGain);
        hGain.connect(gGain);
        gGain.connect(this.javaneseIntroGain);
        gOsc.start(now);
        gHarm.start(now);
        gOsc.stop(now + 2.6);
        gHarm.stop(now + 2.6);
      }

      this.javaneseIntroStep += 1;
    };

    scheduleStep();
    this.javaneseIntroTimer = window.setInterval(scheduleStep, 355);
    return ctx.state === 'running';
  }

  public stopJavaneseIntroMusic() {
    if (this.javaneseIntroTimer !== null) {
      window.clearInterval(this.javaneseIntroTimer);
      this.javaneseIntroTimer = null;
    }
    if (this.javaneseIntroGain && this.ctx) {
      const bus = this.javaneseIntroGain;
      const now = this.ctx.currentTime;
      try {
        bus.gain.setTargetAtTime(0.0001, now, 0.12);
        window.setTimeout(() => {
          try {
            bus.disconnect();
          } catch {
            // ignore
          }
        }, 420);
      } catch {
        // ignore
      }
      this.javaneseIntroGain = null;
    }
  }
}

export const soundEngine = new SoundEngine();
