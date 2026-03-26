let ambientCtx: AudioContext | null = null;
let ambientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;

export function playStartSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available
  }
}

export function playCompletionSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    // Audio not available
  }
}

export function startAmbientSound(volume: number = 0.5) {
  stopAmbientSound();

  try {
    ambientCtx = new AudioContext();
    ambientGain = ambientCtx.createGain();
    ambientGain.gain.setValueAtTime(volume * 0.15, ambientCtx.currentTime);
    ambientGain.connect(ambientCtx.destination);

    // Generate brown noise for a warm ambient sound
    const bufferSize = ambientCtx.sampleRate * 4; // 4 seconds loop
    const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Boost volume
    }

    ambientSource = ambientCtx.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;
    ambientSource.connect(ambientGain);
    ambientSource.start();
  } catch {
    // Audio not available
  }
}

export function stopAmbientSound() {
  try {
    ambientSource?.stop();
    ambientCtx?.close();
  } catch {
    // Ignore
  }
  ambientSource = null;
  ambientGain = null;
  ambientCtx = null;
}

export function setAmbientVolume(volume: number) {
  if (ambientGain && ambientCtx) {
    ambientGain.gain.setValueAtTime(
      volume * 0.15,
      ambientCtx.currentTime
    );
  }
}

export function playTouchGlowSound() {
  try {
    const ctx = new AudioContext();

    // Crystalline chord: C6 / E6 / G6 with a shimmer overtone
    const notes = [
      { freq: 1047, vol: 0.055, delay: 0 },
      { freq: 1319, vol: 0.04, delay: 0.022 },
      { freq: 1568, vol: 0.03, delay: 0.044 },
      { freq: 2093, vol: 0.014, delay: 0.01 },
    ];

    notes.forEach(({ freq, vol, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;

      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

      osc.start(t);
      osc.stop(t + 0.65);
    });

    setTimeout(() => ctx.close(), 1400);
  } catch {
    // Audio not available
  }
}
