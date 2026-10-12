// ───────────────────────────── 99. Main: boot, the frame loop, input, keys, visibility, quality, dev hooks ─────────────────────────────
// Owned by the orchestrator. Modules never call each other's init/bake/update/draw; main does, in a fixed order,
// each call fenced (a broken module can't stop the loop). CONTRACT.md §5.
const MAIN = (() => {
  const mods = () => [Engine, Snd, Patch, Scene, Dial, UI];        // init order
  const layoutMods = () => [Dial, UI, Patch, Scene];                // layout order: Scene last sees the final rects
  let raf = 0, last = 0, acc = 0, ready = false, alive = true;
  // frame stats: JS work per drawn frame (ms) and the interval between drawn frames
  const N = 240, WORK = new Float32Array(N), GAP = new Float32Array(N);
  let wi = 0, wn = 0, bad = 0, seen = 0, lastStep = 0, forcedQ = null;

  // ── the frame loop ──
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const now = ts / 1000;
    let dt = last ? now - last : 1 / 60; last = now;
    if (dt > 0.25) dt = 0.25;
    const cap = fpsCap(now);
    acc += dt;
    if (cap < 58 && acc < 1 / cap - 0.004) return;                 // fps cap: skip this display frame
    const step = Math.min(acc, 0.05), gap = acc; acc = 0;
    CLOCK.rdt = step; CLOCK.real += step; CLOCK.frame++;
    const t0 = performance.now();
    try1(Patch, 'update', step); try1(Scene, 'update', step); try1(Dial, 'update', step); try1(UI, 'update', step);
    try1(Scene, 'draw', ctx);
    const w = performance.now() - t0;
    WORK[wi] = w; GAP[wi] = gap * 1000; wi = (wi + 1) % N; wn = Math.min(wn + 1, N);
    autoQuality(w, gap, cap);
  }
  // The room is calm most of the time, so it draws at 30 fps (20 in heads-down mode): half the work and the
  // battery of 60, on a timer that runs 25 minutes at a time. Moments (a finish, a capture, the harvest, a tap,
  // an unlock) boost it to the quality's full rate for a few seconds. Winding and Bug Hunt are DOM animations on
  // the compositor, so they stay smooth whatever this says.
  let boostUntil = 0;
  const boost = (s) => { boostUntil = Math.max(boostUntil, performance.now() / 1000 + s); };
  function fpsCap(now) {
    const q = QUALITY[QL].fps;
    if (now < boostUntil) return q;
    return Math.min(q, FOCUSMODE.on ? 20 : 30);
  }

  // Step the quality down (never up) when this device can't keep up: either the JS work is long, or frames
  // arrive late (raster/compositor is the bottleneck on old phones). Judged over ~3 s, at most once per 4 s.
  function autoQuality(w, gap, cap) {
    if (forcedQ !== null || QL >= QUALITY.length - 1 || document.hidden) return;
    const target = 1 / cap;
    seen++;
    if (w > 9 || gap > target * 1.6) bad++;
    if (seen < 90) return;
    const ratio = bad / seen; seen = 0; bad = 0;
    if (ratio > 0.35 && CLOCK.real - lastStep > 4 && CLOCK.real > 3) { lastStep = CLOCK.real; setQuality(QL + 1, 'auto'); }
  }
  function setQuality(q, why) {
    q = clamp(q | 0, 0, QUALITY.length - 1);
    if (q === QL) return;
    QL = q;
    document.documentElement.dataset.q = String(QL);
    relayout();
    BUS.emit('quality', { QL, why: why || 'set' });
  }
  function applyQualitySetting() {
    const s = DB && DB.settings ? DB.settings.quality : 'auto';
    forcedQ = s === 'high' ? 0 : s === 'lite' ? 3 : null;
    if (forcedQ !== null) setQuality(forcedQ, 'setting');
  }

  // ── layout & baking ──
  let bakeN = 0;
  const BAKES = {};   // ms from the latest relayout until each module's bake resolved
  function relayout() {
    layout();
    for (const m of layoutMods()) try1(m, 'layout');
    publishDial();
    BUS.emit('layout', { W: VW, H: VH, wide: WIDE, short: SHORT });
    const n = ++bakeN, t0 = performance.now(), took = (name) => () => { BAKES[name] = +(performance.now() - t0).toFixed(1); };
    return Promise.all([Promise.resolve(try1(Patch, 'bake')).then(took('Patch')), Promise.resolve(try1(Scene, 'bake')).then(took('Scene'))]).then(() => { if (n === bakeN) BUS.emit('baked', {}); });
  }
  let rt = 0;
  function onResize() { clearTimeout(rt); rt = setTimeout(relayout, 120); }

  // ── theme: 'auto' follows the time of day; the window outside always follows the real clock ──
  let lastPart = '';
  function applyTheme() {
    const s = DB && DB.settings ? DB.settings.theme : 'auto';
    const part = DAY.part();
    const theme = s === 'auto' ? (part === 'day' || part === 'dawn' ? 'day' : 'night') : s;
    if (document.documentElement.dataset.theme !== theme) {
      document.documentElement.dataset.theme = theme;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme === 'day' ? '#f4efe6' : PAL.night);
      BUS.emit('theme', { theme });
    }
    if (part !== lastPart) { const first = !lastPart; lastPart = part; if (!first) BUS.emit('daypart', { part }); }
  }

  // reduced motion: the setting wins, 'auto' follows the OS (html.rm in shell.html steps CSS motion down)
  function applyMotion() {
    if (DB && DB.settings) PREFS.motion = DB.settings.motion;
    document.documentElement.classList.toggle('rm', RM());
  }

  // ── input: taps on the canvas go to the Scene (the DOM layer above handles its own) ──
  let down = null, gestured = false;
  function gesture() { if (gestured) return; gestured = true; BUS.emit('gesture', {}); }
  function bindInput() {
    addEventListener('pointerdown', gesture, true);
    addEventListener('keydown', gesture, true);
    cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    cv.addEventListener('pointerup', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y, quick = performance.now() - down.t < 600;
      down = null;
      if (dx * dx + dy * dy < 144 && quick) try1(Scene, 'tap', e.clientX, e.clientY);
    });
    cv.addEventListener('pointercancel', () => { down = null; });
    if (!TOUCH) cv.addEventListener('pointermove', (e) => { cv.style.cursor = try1(Scene, 'hover', e.clientX, e.clientY) ? 'pointer' : ''; });
    // keys: the UI (sheets, shortcuts) first, then the Dial (the timer); see CONTRACT.md §6 for the key map
    addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (try1(UI, 'key', e)) { e.preventDefault(); return; }
      const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing) return;
      if (try1(Dial, 'key', e)) e.preventDefault();
    });
    addEventListener('resize', onResize);
    addEventListener('orientationchange', onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; BUS.emit('hidden', {}); }
      else { last = 0; acc = 0; if (!raf && alive) raf = requestAnimationFrame(frame); applyTheme(); BUS.emit('visible', {}); }
    });
    // keep 'auto' theme and the sky honest as the hours pass
    setInterval(applyTheme, 60 * 1000);
    BUS.on('settings', (p) => {
      if (p.key === 'theme' || !p.key) applyTheme();
      if (p.key === 'quality' || !p.key) applyQualitySetting();
      if (p.key === 'weather') try1(Scene, 'bake');
      if (p.key === 'motion' || !p.key) applyMotion();
    });
    BUS.on('data', () => { applyTheme(); applyQualitySetting(); applyMotion(); });
    for (const [ev, s] of [['timer:done', 6], ['rogue:capture', 3.5], ['harvest', 2.5], ['scene:tap', 1.5], ['patch:unlock', 2.5], ['hoodie', 2], ['timer:start', 1.5], ['ui:sheet', 0.8]]) BUS.on(ev, () => boost(s));
    try { RMQ.addEventListener('change', applyMotion); } catch (e) {}
  }

  // ── the service worker (offline + installable); never on file:// or in dev ──
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:' || QS.get('nosw') === '1' || DEV) return;
    addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch((e) => reportErr('sw', e)); });
  }

  // ── boot ──
  const BOOT = { init: {}, bake: 0, fonts: 0, ready: 0 };
  async function boot() {
    const t0 = performance.now();
    document.documentElement.dataset.q = String(QL);
    layout();
    const names = ['Engine', 'Snd', 'Patch', 'Scene', 'Dial', 'UI'];
    mods().forEach((m, i) => { const t = performance.now(); try1(m, 'init'); BOOT.init[names[i]] = +(performance.now() - t).toFixed(1); });
    applyTheme();
    applyQualitySetting();
    applyMotion();
    bindInput();
    registerSW();
    BUS.emit('boot', {});
    raf = requestAnimationFrame(frame);
    let t = performance.now();
    // The controls appear with the first layout, before any art is baked (rasterising SVG blocks the main
    // thread, so waiting on it would hold the controls back): on a slow phone you can start a session while
    // Patch's room is still baking, and the room fades in when it's ready (shell.html: html.ui / html.ready).
    const baking = relayout();
    document.documentElement.classList.add('ui');
    BOOT.ui = +performance.now().toFixed(1);
    await baking;
    BOOT.bake = +(performance.now() - t).toFixed(1); t = performance.now();
    try { if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, wait(1.5)]); } catch (e) {}
    BOOT.fonts = +(performance.now() - t).toFixed(1);
    BOOT.ready = +performance.now().toFixed(1); BOOT.boot = +(performance.now() - t0).toFixed(1);
    ready = true;
    document.documentElement.classList.add('ready');
    BUS.emit('ready', {});
  }

  // ── dev & test hooks (tools/shot.mjs and tools/perf.mjs drive these) ──
  const stat = (arr, n) => { const a = Array.from(arr.slice(0, n)).sort((x, y) => x - y); const q = (p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0); return { n: a.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +(a[a.length - 1] || 0).toFixed(2) }; };
  window.__pomo = {
    get ready() { return ready; }, VERSION, BUS, TIMER, LAYOUT, QUALITY, TEXT,
    get DB() { return DB; }, get QL() { return QL; }, get ERR() { return ERR; },
    mods: { get Engine() { return Engine; }, get Snd() { return Snd; }, get Patch() { return Patch; }, get Scene() { return Scene; }, get Dial() { return Dial; }, get UI() { return UI; } },
    emit: (t, p) => BUS.emit(t, p || {}),
    start: () => Engine.start(), pause: () => Engine.pause(), toggle: () => Engine.toggle(), reset: () => Engine.reset(),
    skip: () => Engine.skip(), finish: () => Engine.finish(), wind: (s) => Engine.wind(s), speed: (f) => try1(Engine, 'setSpeed', f),
    sheet: (id, arg) => SHEET.open(id, arg), close: () => SHEET.close(),
    activity: (id) => try1(Dial, 'activity', id), focusMode: (on) => try1(Dial, 'focusMode', on),
    seed: (kind) => try1(Engine, 'seed', kind),
    quality: (q) => { forcedQ = q; setQuality(q, 'dev'); },
    layout: () => relayout(),
    perf: () => ({ work: stat(WORK, wn), gap: stat(GAP, wn), QL, DPR: +DPR.toFixed(2), fps: fpsCap(performance.now() / 1000) }),
    boost: (s) => boost(s || 3),
    perfReset: () => { wn = 0; wi = 0; },
    errors: () => Object.assign({}, ERR),
    boot: () => JSON.parse(JSON.stringify(Object.assign({ bakes: BAKES }, BOOT))),
    stop: () => { alive = false; cancelAnimationFrame(raf); raf = 0; },
  };

  return { boot, relayout, setQuality };
})();

MAIN.boot().catch((e) => reportErr('boot', e));
