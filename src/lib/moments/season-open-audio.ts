/**
 * Season Opening sound cue — authentic stadium energy, not a jingle.
 * Procedural Web Audio (no asset file). Short. Once. Cleanup on end/skip.
 *
 * CFB: crowd swell + band-hit energy
 * NFL: deeper crowd + broadcast kickoff horn-ish hit
 */

type Sport = "cfb" | "nfl";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  ac: AudioContext,
  dest: AudioNode,
  opts: {
    type: OscillatorType;
    freq: number;
    start: number;
    dur: number;
    gain: number;
    freqEnd?: number;
  }
) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = opts.type;
  o.frequency.setValueAtTime(opts.freq, opts.start);
  if (opts.freqEnd != null) {
    o.frequency.exponentialRampToValueAtTime(
      Math.max(20, opts.freqEnd),
      opts.start + opts.dur
    );
  }
  g.gain.setValueAtTime(0.0001, opts.start);
  g.gain.exponentialRampToValueAtTime(opts.gain, opts.start + 0.04);
  g.gain.exponentialRampToValueAtTime(
    0.0001,
    opts.start + Math.max(0.08, opts.dur)
  );
  o.connect(g);
  g.connect(dest);
  o.start(opts.start);
  o.stop(opts.start + opts.dur + 0.05);
}

/** Filtered noise = distant crowd bed */
function crowdBed(
  ac: AudioContext,
  dest: AudioNode,
  start: number,
  dur: number,
  gain: number
) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.55;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 480;
  filter.Q.value = 0.55;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.25);
  g.gain.setValueAtTime(gain * 0.85, start + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/**
 * Play Opening Day cue. Safe to call multiple times; respects reduced motion
 * by still allowing short audio unless user has no AudioContext.
 */
export function playSeasonOpenCue(sport: Sport): () => void {
  const ac = getCtx();
  if (!ac) return () => {};

  let stopped = false;
  const master = ac.createGain();
  master.gain.value = 0.22;
  master.connect(ac.destination);

  const start = () => {
    if (stopped) return;
    const t0 = ac.currentTime + 0.02;
    // Anticipation rumble
    crowdBed(ac, master, t0, sport === "nfl" ? 2.4 : 2.1, sport === "nfl" ? 0.12 : 0.1);
    // Kickoff / band hit
    const hitAt = t0 + (sport === "nfl" ? 0.55 : 0.45);
    if (sport === "nfl") {
      // Deeper broadcast hit
      tone(ac, master, {
        type: "sawtooth",
        freq: 110,
        freqEnd: 55,
        start: hitAt,
        dur: 0.55,
        gain: 0.14,
      });
      tone(ac, master, {
        type: "square",
        freq: 220,
        freqEnd: 90,
        start: hitAt + 0.02,
        dur: 0.35,
        gain: 0.06,
      });
    } else {
      // Brighter stadium / band-hit energy
      tone(ac, master, {
        type: "sawtooth",
        freq: 196,
        freqEnd: 98,
        start: hitAt,
        dur: 0.4,
        gain: 0.11,
      });
      tone(ac, master, {
        type: "triangle",
        freq: 392,
        freqEnd: 196,
        start: hitAt + 0.03,
        dur: 0.28,
        gain: 0.07,
      });
      tone(ac, master, {
        type: "square",
        freq: 130,
        freqEnd: 65,
        start: hitAt + 0.05,
        dur: 0.45,
        gain: 0.05,
      });
    }
    // Soft swell after hit
    crowdBed(ac, master, hitAt + 0.15, 1.6, sport === "nfl" ? 0.09 : 0.08);
  };

  void ac.resume().then(start).catch(() => {
    try {
      start();
    } catch {
      /* ok */
    }
  });

  return () => {
    stopped = true;
    try {
      master.gain.exponentialRampToValueAtTime(
        0.0001,
        ac.currentTime + 0.12
      );
    } catch {
      /* ok */
    }
  };
}
