// STUB Snd: every call is a silent no-op (CONTRACT.md §8.2). The real one lives in src/30-audio.js.
const Snd = (() => {
  let muted = false;
  const handle = { stop() {}, vol() {} };
  return {
    init() {},
    sfx() { return handle; },
    music() {},
    preview() {},
    haptic(p) { vibrate({ tick: 6, start: [10, 40, 10], done: [30, 60, 30], capture: [8, 30, 8], error: [40] }[p] || 6); },
    setVolume() {},
    mute(on) { muted = on == null ? !muted : !!on; return muted; },
    get muted() { return muted; },
    beat: () => ({ playing: false, phase: 0, bpm: 80 }),
    level: () => 0,
  };
})();
