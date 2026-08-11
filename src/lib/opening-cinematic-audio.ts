export type CinematicAudio = { context: AudioContext; stop: () => void };

export async function startOpeningCinematicAudio(): Promise<CinematicAudio | null> {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  await context.resume();
  if (context.state !== "running") {
    await context.close();
    return null;
  }

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 12;
  compressor.ratio.value = 7;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.22;
  const master = context.createGain();
  master.gain.value = 0.7;
  master.connect(compressor).connect(context.destination);
  const start = context.currentTime + 0.04;

  const noise = (
    at: number,
    duration: number,
    volume: number,
    frequency: number,
    type: BiquadFilterType,
    pan = 0,
  ) => {
    const frames = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      const decay = Math.pow(1 - i / frames, 2.5);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = type === "bandpass" ? 1.1 : 0.65;
    panner.pan.value = pan;
    gain.gain.setValueAtTime(volume, start + at);
    gain.gain.exponentialRampToValueAtTime(0.001, start + at + duration);
    source.connect(filter).connect(gain).connect(panner).connect(master);
    source.start(start + at);
  };

  const tone = (at: number, duration: number, volume: number, from: number, to: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(from, start + at);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + at + duration);
    gain.gain.setValueAtTime(volume, start + at);
    gain.gain.exponentialRampToValueAtTime(0.001, start + at + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(start + at);
    oscillator.stop(start + at + duration);
  };

  const gunshot = (at: number, pan: number) => {
    noise(at, 0.025, 0.78, 4200, "highpass", pan);
    noise(at + 0.006, 0.13, 0.5, 1150, "bandpass", pan);
    noise(at + 0.025, 0.24, 0.18, 420, "lowpass", pan);
  };
  const explosion = (at: number, pan: number, size = 1) => {
    noise(at, 0.09, 0.42 * size, 1900, "bandpass", pan);
    noise(at + 0.015, 1.45, 0.65 * size, 180, "lowpass", pan);
    tone(at, 0.95, 0.52 * size, 92, 31);
  };

  explosion(0.12, -0.55, 0.82);
  [0.58, 0.69, 0.81, 1.08, 1.2, 1.33, 1.78, 1.9, 2.04, 2.66, 2.78, 2.91]
    .forEach((at, index) => gunshot(at, index % 2 ? 0.48 : -0.34));
  explosion(1.46, 0.62, 1);
  explosion(3.08, -0.72, 0.72);

  // Let the wink and disappearance breathe, then drop the title with real weight.
  explosion(6.28, 0, 1.22);
  noise(6.3, 0.11, 0.9, 3300, "bandpass");
  tone(6.3, 1.25, 0.85, 78, 24);
  noise(6.42, 0.48, 0.34, 360, "lowpass");

  // The basketball sheepishly returns after the hero moment.
  [8.02, 8.27, 8.48, 8.65].forEach((at, index) => {
    tone(at, 0.1, 0.2 - index * 0.028, 155 - index * 12, 72);
    noise(at, 0.06, 0.14 - index * 0.018, 700, "bandpass", -0.2 + index * 0.12);
  });

  return {
    context,
    stop: () => {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, 0.025);
      window.setTimeout(() => void context.close(), 120);
    },
  };
}
