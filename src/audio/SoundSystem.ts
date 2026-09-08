import { BoostType } from '../types';

export class SoundSystem {
  private ctx: AudioContext | null = null;

  // Engine Synth
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Drift Screech Noise
  private driftNoiseNode: AudioBufferSourceNode | null = null;
  private driftGain: GainNode | null = null;

  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  constructor() {}

  public init() {
    if (this.isInitialized) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.setupEngineSynth();
      this.setupDriftNoise();

      this.isInitialized = true;
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupEngineSynth() {
    if (!this.ctx) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(450, this.ctx.currentTime);

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(60, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(62, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  private setupDriftNoise() {
    if (!this.ctx) return;

    // Generate 1-second white noise buffer
    const bufferSize = this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, this.ctx.currentTime);
    filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.driftNoiseNode = this.ctx.createBufferSource();
    this.driftNoiseNode.buffer = noiseBuffer;
    this.driftNoiseNode.loop = true;

    this.driftNoiseNode.connect(filter);
    filter.connect(this.driftGain);
    this.driftGain.connect(this.ctx.destination);

    this.driftNoiseNode.start();
  }

  public update(speedKmh: number, isDrifting: boolean, isBoosting: boolean) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    const t = this.ctx.currentTime;

    // Modulate Engine RPM Pitch
    if (this.engineOsc1 && this.engineOsc2 && this.engineFilter) {
      const normalizedSpeed = THREE_Clamp(speedKmh / 280, 0, 1.2);
      const targetFreq = 65 + normalizedSpeed * 340 + (isBoosting ? 90 : 0);
      this.engineOsc1.frequency.setTargetAtTime(targetFreq, t, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.02, t, 0.08);

      const filterFreq = 350 + normalizedSpeed * 1200 + (isBoosting ? 600 : 0);
      this.engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.08);
    }

    // Modulate Drift Noise Gain
    if (this.driftGain) {
      const targetDriftVolume = isDrifting && speedKmh > 20 ? 0.22 : 0.0;
      this.driftGain.gain.setTargetAtTime(targetDriftVolume, t, 0.05);
    }
  }

  public playBoostSound(type: BoostType) {
    if (!this.ctx || !this.isInitialized || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === BoostType.CWW_BOOST) {
      // Powerful super boost: deep sub swoop up to piercing roar
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.5);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);

      osc.start(t);
      osc.stop(t + 1.2);
    } else if (type === BoostType.NITRO) {
      // Roaring rocket burst
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(540, t + 0.4);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.9);

      osc.start(t);
      osc.stop(t + 0.9);
    } else {
      // Crisp mini boost whoosh
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(780, t + 0.25);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

      osc.start(t);
      osc.stop(t + 0.35);
    }
  }

  public playCountdownBeep(isFinal: boolean) {
    if (!this.ctx || !this.isInitialized) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + (isFinal ? 0.6 : 0.3));

    osc.start(t);
    osc.stop(t + (isFinal ? 0.6 : 0.3));
  }
}

function THREE_Clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
