// Web Audio API Engine Rev Simulator for Mazda MX-5 ND (SkyActiv-G 2.0L)

class ExhaustSoundEngine {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private noiseNode: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private revInterval: number | null = null;

  public init() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
  }

  public toggleRev(exhaustType: string, onStateChange?: (active: boolean) => void) {
    this.init();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (this.isPlaying) {
      this.stop();
      if (onStateChange) onStateChange(false);
    } else {
      this.start(exhaustType);
      if (onStateChange) onStateChange(true);
    }
  }

  private start(exhaustType: string) {
    if (!this.audioCtx) return;

    this.isPlaying = true;
    const ctx = this.audioCtx;

    // Master Gain
    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.01, ctx.currentTime);

    // Lowpass filter for deep exhaust tone
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';

    let baseFreq = 75; // idle rpm ~800 RPM (4-cylinder pitch)
    let filterCutoff = 450;

    if (exhaustType === 'tomei_single_big') {
      baseFreq = 85; // throatier single exit
      filterCutoff = 800;
    } else if (exhaustType === 'titanium_quad') {
      baseFreq = 80; // metallic quad
      filterCutoff = 1200;
    } else if (exhaustType === 'oem_dual') {
      baseFreq = 75;
      filterCutoff = 600;
    }

    this.filterNode.frequency.setValueAtTime(filterCutoff, ctx.currentTime);

    // Primary 4-cylinder engine tone
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);

    // Sub harmonic pulse
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    this.osc2.frequency.setValueAtTime(baseFreq * 0.5, ctx.currentTime);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.4, ctx.currentTime);

    this.osc1.connect(this.filterNode);
    this.osc2.connect(oscGain);
    oscGain.connect(this.filterNode);

    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(ctx.destination);

    this.osc1.start();
    this.osc2.start();

    // Fade in
    this.gainNode.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.3);

    // Simulate 2 sequential engine revs!
    let rpmPhase = 0;
    const targetRpmFreqs = [baseFreq, baseFreq * 2.8, baseFreq * 1.5, baseFreq * 3.6, baseFreq * 1.1, baseFreq];
    
    this.revInterval = window.setInterval(() => {
      if (!this.isPlaying || !this.audioCtx || !this.osc1 || !this.osc2 || !this.filterNode) return;
      rpmPhase = (rpmPhase + 1) % targetRpmFreqs.length;
      const targetFreq = targetRpmFreqs[rpmPhase];
      const now = this.audioCtx.currentTime;

      this.osc1.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.6);
      this.osc2.frequency.exponentialRampToValueAtTime(targetFreq * 0.5, now + 0.6);
      this.filterNode.frequency.exponentialRampToValueAtTime(filterCutoff + (targetFreq - baseFreq) * 4, now + 0.6);
    }, 700);
  }

  public stop() {
    this.isPlaying = false;
    if (this.revInterval) {
      clearInterval(this.revInterval);
      this.revInterval = null;
    }
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
      setTimeout(() => {
        try {
          this.osc1?.stop();
          this.osc2?.stop();
          this.osc1?.disconnect();
          this.osc2?.disconnect();
          this.gainNode?.disconnect();
        } catch {
          // ignore
        }
      }, 350);
    }
  }
}

export const soundEngine = new ExhaustSoundEngine();
