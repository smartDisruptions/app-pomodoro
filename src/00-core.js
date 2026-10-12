// ───────────────────────────── 0. Core: tools, layout, bus, shared state, shared art ─────────────────────────────
// Everything every module shares. build.mjs concatenates the modules into one 'use strict' IIFE in file order,
// so these names are visible everywhere. Each later module declares ONE top-level name (its namespace).
// CONTRACT.md is the single source of truth for how the modules fit; read it before changing anything here.
const VERSION = '2.0.0';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t, s = 1.70158) => { const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const $ = (id) => document.getElementById(id);
const QS = new URLSearchParams(location.search);
const DEV = QS.get('dev') === '1';
const TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const RMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// One error report per place, so a broken hook can't flood the console (or stop the loop).
const ERR = {};
function reportErr(where, e) { ERR[where] = (ERR[where] || 0) + 1; if (ERR[where] === 1) console.error('[pomodoro] ' + where, e); }
// Call a module hook if it exists, fenced. try1(Patch, 'bake') → whatever it returns, or undefined.
function try1(mod, fn, ...a) { try { return mod && typeof mod[fn] === 'function' ? mod[fn](...a) : undefined; } catch (e) { reportErr(fn, e); return undefined; } }

// ── the bus: modules announce, others react. Synchronous; each handler fenced. ──
const BUS = (() => {
  const m = Object.create(null);
  return {
    on(type, fn) { (m[type] || (m[type] = [])).push(fn); },
    off(type, fn) { const a = m[type]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    emit(type, p) { const a = m[type]; if (!a) return; const pl = p || {}; for (const fn of a.slice()) { try { fn(pl); } catch (e) { reportErr('bus:' + type, e); } } },
  };
})();

// real seconds since boot and this frame's step; main advances it every animation frame.
const CLOCK = { real: 0, rdt: 0, frame: 0 };

// ── persistence: one prefix for everything this version writes. v1 (the Next.js app) used pomo-*-v1 keys. ──
const store = {
  get(k, d) { try { const v = localStorage.getItem('pomo2:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pomo2:' + k, JSON.stringify(v)); return true; } catch (e) { reportErr('store.set', e); return false; } },
  del(k) { try { localStorage.removeItem('pomo2:' + k); } catch (e) {} },
  raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },   // un-prefixed read (v1 migration)
};

// Preferences other modules need before or without the Engine. The Engine keeps these in step with DB.settings.
const PREFS = { haptics: true, motion: 'auto', talk: true, sound: true };
const RM = () => PREFS.motion === 'reduced' || (PREFS.motion !== 'full' && !!RMQ.matches);   // reduced motion, live
const vibrate = (p) => { try { if (PREFS.haptics && !RM() && navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

// ───────── DOM helpers ─────────
// h('button', {class: 'x', onclick: fn, 'aria-label': 'Start'}, 'Start', otherNode) → element
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  return el;
}
// Inject a module's stylesheet once. Prefix every class with your module's prefix (CONTRACT.md §3).
function CSS(id, text) { if (document.getElementById('css-' + id)) return; const s = document.createElement('style'); s.id = 'css-' + id; s.textContent = text; document.head.appendChild(s); }
// Screen-reader announcement (polite). Use for state changes a sighted user would see.
let _liveT = 0;
function ANNOUNCE(text) { const el = $('live'); if (!el) return; el.textContent = ''; clearTimeout(_liveT); _liveT = setTimeout(() => { el.textContent = text; }, 60); }

// ───────── formatting ─────────
const pad2 = (n) => (n < 10 ? '0' : '') + n;
// 1499.4 → "24:59" (ceil: a timer reads 25:00 until a whole second has gone)
function mmss(sec) { const s = Math.max(0, Math.ceil(sec - 1e-6)); const m = Math.floor(s / 60); return (m < 10 ? '0' : '') + m + ':' + pad2(s % 60); }
// 3900 → "1h 05m", 1500 → "25m", 40 → "40s"
function hm(sec) { sec = Math.round(Math.max(0, sec)); if (sec < 60) return sec + 's'; const m = Math.round(sec / 60); if (m < 60) return m + 'm'; return Math.floor(m / 60) + 'h ' + pad2(m % 60) + 'm'; }
// local calendar day of a timestamp: "2026-10-12"
function dateKey(ms = Date.now()) { const d = new Date(ms); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function dayStart(ms = Date.now()) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
// Monday 00:00 of the week containing ms
function weekStart(ms = Date.now()) { const d = new Date(dayStart(ms)); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); }
const addDays = (ms, n) => { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); };
// whole calendar days from a to b (DST-safe)
const dayDiff = (a, b) => Math.round((dayStart(b) - dayStart(a)) / 864e5);
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
const clockTime = (ms) => { try { return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { const d = new Date(ms); return d.getHours() + ':' + pad2(d.getMinutes()); } };

// ───────── canvas & layout ─────────
// One full-bleed canvas (#scene) behind a DOM app layer (#app). The canvas draws Patch's room; the DOM
// draws every control. LAYOUT is the agreed geometry, in CSS px; core computes it, then main calls each
// module's layout() hook in the order Dial → UI → Patch → Scene (CONTRACT.md §5), so Scene sees the final rects.
const cv = $('scene');
const ctx = cv.getContext('2d', { alpha: false });
let VW = 390, VH = 844;               // viewport, CSS px
let DPR = 1;                          // device px per CSS px actually used on the canvas (after quality and caps)
let WIDE = false;                     // landscape-ish window: phone on its side, tablet landscape, desktop
let SHORT = false;                    // a short window (phone landscape): slimmer bars
// Quality steps. Main starts from a device guess, then steps down (never back up) when frames run long.
//   res: canvas resolution multiplier · fps: scene frame cap · rain: rain streak count · parts: particle cap ·
//   fx: optional glow work 0..1 · amb: ambient animation density 0..1
const QUALITY = [
  { res: 1.0, fps: 60, rain: 90, parts: 220, fx: 1.0, amb: 1.0 },
  { res: 0.85, fps: 60, rain: 60, parts: 140, fx: 0.75, amb: 0.8 },
  { res: 0.72, fps: 30, rain: 36, parts: 80, fx: 0.45, amb: 0.55 },
  { res: 0.6, fps: 30, rain: 0, parts: 40, fx: 0.2, amb: 0.3 },
];
let QL = 0;
const PIXEL_CAP = 2.6e6;              // never more device pixels than this on the scene canvas
(function guessQuality() {
  const q = QS.get('q');
  if (q !== null) { QL = clamp(parseInt(q, 10) || 0, 0, QUALITY.length - 1); return; }
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (cores <= 2 || mem <= 1) QL = 3; else if (cores <= 4 && mem <= 2) QL = 2; else if (cores <= 4) QL = 1;
})();
const LAYOUT = {
  W: 390, H: 844, wide: false, short: false,
  safe: { t: 0, b: 0, l: 0, r: 0 },
  top: { x: 0, y: 0, w: 390, h: 56 },      // the top bar (UI)
  dock: { x: 0, y: 776, w: 390, h: 68 },   // the bottom dock (UI)
  stage: { x: 0, y: 0, w: 390, h: 380 },   // where the room composition lives: window, Patch, the back of the desk (Scene)
  deskY: 380,                              // the desk's back edge in CSS px; Patch sits behind it, the dial sits on it
  ui: { x: 0, y: 380, w: 390, h: 396 },    // the timer column: dial, readout, controls (Dial)
  dial: { cx: 195, cy: 470, r: 80 },       // the tomato (Dial may refine it in its layout() hook)
};
function readSafe() {
  try {
    const cs = getComputedStyle(document.documentElement);
    LAYOUT.safe.t = parseFloat(cs.getPropertyValue('--sat')) || 0; LAYOUT.safe.b = parseFloat(cs.getPropertyValue('--sab')) || 0;
    LAYOUT.safe.l = parseFloat(cs.getPropertyValue('--sal')) || 0; LAYOUT.safe.r = parseFloat(cs.getPropertyValue('--sar')) || 0;
  } catch (e) {}
}
const _cssVar = (k, v) => document.documentElement.style.setProperty(k, v);
const _rectVars = (name, r) => { _cssVar('--' + name + '-x', r.x + 'px'); _cssVar('--' + name + '-y', r.y + 'px'); _cssVar('--' + name + '-w', r.w + 'px'); _cssVar('--' + name + '-h', r.h + 'px'); };
function layout() {
  VW = Math.max(1, innerWidth); VH = Math.max(1, innerHeight);
  WIDE = VW / VH >= 1.15 && VW >= 600;
  SHORT = VH < 520;
  readSafe();
  const L = LAYOUT, s = L.safe;
  L.W = VW; L.H = VH; L.wide = WIDE; L.short = SHORT;
  L.top = { x: 0, y: 0, w: VW, h: Math.round((SHORT ? 44 : 56) + s.t) };
  const dockH = Math.round((SHORT ? 54 : 68) + s.b);
  L.dock = { x: 0, y: VH - dockH, w: VW, h: dockH };
  const y0 = L.top.h, y1 = L.dock.y;
  if (!WIDE) {
    const deskY = Math.round(y0 + (y1 - y0) * 0.44);
    L.stage = { x: 0, y: 0, w: VW, h: deskY };
    L.deskY = deskY;
    L.ui = { x: 0, y: deskY, w: VW, h: y1 - deskY };
    const r = Math.round(clamp(Math.min(VW * 0.25, L.ui.h * 0.22), 52, 120));
    L.dial = { cx: Math.round(VW / 2), cy: deskY + 12 + r, r };
  } else {
    const colW = Math.round(clamp(VW * 0.4, 300, 520));
    L.ui = { x: VW - colW - s.r, y: y0, w: colW, h: y1 - y0 };
    L.stage = { x: 0, y: 0, w: VW - colW - s.r, h: VH };
    L.deskY = Math.round(y0 + (y1 - y0) * (SHORT ? 0.74 : 0.7));
    const r = Math.round(clamp(Math.min(colW * 0.3, L.ui.h * (SHORT ? 0.2 : 0.24)), 44, 140));
    L.dial = { cx: Math.round(L.ui.x + colW / 2), cy: Math.round(L.ui.y + r + (SHORT ? 6 : L.ui.h * 0.06)), r };
  }
  _rectVars('top', L.top); _rectVars('dock', L.dock); _rectVars('stage', L.stage); _rectVars('ui', L.ui);
  _cssVar('--desk-y', L.deskY + 'px');
  document.documentElement.classList.toggle('wide', WIDE);
  document.documentElement.classList.toggle('short', SHORT);
  // the scene canvas
  let d = Math.min(window.devicePixelRatio || 1, 2) * QUALITY[QL].res;
  if (VW * VH * d * d > PIXEL_CAP) d = Math.sqrt(PIXEL_CAP / (VW * VH));
  DPR = Math.max(0.5, d);
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
}
// call after a module changes LAYOUT.dial (Dial's layout hook does)
function publishDial() { const d = LAYOUT.dial; _cssVar('--dial-cx', d.cx + 'px'); _cssVar('--dial-cy', d.cy + 'px'); _cssVar('--dial-r', d.r + 'px'); }

// ───────── the time of day (the window outside Patch's room follows the real clock) ─────────
// DAY.hour() → local hour as a float (0..24). DAY.part() → 'night' | 'dawn' | 'day' | 'dusk'.
// ?hour=22.5 pins it (dev and screenshots).
const DAY = {
  hour() { const q = QS.get('hour'); if (q !== null && q !== '') return clamp(parseFloat(q) || 0, 0, 23.99); const d = new Date(); return d.getHours() + d.getMinutes() / 60; },
  part(hr = DAY.hour()) { return hr < 5 || hr >= 21 ? 'night' : hr < 7.5 ? 'dawn' : hr < 17.5 ? 'day' : 'dusk'; },
};

// ───────── focus ("heads-down") mode: the chrome steps back, the screen stays awake ─────────
const FOCUSMODE = { on: false };

// ───────── sheets: every panel that slides over the room (tasks, log, patches, settings, …) ─────────
// Any module can define a sheet at load time; UI owns the container, the animation, focus and Esc.
// SHEET.def('log', { title: 'Changelog', size: 'tall'|'half'|'auto', render(body, arg) {}, opened(arg) {}, closed() {} })
const SHEETS = Object.create(null);
const SHEET = {
  def(id, impl) { impl.id = id; SHEETS[id] = impl; },
  open(id, arg) { return try1(typeof UI !== 'undefined' ? UI : null, 'open', id, arg); },
  close() { return try1(typeof UI !== 'undefined' ? UI : null, 'close'); },
};

// ───────── shared art ─────────
// Rasterise an SVG string to a canvas (async; resolves to the canvas). w,h = SVG viewBox size in its own
// units; px = device pixels per SVG unit. Bake once (and again after a resize/quality change), never per frame.
function svgCanvas(svg, w, h, px) {
  return new Promise((res) => {
    const c = makeCanvas(w * px, h * px);
    const src = svg.indexOf('<svg') === 0 ? svg : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${svg}</svg>`;
    const withSize = src.replace(/<svg([^>]*)>/, (m, a) => (/\swidth=/.test(a) ? m : `<svg${a} width="${w}" height="${h}">`));
    const img = new Image();
    img.onload = () => { try { c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); } catch (e) { reportErr('svgCanvas', e); } res(c); };
    img.onerror = (e) => { reportErr('svgCanvas:decode', e); res(c); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(withSize.indexOf('xmlns=') < 0 ? withSize.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"') : withSize);
  });
}
function glowSprite(rgb, px = 64, core = 0.5) {
  const c = makeCanvas(px, px), g = c.getContext('2d'), hh = px / 2;
  const rg = g.createRadialGradient(hh, hh, 0, hh, hh, hh);
  rg.addColorStop(0, `rgba(${rgb},1)`); rg.addColorStop(0.25, `rgba(${rgb},${core})`); rg.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = rg; g.fillRect(0, 0, px, px);
  return c;
}
const GLOWS = {};
const glowOf = (rgb, px = 64, core = 0.45) => GLOWS[rgb + '|' + px + '|' + core] || (GLOWS[rgb + '|' + px + '|' + core] = glowSprite(rgb, px, core));

// The palette (DESIGN.md §4). Use these tokens; a module may derive its own shades of them.
const PAL = {
  night: '#0c0f22', ink: '#13152a', panel: '#151a35', panel2: '#1b2145', line: '#3d4c95', moon: '#a9bcff',
  text: '#eef1f8', muted: '#9aa3cf', dim: '#5a6280',
  mint: '#3dffc2', mintRGB: '61,255,194',          // Patch's signature neon: focus, her glasses, her screens
  amber: '#ffb35c', amberRGB: '255,179,92',        // the desk lamp: warmth, breaks
  gold: '#f5c542',                                  // her hoops; patches, streaks
  tomato: '#ff4a3d', tomatoDeep: '#c8231a', tomatoHi: '#ff9a86', tomatoRGB: '255,74,61',
  unripe: '#8fd14f', unripeDeep: '#4e9a2e', leaf: '#2fbf71', leafDeep: '#1b7a45',
  rogue: '#ff2340',                                 // every rogue's eyes
  skin: '#8a5634', skinShade: '#6b3d22', hair: '#24160f',   // Patch (from the cast sheet)
};
const FONT = {
  display: '"Dela Gothic One", "Arial Black", Impact, sans-serif',      // the wordmark and big headings (caps)
  mono: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',   // the timer, labels, Patch's terminals
  body: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
};

// ───────── icons: one small set, stroke style, 24×24, currentColor ─────────
// ICON('play') → '<svg …>…</svg>' (a string; put it in innerHTML or h(..., {html})). Size with CSS (.ic { width; height }).
const ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  skip: '<path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none"/><path d="M18 5v14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L6.8 5M3.5 12l1.2 1.2 2.1-2.2M3.5 18l1.2 1.2 2.1-2.2"/>',
  log: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  patch: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5" stroke-dasharray="2 2.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  collapse: '<path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.3 3.7-8.3.5 2.3 1.6 3.6 3 4.3-.2-2.8.9-5.4 3-7.3.3 3.2 3.3 5.6 3.3 10.1C18.5 18.6 16 21 12 21z"/>',
  tomato: '<path d="M12 7.5c-4.7 0-8 2.8-8 6.7C4 18.1 7.6 21 12 21s8-2.9 8-6.8c0-3.9-3.3-6.7-8-6.7z" fill="currentColor" stroke="none"/><path d="M12 8V4.5M8.5 6.5 12 8l3.5-1.5M9.5 9.2 12 8l2.5 1.2"/>',
  bug: '<path d="M8 8.5a4 4 0 0 1 8 0"/><rect x="7" y="8.5" width="10" height="11" rx="5"/><path d="M12 11v8.5M3.5 13H7M17 13h3.5M4.5 8.5 7 10M19.5 8.5 17 10M4.5 19 7 17M19.5 19 17 17M9.5 5.5 8 3.5M14.5 5.5 16 3.5"/>',
  glitch: '<path d="M4 6h10M8 10h12M4 14h8M10 18h10"/><path d="M17 4v4M6 12v4" stroke-width="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  drag: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3"/>',
  breathe: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" stroke-dasharray="2 3"/><circle cx="12" cy="12" r="10.5" opacity=".45"/>',
  stretch: '<circle cx="12" cy="4.5" r="2"/><path d="M5 3.5 9 9h6l4-5.5M9 9l-1 12M15 9l1 12M9.3 15h5.4"/>',
  cup: '<path d="M5 9h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M9 3.5c-.8 1 .8 2-.2 3M12.5 3.5c-.8 1 .8 2-.2 3"/>',
  window: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
  game: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
};
function ICON(name, cls = 'ic') { const p = ICONS[name] || ICONS.info; return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`; }

// ───────── shared state: the Engine owns every write, everyone else reads ─────────
// DB is the saved document (CONTRACT.md §8). The Engine reassigns it on load, import and clear, so always
// read the global DB; never keep your own reference to it or to its arrays across events.
let DB = null;
// The running timer, mutated in place by the Engine (safe to keep a reference to TIMER itself).
//   mode 'focus'|'short'|'long' · state 'idle'|'running'|'paused' · dur = planned seconds for this session ·
//   left = seconds remaining (updated on every tick; Engine.left() is exact) · endAt/startAt = ms (0 when unset) ·
//   elapsed = active seconds so far · cycle = focus sessions finished in this cycle (0..longEvery-1) ·
//   rogues = distractions logged this session · sessionId = id of the session in progress (null when idle and fresh)
const TIMER = { mode: 'focus', state: 'idle', dur: 1500, left: 1500, endAt: 0, startAt: 0, elapsed: 0, cycle: 0, rogues: 0, sessionId: null };
function defaultSettings() {
  return {
    focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4,   // minutes; long break after every `longEvery` focus sessions
    autoBreak: false, autoFocus: false, dailyGoal: 8,
    sound: true, volume: 0.8, tick: false,                 // master sound, master volume 0..1, a soft clock tick while focusing
    music: 'lofi', musicVol: 0.55,                         // 'lofi' | 'rain' | 'city' | 'off'
    haptics: true, notify: false, wakeLock: true, reflect: true, talk: true,
    theme: 'auto',                                         // 'auto' | 'night' | 'day'
    quality: 'auto',                                       // 'auto' | 'high' | 'lite'
    motion: 'auto',                                        // 'auto' | 'reduced' | 'full'
    weather: 'auto',                                       // 'auto' | 'rain' | 'clear' (the window)
  };
}
function freshDB() {
  return {
    v: 2,
    settings: defaultSettings(),
    tasks: [],          // { id, title, est (tomatoes, 1..12), done (tomatoes finished), createdAt, doneAt (ms|null), order }
    activeTask: null,   // task id or null
    sessions: [],       // { id, kind 'focus'|'short'|'long', planned (s), actual (s), start (ms), end (ms), taskId, rating (1..5|null), note, rogues, music, ok }
    rogues: [],         // { id, kind (TEXT.rogues id), note, at (ms), sessionId, done }
    patches: {},        // patch id → unlocked at (ms)
    hoodie: [],         // up to 4 patch ids sewn on Patch's hoodie, oldest first
    counters: { breathe: 0, bugBest: 0, bugTotal: 0, stretch: 0, window: 0, abandoned: 0 },
    timer: null,        // a TIMER snapshot, so a reload mid-session carries on (Engine)
    meta: { firstOpen: Date.now(), lastOpen: 0, onboarded: false, migratedV1: false, v1Sessions: 0 },
  };
}
