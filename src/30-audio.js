// ───────────────────────────── 30. Audio: Snd ─────────────────────────────
// Everything the app hears (CONTRACT.md §8.2, DESIGN.md §8). Every file's story: public/audio/AUDIO.md.
//
//  · Effects are synthesised right here, in plain JS, into small AudioBuffers: rendered the first time they're
//    needed (the common ones warm up in idle time after the first gesture), loudness-matched by tier
//    (K-weighted momentary loudness) and played through one master gain. The bell is a recorded mechanical
//    kitchen timer (bell.mp3); until it has arrived a synthesised one stands in.
//  · Music (Patch's lo-fi radio, the break bed, rain, the night city) streams through <audio> elements from
//    fetched blobs; it is never decoded into AudioBuffers. On Chromium a MediaSource appends the same MP3 again
//    and again, trimmed to the sample, so a loop has no seam at all (the element's own `loop` leaves a ~35 ms
//    hole there); elsewhere the element loops by itself. The director follows the timer: focus → the radio
//    (three tracks in rotation, beat-matched two-bar crossfades), break → the break bed, paused → ducked,
//    idle → a 3 s fade. It keeps playing when the tab is hidden (people switch apps while they focus).
//  · Haptics, the optional focus tick (one looping buffer, aligned to the readout), the Media Session (the
//    lock screen's play/pause drive the timer, its progress bar is the session), beat() and level().
// Nothing runs per frame: fades step on a short interval only while one runs, and beat()/level() are computed
// on demand from the playing element's clock, cached per frame, allocation-free. Nothing plays before the first
// gesture; everything honours settings.sound, volume, music, musicVol, tick and mute.
const Snd = (() => {
  // ═════════════════════════════ the files ═════════════════════════════
  const BASE = 'audio/';
  const SR0 = 44100;
  // Every loop was encoded with its own last/first 1152 samples wrapped round it and the MP3's LAME tag moved to
  // cover them, so a gapless decoder returns the loop exactly; on the MediaSource path the loop starts PAD
  // samples into each appended copy (1728 encoder + 529 decoder delay). AUDIO.md has the method and the checks.
  const PAD = 2257;
  // n: exact loop length (samples at 44.1 kHz) · beats per loop · down: first downbeat (s) · gain: trim on the
  // music bus · env: loudness, 10 per second, 64 steps (A = −24 dB … _ = the loop's loudest) · lvl: flat level
  const TRACK = {
    'lofi-1': { file: 'lofi-1.mp3', n: 2381356, beats: 72, down: 2.947, gain: 1, env: '_z1yxupviijmoonmljjhh4ygdbaZfo_yxz9uu0srponlkkjhgfd4zutsssrt_yyxxww1usrqpomnkjjhg4zuttsrsp_yxz9ttzsqoonlkjjhged40zxwvttt_z0yyxw1vtrqqpmmlkiig4yfecZZgp_ywz9uuzsqponlkkhhgfd3zutsrqqu_zzxxvv0tsrqonnlkjihe3zussrqqn_xxz9ttzsqoomlkjigffc40xxwvvtq8z0yywv0srppnnlkjihhe3ydbaYXdn_xwy7ttzrqpnmlkjhhfec3yvtssqrs_yyxxvu0trqponmliiige3yttssrrp_wwz8tszrqoommkjhgeec30wwwutsq_yxxxww1usstrronmljih2ywutuust-yzy8vz2uurrqonnkkjhg30yvvtstr_yyxyxw1vustrqpnlkjig30tsqpoon_zy09wz1vusrqponljiig3zvuutrtt_xywywx1utrtrrpnmljjh3zwutusst-ywz8vy1vusrqoomljhhg2zwvttrr' },
    'lofi-2': { file: 'lofi-2.mp3', n: 2646020, beats: 80, down: 0.0249, gain: 1, env: 'y_mwxvvuxuutssrprqp88cktkkj_sdw_nxxvuuxqpnnlkkigg9-hcrfbXcfp2_qyyyxwzvttutqqpon98cjtkjjiis2_oxxvvtyrpoomkkjhg99TcrniacXp3_qyzyxw0vvtutrqsqq98eltkkj_rdu_mutrpnrhebcdefdcb55XXmbVUbbkx_ktussqvppnpnmllji53Yfnffdddoz_jusspotnkkkiggfcb55SZmgaUWUny_mvutssusqoonmlnml33Ygoffe9mZq_lttrqptljikhhgdba44ZXndWScajx-qwvtssuqpoonllkji43Xeofeddcny_nvusqpumkkkhhffdb45RXnicUXWlx_lvvusruqpooonlnmk33agofed8oYq_kssrposljjkiggdca45aZmdYTbYkx_pxvutsurpnoomkkii43Xeoeeddcoy_nvusqptnlkkigffcb45RYmhcSZYmy_mvutssvqqnponlolk33Ygoffe9mYo_mtsrqptmjiljhgdcb45cYneXSbbkx-pwutsrvqonpnlkkjj33Xeneeddcox_mwtsqoumlkkiggfdb45SXmgbTXWl' },
    'lofi-3': { file: 'lofi-3.mp3', n: 3175227, beats: 96, down: 0.0286, gain: 1, env: '7_10zxvr1rrtvv99-tuuutt1ssr_pp6_22110z4yxwvu49-stussr0qpppon5_32201z5xywwv78-sustrr1t40qqp6_1221104zzyyy68-vuwvuu1uttsss6_12210z3yyxxw88_suuttt1srr_pp6_22210z4yxxwu48-sttssr0qqppon5_33211z4xywwu77-stssqq1s30opo5_z211104zyyyx789tuvvuu1ttsssr6-11100z3xxxxx99-stttss1sss_op5-2221103yywwv59-rsttss0qqpqpo5_2221104xxwwu789rtttrr0s4zppo4_z00zzz1yzyyx78-uvvvvu2tttttr5_33210z4yxxyy89-tuuuts1sss_oq6-33210z4zyxxw58-suutts0rqqqpp6_3332105xxwxw879ttttsr2s61rqp4_332111500zyz78-uwwvvv3vutvts6_3322103xyyxw98-svwvuu1sts_np6_4532114zzzyx49_tuutts1srqroo5_3543126zzzyy879uuvtts2t50qqp4-32122150z0zx77-vwwwvv3wvuwts7_4331114yxxxw99-suwwvu2sts_pq6_4533225z00zy68_uvvuts1srrrqo5_4443225zzyyy779tuwuts2s50rqq5-1221105zzzzx779uvvwvu1ttttss' },
    'break-1': { file: 'break-1.mp3', n: 1323980, beats: 40, down: 2.9205, gain: 0.92, env: '____-7544306443220yxvutusqonnmkkihgfddbbZZYXWWVTRSQPNNNLKKHG-9975534443540z0yxvvrsrqqmkmiifgfebcYbYYVVVTSRRQNPMLKKIIGGFE-9775444532654132zzxvvvutrqonmmkjiggedfbabZaWWVUTRSQQPPMMLKI_9750479--9643314z0wxtustrnomkkjihhdddcbZYYZUVWSTQQOOONKMLJF__-9755675487545431zyxxxusrqpponmljiggffdccaYYXWWVTSRQPNNMMK' },
    rain: { file: 'rain.mp3', n: 657972, beats: 0, gain: 1, lvl: 0.4 },
    city: { file: 'city.mp3', n: 882000, beats: 0, gain: 1, lvl: 0.32 },
  };
  // settings.music → what plays in each bed. Titles are for the lock screen.
  const CHAN = {
    lofi: { focus: ['lofi-1', 'lofi-2', 'lofi-3'], brk: ['break-1'], title: 'Lo-fi radio' },
    rain: { focus: ['rain'], brk: ['rain'], title: 'Rain' },
    city: { focus: ['city'], brk: ['city'], title: 'Night city' },
  };
  const ROT_LOOPS = 3;       // the radio moves to the next track after the current one has looped this many times
  const DUCK = 0.3;          // the bed's level while the timer is paused
  const PAUSE_QUIET = 300;   // … and after this many seconds paused it fades out altogether (s)

  // ═════════════════════════════ platform ═════════════════════════════
  const UA = navigator.userAgent || '';
  const IOS = /iP(hone|ad|od)/.test(UA) || (/Macintosh/.test(UA) && (navigator.maxTouchPoints || 0) > 1);
  const WEBKIT = IOS || (/Safari\//.test(UA) && !/Chrome|Chromium|CriOS|Android|Edg\//.test(UA));   // per-element play() unlocks
  // Blink (Chrome, Edge, Android) loops through a MediaSource (verified in Chromium); Firefox and WebKit use the
  // element's own loop.
  // dev/test: ?snd=nomse (the element's own loop) · ?snd=novol (iOS-like: no volume) · ?snd=noworker (render here)
  const FORCE = QS.get('snd') || '';
  const MSE = (() => { try { return !/nomse/.test(FORCE) && !!window.chrome && !IOS && !!window.MediaSource && MediaSource.isTypeSupported('audio/mpeg') && location.protocol !== 'file:'; } catch (e) { return false; } })();
  let VOL = true;            // can an element's volume be set? (iOS: no, the hardware buttons own it)
  const activeNow = () => { try { return !navigator.userActivation || navigator.userActivation.isActive; } catch (e) { return true; } };
  const everActive = () => { try { return !navigator.userActivation || navigator.userActivation.hasBeenActive; } catch (e) { return true; } };
  const SPEED = +(QS.get('speed') || 1) || 1;
  const eng = (fn, ...a) => try1(typeof Engine !== 'undefined' ? Engine : null, fn, ...a);
  const engLeft = () => { const v = eng('left'); return typeof v === 'number' && isFinite(v) ? v : TIMER.left; };
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(() => fn(null), 50));

  // ═════════════════════════════ settings → gains ═════════════════════════════
  const S = () => (DB && DB.settings) || defaultSettings();
  const live = { master: null, music: null };            // setVolume() during a slider drag, until the setting lands
  let muted = !!store.get('mute', false);
  let unlocked = false;                                  // a real user activation has happened
  let HIDDEN = false;
  const soundOn = () => !muted && S().sound !== false;
  const masterV = () => clamp(live.master != null ? live.master : +S().volume || 0, 0, 1);
  const musicV = () => clamp(live.music != null ? live.music : +S().musicVol || 0, 0, 1);
  const fxGain = () => (soundOn() ? masterV() * masterV() : 0);                              // slider² ≈ loudness
  const busGain = () => (soundOn() ? masterV() * masterV() * Math.pow(musicV(), 1.5) : 0);

  // ═════════════════════════════ the effects: a small DSP kit and the recipes ═════════════════════════════
  // One self-contained function (it names nothing outside itself, so its own source can start a Worker): every
  // recipe renders into a Float32Array, seeded so a render is repeatable, ends on a raised-cosine tail and is
  // loudness-matched to its tier. KIT.render(name, variant, sampleRate) → Float32Array (with .rate).
  function DSPKIT() {
    const TAU = Math.PI * 2, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const mulberry = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    let SR = 48000, RNG = Math.random;
    const nz = () => RNG() * 2 - 1;
    const ix = (s) => Math.round(s * SR);
    const buf = (s) => new Float32Array(Math.max(1, Math.ceil(s * SR)));
    const noiseBuf = (s) => { const y = buf(s); for (let i = 0; i < y.length; i++) y[i] = nz(); return y; };
    // a struck mode: amp·e^(−t/tau)·sin(2πf·t) from t0 (s), by a rotating phasor (no sin() per sample)
    function mode(x, t0, f, amp, tau) {
      if (!(f > 0) || f >= SR * 0.46 || !(amp > 0)) return;
      const w = TAU * f / SR, r = Math.exp(-1 / (tau * SR)), cr = r * Math.cos(w), ci = r * Math.sin(w);
      let re = amp, im = 0;
      const a = Math.max(0, ix(t0)), b = Math.min(x.length, a + Math.ceil(tau * SR * 7));
      for (let i = a; i < b; i++) { x[i] += im; const nr = re * cr - im * ci; im = re * ci + im * cr; re = nr; }
    }
    // a mode rung by an excitation signal (a train of hammer strikes): one 2-pole resonator, unit impulse response
    function ring(x, exc, f, amp, tau) {
      if (f >= SR * 0.46) return;
      const w = TAU * f / SR, r = Math.exp(-1 / (tau * SR)), a1 = 2 * r * Math.cos(w), a2 = r * r, b = amp * Math.sin(w);
      let y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) { const y = a1 * y1 - a2 * y2 + b * exc[i]; y2 = y1; y1 = y; x[i] += y; }
    }
    // RBJ biquad coefficients [b0, b1, b2, a1, a2]: lp hp bp (0 dB peak) pk hs
    function biq(type, f, q, db) {
      const w = TAU * clamp(f, 10, SR * 0.45) / SR, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * (q || 0.7071)), A = Math.pow(10, (db || 0) / 40);
      let b0, b1, b2, a0, a1, a2;
      if (type === 'lp') { b1 = 1 - cw; b0 = b2 = b1 / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
      else if (type === 'hp') { b1 = -(1 + cw); b0 = b2 = (1 + cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
      else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
      else if (type === 'pk') { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
      else {
        const s = 2 * Math.sqrt(A) * al;
        b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s);
        a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s;
      }
      return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
    }
    function filt(x, c) {
      const b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4];
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
      return x;
    }
    // a filter whose frequency follows fu(u) (Hz, u = 0..1 along the buffer); coefficients every 32 samples
    function glide(x, type, fu, q) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, c = null;
      const n = x.length;
      for (let i = 0; i < n; i++) {
        if ((i & 31) === 0) c = biq(type, fu(i / n), q);
        const v = x[i], y = c[0] * v + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
      }
      return x;
    }
    // a sine (plus an optional 3rd harmonic) gliding f0 → f1, a linear attack, then an exponential decay
    function tone(x, t0, dur, f0, f1, amp, att, tau, h3) {
      const a = Math.max(0, ix(t0)), n = Math.min(x.length - a, Math.ceil(dur * SR));
      if (n <= 0) return;
      const r = f1 / f0, at = Math.max(1, att * SR), k = Math.exp(-1 / (tau * SR)), tail = Math.max(1, Math.round(0.003 * SR));
      let ph = 0, dec = 1;
      for (let i = 0; i < n; i++) {
        ph += TAU * f0 * Math.pow(r, i / n) / SR;
        let e = i < at ? i / at : (dec *= k);
        if (i > n - tail) e *= (n - i) / tail;
        x[a + i] += amp * e * (Math.sin(ph) + (h3 ? h3 * Math.sin(3 * ph) : 0));
      }
    }
    function mix(x, y, t0, g) { const a = ix(t0); for (let i = 0, n = Math.min(y.length, x.length - a); i < n; i++) x[a + i] += y[i] * g; return x; }
    function env(x, fn) {
      const n = x.length;
      let a = fn(0);
      for (let i = 0; i < n; i += 16) {
        const j = Math.min(n, i + 16), b = fn(j / n), k = (b - a) / (j - i);
        for (let m = i; m < j; m++) x[m] *= a + k * (m - i);
        a = b;
      }
      return x;
    }
    // a noise click, filtered (a latch, a pawl, a key): dur s of decaying noise
    function click(x, t0, dur, f, q, g, type) { const c = noiseBuf(dur); env(c, (u) => Math.exp(-u * 6)); filt(c, biq(type || 'bp', f, q)); return mix(x, c, t0, g); }
    // leaves, thread, rattles: short noise grains that thin out
    function grains(x, t0, dur, count, amp) {
      for (let g = 0; g < count; g++) {
        const u = Math.pow(RNG(), 1.6), s = ix(t0 + u * dur), n = Math.ceil((0.001 + RNG() * 0.005) * SR), a = amp * (0.35 + 0.65 * RNG()) * (1 - 0.6 * u);
        for (let i = 0; i < n && s + i < x.length; i++) x[s + i] += nz() * a * Math.sin(Math.PI * i / n);
      }
      return x;
    }
    function fadeTail(x, s) { const n = Math.min(x.length, Math.ceil(s * SR)); for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n; return x; }
    const sin2 = (u) => { const s = Math.sin(u * Math.PI / 2); return s * s; };
    const cos2 = (u) => { const c = Math.cos(u * Math.PI / 2); return c * c; };
    const swell = (p) => (u) => (u < p ? sin2(u / p) : cos2((u - p) / (1 - p)));     // up to a peak at p, then away
    // a soft pad: sines with their own levels, a shared envelope, an optional slow glide
    function pad(x, notes, envFn, bend) {
      const n = x.length, y = new Float32Array(n);
      for (const [f, g] of notes) {
        let re = 1, im = 0;
        for (let i = 0; i < n; i += 64) {                // a rotating phasor; the slow glide updates it every 64 samples
          const w = TAU * f * (1 + (bend || 0) * i / n) / SR, cr = Math.cos(w), ci = Math.sin(w);
          for (let m = i, e = Math.min(n, i + 64); m < e; m++) { y[m] += g * im; const nr = re * cr - im * ci; im = re * ci + im * cr; re = nr; }
          const mag = Math.sqrt(re * re + im * im); re /= mag; im /= mag;
        }
      }
      env(y, envFn);
      for (let i = 0; i < n; i++) x[i] += y[i];
      return x;
    }
    // the loudness the ear gives a short sound: K-weighted (BS.1770) like LUFS, but the max over 100 ms windows,
    // because a 400 ms window rates a click far quieter than it sounds
    function loudM(x) {
      const y = Float32Array.from(x);
      filt(y, biq('hs', 1681.97, 0.7072, 3.9998)); filt(y, biq('hp', 38.135, 0.5003));
      const W = ix(0.1), H = ix(0.025), n = y.length, P = new Float64Array(n + 1);
      for (let i = 0; i < n; i++) P[i + 1] = P[i] + y[i] * y[i];
      let best = 0;
      for (let s = -W + H; s < n; s += H) { const ms = (P[Math.min(n, s + W)] - P[Math.max(0, s)]) / W; if (ms > best) best = ms; }
      return best > 0 ? -0.691 + 10 * Math.log10(best) : -120;
    }
    function normalize(x, target, capDb) {
      let pk = 0;
      for (let i = 0; i < x.length; i++) { const a = x[i] < 0 ? -x[i] : x[i]; if (a > pk) pk = a; }
      if (!(pk > 0)) return x;
      let g = Math.pow(10, (target - loudM(x)) / 20);
      const cap = Math.pow(10, capDb / 20);
      if (pk * g > cap) g = cap / pk;
      for (let i = 0; i < x.length; i++) x[i] *= g;
      return x;
    }

    // ── the recipes ──
    // Quiet, short, physical. v = the variant (a few effects have slightly different takes, round-robin).
    const FX = {
      // a tiny glassy tick: interface buttons
      tap(v) { const k = [1, 1.035, 0.968][v], x = buf(0.07); click(x, 0, 0.005, 3000 * k, 0.9, 0.7); mode(x, 0, 1850 * k, 0.32, 0.011); mode(x, 0, 3720 * k, 0.1, 0.005); return x; },
      // a switch: down, then up
      toggle() { const x = buf(0.12); click(x, 0, 0.005, 1900, 1, 0.75); mode(x, 0, 880, 0.26, 0.014); mode(x, 0, 2400, 0.1, 0.006); click(x, 0.032, 0.004, 2900, 1, 0.45); mode(x, 0.032, 1320, 0.18, 0.01); return x; },
      // one soft key
      type(v) { const k = [1, 1.04, 0.96, 1.08][v], x = buf(0.1); click(x, 0, 0.004, 2800 * k, 0.8, 0.55); mode(x, 0, 285 * k, 0.32, 0.018); mode(x, 0, 1250 * k, 0.13, 0.007); return x; },
      // a sheet slides up: rising air and a small glint
      open() { const x = buf(0.32), a = noiseBuf(0.26); glide(a, 'bp', (u) => 500 * Math.pow(5.2, u), 1.3); env(a, swell(0.55)); mix(x, a, 0, 0.5); tone(x, 0.07, 0.16, 1320, 1760, 0.1, 0.02, 0.07); tone(x, 0.1, 0.13, 2640, 3520, 0.035, 0.015, 0.05); return x; },
      // … and slides away
      close() { const x = buf(0.28), a = noiseBuf(0.2); glide(a, 'bp', (u) => 2400 * Math.pow(650 / 2400, u), 1.2); env(a, swell(0.25)); mix(x, a, 0, 0.45); mode(x, 0.16, 410, 0.2, 0.03); click(x, 0.16, 0.004, 1100, 1, 0.2); return x; },
      // the timer's mechanism engages: a clack, a settling click, a small upward "go"
      start() {
        const x = buf(0.36);
        click(x, 0, 0.006, 2300, 0.8, 0.9); mode(x, 0, 720, 0.42, 0.034); mode(x, 0, 1530, 0.26, 0.02); mode(x, 0, 2870, 0.12, 0.011);
        tone(x, 0, 0.1, 150, 85, 0.5, 0.002, 0.04);
        click(x, 0.046, 0.004, 3100, 1, 0.3); mode(x, 0.046, 1960, 0.11, 0.009);
        tone(x, 0.03, 0.17, 660, 990, 0.06, 0.03, 0.07); tone(x, 0.03, 0.17, 1320, 1980, 0.018, 0.03, 0.06);
        return x;
      },
      pause() { const x = buf(0.34); click(x, 0, 0.006, 1700, 0.8, 0.75); mode(x, 0, 560, 0.4, 0.03); mode(x, 0, 1180, 0.22, 0.018); tone(x, 0, 0.1, 125, 78, 0.42, 0.002, 0.04); tone(x, 0.03, 0.18, 880, 600, 0.05, 0.03, 0.07); return x; },
      resume() { const x = buf(0.34); click(x, 0, 0.006, 2400, 0.8, 0.7); mode(x, 0, 760, 0.34, 0.03); mode(x, 0, 1610, 0.2, 0.018); tone(x, 0, 0.09, 140, 90, 0.36, 0.002, 0.035); tone(x, 0.03, 0.16, 740, 990, 0.055, 0.03, 0.07); return x; },
      // the ratchet unwinds back to zero, faster and faster, and lands
      reset() {
        const x = buf(0.46);
        let t = 0;
        for (let i = 0; i < 9; i++) { click(x, t, 0.003, 3400 - i * 120, 1.1, 0.6 - i * 0.03); mode(x, t, 2500 - i * 70, 0.11, 0.006); t += 0.034 - i * 0.0022; }
        t += 0.03; tone(x, t, 0.12, 150, 92, 0.4, 0.002, 0.045); click(x, t, 0.005, 1500, 0.9, 0.4); mode(x, t, 820, 0.18, 0.03);
        return x;
      },
      // a forward flick
      skip() { const x = buf(0.26), a = noiseBuf(0.15); glide(a, 'bp', (u) => 700 * Math.pow(5.4, u), 1.4); env(a, swell(0.6)); mix(x, a, 0, 0.5); click(x, 0.12, 0.004, 3000, 1, 0.45); mode(x, 0.12, 2100, 0.14, 0.008); return x; },
      // one detent of the tomato's ratchet: a pawl, a little metal, a little plastic. Short enough to spin.
      wind_tick(v) {
        const k = [1, 0.965, 1.035, 1.07][v], x = buf(0.045), c = noiseBuf(0.003);
        env(c, (u) => Math.exp(-u * 7)); filt(c, biq('hp', 2000, 0.7)); filt(c, biq('bp', 4200 * k, 0.9)); mix(x, c, 0, 0.9);
        mode(x, 0, 3150 * k, 0.22, 0.009); mode(x, 0, 5050 * k, 0.12, 0.005); mode(x, 0, 1150 * k, 0.16, 0.007);
        return x;
      },
      // let go of the band: the spring takes up, the escapement starts to whirr
      wind_release() {
        const x = buf(0.45), a = noiseBuf(0.22);
        tone(x, 0, 0.14, 165, 105, 0.55, 0.002, 0.055); click(x, 0, 0.006, 1600, 0.9, 0.6); mode(x, 0, 690, 0.24, 0.035);
        mode(x, 0.01, 1240, 0.07, 0.16); mode(x, 0.01, 1253, 0.05, 0.14);
        filt(a, biq('bp', 3000, 2)); env(a, (u) => (0.25 + 0.75 * Math.pow(Math.abs(Math.sin(Math.PI * 42 * u * 0.22)), 4)) * Math.exp(-u * 4)); mix(x, a, 0.02, 0.16);
        return x;
      },
      // stand-in for bell.mp3: the same bell's modes, rung by a bouncing clapper while the spring runs down
      bell() {
        const x = buf(1.95), e = buf(1.95);
        let t = 0.012, k = 0;
        while (t < 1.36) { const g = t < 0.32 ? 1 : Math.exp(-(t - 0.32) / 0.36); e[ix(t)] += g * (0.75 + 0.5 * RNG()); click(x, t, 0.003, 6000, 0.7, 0.25 * g, 'hp'); t += (k++ % 2) ? 0.009 + RNG() * 0.004 : 0.045 + RNG() * 0.012; }
        for (const [f, a, d] of [[1717, 0.5, 0.5], [1726, 0.5, 0.56], [4510, 0.3, 0.25], [7950, 0.24, 0.14], [11260, 0.08, 0.07]]) ring(x, e, f, a, d);
        filt(x, biq('pk', 7950, 1.4, -5)); filt(x, biq('hs', 10000, 0.7, -6));
        return fadeTail(x, 0.08);
      },
      // two soft notes on a small bell, rising: break over, activity done
      chime() {
        const x = buf(2.6);
        const note = (t, f, a) => { click(x, t, 0.004, 2600, 0.7, 0.18 * a); mode(x, t, f, a, 1.0); mode(x, t, f * 1.003, a * 0.35, 1.1); mode(x, t, f * 2.76, a * 0.2, 0.36); mode(x, t, f * 5.4, a * 0.06, 0.13); };
        note(0, 988, 0.5); note(0.17, 1319, 0.5);
        return filt(x, biq('lp', 7000, 0.7));
      },
      // Patch's holo-glove zaps a rogue: an FM zap falling through the floor, bit-crushed, stuttering, crackling
      capture() {
        const x = buf(0.42), z = buf(0.3), n = z.length;
        let pc = 0, pm = 0;
        for (let i = 0; i < n; i++) { const u = i / n, fc = 1700 * Math.pow(210 / 1700, u), m = 3.5 * Math.pow(0.6 / 3.5, u); pc += TAU * fc / SR; pm += TAU * fc * 1.48 / SR; z[i] = Math.sin(pc + m * Math.sin(pm)) * Math.min(1, i / (0.004 * SR)) * Math.exp(-u * 4); }
        const ch = ix(0.012);
        for (let s = ix(0.03); s < ix(0.2); s += ch) { if (RNG() < 0.6) { const hold = 2 + ((RNG() * 10) | 0); for (let i = s; i < Math.min(n, s + ch); i++) z[i] = z[i - ((i - s) % hold)]; } }
        for (let g = 0; g < 3; g++) { const s = ix(0.05 + RNG() * 0.15), l = ix(0.01 + RNG() * 0.008); for (let i = s; i < Math.min(n, s + l); i++) z[i] *= 0.15; }
        mix(x, z, 0, 0.5);
        for (let i = 0; i < 7; i++) click(x, RNG() * 0.35, 0.002, 5200, 1.5, 0.22);
        tone(x, 0.2, 0.09, 330, 160, 0.12, 0.003, 0.04);
        return filt(x, biq('lp', 7500, 0.7));
      },
      // …and it lands in the jar: a glass clink, a little bounce, the lid
      quarantine() {
        const x = buf(1.5);
        const clink = (t, f0, a) => { click(x, t, 0.002, 5000, 0.7, 0.4 * a, 'hp'); mode(x, t, f0, a, 0.6); mode(x, t, f0 * 2.21, a * 0.5, 0.32); mode(x, t, f0 * 3.85, a * 0.26, 0.16); mode(x, t, f0 * 5.95, a * 0.12, 0.08); };
        clink(0, 2350, 0.55); clink(0.11, 2420, 0.26);
        tone(x, 0.21, 0.08, 260, 200, 0.18, 0.002, 0.03); click(x, 0.21, 0.005, 1200, 0.8, 0.15, 'lp');
        return x;
      },
      // a patch is earned: a little celesta arpeggio and a shimmer
      unlock() {
        const x = buf(1.6);
        for (const [f, t, a] of [[1047, 0, 0.42], [1319, 0.07, 0.4], [1568, 0.14, 0.38], [2093, 0.21, 0.45]]) { click(x, t, 0.003, 5000, 0.8, 0.08 * a, 'lp'); mode(x, t, f, a, 0.5); mode(x, t, f * 2, a * 0.18, 0.24); mode(x, t, f * 3.01, a * 0.07, 0.12); }
        for (let i = 0; i < 14; i++) mode(x, 0.05 + RNG() * 0.65, 4500 + RNG() * 4000, 0.025 + RNG() * 0.025, 0.03 + RNG() * 0.03);
        return x;
      },
      // sewn onto her hoodie: thread pulled through twill, twice (zip, zip), and a sparkle
      sew() {
        const x = buf(1.0);
        const zip = (t, d, f0, f1, a) => { const z = noiseBuf(d); glide(z, 'bp', (u) => f0 * Math.pow(f1 / f0, u), 2.2); env(z, (u) => Math.min(1, u * d / 0.02) * Math.min(1, (1 - u) * d / 0.03) * (0.35 + 0.65 * Math.pow(Math.abs(Math.sin(Math.PI * 68 * u * d)), 3))); mix(x, z, t, a); };
        zip(0, 0.12, 1800, 4200, 0.55); zip(0.17, 0.1, 2100, 5200, 0.6);
        for (const [f, t] of [[2637, 0.3], [3136, 0.345], [3951, 0.39]]) { mode(x, t, f, 0.15, 0.18); mode(x, t, f * 2, 0.04, 0.08); }
        return x;
      },
      // a task ships: a rubber stamp thunks onto it, and a small bright chime
      ship() {
        const x = buf(1.3), b = noiseBuf(0.05);
        tone(x, 0, 0.16, 120, 72, 0.8, 0.002, 0.07);
        env(b, (u) => Math.exp(-u * 5)); filt(b, biq('lp', 900, 0.7)); mix(x, b, 0, 0.55);
        click(x, 0, 0.006, 1500, 1, 0.3); click(x, 0.018, 0.008, 700, 1, 0.15);
        mode(x, 0.13, 2093, 0.2, 0.42); mode(x, 0.13, 2093 * 2.76, 0.05, 0.13); mode(x, 0.2, 2637, 0.16, 0.4); mode(x, 0.2, 2637 * 2.76, 0.04, 0.12);
        return x;
      },
      // the ripe tomato is picked: the stem snaps, a soft pop, the leaves rustle
      harvest() {
        const x = buf(0.42), r = buf(0.36);
        click(x, 0, 0.004, 2600, 1, 0.45); tone(x, 0.004, 0.07, 320, 880, 0.5, 0.002, 0.02);
        grains(r, 0.02, 0.3, 46, 0.5); filt(r, biq('hp', 1800, 0.7)); filt(r, biq('lp', 7000, 0.7)); mix(x, r, 0.03, 0.45);
        return x;
      },
      pop(v) { const k = [1, 1.12][v], x = buf(0.08); tone(x, 0, 0.06, 420 * k, 1100 * k, 0.55, 0.001, 0.022); click(x, 0, 0.002, 2000, 1, 0.22); return x; },
      // Bug Hunt: a squish
      squash(v) {
        const k = [1, 0.92, 1.1][v], x = buf(0.24), a = noiseBuf(0.16);
        glide(a, 'lp', (u) => 2200 * Math.pow(300 / 2200, u), 2.5); env(a, (u) => Math.min(1, u * 0.16 / 0.003) * Math.exp(-u * 0.16 / 0.05)); mix(x, a, 0, 0.55);
        tone(x, 0, 0.15, 240 * k, 70 * k, 0.42, 0.002, 0.05); click(x, 0, 0.004, 1300 * k, 1.2, 0.3);
        return x;
      },
      // Bug Hunt: a bug splits in two (Bagu's canon), one blip up, one down
      split(v) { const k = [1, 1.08][v], x = buf(0.16); click(x, 0, 0.003, 4000, 0.8, 0.32, 'hp'); tone(x, 0.005, 0.08, 700 * k, 1150 * k, 0.28, 0.002, 0.035); tone(x, 0.005, 0.08, 700 * k, 430 * k, 0.28, 0.002, 0.035); return x; },
      // Bug Hunt: a test! a cheerful arpeggio, a sweep that clears the screen, a sparkle
      test() {
        const x = buf(1.3), a = noiseBuf(0.3);
        for (const [f, t] of [[784, 0], [1047, 0.045], [1319, 0.09], [1568, 0.135]]) { mode(x, t, f, 0.28, 0.16); mode(x, t, f * 2, 0.08, 0.08); mode(x, t, f * 3, 0.045, 0.05); }
        glide(a, 'bp', (u) => 900 * Math.pow(7.2, u), 1.6); env(a, swell(0.6)); mix(x, a, 0.17, 0.32);
        mode(x, 0.42, 2637, 0.17, 0.3); mode(x, 0.42, 3951, 0.09, 0.2);
        return x;
      },
      // breathing with Patch: four seconds of air that opens up, and a soft A-minor pad under it
      breath_in() {
        const x = buf(4.1), a = noiseBuf(4.05);
        let p = 0; for (let i = 0; i < a.length; i++) { p = p * 0.97 + a[i] * 0.03; a[i] = p * 6 + a[i] * 0.15; }
        glide(a, 'bp', (u) => 380 * Math.pow(1150 / 380, Math.min(1, u / 0.9)), 0.75);
        const shape = (u) => { const t = u * 4.05; return t < 3.7 ? sin2(t / 3.7) : cos2((t - 3.7) / 0.35); };
        env(a, shape); mix(x, a, 0, 0.5);
        const pd = buf(4.05); pad(pd, [[220, 0.05], [330, 0.04], [440, 0.015]], shape, 0.004); mix(x, pd, 0, 1);
        return x;
      },
      // …and four seconds of letting it go
      breath_out() {
        const x = buf(4.1), a = noiseBuf(4.05);
        let p = 0; for (let i = 0; i < a.length; i++) { p = p * 0.97 + a[i] * 0.03; a[i] = p * 6 + a[i] * 0.15; }
        glide(a, 'bp', (u) => 1150 * Math.pow(330 / 1150, Math.min(1, u / 0.95)), 0.75);
        const shape = (u) => { const t = u * 4.05; return t < 0.35 ? sin2(t / 0.35) : cos2((t - 0.35) / 3.7); };
        env(a, shape); mix(x, a, 0, 0.5);
        const pd = buf(4.05); pad(pd, [[330, 0.045], [247, 0.04], [165, 0.02]], shape, -0.004); mix(x, pd, 0, 1);
        return x;
      },
      // a soft "nuh-uh"
      error() { const x = buf(0.3); tone(x, 0, 0.09, 392, 384, 0.34, 0.004, 0.05, 0.12); tone(x, 0.11, 0.1, 330, 322, 0.34, 0.004, 0.05, 0.12); return filt(x, biq('lp', 2200, 0.7)); },
      whoosh() { const x = buf(0.38), a = noiseBuf(0.36); glide(a, 'bp', (u) => (u < 0.6 ? 420 * Math.pow(2600 / 420, u / 0.6) : 2600 * Math.pow(900 / 2600, (u - 0.6) / 0.4)), 0.9); env(a, (u) => Math.pow(Math.sin(Math.PI * u), 1.5)); return mix(x, a, 0, 0.6); },
      // ── internal: the focus tick, the room, small reactions ──
      tick() { const x = buf(0.05); click(x, 0, 0.0015, 3600, 0.9, 0.6); mode(x, 0, 2950, 0.24, 0.006); mode(x, 0, 1180, 0.12, 0.009); return x; },
      tock() { const x = buf(0.05); click(x, 0, 0.0015, 3000, 0.9, 0.55); mode(x, 0, 2480, 0.22, 0.006); mode(x, 0, 990, 0.12, 0.01); return x; },
      // the tomato lands on the windowsill plant
      land() { const x = buf(0.3), r = buf(0.22); tone(x, 0, 0.08, 280, 150, 0.42, 0.002, 0.035); grains(r, 0.01, 0.18, 20, 0.5); filt(r, biq('hp', 1800, 0.7)); filt(r, biq('lp', 7000, 0.7)); return mix(x, r, 0.01, 0.3); },
      rustle() { const x = buf(0.42); grains(x, 0, 0.38, 40, 0.6); filt(x, biq('hp', 1700, 0.7)); return filt(x, biq('lp', 7500, 0.7)); },
      // a knuckle on the window, twice
      glass() {
        const x = buf(0.4);
        const knock = (t, a) => { const b = noiseBuf(0.012); env(b, (u) => Math.exp(-u * 5)); filt(b, biq('lp', 700, 0.7)); mix(x, b, t, 0.35 * a); mode(x, t, 1150, 0.22 * a, 0.04); mode(x, t, 2870, 0.12 * a, 0.025); mode(x, t, 4650, 0.05 * a, 0.012); };
        knock(0, 1); knock(0.13, 0.8);
        return x;
      },
      // a spoon on her mug
      mug() { const x = buf(1.0); click(x, 0, 0.002, 4000, 0.7, 0.3, 'hp'); mode(x, 0, 1580, 0.28, 0.28); mode(x, 0, 1587, 0.14, 0.3); mode(x, 0, 3920, 0.13, 0.13); mode(x, 0, 6150, 0.06, 0.06); return x; },
      // the holo-terminals: three data blips and a chirp
      screens() { const x = buf(0.3); for (const [f, t] of [[1760, 0], [2350, 0.045], [3140, 0.09]]) tone(x, t, 0.03, f, f, 0.12, 0.002, 0.012, 0.25); tone(x, 0.12, 0.09, 900, 2600, 0.07, 0.01, 0.05); return x; },
      // the radio: a switch, then the dial sweeping through static to the next station
      radio() {
        const x = buf(0.62), a = noiseBuf(0.55);
        click(x, 0, 0.005, 1900, 1, 0.6); mode(x, 0, 880, 0.2, 0.014);
        glide(a, 'bp', (u) => (u < 0.5 ? 600 * Math.pow(2800 / 600, u / 0.5) : 2800 * Math.pow(1400 / 2800, (u - 0.5) / 0.5)), 3.5);
        env(a, (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.1)), 1.2) * (0.6 + 0.4 * Math.sin(u * 40))); mix(x, a, 0.04, 0.3);
        tone(x, 0.06, 0.45, 2400, 1100, 0.03, 0.05, 0.3);
        return x;
      },
      // a tap on the quarantine jar: glass, and the rogues rattling inside
      jar() {
        const x = buf(1.1);
        click(x, 0, 0.002, 5000, 0.7, 0.14, 'hp'); mode(x, 0, 2470, 0.3, 0.45); mode(x, 0, 2470 * 2.21, 0.14, 0.22); mode(x, 0, 2470 * 3.85, 0.07, 0.11);
        for (const t of [0.06, 0.095, 0.14]) { click(x, t, 0.002, 3200, 1, 0.12); mode(x, t, 1800 + RNG() * 400, 0.05, 0.006); }
        return x;
      },
      // Patch, poked: a little holo "bwip"
      patch() { const x = buf(0.2); tone(x, 0, 0.07, 880, 1320, 0.22, 0.006, 0.05); tone(x, 0.075, 0.09, 1175, 988, 0.16, 0.004, 0.05); return filt(x, biq('lp', 4000, 0.7)); },
      // unpicking a patch: two snips
      snip() { const x = buf(0.2); for (const t of [0, 0.085]) { click(x, t, 0.003, 2500, 0.7, 0.5, 'hp'); mode(x, t, 6200, 0.08, 0.025); mode(x, t, 3100, 0.1, 0.015); } return x; },
      // far-off thunder when the rain comes in
      thunder() {
        const x = buf(3.2), r = noiseBuf(3.2), c = noiseBuf(0.25);
        let b = 0; for (let i = 0; i < r.length; i++) { b = b * 0.996 + r[i] * 0.06; r[i] = b; }
        filt(r, biq('lp', 160, 0.7)); filt(r, biq('hp', 28, 0.7));
        env(r, (u) => { const t = u * 3.2; return Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.25) / 0.9) * (1 + 0.35 * Math.sin(TAU * 0.9 * t) + 0.25 * Math.sin(TAU * 1.7 * t + 1)); });
        mix(x, r, 0, 1);
        filt(c, biq('bp', 700, 0.8)); env(c, (u) => Math.exp(-u * 3)); mix(x, c, 0, 0.12);
        return fadeTail(x, 0.3);
      },
    };
    const VARS = { tap: 3, wind_tick: 4, type: 4, pop: 2, squash: 3, split: 2 };
    const HALF = { breath_in: 1, breath_out: 1, thunder: 1 };     // nothing above 6 kHz: render at half the rate
    // Loudness tiers (max momentary LUFS at full master volume). The lo-fi bed sits near −30 LUFS at the default
    // volumes: interface sounds just under it, interactions over it, celebrations clearly over it, the bell on top.
    const LOUD = {
      tap: -30, toggle: -29, type: -32, wind_tick: -29, open: -30, close: -31, patch: -28, screens: -29, glass: -28, mug: -27, jar: -27, rustle: -29,
      start: -24, pause: -26, resume: -25, reset: -25, skip: -27, wind_release: -25, pop: -27, error: -26, whoosh: -29, squash: -24, split: -25, snip: -25, land: -28, radio: -27,
      chime: -23, capture: -22, quarantine: -22, unlock: -21, sew: -22, ship: -21, harvest: -23, test: -21,
      breath_in: -31, breath_out: -31, thunder: -27, tick: -37, tock: -38, bell: -18,
    };
    // one effect, one variation: rendered at `sr` (breath and thunder at half rate), tail faded, set to its tier
    function render(name, v, sr) {
      SR = sr / (HALF[name] && sr >= 44100 ? 2 : 1); RNG = mulberry(hash(name) + (v || 0) * 7919);
      try {
        const x = FX[name](v || 0), n = Math.min(x.length, Math.ceil(Math.min(0.3, x.length / SR * 0.2) * SR));
        for (let i = 0; i < n; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / n);    // no click at the end
        normalize(x, LOUD[name] != null ? LOUD[name] : -26, name === 'bell' ? -1 : -1.5);
        x.rate = SR;
        return x;
      } finally { RNG = Math.random; }
    }
    return { render, has: (n) => !!FX[n], VARS, names: Object.keys(FX) };
  }
  const KIT = DSPKIT();
  // The same kit in a Worker: effects render there, off the main thread, so an old phone never stutters for one.
  const WSRC = "'use strict';const K=(" + DSPKIT.toString() + ")();onmessage=function(e){var d=e.data,xs=[],r=0;try{for(var v=0;v<(K.VARS[d.name]||1);v++){var x=K.render(d.name,v,d.sr);xs.push(x);r=x.rate;}postMessage({name:d.name,xs:xs,rate:r},xs.map(function(x){return x.buffer;}));}catch(err){postMessage({name:d.name,err:String(err&&err.message||err)});}};";

  // de-duplication: the same effect asked for again within this many seconds is dropped (the first wins), so a
  // module that plays a sound Snd also plays from the BUS can't double it
  const GAP = { wind_tick: 0.026, tap: 0.04, type: 0.03, pop: 0.05, squash: 0.03, split: 0.03, toggle: 0.08, open: 0.12, close: 0.12, start: 0.3, pause: 0.3, resume: 0.3, reset: 0.3, skip: 0.3, wind_release: 0.15, bell: 1.5, chime: 0.8, capture: 0.6, quarantine: 0.6, unlock: 2, sew: 0.8, snip: 0.5, ship: 0.8, harvest: 0.8, land: 0.5, test: 0.5, breath_in: 1.5, breath_out: 1.5, thunder: 4, radio: 0.3, error: 0.2 };
  const LIM = { wind_tick: 3, tap: 3, type: 3, pop: 3, squash: 4, split: 4 };       // voices per effect (the oldest is stolen)
  const JITTER = { wind_tick: 0.024, tap: 0.02, type: 0.03, squash: 0.04, split: 0.03, pop: 0.03 };

  // ═════════════════════════════ the effects: playback ═════════════════════════════
  let AC = null, OUT = null, lastSound = 0, idleT = 0, lastDone = -10, bellSrc = null;
  const FXC = Object.create(null);          // name → [AudioBuffer…] (variants)
  const VI = Object.create(null);           // name → the last variant played
  const LAST = Object.create(null);         // name → when it last started (context time)
  const VOICES = [];                        // what's sounding now
  const NOP = { stop() {} };
  function ctx() {
    if (AC) return AC;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try { AC = new C({ latencyHint: 'interactive' }); } catch (e) { try { AC = new C(); } catch (e2) { AC = null; return null; } }
    OUT = AC.createGain(); OUT.gain.value = fxGain(); OUT.connect(AC.destination);
    try { AC.onstatechange = () => { if (AC.state === 'running') tickSync(); }; } catch (e) {}
    return AC;
  }
  function resumeCtx() { if (!AC || AC.state === 'running' || AC.state === 'closed') return; try { const p = AC.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  // ── rendering: a queue served by the Worker (or, where one can't start, by idle time here); a sound asked for
  // before its render has arrived plays the moment it lands (if that's within 350 ms) ──
  const ARR = Object.create(null);          // name → { xs: [Float32Array…], rate }: rendered, not yet buffers
  const QUEUE = [], PENDING = Object.create(null);
  let WK = null, wkState = 0, wkBusy = '', wkURL = '', mainBusy = false;
  const rRate = () => (AC ? AC.sampleRate : 48000);
  // the sounds people meet first, rendered in the background once the app is up (the rest render on first use)
  const COMMON = ['tap', 'toggle', 'open', 'close', 'start', 'pause', 'resume', 'wind_tick', 'wind_release', 'reset', 'skip', 'chime', 'harvest', 'land', 'capture', 'quarantine', 'unlock', 'ship', 'sew', 'snip', 'pop', 'whoosh', 'error', 'type', 'tick', 'tock', 'squash', 'split', 'test', 'patch', 'rustle', 'glass', 'mug', 'screens', 'radio', 'jar'];
  function startWorker() {
    if (wkState) return;
    wkState = -1;
    if (typeof Worker === 'undefined' || /noworker/.test(FORCE)) return;
    try {
      wkURL = URL.createObjectURL(new Blob([WSRC], { type: 'text/javascript' }));
      WK = new Worker(wkURL);
      WK.onmessage = onRendered;
      WK.onerror = (e) => { try { e.preventDefault(); } catch (x) {} WK = null; wkState = -1; const n = wkBusy; wkBusy = ''; if (n) QUEUE.unshift(n); pumpRender(); };
      wkState = 1;
    } catch (e) { WK = null; wkState = -1; }
  }
  function onRendered(e) {
    const d = (e && e.data) || {};
    if (wkURL) { try { URL.revokeObjectURL(wkURL); } catch (x) {} wkURL = ''; }
    wkBusy = '';
    if (d.name) {
      if (d.xs && d.xs.length) ARR[d.name] = { xs: d.xs, rate: d.rate };
      else reportErr('Snd.render:' + d.name, new Error(d.err || 'render failed'));
      rendered(d.name);
    }
    pumpRender();
  }
  function renderMain(n) {
    try { const xs = []; for (let v = 0; v < (KIT.VARS[n] || 1); v++) xs.push(KIT.render(n, v, rRate())); return { xs, rate: xs[0].rate }; }
    catch (e) { reportErr('Snd.render:' + n, e); return null; }
  }
  function want(names, urgent) {
    for (const n of names) {
      if (!KIT.has(n) || FXC[n] || ARR[n] || n === wkBusy) continue;
      const i = QUEUE.indexOf(n);
      if (i >= 0) { if (urgent && i > 0) { QUEUE.splice(i, 1); QUEUE.unshift(n); } continue; }
      if (urgent) QUEUE.unshift(n); else QUEUE.push(n);
    }
    pumpRender();
  }
  function pumpRender() {
    if (!QUEUE.length || wkBusy || mainBusy) return;
    if (!wkState) startWorker();
    if (WK) {
      const n = QUEUE.shift();
      wkBusy = n;
      try { WK.postMessage({ name: n, sr: rRate() }); } catch (e) { wkBusy = ''; WK = null; wkState = -1; QUEUE.unshift(n); pumpRender(); }
      return;
    }
    mainBusy = true;                                   // no Worker: one render per idle slot, here
    idle(() => { mainBusy = false; const n = QUEUE.shift(); if (n && !FXC[n] && !ARR[n]) { const r = renderMain(n); if (r) ARR[n] = r; rendered(n); } pumpRender(); });
  }
  // an effect arrived: play what was asked for while it rendered (unless that's stale now); the tick may be waiting
  function rendered(n) {
    const p = PENDING[n];
    if (p) { delete PENDING[n]; for (const h of p) { if (!h.done && performance.now() - h.asked < 350) begin(h); else h.done = true; } }
    if (n === 'tick' || n === 'tock') tickSync();
  }
  // buffers are made the first time an effect plays (the context only exists after the first gesture)
  function fxList(n) {
    if (FXC[n]) return FXC[n];
    const a = ARR[n];
    if (!a || !AC) return null;
    const out = [];
    for (const x of a.xs) {
      let b = null;
      try { b = AC.createBuffer(1, x.length, a.rate); } catch (e) {}
      if (!b) return null;
      if (b.copyToChannel) b.copyToChannel(x, 0); else b.getChannelData(0).set(x);
      out.push(b);
    }
    delete ARR[n];
    return (FXC[n] = out);
  }
  function sfx(name, o) {
    if (typeof o === 'number') o = { vol: o };
    o = o || {};
    if (!unlocked || !AC || !KIT.has(name) || !soundOn()) return NOP;
    if (AC.state !== 'running') { if (AC.state === 'suspended') resumeCtx(); else return NOP; }
    const delay = Math.max(0, +o.delay || 0), t = AC.currentTime + delay;
    const gap = GAP[name] != null ? GAP[name] : 0.05;
    if (LAST[name] != null && Math.abs(t - LAST[name]) < gap) return NOP;
    LAST[name] = t;
    const h = { name, o, delay, asked: performance.now(), src: null, g: null, done: false,
      stop() { if (h.done) return; if (!h.src) { h.done = true; return; } try { const n = AC.currentTime; h.g.gain.cancelScheduledValues(n); h.g.gain.setTargetAtTime(0, n, 0.006); h.src.stop(n + 0.04); } catch (e) { end(h); } } };
    if (fxList(name)) begin(h);
    else if (wkState === 1) { (PENDING[name] || (PENDING[name] = [])).push(h); want([name], true); }
    else { const r = renderMain(name); if (!r) return NOP; ARR[name] = r; begin(h); }
    lastSound = performance.now();
    if (!idleT && !IOS) idleT = setTimeout(sleepCheck, 22000);
    return h;
  }
  function begin(h) {
    const list = fxList(h.name);
    if (!list || !list.length || h.done || !AC) { h.done = true; return; }
    const name = h.name, o = h.o, late = (performance.now() - h.asked) / 1000;
    const vi = VI[name] = ((VI[name] == null ? -1 : VI[name]) + 1) % list.length;
    try {
      const src = AC.createBufferSource(), g = AC.createGain();
      src.buffer = list[vi];
      const j = JITTER[name] || 0, rate = clamp((+o.rate || 1) * (1 + (Math.random() - 0.5) * j), 0.25, 4);
      if (rate !== 1) src.playbackRate.value = rate;
      g.gain.value = clamp(o.vol == null ? 1 : +o.vol || 0, 0, 2);
      src.connect(g); g.connect(OUT);
      src.start(AC.currentTime + Math.max(0, h.delay - late));
      h.src = src; h.g = g;
      src.onended = () => end(h);
    } catch (e) { reportErr('Snd.sfx', e); h.done = true; return; }
    // voice stealing: a few of each, a dozen in all
    const lim = LIM[name] || 2;
    let same = 0;
    for (let i = VOICES.length - 1; i >= 0; i--) if (VOICES[i].name === name && ++same >= lim) VOICES[i].stop();
    if (VOICES.length >= 14) VOICES[0].stop();
    VOICES.push(h);
  }
  function end(h) { if (h.done && !h.src) return; h.done = true; try { h.src.disconnect(); h.g.disconnect(); } catch (e) {} const i = VOICES.indexOf(h); if (i >= 0) VOICES.splice(i, 1); }
  const stopNamed = (name) => { for (const h of VOICES.slice()) if (h.name === name) h.stop(); };
  // a quiet context still wakes the audio thread every few ms: let it sleep when nothing is going on
  function sleepCheck() {
    idleT = 0;
    if (!AC || AC.state !== 'running') return;
    const quietFor = performance.now() - lastSound;
    if (TIMER.state !== 'idle' || tick.src || VOICES.length || quietFor < 20000) { idleT = setTimeout(sleepCheck, Math.max(4000, 22000 - quietFor)); return; }
    try { AC.suspend(); } catch (e) {}
  }
  // the recorded bell: fetched and decoded after the first gesture (24 KB), at the bell's loudness tier
  const BELL_GAIN = 0.629;
  function loadBell() {
    bytes('bell.mp3').then((ab) => {
      if (!ab || !AC) return null;
      delete BYTES['bell.mp3'];
      return new Promise((res) => { try { const p = AC.decodeAudioData(ab, res, () => res(null)); if (p && p.then) p.then(res, () => res(null)); } catch (e) { res(null); } });
    }).then((b) => {
      if (!b) return;
      const x = b.getChannelData(0);
      for (let i = 0; i < x.length; i++) x[i] *= BELL_GAIN;                 // to its tier (measured: AUDIO.md)
      FXC.bell = [b]; bellSrc = 'file';
    }).catch(() => {});
  }

  // ═════════════════════════════ haptics ═════════════════════════════
  const HAP = { tick: 6, start: [12, 40, 18], done: [40, 70, 40, 70, 90], capture: [10, 30, 22], error: [30, 50, 30] };
  // core's vibrate() honours PREFS.haptics; a vibrate before any tap is refused (and logged) by browsers
  function haptic(name) { if (unlocked && everActive()) vibrate(HAP[name] || 6); }

  // ═════════════════════════════ the focus tick ═════════════════════════════
  // A two-second buffer (tick, tock) looping on the audio clock: no timers. It starts when the readout next
  // turns over, and re-aligns now and then (the audio clock and the wall clock drift a little).
  const tick = { src: null, g: null, buf: null, t0: 0, chk: 0 };
  const tickWanted = () => unlocked && soundOn() && !!S().tick && TIMER.state === 'running' && TIMER.mode === 'focus' && SPEED === 1;
  function tickBuf() {
    const get = (n) => (FXC[n] ? { x: FXC[n][0].getChannelData(0), rate: FXC[n][0].sampleRate } : ARR[n] ? { x: ARR[n].xs[0], rate: ARR[n].rate } : null);
    const a = get('tick'), b = get('tock');
    if (!a || !b) { want(['tick', 'tock'], true); return null; }    // rendered() calls tickSync again when they land
    const sr = a.rate, x = new Float32Array(2 * sr);
    x.set(a.x.subarray(0, Math.min(a.x.length, sr)), 0); x.set(b.x.subarray(0, Math.min(b.x.length, sr)), sr);
    const bf = AC.createBuffer(1, x.length, sr);
    if (bf.copyToChannel) bf.copyToChannel(x, 0); else bf.getChannelData(0).set(x);
    return bf;
  }
  function tickStop() {
    if (!tick.src) return;
    try { const n = AC.currentTime; tick.g.gain.setTargetAtTime(0, n, 0.01); tick.src.stop(n + 0.08); } catch (e) {}
    tick.src = null; tick.g = null;
  }
  function tickSync(restart) {
    const want = tickWanted();
    if (!want || restart) tickStop();
    if (!want || tick.src || !AC) return;
    if (AC.state !== 'running') { resumeCtx(); return; }        // the context's statechange calls back
    if (!tick.buf) tick.buf = tickBuf();
    if (!tick.buf) return;
    const left = engLeft();
    let d = left - Math.floor(left); if (d < 0.03) d += 1;
    try {
      const s = AC.createBufferSource(), g = AC.createGain();
      s.buffer = tick.buf; s.loop = true; s.connect(g); g.connect(OUT);
      tick.t0 = AC.currentTime + d; s.start(tick.t0);
      tick.src = s; tick.g = g; tick.chk = performance.now();
    } catch (e) { reportErr('Snd.tick', e); }
  }
  function tickCheck() {
    if (!tick.src || !AC || performance.now() - tick.chk < 30000) return;
    tick.chk = performance.now();
    const left = engLeft(), next = AC.currentTime + (left - Math.floor(left));
    const ours = tick.t0 + Math.ceil(Math.max(0, AC.currentTime - tick.t0));
    let off = Math.abs(next - ours) % 1; off = Math.min(off, 1 - off);
    if (off > 0.05) tickSync(true);
  }

  // ═════════════════════════════ music: files and decks ═════════════════════════════
  const BYTES = Object.create(null);        // file → Promise<ArrayBuffer|null>
  const BLOBS = Object.create(null);        // file → Promise<url> (a blob URL, or the plain URL when fetch can't run)
  const bytes = (file) => BYTES[file] || (BYTES[file] = fetch(BASE + file).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
  const blobURL = (file) => BLOBS[file] || (BLOBS[file] = bytes(file).then((ab) => (ab ? URL.createObjectURL(new Blob([ab], { type: 'audio/mpeg' })) : BASE + file)));
  function forget(file) {
    if (BLOBS[file]) { BLOBS[file].then((u) => { if (u && u.indexOf('blob:') === 0) try { URL.revokeObjectURL(u); } catch (e) {} }); delete BLOBS[file]; }
    delete BYTES[file];
  }
  // A short silent WAV: played once inside a tap, it "blesses" an element so iOS lets it play later on its own.
  let SILENT = '';
  function silentURL() {
    const n = 400, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
    return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }
  // a deck: one <audio> element and what it's playing. Two for the beds (crossfades), one for previews.
  const DECKS = [];
  let PV = null;
  function mkDeck(preview) {
    const el = document.createElement('audio');
    el.preload = 'auto';
    try { el.setAttribute('playsinline', ''); el.disableRemotePlayback = true; } catch (e) {}
    try { el.preservesPitch = false; el.webkitPreservesPitch = false; } catch (e) {}
    const d = { el, id: null, gen: 0, ready: null, mse: false, ms: null, sb: null, data: null, k: 0, preview: !!preview,
      lvl: 0, from: 0, to: 0, t0: 0, dur: 0, fading: false, stopAt0: false, vol: -1, want: false, blessed: false, blessing: false, tape: 0, since: 0, ownPause: -1e9 };
    // (pause events arrive late: one we asked for, or one already undone by a play(), isn't an outside pause)
    el.addEventListener('pause', () => { if (d.want && el.paused && !d.blessing && !d.preview && performance.now() - d.ownPause > 600) onOutsidePause(d); });
    el.addEventListener('error', () => { if (d.blessing || !d.id) return; const id = d.id; d.ready = null; d.id = null; if (d.want) reportErr('Snd.music:' + id, new Error('the audio element could not play ' + id)); });
    return d;
  }
  function decks() { if (!DECKS.length) DECKS.push(mkDeck(), mkDeck()); return DECKS; }
  function bless(d) {
    if (d.blessed || d.id) return;
    if (!SILENT) SILENT = silentURL();
    d.blessed = true; d.blessing = true;
    d.el.src = SILENT;
    let p = null;
    try { p = d.el.play(); } catch (e) { d.blessed = false; d.blessing = false; return; }
    if (p && p.then) p.then(() => { if (d.blessing) { d.blessing = false; try { d.el.pause(); } catch (e) {} } }, () => { d.blessing = false; d.blessed = false; });
    else d.blessing = false;
  }
  // (a deck that already holds a track is blessed by playing it inside the gesture, which the director does)
  const blessAll = () => { if (!activeNow()) return; if (!WEBKIT) { for (const d of decks()) d.blessed = true; return; } for (const d of decks()) bless(d); if (PV) bless(PV); };
  const musicMaybe = () => soundOn() && !!CHAN[S().music];
  // put a track on a deck (fresh: start it over even if it's already there). Resolves true when it can play.
  function load(d, id, fresh) {
    if (d.id === id && d.ready && !fresh) return d.ready;
    const gen = ++d.gen, tr = TRACK[id];
    // (want goes false first: swapping the source isn't an outside pause)
    d.want = false; d.fading = false; d.ownPause = performance.now(); d.id = id; d.blessing = false; d.ms = null; d.sb = null; d.data = null; d.k = 0;
    const viaBlob = () => blobURL(tr.file).then((u) => { if (gen !== d.gen) return false; d.mse = false; d.el.loop = true; d.el.src = u; return true; });
    d.ready = (MSE && !d.preview ? bytes(tr.file).then((ab) => (gen !== d.gen ? false : ab ? attachMSE(d, ab, gen).then((ok) => ok || (gen === d.gen && viaBlob())) : viaBlob())) : viaBlob())
      .catch((e) => { reportErr('Snd.load', e); return false; })
      .then((ok) => { if (!ok && gen === d.gen) d.ready = null; return ok; });
    return d.ready;
  }
  // MediaSource: the same MP3 appended again and again, each copy trimmed to exactly one loop
  function attachMSE(d, ab, gen) {
    return new Promise((res) => {
      let ms;
      try { ms = new MediaSource(); } catch (e) { res(false); return; }
      const url = URL.createObjectURL(ms);
      d.ms = ms; d.data = ab; d.k = 0; d.mse = true; d.el.loop = false;
      const fail = setTimeout(() => res(false), 8000);
      ms.addEventListener('sourceopen', () => {
        try { URL.revokeObjectURL(url); } catch (e) {}
        if (gen !== d.gen) { clearTimeout(fail); res(false); return; }
        try { d.sb = ms.addSourceBuffer('audio/mpeg'); } catch (e) { clearTimeout(fail); reportErr('Snd.mse', e); res(false); return; }
        d.sb.addEventListener('updateend', () => { if (gen === d.gen) { if (d.k > 0) { clearTimeout(fail); res(true); } pump(d); } });
        pump(d);
      }, { once: true });
      d.el.src = url;
    });
  }
  function pump(d) {
    const sb = d.sb, tr = TRACK[d.id];
    if (!d.mse || !sb || !tr || !d.data || sb.updating || !d.ms || d.ms.readyState !== 'open') return;
    const L = tr.n / SR0, ct = d.el.currentTime || 0;
    let start = 0, end = 0;
    try { if (sb.buffered.length) { start = sb.buffered.start(0); end = sb.buffered.end(sb.buffered.length - 1); } } catch (e) {}
    if (end - ct < (HIDDEN ? 2.6 : 1.3) * L) {
      try {
        sb.appendWindowEnd = Infinity;
        sb.appendWindowStart = d.k * L;
        sb.appendWindowEnd = (d.k + 1) * L;
        sb.timestampOffset = d.k * L - PAD / SR0;
        sb.appendBuffer(d.data);
        d.k++;
      } catch (e) {
        if (e && e.name === 'QuotaExceededError') { try { if (ct - start > 12) sb.remove(start, ct - 8); } catch (e2) {} }
        else reportErr('Snd.append', e);
      }
      return;
    }
    if (ct - start > L + 20) { try { sb.remove(start, ct - 15); } catch (e) {} }
  }
  let pumpIv = 0;
  function pumpLoop() {
    const any = DECKS.some((d) => d.mse && d.want);
    if (any && !pumpIv) pumpIv = setInterval(() => { for (const d of DECKS) if (d.mse && d.want) pump(d); pumpLoop(); }, 3000);
    else if (!any && pumpIv) { clearInterval(pumpIv); pumpIv = 0; }
  }
  function playDeck(d) {
    d.want = true;
    applyVol(d);                                       // (the floor above: never start on the null sink)
    if (!d.el.paused) return;
    let p = null;
    try { p = d.el.play(); } catch (e) {}
    if (p && p.catch) p.catch((e) => { if (e && e.name === 'NotAllowedError') { d.blessed = false; d.want = false; } });
    pumpLoop();
  }
  function pauseDeck(d) { d.want = false; d.fading = false; d.ownPause = performance.now(); try { d.el.pause(); } catch (e) {} try { d.el.playbackRate = 1; } catch (e) {} d.tape = 0; pumpLoop(); }
  // something outside the app paused the music (a headphone unplugged, a call): don't fight it. The next
  // start, resume or change of channel brings it back.
  let HOLD = false;
  function onOutsidePause(d) { if (d !== cur) return; d.want = false; HOLD = true; d.fading = false; msSync(); }

  // ── fades: an equal-power curve in and out of silence, a smooth one in between; one 33 ms timer while any run ──
  let fadeIv = 0;
  const DIP = { v: 1, from: 1, to: 1, t0: 0, dur: 0, on: false };       // the bed dips under a preview
  function fadeTo(d, to, secs, stopAt0) {
    d.stopAt0 = !!stopAt0 && to === 0;
    if (!VOL) {                                       // iOS: no volume. Start and stop (lo-fi gets a tape-stop).
      d.lvl = d.to = to; d.fading = false;
      if (to > 0) { d.tape = 0; try { d.el.playbackRate = 1; } catch (e) {} playDeck(d); }
      else if (d.stopAt0) { if (TRACK[d.id] && TRACK[d.id].beats && !d.el.paused && secs > 0.2) { d.tape = performance.now(); ensureFader(); } else pauseDeck(d); }
      applyVol(d);
      return;
    }
    d.from = d.lvl; d.to = to; d.t0 = performance.now(); d.dur = Math.max(0, secs || 0) * 1000; d.fading = true;
    ensureFader(); stepFades();
  }
  function dip(to, secs) { DIP.from = DIP.v; DIP.to = to; DIP.t0 = performance.now(); DIP.dur = secs * 1000; DIP.on = true; ensureFader(); }
  const ensureFader = () => { if (!fadeIv) fadeIv = setInterval(stepFades, 33); };
  const curve = (a, b, u) => (a === 0 && b > 0 ? b * Math.sin(u * Math.PI / 2) : b === 0 && a > 0 ? a * Math.cos(u * Math.PI / 2) : a + (b - a) * (u * u * (3 - 2 * u)));
  function stepFades() {
    const now = performance.now();
    let busy = false;
    if (DIP.on) { const u = DIP.dur > 0 ? clamp((now - DIP.t0) / DIP.dur, 0, 1) : 1; DIP.v = DIP.from + (DIP.to - DIP.from) * u; if (u >= 1) DIP.on = false; else busy = true; }
    for (let i = 0; i <= DECKS.length; i++) {
      const d = i < DECKS.length ? DECKS[i] : PV;
      if (!d) continue;
      if (d.fading) {
        const u = d.dur > 0 ? clamp((now - d.t0) / d.dur, 0, 1) : 1;
        d.lvl = curve(d.from, d.to, u);
        if (u >= 1) { d.fading = false; d.lvl = d.to; if (d.stopAt0) pauseDeck(d); } else busy = true;
      }
      if (d.tape) {                                    // the tape slows to a stop
        const u = clamp((now - d.tape) / 380, 0, 1);
        try { d.el.playbackRate = 1 - 0.5 * u * u; } catch (e) {}
        if (u >= 1) pauseDeck(d); else busy = true;
      }
      applyVol(d);
    }
    if (!busy && fadeIv) { clearInterval(fadeIv); fadeIv = 0; }
  }
  function applyVol(d) {
    const tr = TRACK[d.id];
    const g = busGain();
    let v = clamp(d.lvl * g * (tr ? tr.gain : 1) * (d.preview ? 1 : DIP.v), 0, 1);
    // never exactly 0 while it plays: Chromium moves a silent element to a null sink and stalls ~33 ms when it
    // comes back, which knocks a beat-matched deck out of step (−66 dB is inaudible)
    if (d.want && g > 0 && v < 0.0005) v = 0.0005;
    if (VOL) { if (Math.abs(v - d.vol) > 0.0004) { d.vol = v; try { d.el.volume = v; } catch (e) {} } }
    else { const m = g === 0; if (d.el.muted !== m) d.el.muted = m; }
  }
  const applyAll = () => { for (const d of DECKS) applyVol(d); if (PV) applyVol(PV); };
  function applyGains() {
    if (OUT && AC) { try { OUT.gain.setTargetAtTime(fxGain(), AC.currentTime, 0.02); } catch (e) { OUT.gain.value = fxGain(); } }
    applyAll();
  }

  // ═════════════════════════════ music: the director ═════════════════════════════
  let cur = null, curKey = null, override, rotT = 0, pausedAt = 0, lastAlign = null;
  const ALOG = [];
  let rotIdx = (() => { const v = store.get('radio', -1); return typeof v === 'number' && isFinite(v) ? v | 0 : -1; })();
  function wantNow() {
    if (!unlocked || !soundOn() || HOLD) return null;
    const ch = S().music;
    if (!CHAN[ch]) return null;
    let bed;
    if (override !== undefined) bed = override;
    else if (TIMER.state === 'idle') bed = null;
    else if (TIMER.state === 'paused' && pausedAt && performance.now() - pausedAt > PAUSE_QUIET * 1000) bed = null;
    else bed = TIMER.mode === 'focus' ? 'focus' : 'brk';
    if (!bed) return null;
    return { key: ch + ':' + bed, ch, bed, duck: TIMER.state === 'paused' && override === undefined ? DUCK : 1 };
  }
  const other = (d) => (DECKS[0] === d ? DECKS[1] : DECKS[0]);
  const freeDeck = () => { const [a, b] = decks(); return !a.want ? a : !b.want ? b : a.lvl <= b.lvl ? a : b; };
  function direct(fade) {
    if (!unlocked) return;
    const w = wantNow();
    if (!w) {
      clearTimeout(rotT); rotT = 0;
      if (cur) { cur.pending = null; fadeTo(cur, 0, fade != null ? fade : 3, true); }
      cur = null; curKey = null;
      return;
    }
    if (w.key === curKey && cur) {
      if (cur.pending) { cur.pending.lvl = w.duck; return; }      // still loading: it comes in at the right level
      if (!VOL) { fadeTo(cur, w.duck < 1 ? 0 : 1, 0.5, w.duck < 1); return; }     // iOS: paused means quiet
      if (!cur.want) {                                             // stopped (by us or by the OS): bring it back
        if (!cur.id || !cur.ready) { startBed(cur, pick(w), w.duck, 1.2); return; }
        playDeck(cur);
      }
      if (cur.to !== w.duck || (!cur.fading && Math.abs(cur.lvl - w.duck) > 0.01)) fadeTo(cur, w.duck, w.duck < cur.lvl ? 0.8 : 0.6);
      return;
    }
    const id = pick(w), old = cur, d = old ? other(old) : freeDeck();
    clearTimeout(rotT); rotT = 0;
    curKey = w.key; cur = d;
    if (old) { old.pending = null; fadeTo(old, 0, fade != null ? fade : 2.5, true); }
    startBed(d, id, w.duck, fade != null ? fade : old ? 2.5 : 1.6);
    // free what this channel won't need again soon
    const keep = new Set([...CHAN[w.ch].focus, ...CHAN[w.ch].brk].map((t) => TRACK[t].file));
    for (const t in TRACK) if (!keep.has(TRACK[t].file) && !DECKS.some((x) => x.id === t && x.want)) forget(TRACK[t].file);
  }
  function pick(w) {
    const list = CHAN[w.ch][w.bed];
    if (list.length === 1) return list[0];
    rotIdx = (rotIdx + 1 + list.length) % list.length;
    store.set('radio', rotIdx);
    return list[rotIdx];
  }
  function startBed(d, id, lvl, fade) {
    const pd = d.pending = { id, lvl, fade };
    const go = () => {
      if (cur !== d || d.pending !== pd) return;
      const fresh = !!TRACK[id].beats;                 // music starts at the top; rain and the city carry on
      load(d, id, fresh).then((ok) => {
        if (d.pending !== pd) return;
        d.pending = null;
        if (cur !== d) return;
        if (!ok) { cur = null; curKey = null; return; }
        d.lvl = 0; applyVol(d);
        playDeck(d); d.since = performance.now();
        fadeTo(d, pd.lvl, pd.fade, false);
        if (curKey && curKey.endsWith(':focus') && CHAN[S().music] && CHAN[S().music].focus.length > 1) scheduleRotate(d);
        prefetchNext();
      });
    };
    // the deck may still be fading out from an earlier change: tuck it away quickly first, never cut it
    if (d.want && !d.el.paused && d.lvl > 0.02) { fadeTo(d, 0, 0.15, true); setTimeout(go, 170); } else go();
  }
  // ── the radio's rotation: after a few loops, the next track comes in on the beat ──
  function scheduleRotate(d) {
    clearTimeout(rotT);
    const tr = TRACK[d.id];
    rotT = setTimeout(rotate, Math.max(20, ROT_LOOPS * tr.n / SR0 - 9) * 1000);
  }
  function rotate() {
    rotT = 0;
    const A = cur, w = wantNow();
    if (!A || !w || w.bed !== 'focus' || CHAN[w.ch].focus.length < 2 || curKey !== w.key) return;
    if (TIMER.state !== 'running' || !A.want) { rotT = setTimeout(rotate, 15000); return; }
    const list = CHAN[w.ch].focus, id = list[(rotIdx + 1) % list.length], B = other(A);
    if (B.want && B.lvl > 0.01) { rotT = setTimeout(rotate, 4000); return; }
    if (!VOL) {
      // iOS can't fade or play silently: switch on a bar line, the next track entering on its own downbeat
      load(B, id, true).then((ok) => {
        if (!ok || cur !== A) return;
        const ta = TRACK[A.id], tb = TRACK[B.id], barA = 4 * ta.n / SR0 / ta.beats, now = A.el.currentTime || 0;
        const tA = ta.down + Math.ceil((now + 0.6 - ta.down) / barA) * barA;
        setTimeout(() => {
          if (cur !== A) return;
          try { B.el.currentTime = tb.down; } catch (e) {}
          rotIdx = list.indexOf(id); store.set('radio', rotIdx);
          cur = B; B.lvl = B.to = 1; playDeck(B); pauseDeck(A); scheduleRotate(B);
        }, Math.max(0, (tA - now) * 1000 - 40));
      });
      return;
    }
    load(B, id, true).then((ok) => {
      if (!ok || cur !== A) return null;
      return align(A, B);
    }).then((r) => {
      if (!r || cur !== A || B.id !== id) { if (B !== cur && B.want && B.lvl < 0.01) pauseDeck(B); return; }
      rotIdx = list.indexOf(id); store.set('radio', rotIdx);
      lastAlign = { ok: r.ok, err: +(r.err || 0).toFixed(4) };
      const blend = () => {
        if (cur !== A) { if (B !== cur) pauseDeck(B); return; }
        const x = r.ok ? 6 : 1.5, lv = A.fading ? A.to : A.lvl;   // two bars when the beats line up, a short blend when not
        cur = B; B.since = performance.now();
        fadeTo(A, 0, x, true); fadeTo(B, lv, x, false);
        scheduleRotate(B);
      };
      setTimeout(blend, Math.max(0, (r.tA - (A.el.currentTime || 0)) * 1000));
    });
  }
  // Start B (silent) so that its bar 1 lands on one of A's bar lines, then pull it into step while it's silent.
  // Seeks only: a seek leaves the element standing still for a moment (~30–60 ms), so each correction aims that
  // far ahead, and the lag is learned from what the last seek left over (and kept for the next rotation).
  let seekLag = 0.045;
  function align(A, B) {
    const ta = TRACK[A.id], tb = TRACK[B.id];
    const barA = 4 * ta.n / SR0 / ta.beats, barB = 4 * tb.n / SR0 / tb.beats, pos = () => A.el.currentTime || 0;
    let tA = ta.down + Math.ceil((pos() + 2.6 - ta.down) / barA) * barA, pB = tb.down + barB;
    let sB = pB - (tA - pos());
    while (sB < 0.05) { pB += barB; sB += barB; }
    B.lvl = 0; applyVol(B);
    try { B.el.currentTime = sB + seekLag; } catch (e) {}
    playDeck(B);
    return new Promise((res) => {
      let tries = 0, waits = 0, seeked = true;
      const check = () => {
        if (cur !== A || !B.want) { res(null); return; }
        if (B.el.paused || B.el.seeking || B.el.readyState < 3) { if (++waits > 50) res({ ok: false, tA }); else setTimeout(check, 60); return; }
        while (pos() > tA - 0.35) { tA += barA; pB += barB; }
        const err = (B.el.currentTime - pB) - (pos() - tA);
        if (DEV || ALOG.length < 200) ALOG.push([+(performance.now() / 1000).toFixed(3), +pos().toFixed(4), +B.el.currentTime.toFixed(4), +tA.toFixed(4), +pB.toFixed(4), +(err * 1000).toFixed(2), +seekLag.toFixed(4)]);
        if (seeked && tries > 0) seekLag = clamp(seekLag - err, 0, 0.25);
        if (Math.abs(err) < 0.003 || tries >= 7) { res({ ok: Math.abs(err) < 0.012, tA, err }); return; }
        tries++;
        try { B.el.currentTime = Math.max(0, B.el.currentTime - err + seekLag); seeked = true; } catch (e) { seeked = false; }
        setTimeout(check, 320);
      };
      setTimeout(check, 400);
    });
  }
  function nextTrack() { if (cur && curKey && curKey.endsWith(':focus')) { clearTimeout(rotT); rotate(); } }
  // after the first gesture: fetch what the next bed will need (the channel in use only)
  function prefetchNext() {
    const ch = CHAN[S().music];
    if (!ch || !unlocked) return;
    const next = TIMER.mode === 'focus' ? ch.brk[0] : ch.focus[(rotIdx + 1 + ch.focus.length) % ch.focus.length];
    idle(() => { bytes(TRACK[next].file); });
  }

  // ── previews: a three-second taste of a channel (Settings, the radio on her desk) ──
  let pvT = 0, pvCh = '', pvAt = -1e9;
  function preview(ch) {
    if (!CHAN[ch]) return;
    unlockNow();
    if (!unlocked || !soundOn()) return;
    const now = performance.now();
    if (ch === pvCh && now - pvAt < 1500) return;
    pvCh = ch; pvAt = now;
    if (cur && curKey && curKey.split(':')[0] === ch && cur.want && cur.lvl > 0.05) return;    // already on air
    if (!PV) { PV = mkDeck(true); if (WEBKIT) bless(PV); else PV.blessed = true; }
    const d = PV, list = CHAN[ch].focus;
    const id = list.length > 1 ? list[(rotIdx + 1 + list.length) % list.length] : list[0];
    clearTimeout(pvT);
    if (d.want) pauseDeck(d);
    load(d, id, true).then((ok) => {
      if (!ok || pvCh !== ch || performance.now() - pvAt > 4000) return;
      const tr = TRACK[id];
      try { d.el.currentTime = tr.beats ? tr.down + 4 * 4 * tr.n / SR0 / tr.beats : 0; } catch (e) {}
      d.lvl = 0; applyVol(d); playDeck(d); fadeTo(d, 1, 0.25, false);
      if (cur && cur.want) dip(0.25, 0.3);
      pvT = setTimeout(() => { fadeTo(d, 0, 0.5, true); dip(1, 0.6); }, 2700);
    });
  }

  // ═════════════════════════════ the lock screen (Media Session) ═════════════════════════════
  let msTitle = '';
  function msInit() {
    const ms = navigator.mediaSession;
    if (!ms) return;
    const set = (a, fn) => { try { ms.setActionHandler(a, fn); } catch (e) {} };
    set('play', () => { HOLD = false; if (TIMER.state !== 'running') eng('toggle'); else direct(); });
    set('pause', () => { if (TIMER.state === 'running') eng('pause'); });
    set('stop', () => { if (TIMER.state === 'running') eng('pause'); });
    set('nexttrack', () => nextTrack());
    for (const a of ['previoustrack', 'seekbackward', 'seekforward', 'seekto']) set(a, null);
  }
  function msSync() {
    const ms = navigator.mediaSession;
    if (!ms) return;
    try {
      const ch = CHAN[S().music], m = TEXT.modes[TIMER.mode];
      const title = (m ? m.label : '') + (ch && musicMaybe() ? ' · ' + ch.title : '');
      if (title !== msTitle && typeof MediaMetadata !== 'undefined') { msTitle = title; ms.metadata = new MediaMetadata({ title, artist: 'Patch', album: TEXT.app.name, artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] }); }
      ms.playbackState = TIMER.state === 'running' ? 'playing' : TIMER.state === 'paused' ? 'paused' : 'none';
      if (ms.setPositionState) {
        const dur = +TIMER.dur || 0;
        if (TIMER.state === 'idle' || !(dur > 0)) ms.setPositionState();
        else ms.setPositionState({ duration: dur, playbackRate: SPEED > 0 ? SPEED : 1, position: clamp(dur - engLeft(), 0, dur) });
      }
    } catch (e) {}
  }

  // ═════════════════════════════ the first gesture ═════════════════════════════
  // iOS only opens audio inside an activation (pointerup, touchend, click, keydown: not a touch's pointerdown),
  // so Snd listens for those itself as well as BUS 'gesture'. The context is created inside the gesture (never
  // before: browsers log a warning); on iOS a one-sample buffer opens the output, on WebKit the music elements
  // are blessed.
  let unlockMs = 0;
  function unlockNow() {
    if (!activeNow()) return;
    const first = !unlocked, t0 = performance.now();
    unlocked = true;
    const ac = ctx();
    if (ac) {
      if (ac.state !== 'running') resumeCtx();
      if (first && IOS) { try { const b = ac.createBuffer(1, 1, ac.sampleRate), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {} }
    }
    if (musicMaybe()) blessAll();
    if (first) {
      applyGains();
      direct(1.6);
      tickSync();
      idle(() => { msSync(); prefetchNext(); loadBell(); want(COMMON); });   // none of this is needed this instant
      unlockMs = performance.now() - t0;
    } else if (cur && !cur.want && !cur.pending) direct();          // a play() the browser refused earlier: retry inside this tap
  }
  function onGesture(e) {
    if (e && e.type === 'keydown' && (e.key === 'Escape' || e.ctrlKey || e.metaKey || e.altKey)) return;
    if (unlocked && AC && AC.state === 'running' && (!musicMaybe() || DECKS.every((d) => d.blessed))) return;
    unlockNow();
  }
  function wake() { if (unlocked && AC && AC.state === 'suspended') resumeCtx(); }

  // ═════════════════════════════ reacting to the app ═════════════════════════════
  let hoodN = 0, unlockAt = 0;
  function onDone(p) {
    p = p || {};
    // a fresh finish rings the bell, even from a background tab (that's what a kitchen timer is for); a finish
    // discovered late (back from away) gets a quiet chime instead
    const fresh = !(p.session && p.session.end) || Date.now() - p.session.end < 6000;
    lastDone = AC ? AC.currentTime : 0;
    if (p.mode === 'focus') { if (fresh) { sfx('bell'); haptic('done'); } else sfx('chime', { vol: 0.6 }); }
    else { sfx('chime'); if (fresh) haptic('done'); }
  }
  function onPatchUnlock() {
    // the Engine announces unlocks just before timer:done: wait a beat, then sparkle after the bell has rung out
    setTimeout(() => {
      if (!AC) return;
      const now = AC.currentTime;
      if (now < unlockAt) return;                     // one sparkle per burst of unlocks
      const delay = now - lastDone < 4 ? Math.max(0.15, lastDone + 2.9 - now) : 0.15;
      unlockAt = now + delay + 1.5;
      sfx('unlock', { delay });
    }, 0);
  }
  function onHoodie(p) { const n = ((p && p.ids) || (DB && DB.hoodie) || []).length; if (n > hoodN) sfx('sew'); else if (n < hoodN) sfx('snip'); hoodN = n; }
  function onTask(p) {
    const op = p && p.op;
    if (op === 'done') sfx('ship'); else if (op === 'add') sfx('pop', { vol: 0.8 }); else if (op === 'remove') sfx('whoosh', { vol: 0.6 });
    else if (op === 'clear') sfx('whoosh', { vol: 0.8 }); else if (op === 'undone') sfx('tap'); else if (op === 'active') sfx('toggle', { vol: 0.6 });
  }
  function onActivity(p) {
    if (!p) return;
    if (p.phase === 'start') { if (p.id === 'breathe') want(['breath_in', 'breath_out'], true); else sfx('whoosh', { vol: 0.7 }); }
    else if (p.phase === 'end') { stopNamed('breath_in'); stopNamed('breath_out'); if (p.done) sfx('chime'); }
  }
  function onStep(p) {
    if (!p) return;
    const box = (TEXT.breaks.breathe && TEXT.breaks.breathe.box) || 4, rate = clamp(4 / box, 0.5, 2);
    if (p.id === 'breathe' && p.breath === 'in') sfx('breath_in', { rate });
    else if (p.id === 'breathe' && p.breath === 'out') sfx('breath_out', { rate });
    else if (p.id === 'stretch' && p.step > 0) sfx('pop', { vol: 0.6 });
  }
  const TAPS = { patch: 'patch', plant: 'rustle', window: 'glass', mug: 'mug', screens: 'screens', radio: 'radio', jar: 'jar' };
  function onSceneTap(p) { const n = p && TAPS[p.id]; if (n) sfx(n); }
  function onSettings(p) {
    const k = p && p.key;
    if (k === 'volume' || !k) live.master = null;
    if (k === 'musicVol' || !k) live.music = null;
    applyGains();
    if (!k || k === 'sound' || k === 'music' || k === 'tick') {
      if (k === 'music' || k === 'sound') HOLD = false;
      if (k === 'sound' && p.value) want(COMMON);
      if (musicMaybe() && unlocked) blessAll();       // a tap in Settings or on the radio: still inside the gesture
      direct(k === 'music' ? 2 : undefined);
      if (k === 'music' && CHAN[p.value] && !curKey) preview(p.value);
      tickSync();
      msSync();
    }
    if ((k === 'weather' || k === 'music') && p.value === 'rain') sfx('thunder', { delay: 1.4, vol: 0.9 });
  }
  function onTimer(kind) {
    return (p) => {
      // an auto-start right after the bell stays quiet: the bell was the cue
      const quiet = kind === 'start' && AC && AC.currentTime - lastDone < 2;
      if (!quiet) sfx(kind);
      if (kind === 'start' || kind === 'resume') { HOLD = false; pausedAt = 0; }
      if (kind === 'pause') pausedAt = performance.now();
      if (kind === 'start') { if (!quiet) haptic('start'); if (p && p.mode && p.mode !== 'focus') want(['breath_in', 'breath_out']); }
      direct();
      tickSync(kind === 'start' || kind === 'resume');
      msSync();
    };
  }

  // ═════════════════════════════ beat() and level(): on demand, cached per frame ═════════════════════════════
  const BEAT = { playing: false, phase: 0, bpm: 80, beat: 0, bar: 0 };
  let beatF = -1, lvF = -1, LV = 0;
  function dominant(withBeat) {
    let best = null;
    for (const d of DECKS) if (d.want && d.id && !d.el.paused && d.lvl > 0.02 && (!withBeat || TRACK[d.id].beats) && (!best || d.lvl > best.lvl)) best = d;
    return best;
  }
  function beat() {
    if (beatF === CLOCK.frame && CLOCK.frame) return BEAT;
    beatF = CLOCK.frame;
    const d = dominant(true);
    if (!d) { BEAT.playing = false; return BEAT; }
    const tr = TRACK[d.id], bl = tr.n / SR0 / tr.beats, x = ((d.el.currentTime || 0) - tr.down) / bl;
    BEAT.playing = true; BEAT.bpm = 60 / bl; BEAT.beat = Math.floor(x); BEAT.phase = x - BEAT.beat; BEAT.bar = (((x / 4) % 1) + 1) % 1;
    return BEAT;
  }
  const ENVA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function envOf(tr) {
    if (!tr.E) { tr.E = new Float32Array(tr.env.length); for (let i = 0; i < tr.env.length; i++) tr.E[i] = Math.max(0, ENVA.indexOf(tr.env[i])) / 63; }
    return tr.E;
  }
  function level() {
    if (lvF === CLOCK.frame && CLOCK.frame) return LV;
    lvF = CLOCK.frame;
    let s = 0;
    for (const d of DECKS) {
      if (!d.want || !d.id || d.el.paused || d.lvl <= 0.001) continue;
      const tr = TRACK[d.id];
      let e = tr.lvl || 0.35;
      if (tr.env) { const E = envOf(tr), f = ((d.el.currentTime || 0) % (tr.n / SR0)) * 10, i = Math.floor(f) % E.length, j = (i + 1) % E.length; e = E[i] + (E[j] - E[i]) * (f - Math.floor(f)); }
      s += e * d.lvl * DIP.v;
    }
    LV = soundOn() ? clamp(s, 0, 1) : 0;
    return LV;
  }

  // ═════════════════════════════ the API ═════════════════════════════
  function music(bed, o) { override = bed === 'focus' ? 'focus' : bed === 'break' ? 'brk' : null; HOLD = false; direct(o && o.fade != null ? Math.max(0, +o.fade) : undefined); }
  function setVolume(kind, v) { v = clamp(+v || 0, 0, 1); if (kind === 'music') live.music = v; else live.master = v; applyGains(); }
  function mute(on) {
    const m = on === undefined ? !muted : !!on;
    if (m === muted) return muted;
    unlockNow();
    muted = m; store.set('mute', muted);
    if (!muted) HOLD = false;
    applyGains(); direct(muted ? 0.4 : 1.2); tickSync(); msSync();
    BUS.emit('snd:mute', { muted });
    return muted;
  }
  function init() {
    try { const a = document.createElement('audio'); a.volume = 0.5; VOL = Math.abs(a.volume - 0.5) < 0.01 && !/novol/.test(FORCE); } catch (e) { VOL = false; }
    hoodN = ((DB && DB.hoodie) || []).length;
    for (const t of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(t, onGesture, { capture: true, passive: true });
    addEventListener('pointerdown', wake, { capture: true, passive: true });
    BUS.on('gesture', () => onGesture(null));
    BUS.on('ready', () => setTimeout(() => { if (S().sound !== false) want(COMMON); }, 1500));
    BUS.on('hidden', () => { HIDDEN = true; for (const d of DECKS) if (d.mse && d.want) pump(d); });
    BUS.on('visible', () => {
      HIDDEN = false;
      if (unlocked && AC && AC.state !== 'running') resumeCtx();
      for (const d of DECKS) if (d.want && d.el.paused && d === cur) playDeck(d);
      direct(); tickSync(true); msSync();
    });
    BUS.on('settings', onSettings);
    BUS.on('data', () => { hoodN = ((DB && DB.hoodie) || []).length; onSettings({}); });
    BUS.on('timer:start', onTimer('start'));
    BUS.on('timer:pause', onTimer('pause'));
    BUS.on('timer:resume', onTimer('resume'));
    BUS.on('timer:reset', onTimer('reset'));
    BUS.on('timer:skip', onTimer('skip'));
    BUS.on('timer:done', onDone);
    BUS.on('timer:state', (p) => { override = undefined; if (p && p.state !== 'paused') pausedAt = 0; direct(); tickSync(); msSync(); });
    BUS.on('timer:mode', () => { direct(); msSync(); });
    BUS.on('timer:wind', () => { tickSync(true); msSync(); });
    BUS.on('timer:tick', tickCheck);
    BUS.on('rogue:capture', () => { sfx('capture'); sfx('quarantine', { delay: 0.75 }); haptic('capture'); });
    BUS.on('patch:unlock', onPatchUnlock);
    BUS.on('hoodie', onHoodie);
    BUS.on('task:change', onTask);
    BUS.on('harvest', () => { sfx('harvest'); sfx('land', { delay: 0.5 }); });
    BUS.on('activity', onActivity);
    BUS.on('activity:step', onStep);
    BUS.on('ui:sheet', (p) => sfx(p && p.id ? 'open' : 'close'));
    BUS.on('scene:tap', onSceneTap);
    BUS.on('focusmode', () => sfx('toggle', { vol: 0.7 }));
    BUS.on('onboard:done', () => sfx('chime', { vol: 0.7 }));
    BUS.on('sfx', (p) => { if (p && p.name) sfx(p.name, { vol: p.vol, rate: p.rate, delay: p.delay }); });
    msInit();
    msSync();
  }
  return {
    init, sfx, music, preview, haptic, setVolume, mute, beat, level,
    get muted() { return muted; },
    // extras beyond the contract: skip to the next lo-fi track (the lock screen's ⏭ uses it) · what's on
    next: nextTrack,
    get onAir() { const d = dominant(false); return d ? { channel: (curKey || '').split(':')[0] || null, bed: (curKey || '').split(':')[1] || null, track: d.id } : null; },
    // for tests and the dev console: state, and an effect rendered offline (Float32Array at `sr`)
    stats() {
      return { unlocked, ctx: AC ? AC.state : 'none', rate: AC ? AC.sampleRate : 0, mse: MSE, vol: VOL, ios: IOS, muted, sound: soundOn(), bed: curKey, rot: rotIdx, hold: HOLD,
        decks: DECKS.concat(PV ? [PV] : []).map((d) => ({ id: d.id, mse: d.mse, want: d.want, paused: d.el.paused, t: +(d.el.currentTime || 0).toFixed(3), lvl: +d.lvl.toFixed(3), vol: +(+d.el.volume).toFixed(3), k: d.k, rs: d.el.readyState, preview: d.preview })),
        unlockMs: +unlockMs.toFixed(1), align: lastAlign, rendered: Object.keys(FXC).length + Object.keys(ARR).length, worker: wkState === 1 ? 'on' : wkState ? 'off' : 'idle', queue: QUEUE.length, voices: VOICES.length, tick: !!tick.src, bell: bellSrc || (FXC.bell ? 'synth' : null), beat: Object.assign({}, beat()), level: +level().toFixed(3) };
    },
    renderFx(name, sr, v) { return KIT.has(name) ? KIT.render(name, v || 0, sr || 48000) : null; },
    effects: KIT.names,
    // test hooks: the music elements, and an analyser on the effects bus (created only when asked for)
    debug: {
      els: () => DECKS.concat(PV ? [PV] : []).map((d) => d.el),
      alog: ALOG,
      analyser() { if (!AC || !OUT) return null; if (!OUT._an) { OUT._an = AC.createAnalyser(); OUT._an.fftSize = 2048; OUT.connect(OUT._an); } return OUT._an; },
    },
  };
})();
