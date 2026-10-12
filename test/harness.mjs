// Test harness for the Engine: loads src/00-core.js + src/10-text.js + src/20-engine.js into a Node vm context with
// small fakes (document, localStorage, matchMedia, navigator, location) and a controllable clock: Date.now(),
// new Date() and every setTimeout/setInterval run on fake time, so a 25-minute session takes milliseconds.
//
//   const app = boot({ now: at('2026-10-12 09:00'), storage, query: 'speed=1' });
//   app.E.start(); app.advance(25 * 60e3); app.E.stats() …
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

process.env.TZ = process.env.TZ || 'America/Los_Angeles';   // Josh's zone: DST ends 2026-11-01, starts 2026-03-08
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = ['00-core.js', '10-text.js', '20-engine.js'].map((f) => readFileSync(path.join(ROOT, 'src', f), 'utf8')).join('\n\n');

// local wall time → ms ('2026-10-12 09:00' is read in process.env.TZ)
export const at = (s) => new Date(s.replace(' ', 'T')).getTime();
export const MIN = 60e3, HOUR = 3600e3, DAY = 864e5;

export function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

function fakeEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(), style: { setProperty() {} }, children: [], attrs: {}, textContent: '', innerHTML: '', className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
    appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); }, remove() {},
    insertAdjacentHTML(pos, html) { this.innerHTML = pos === 'afterbegin' ? html + this.innerHTML : this.innerHTML + html; },
    addEventListener() {}, removeEventListener() {}, getContext: () => ({}), querySelector: () => null, querySelectorAll: () => [],
    isConnected: true,
  };
  return el;
}

export function boot(o = {}) {
  let t = o.now ?? at('2026-10-12 09:00');
  const storage = o.storage || memoryStorage();
  const timers = new Map();
  let seq = 0;
  const addTimer = (fn, ms, every) => { const id = ++seq; timers.set(id, { fn, due: t + Math.max(0, +ms || 0), every: every ? Math.max(1, +ms || 1) : 0 }); return id; };
  const clearTimer = (id) => { timers.delete(id); };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(t); else super(...a); }
    static now() { return t; }
  }
  const listeners = {};
  const doc = {
    hidden: false, title: '', _focus: true,
    hasFocus() { return this._focus; },
    getElementById: (id) => (id === 'scene' ? fakeEl('canvas') : null),
    createElement: (tag) => fakeEl(tag),
    head: fakeEl('head'), body: fakeEl('body'), documentElement: fakeEl('html'),
    addEventListener() {}, removeEventListener() {}, querySelector: () => null,
  };
  const ctx = {
    console, Math, JSON, Promise, Map, Set, WeakMap, Array, Object, String, Number, Boolean, Symbol, Error, TypeError, RangeError, isFinite, isNaN, parseFloat, parseInt, encodeURIComponent, Intl,
    Date: FakeDate,
    setTimeout: (fn, ms) => addTimer(fn, ms, false), clearTimeout: clearTimer,
    setInterval: (fn, ms) => addTimer(fn, ms, true), clearInterval: clearTimer,
    requestAnimationFrame: (fn) => addTimer(() => fn(t), 16, false), cancelAnimationFrame: clearTimer,
    localStorage: storage, document: doc,
    navigator: o.navigator || { hardwareConcurrency: 8, deviceMemory: 8 },
    location: { search: o.query ? '?' + o.query : '', protocol: 'http:' },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    performance: { now: () => t },
    URLSearchParams, Image: class {},
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener: (type, fn) => { (listeners[type] || (listeners[type] = [])).push(fn); }, removeEventListener() {},
  };
  if (o.Notification) ctx.Notification = o.Notification;
  // an idle callback that runs at its timeout (the worst case: a busy phone that never idles)
  if (o.idle) { ctx.requestIdleCallback = (fn, opt) => addTimer(fn, (opt && opt.timeout) || 50, false); ctx.cancelIdleCallback = clearTimer; }
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const tail = `
globalThis.__T = { Engine, BUS, TIMER, PREFS, TEXT, LINE, SHEETS, FOCUSMODE, store, freshDB, defaultSettings, dateKey, weekStart, dayStart, addDays,
  get DB() { return DB; }, set DB(v) { DB = v; } };`;
  vm.runInContext(`(() => {\n'use strict';\n${SRC}\n${tail}\n})();`, ctx, { filename: 'engine-under-test.js' });
  const T = ctx.__T;
  const log = [];
  const recordAll = ['boot', 'timer:tick', 'timer:state', 'timer:start', 'timer:pause', 'timer:resume', 'timer:reset', 'timer:skip', 'timer:done', 'timer:mode',
    'timer:wind', 'timer:milestone', 'session:new', 'session:rated', 'task:change', 'rogue:capture', 'rogue:change', 'patch:unlock', 'hoodie', 'settings', 'data', 'stats'];
  for (const e of recordAll) T.BUS.on(e, (p) => log.push([e, p]));

  // run due timers in time order up to t + ms (intervals re-arm)
  function advance(ms, step) {
    const end = t + ms;
    for (;;) {
      let next = null;
      for (const [id, tm] of timers) if (tm.due <= end && (!next || tm.due < next[1].due || (tm.due === next[1].due && id < next[0]))) next = [id, tm];
      if (!next) break;
      const [id, tm] = next;
      t = Math.max(t, tm.due);
      if (tm.every) tm.due += tm.every; else timers.delete(id);
      tm.fn();
      if (step) step(t);
    }
    t = end;
  }
  const app = {
    T, E: T.Engine, BUS: T.BUS, TIMER: T.TIMER, storage, doc, log, listeners,
    get DB() { return T.DB; },
    get now() { return t; },
    // jump the clock without running timers (a sleeping phone, a hidden tab that got frozen)
    jump(ms) { t += ms; for (const tm of timers.values()) if (tm.every && tm.due < t) tm.due = t; },
    setNow(ms) { t = ms; },
    advance,
    init() { T.Engine.init(); T.BUS.emit('boot', {}); return app; },
    events: (type) => log.filter((e) => e[0] === type).map((e) => e[1]),
    clearLog() { log.length = 0; },
    hide() { doc.hidden = true; T.BUS.emit('hidden', {}); },
    show() { doc.hidden = false; T.BUS.emit('visible', {}); },
    timerCount: () => timers.size,
  };
  if (o.init !== false) app.init();
  return app;
}

// A history builder: focus sessions at local wall times → a v2 backup the Engine can import.
export function backup(sessions, extra = {}) {
  let n = 0;
  const list = sessions.map((s) => {
    const end = typeof s === 'string' ? at(s) : s.end;
    const min = s.min || 25;
    return Object.assign({ id: 'h' + ++n, kind: 'focus', planned: min * 60, actual: min * 60, start: end - min * MIN, end, taskId: null, rating: null, note: '', rogues: 0, music: 'off', ok: true }, typeof s === 'string' ? {} : s, { end });
  });
  return JSON.stringify(Object.assign({ v: 2, settings: {}, tasks: [], activeTask: null, sessions: list, rogues: [], patches: {}, hoodie: [], counters: {}, meta: { onboarded: true } }, extra));
}
