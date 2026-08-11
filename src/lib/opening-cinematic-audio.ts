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

  const master = context.createGain();
  master.gain.value = 0.52;
  master.connect(context.destination);
  const start = context.currentTime;

  const hit = (at: number, duration: number, volume: number, cutoff: number) => {
    const frames = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      const decay = Math.pow(1 - i / frames, 3);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start(start + at);
  };

  // Distant battle, sharp reports, logo impact, then the late basketball gag.
  hit(0.18, 1.1, 0.7, 150);
  [0.45, 0.68, 1.04, 1.66, 2.05].forEach((at) => hit(at, 0.09, 0.32, 2400));
  hit(1.18, 1.35, 0.64, 105);
  hit(4.28, 1.2, 1, 120);
  hit(4.3, 0.15, 0.48, 3600);
  [6.03, 6.29, 6.5, 6.67].forEach((at, index) => hit(at, 0.07, 0.3 - index * 0.045, 650));

  return {
    context,
    stop: () => {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, 0.025);
      window.setTimeout(() => void context.close(), 120);
    },
  };
}
