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