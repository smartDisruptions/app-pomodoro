// ───────────────────────────── 20. Engine: the timer, the data, v1 migration, stats, unlocks, the Changelog ─────────────────────────────
// Owns every write to DB and TIMER (CONTRACT.md §8.1). The clock is wall time: a session is a start and an end in
// Date.now() ms, so a reload, a sleeping phone or a hidden tab never loses a second. The Engine is not on the frame
// loop: while a session runs it keeps one 250 ms interval, and it emits `timer:tick` only when the shown second
// changes. The Changelog sheet (prefix lg-) builds its DOM when it opens, from one cached stats() pass.
const Engine = (() => {
  // Patch's lines this module needs that aren't in TEXT yet. Merged into TEXT.lines at load (a copy moved into
  // 10-text.js wins), so LINE() works on them like any other line.
  const NEW_TEXT = {};   // the Changelog's lines live in TEXT.lines (log_*)
  for (const k in NEW_TEXT) if (!TEXT.lines[k]) TEXT.lines[k] = NEW_TEXT[k];

  const MODES = ['focus', 'short', 'long'];
  const MIN_KEY = { focus: 'focusMin', short: 'shortMin', long: 'longMin' };
  const KINDS = TEXT.rogues.map((r) => r.id);
  const DAY_MS = 864e5;
  const WIND_MIN = 60, WIND_MAX = 120 * 60;
  const DEF = defaultSettings();
  const RANGE = { focusMin: [1, 120], shortMin: [1, 30], longMin: [1, 60], longEvery: [1, 12], dailyGoal: [1, 24] };
  const ENUM = { music: ['lofi', 'rain', 'city', 'off'], theme: ['auto', 'night', 'day'], quality: ['auto', 'high', 'lite'], motion: ['auto', 'reduced', 'full'], weather: ['auto', 'rain', 'clear'] };
  const VOL = { volume: 1, musicVol: 1 };
  const V1 = { sessions: 'pomo-sessions-v1', tasks: 'pomo-tasks-v1', settings: 'pomo-settings-v1', achievements: 'pomo-achievements-v1' };
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const BREAKS = ['breathe', 'stretch', 'window'];

  let speed = 1;                 // dev/test: time passes this many times faster (?speed=)
  let iv = 0, saveT = 0;         // the tick interval while running · the debounced save
  let lastWhole = -1;            // the whole second last announced by timer:tick
  let prevLeft = 0, fired = {};  // milestone crossing detection
  let booted = false;            // before main's `boot`, events wait in a queue (other modules haven't registered yet)
  const queue = [];
  let rev = 0;                   // bumps on every data change: stats() and the index cache key on it
  let lastDay = '';
  const now = () => Date.now();
  const hidden = () => typeof document !== 'undefined' && !!document.hidden;
  const arr = (a) => (Array.isArray(a) ? a : []);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const int = (v, a, b, d) => { if (v === null || v === '' || typeof v === 'boolean' || v === undefined) return d; const n = Math.round(+v); return isFinite(n) ? clamp(n, a, b) : d; };
  const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
  const oneLine = (v, max) => str(v, 4 * max).replace(/\s+/g, ' ').trim().slice(0, max);

  function emit(type, p) { if (booted) BUS.emit(type, p || {}); else queue.push([type, p || {}]); }

  // ───────── the document: load, clean, save ─────────
  // freshDB() is the canonical shape; the Engine adds `archive` (cleared shipped tasks, so the Changelog still
  // counts them) and counters.abandonedAt (when the last focus was abandoned: "no resets" rules need it).
  function fresh() { const d = freshDB(); d.archive = []; d.counters.abandonedAt = 0; return d; }
  function validSetting(k, v) {
    if (RANGE[k]) return int(v, RANGE[k][0], RANGE[k][1], undefined);
    if (VOL[k]) { if (v === null || v === '' || typeof v === 'boolean') return undefined; const n = +v; return isFinite(n) ? Math.round(clamp(n, 0, 1) * 100) / 100 : undefined; }
    if (ENUM[k]) return ENUM[k].indexOf(v) >= 0 ? v : undefined;
    if (typeof DEF[k] === 'boolean') return v === 'false' ? false : v === 'true' ? true : typeof v === 'boolean' || typeof v === 'number' ? !!v : undefined;
    return undefined;
  }
  function cleanSession(s) {
    if (!s || typeof s !== 'object' || MODES.indexOf(s.kind) < 0) return null;
    const a = num(s.start, NaN), b = num(s.end, NaN);
    if (!isFinite(a) || !isFinite(b)) return null;
    const o = {
      id: str(s.id, 64) || uid(), kind: s.kind, planned: Math.max(0, Math.round(num(s.planned, 0))), actual: Math.max(0, Math.round(num(s.actual, 0))),
      start: Math.min(a, b), end: Math.max(a, b), taskId: typeof s.taskId === 'string' ? s.taskId : null,
      rating: s.rating == null ? null : int(s.rating, 1, 5, null), note: str(s.note, 500), rogues: int(s.rogues, 0, 999, 0),
      music: typeof s.music === 'string' ? s.music : null, ok: s.ok !== false,
    };
    if (s.v1) o.v1 = true;
    return o;
  }
  function cleanTask(t) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !t.id) return null;
    return { id: t.id.slice(0, 64), title: oneLine(t.title, 140) || 'Untitled', est: int(t.est, 1, 12, 1), done: int(t.done, 0, 9999, 0),
      createdAt: num(t.createdAt, now()), doneAt: typeof t.doneAt === 'number' && isFinite(t.doneAt) && t.doneAt > 0 ? t.doneAt : null, order: 0 };
  }
  function cleanRogue(r) {
    if (!r || typeof r !== 'object' || KINDS.indexOf(r.kind) < 0 || !isFinite(r.at)) return null;
    return { id: str(r.id, 64) || uid(), kind: r.kind, note: str(r.note, 280), at: +r.at, sessionId: typeof r.sessionId === 'string' ? r.sessionId : null, done: !!r.done };
  }
  // A saved or imported document → a clean v2 DB (or null when it isn't one). Never throws on odd input.
  function sanitize(d) {
    if (!d || typeof d !== 'object' || d.v !== 2) return null;
    const o = fresh();
    const s = d.settings && typeof d.settings === 'object' ? d.settings : {};
    for (const k in o.settings) if (k in s) { const v = validSetting(k, s[k]); if (v !== undefined) o.settings[k] = v; }
    const seen = new Set();
    o.tasks = arr(d.tasks).map(cleanTask).filter((t) => t && !seen.has(t.id) && seen.add(t.id));
    o.tasks.forEach((t, i) => { t.order = i; });
    o.archive = arr(d.archive).map(cleanTask).filter((t) => t && t.doneAt).slice(-500);
    o.activeTask = o.tasks.some((t) => t.id === d.activeTask && !t.doneAt) ? d.activeTask : null;
    o.sessions = arr(d.sessions).map(cleanSession).filter(Boolean).sort((a, b) => a.end - b.end);
    o.rogues = arr(d.rogues).map(cleanRogue).filter(Boolean).sort((a, b) => a.at - b.at);
    const P = d.patches && typeof d.patches === 'object' ? d.patches : {};
    for (const p of TEXT.patches) { const v = P[p.id]; if (typeof v === 'number' && isFinite(v) && v > 0) o.patches[p.id] = v; }
    o.hoodie = arr(d.hoodie).filter((id, i, a) => o.patches[id] && a.indexOf(id) === i).slice(0, 4);
    const c = d.counters && typeof d.counters === 'object' ? d.counters : {};
    for (const k in o.counters) o.counters[k] = Math.max(0, num(c[k], 0));
    o.timer = d.timer && typeof d.timer === 'object' ? d.timer : null;
    const m = d.meta && typeof d.meta === 'object' ? d.meta : {};
    o.meta.firstOpen = num(m.firstOpen, o.meta.firstOpen); o.meta.lastOpen = num(m.lastOpen, 0);
    o.meta.onboarded = !!m.onboarded; o.meta.migratedV1 = !!m.migratedV1; o.meta.v1Sessions = int(m.v1Sessions, 0, 1e7, 0);
    if (m.demo) o.meta.demo = true;
    return o;
  }
  function load() {
    const raw = store.raw('pomo2:db');
    let d = null;
    try { d = raw ? sanitize(JSON.parse(raw)) : null; } catch (e) { d = null; }
    // something unreadable (half-written, or a newer format) is kept aside before a fresh document replaces it
    if (!d && raw) { try { localStorage.setItem('pomo2:db.bak', raw); } catch (e) {} }
    DB = d || fresh();
  }
  const snapshot = () => ({ mode: TIMER.mode, state: TIMER.state, dur: TIMER.dur, left: TIMER.left, endAt: TIMER.endAt, startAt: TIMER.startAt, elapsed: TIMER.elapsed, cycle: TIMER.cycle, rogues: TIMER.rogues, sessionId: TIMER.sessionId });
  function save(timerSnap) { clearTimeout(saveT); saveT = 0; if (!DB) return; DB.timer = timerSnap || snapshot(); store.set('db', DB); }
  function saveSoon() { if (!saveT) saveT = setTimeout(() => { saveT = 0; save(); }, 300); }
  function syncPrefs() { const s = DB.settings; PREFS.haptics = !!s.haptics; PREFS.motion = s.motion; PREFS.talk = !!s.talk; PREFS.sound = !!s.sound; }

  // ───────── the timer ─────────
  const durOf = (mode) => 60 * DB.settings[MIN_KEY[mode] || 'focusMin'];
  function left() { return TIMER.state === 'running' ? Math.max(0, ((TIMER.endAt - now()) * speed) / 1000) : TIMER.left; }
  const progress = () => (TIMER.dur > 0 ? clamp(1 - left() / TIMER.dur, 0, 1) : 0);
  function nextMode() {
    if (TIMER.mode !== 'focus') return 'focus';
    return TIMER.cycle + 1 >= DB.settings.longEvery ? 'long' : 'short';
  }
  // an idle, fresh session in `mode` (no events)
  function setup(mode) {
    TIMER.mode = mode; TIMER.state = 'idle';
    TIMER.dur = TIMER.left = durOf(mode);
    TIMER.endAt = TIMER.startAt = 0; TIMER.elapsed = 0; TIMER.rogues = 0; TIMER.sessionId = null;
    fired = {}; lastWhole = -1;
  }
  function title() {
    if (typeof document === 'undefined') return;
    const t = TIMER.state === 'idle' ? TEXT.app.name : mmss(left()) + ' · ' + (TIMER.state === 'paused' ? 'Paused' : TEXT.modes[TIMER.mode].short);
    if (document.title !== t) document.title = t;
  }
  function emitTick() {
    TIMER.left = left(); TIMER.elapsed = Math.max(0, TIMER.dur - TIMER.left);
    lastWhole = Math.ceil(TIMER.left - 1e-6);
    emit('timer:tick', { left: TIMER.left, dur: TIMER.dur, mode: TIMER.mode, state: TIMER.state });
    title();
  }
  const emitState = () => emit('timer:state', { state: TIMER.state, mode: TIMER.mode });
  const emitMode = () => emit('timer:mode', { mode: TIMER.mode, cycle: TIMER.cycle });
  function arm() { clearInterval(iv); iv = TIMER.state === 'running' ? setInterval(tick, 250) : 0; }
  function disarm() { clearInterval(iv); iv = 0; }
  function tick() {
    if (TIMER.state !== 'running') { disarm(); return; }
    const l = left();
    if (l <= 0) { reconcile(); return; }
    TIMER.left = l; TIMER.elapsed = TIMER.dur - l;
    milestones(prevLeft, l); prevLeft = l;
    if (Math.ceil(l - 1e-6) !== lastWhole) emitTick();
  }
  // half, 5 min left, 1 min left: focus sessions of 10 minutes or more, once each, only when crossed while running
  function milestones(a, b) {
    if (TIMER.mode !== 'focus' || TIMER.dur < 600) return;
    let hit = null;
    for (const [k, T] of [['half', TIMER.dur / 2], ['five', 300], ['one', 60]]) if (!fired[k] && a > T && b <= T) { fired[k] = true; hit = k; }
    if (hit) emit('timer:milestone', { kind: hit });
  }
  // start a session whose clock began at `at` (now, or a previous session's end when auto-start chains)
  function begin(at) {
    const t = now();
    TIMER.sessionId = uid(); TIMER.startAt = at; TIMER.endAt = at + (TIMER.left * 1000) / speed;
    TIMER.state = 'running'; TIMER.rogues = 0; fired = {}; prevLeft = left(); lastWhole = -1;
    emit('timer:start', at < t - 3000 ? { mode: TIMER.mode, dur: TIMER.dur, away: true } : { mode: TIMER.mode, dur: TIMER.dur });
    emitState(); emitTick(); save(); arm(); syncLock();
  }
  function start() {
    if (TIMER.state === 'running') return false;
    if (TIMER.state === 'paused') return resume();
    begin(now());
    return true;
  }
  function pause() {
    if (TIMER.state !== 'running') return false;
    if (left() <= 0) { reconcile(); return false; }
    TIMER.left = left(); TIMER.elapsed = TIMER.dur - TIMER.left; TIMER.state = 'paused'; TIMER.endAt = 0;
    disarm();
    emit('timer:pause', {}); emitState(); emitTick(); save(); syncLock();
    return true;
  }
  function resume() {
    if (TIMER.state !== 'paused') return false;
    TIMER.endAt = now() + (TIMER.left * 1000) / speed; TIMER.state = 'running'; prevLeft = TIMER.left;
    emit('timer:resume', {}); emitState(); emitTick(); save(); arm(); syncLock();
    return true;
  }
  function toggle() { return TIMER.state === 'running' ? pause() : start(); }
  // running/paused → idle with the planned duration (abandoned if a focus had ≥ 60 s on it); idle → un-wind
  function reset() {
    if (TIMER.state === 'idle') {
      const d = durOf(TIMER.mode);
      if (TIMER.left === d && TIMER.dur === d) return false;
      TIMER.dur = TIMER.left = d;
      emit('timer:reset', { abandoned: false }); emitTick(); saveSoon();
      return true;
    }
    const abandoned = TIMER.mode === 'focus' && TIMER.dur - left() >= 60;
    if (abandoned) { DB.counters.abandoned++; DB.counters.abandonedAt = now(); rev++; }
    disarm();
    const dur = TIMER.dur;
    setup(TIMER.mode); TIMER.dur = TIMER.left = dur;
    emit('timer:reset', { abandoned }); emitMode(); emitState(); emitTick(); save(); syncLock();
    return true;
  }
  // to the next mode, idle. Skipping records nothing; skipping a focus doesn't advance the cycle; a long break
  // (finished or skipped) closes the cycle.
  function skip() {
    const from = TIMER.mode, to = nextMode();
    disarm();
    if (from === 'long') TIMER.cycle = 0;
    setup(to);
    emit('timer:skip', { from, to }); emitMode(); emitState(); emitTick(); save(); syncLock();
    return true;
  }
  function setMode(mode) {
    if (TIMER.state !== 'idle' || MODES.indexOf(mode) < 0) return false;
    setup(mode);
    emitMode(); emitState(); emitTick(); saveSoon();
    return true;
  }
  // set the time in any state (one-off: the setting keeps its default)
  function wind(sec) {
    sec = clamp(Math.round(+sec || 0), WIND_MIN, WIND_MAX);
    if (TIMER.state === 'running') {
      const el = Math.max(0, TIMER.dur - left());
      TIMER.endAt = now() + (sec * 1000) / speed; TIMER.dur = el + sec; TIMER.left = sec; prevLeft = sec;
    } else if (TIMER.state === 'paused') {
      const el = Math.max(0, TIMER.dur - TIMER.left);
      TIMER.left = sec; TIMER.dur = el + sec;
    } else TIMER.dur = TIMER.left = sec;
    TIMER.elapsed = TIMER.dur - TIMER.left;
    emit('timer:wind', { left: sec, dur: TIMER.dur }); emitTick(); saveSoon();
    return sec;
  }
  // what's audible right now (lofi_forever counts sessions recorded with the lo-fi radio on and sound on)
  function musicNow() {
    const s = DB.settings;
    const muted = typeof Snd !== 'undefined' && Snd && Snd.muted === true;
    return s.sound && !muted ? s.music : 'off';
  }
  // Complete the running (or paused, via finish) session as if its time ran out at `end`.
  function complete(end, noAuto) {
    const t = now();
    end = Math.round(Math.min(end || t, t));
    const mode = TIMER.mode, focus = mode === 'focus', late = t - end > 3000, away = hidden() || late;
    const dur = Math.max(1, Math.round(TIMER.dur));
    disarm();
    const s = {
      id: TIMER.sessionId || uid(), kind: mode, planned: dur, actual: dur,
      start: Math.round(TIMER.startAt || end - (dur * 1000) / speed), end,
      taskId: focus ? DB.activeTask || null : null, rating: null, note: '', rogues: focus ? TIMER.rogues : 0, music: musicNow(), ok: true,
    };
    DB.sessions.push(s);
    let next = 'focus', cycle = false;
    if (focus) {
      const task = taskById(DB.activeTask);
      if (task) task.done++;
      const c = TIMER.cycle + 1;
      if (c >= DB.settings.longEvery) { next = 'long'; TIMER.cycle = 0; cycle = true; } else { next = 'short'; TIMER.cycle = c; }
    } else if (mode === 'long') TIMER.cycle = 0;
    rev++;
    const un = evaluate({ session: focus ? s : null, cycle });
    // saved now, as the next session (a crash during the celebration loses nothing)
    save({ mode: next, state: 'idle', dur: durOf(next), left: durOf(next), endAt: 0, startAt: 0, elapsed: 0, cycle: TIMER.cycle, rogues: 0, sessionId: null });
    // during timer:done, TIMER still shows the finished session, at zero
    TIMER.state = 'idle'; TIMER.left = 0; TIMER.endAt = 0; TIMER.elapsed = TIMER.dur;
    emit('session:new', { session: s });
    emit('timer:done', { mode, session: s, next, away });
    notifyDone(mode, next, end);
    for (const id of un) emit('patch:unlock', { id });
    setup(next);
    emitMode(); emitState(); emitTick();
    emit('stats', {});
    const auto = next === 'focus' ? DB.settings.autoFocus : DB.settings.autoBreak;
    if (auto && !noAuto) begin(end); else syncLock();
    return s;
  }
  // Complete every session whose end has passed, each from its own end time. Auto-start chains are capped at one
  // full cycle (2 × longEvery sessions) so a weekend away with both autos on doesn't invent a hundred tomatoes.
  function reconcile() {
    const cap = Math.max(4, 2 * DB.settings.longEvery);
    let n = 0;
    while (TIMER.state === 'running' && left() <= 0) { n++; complete(TIMER.endAt, n >= cap); }
  }
  function finish() {
    if (TIMER.state === 'idle') begin(now());
    complete(now(), false);
    return true;
  }
  function setSpeed(f) {
    f = clamp(+f || 1, 0.01, 1e5);
    if (TIMER.state === 'running') { const l = left(); speed = f; TIMER.endAt = now() + (l * 1000) / speed; arm(); } else speed = f;
    return speed;
  }
  // after a reload: carry on exactly where the saved session is (a running one keeps running in wall time)
  function restoreTimer() {
    setup('focus'); TIMER.cycle = 0;
    const t = DB.timer;
    if (!t || typeof t !== 'object' || MODES.indexOf(t.mode) < 0) return;
    TIMER.mode = t.mode;
    TIMER.cycle = int(t.cycle, 0, DB.settings.longEvery - 1, 0);
    const state = t.state === 'running' || t.state === 'paused' ? t.state : 'idle';
    if (state === 'idle') { TIMER.dur = TIMER.left = clamp(Math.round(num(t.left, durOf(t.mode))), WIND_MIN, WIND_MAX); return; }
    TIMER.dur = clamp(num(t.dur, durOf(t.mode)), 1, DAY_MS / 1000);
    TIMER.sessionId = typeof t.sessionId === 'string' && t.sessionId ? t.sessionId : uid();
    TIMER.startAt = num(t.startAt, now()); TIMER.rogues = int(t.rogues, 0, 999, 0);
    if (state === 'running' && num(t.endAt, 0) > 0) { TIMER.state = 'running'; TIMER.endAt = t.endAt; }
    else { TIMER.state = 'paused'; TIMER.endAt = 0; TIMER.left = clamp(num(t.left, TIMER.dur), 0, TIMER.dur); }
    TIMER.left = left(); TIMER.elapsed = TIMER.dur - TIMER.left; prevLeft = TIMER.left;
    fired = { half: TIMER.left <= TIMER.dur / 2, five: TIMER.left <= 300, one: TIMER.left <= 60 };
  }

  // ───────── platform: title, wake lock, notifications ─────────
  let lock = null, locking = false;
  const wantLock = () => !!(DB && DB.settings.wakeLock && !hidden() && (TIMER.state === 'running' || FOCUSMODE.on));
  function syncLock() {
    if (!wantLock()) { const l = lock; lock = null; if (l) { try { const r = l.release(); if (r && r.catch) r.catch(() => {}); } catch (e) {} } return; }
    if (lock || locking) return;
    const wl = typeof navigator !== 'undefined' && navigator.wakeLock;
    if (!wl || typeof wl.request !== 'function') return;
    locking = true;
    let p;
    try { p = wl.request('screen'); } catch (e) { locking = false; return; }
    Promise.resolve(p).then((l) => {
      locking = false; lock = l;
      try { l.addEventListener('release', () => { if (lock === l) lock = null; }); } catch (e) {}
      if (!wantLock()) syncLock();
    }, () => { locking = false; });
  }
  // a background tab's timers run late (Chrome throttles them to once a minute), so lateness alone doesn't mean
  // the person saw it; ten minutes after the end, the news is stale
  function notifyDone(mode, next, end) {
    try {
      if (!DB.settings.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted' || now() - end > 10 * 60e3) return;
      const focused = !hidden() && (typeof document.hasFocus !== 'function' || document.hasFocus());
      if (focused) return;
      const n = TEXT.notify[mode] || TEXT.notify.focus;
      const opts = { body: n.body.replace('{min}', DB.settings[MIN_KEY[next]]), tag: 'patchs-pomodoro', renotify: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
      let shown = false;
      const plain = () => { if (shown) return; shown = true; try { new Notification(n.title, opts); } catch (e) {} };
      const sw = typeof navigator !== 'undefined' && navigator.serviceWorker;
      if (sw && sw.controller && sw.ready) {
        const t = setTimeout(plain, 1500);
        sw.ready.then((r) => { if (shown) return; shown = true; clearTimeout(t); return r.showNotification(n.title, opts); }).catch(() => { clearTimeout(t); shown = false; plain(); });
      } else plain();
    } catch (e) { reportErr('engine:notify', e); }
  }
  function requestNotify() {
    try {
      if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
      if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
      return new Promise((res) => {
        const p = Notification.requestPermission((r) => res(r));
        if (p && p.then) p.then(res, () => res('denied'));
      });
    } catch (e) { return Promise.resolve('unsupported'); }
  }

  // ───────── the index: completed focus sessions by local calendar day (cached per data revision) ─────────
  // Day numbers are calendar days since 1970-01-01 of the *local* date, so DST never splits or merges a day.
  const dayNumOf = (ms) => { const d = new Date(ms); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS; };
  const keyOfNum = (dn) => { const d = new Date(dn * DAY_MS); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); };
  const msOfNum = (dn) => { const d = new Date(dn * DAY_MS); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime(); };
  const weekdayOfNum = (dn) => (dn + 4) % 7;   // 0 = Sunday (1970-01-01 was a Thursday)
  let IX = null;
  function index() {
    if (IX && IX.rev === rev) return IX;
    const f = [], dns = [], days = new Map();
    let sec = 0, rs = 0, rn = 0, d0 = 0, d1 = -1, dn = 0;
    for (const s of DB.sessions) {
      if (s.kind !== 'focus' || !s.ok) continue;
      const e = s.end;
      if (e < d0 || e >= d1) {   // a new calendar day: one Date per day, not per session
        const d = new Date(e); d.setHours(0, 0, 0, 0); d0 = d.getTime();
        dn = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
        d.setDate(d.getDate() + 1); d1 = d.getTime();
      }
      f.push(s); dns.push(dn);
      const x = days.get(dn);
      if (x) { x.n++; x.sec += s.actual; } else days.set(dn, { n: 1, sec: s.actual });
      sec += s.actual;
      if (s.rating != null) { rs += s.rating; rn++; }
    }
    IX = { rev, f, dns, days, sec, rs, rn };
    return IX;
  }
  // consecutive days with a completed focus, ending on day `dn` (0 if `dn` has none)
  function runTo(days, dn) { let n = 0; while (days.has(dn - n)) n++; return n; }
  function longestRun(days) {
    let best = 0;
    for (const dn of days.keys()) { if (days.has(dn - 1)) continue; let n = 1; while (days.has(dn + n)) n++; if (n > best) best = n; }
    return best;
  }
  const allTasks = () => DB.tasks.concat(DB.archive || []);

  // ───────── patches: the exact rules (CONTRACT.md §8.1) ─────────
  // Returns the ids unlocked by this call (DB.patches written; the caller emits patch:unlock after its own event).
  // ctx.session: the focus session just completed · ctx.cycle: it closed a cycle (full_stack) · ctx.all: a catch-up
  // (boot, import, seed) that re-reads every session for the rules that look at single sessions.
  function evaluate(ctx) {
    ctx = ctx || {};
    const P = DB.patches, out = [];
    const want = (id) => !P[id];
    const un = (id) => { if (!P[id]) { P[id] = now(); out.push(id); } };
    const ix = index(), f = ix.f, n = f.length;
    if (n >= 1) un('first_tomato');
    if (n >= 10) un('ten_down');
    if (n >= 50) un('full_crate');
    if (n >= 100) un('hundred_club');
    if (ix.sec >= 3600) un('hour_power');
    if (ix.sec >= 18000) un('deep_worker');
    if (want('hat_trick') || want('weekly_warrior') || want('monthly_master')) {
      const st = runTo(ix.days, dayNumOf(now()));
      if (st >= 3) un('hat_trick');
      if (st >= 7) un('weekly_warrior');
      if (st >= 30) un('monthly_master');
    }
    if (want('night_owl') || want('early_bird')) for (const s of ctx.all ? f : ctx.session ? [ctx.session] : []) { const hr = new Date(s.end).getHours(); if (hr >= 22 || hr < 4) un('night_owl'); else if (hr >= 4 && hr < 7) un('early_bird'); }
    if (want('marathon')) for (const x of ix.days.values()) if (x.n >= 8) { un('marathon'); break; }
    if (want('weekend_shift')) for (const dn of ix.days.keys()) if (weekdayOfNum(dn) === 6 && ix.days.has(dn + 1)) { un('weekend_shift'); break; }
    if (want('hotfix') && (ctx.all || ctx.session)) for (let i = ctx.all ? 1 : n - 1; i < n; i++) if (i > 0 && ix.dns[i] - ix.dns[i - 1] >= 3) { un('hotfix'); break; }
    if (want('lofi_forever')) { let k = 0; for (const s of f) if (s.music === 'lofi' && ++k >= 10) { un('lofi_forever'); break; } }
    if (want('quarantine') && DB.rogues.length >= 10) un('quarantine');
    if (want('rogues_gallery')) { const k = new Set(); for (const r of DB.rogues) k.add(r.kind); if (k.size >= KINDS.length) un('rogues_gallery'); }
    if (want('exterminator') && DB.counters.bugBest >= 25) un('exterminator');
    if (want('breathe_easy') && DB.counters.breathe >= 5) un('breathe_easy');
    if (want('shipped_it') && allTasks().some((t) => t.doneAt && t.done >= 1 && t.done <= t.est)) un('shipped_it');
    // sequence rules: judged when a session completes (v1 history had no rogues or resets to judge by)
    const ab = DB.counters.abandonedAt || 0;
    if (ctx.session && want('clean_build') && n >= 4) {
      const w = f.slice(n - 4);
      if (w.every((s) => !s.v1 && s.rogues === 0) && ab <= w[0].start) un('clean_build');
    }
    if (ctx.cycle && want('full_stack')) {
      const L = DB.settings.longEvery;
      if (n >= L) {
        const w = f.slice(n - L), day = ix.dns[n - 1];
        if (w.every((s, i) => !s.v1 && ix.dns[n - L + i] === day) && dayNumOf(w[0].start) === day && ab <= w[0].start) un('full_stack');
      }
    }
    if (out.length) rev++;
    return out;
  }
  function unlocks(ids) { for (const id of ids) emit('patch:unlock', { id }); }

  // ───────── tasks ─────────
  function taskById(id) { if (!id) return null; for (const t of DB.tasks) if (t.id === id) return t; return null; }
  const renumber = () => DB.tasks.forEach((t, i) => { t.order = i; });
  const nextOpen = (except) => { for (const t of DB.tasks) if (!t.doneAt && t.id !== except) return t.id; return null; };
  function tchange(task, op, now_) { rev++; if (now_) save(); else saveSoon(); emit('task:change', { task, op }); }
  function addTask(title, est = 1) {
    title = oneLine(title, 140);
    if (!title) return null;
    const t = { id: uid(), title, est: int(est, 1, 12, 1), done: 0, createdAt: now(), doneAt: null, order: DB.tasks.length };
    DB.tasks.push(t);
    if (!DB.activeTask) DB.activeTask = t.id;
    tchange(t, 'add'); emit('stats', {});
    return t;
  }
  function updateTask(id, p) {
    const t = taskById(id);
    if (!t || !p || typeof p !== 'object') return null;
    if ('title' in p) { const s = oneLine(p.title, 140); if (s) t.title = s; }
    if ('est' in p) t.est = int(p.est, 1, 12, t.est);
    if ('done' in p) t.done = int(p.done, 0, 9999, t.done);
    tchange(t, 'update'); emit('stats', {});
    return t;
  }
  function removeTask(id) {
    const t = taskById(id);
    if (!t) return false;
    DB.tasks.splice(DB.tasks.indexOf(t), 1); renumber();
    if (DB.activeTask === id) DB.activeTask = nextOpen();
    tchange(t, 'remove'); emit('stats', {});
    return true;
  }
  function toggleTaskDone(id) {
    const t = taskById(id);
    if (!t) return null;
    if (t.doneAt) {
      t.doneAt = null;
      if (!DB.activeTask) DB.activeTask = t.id;
      tchange(t, 'undone');
    } else {
      t.doneAt = now();
      if (DB.activeTask === id) DB.activeTask = nextOpen(id);
      const un = evaluate({ task: t });
      tchange(t, 'done', true); unlocks(un);
    }
    emit('stats', {});
    return t;
  }
  function setActiveTask(id) {
    const t = id ? taskById(id) : null;
    if (id && (!t || t.doneAt)) return false;
    DB.activeTask = t ? t.id : null;
    tchange(t, 'active');
    return true;
  }
  function moveTask(id, to) {
    const i = DB.tasks.findIndex((t) => t.id === id);
    if (i < 0) return false;
    const [t] = DB.tasks.splice(i, 1);
    DB.tasks.splice(clamp(Math.round(+to || 0), 0, DB.tasks.length), 0, t); renumber();
    tchange(t, 'move');
    return true;
  }
  // shipped tasks leave the list but stay in the archive, so the Changelog keeps counting them
  function clearDoneTasks() {
    const done = DB.tasks.filter((t) => t.doneAt);
    if (!done.length) return 0;
    DB.archive = (DB.archive || []).concat(done).slice(-500);
    DB.tasks = DB.tasks.filter((t) => !t.doneAt); renumber();
    tchange(null, 'clear'); emit('stats', {});
    return done.length;
  }

  // ───────── rogues, reflection, hoodie, breaks ─────────
  function captureRogue(kind, note = '') {
    if (KINDS.indexOf(kind) < 0) return null;
    const live = TIMER.mode === 'focus' && (TIMER.state === 'running' || TIMER.state === 'paused');
    const r = { id: uid(), kind, note: str(note, 280).trim(), at: now(), sessionId: live ? TIMER.sessionId : null, done: false };
    DB.rogues.push(r);
    if (live) TIMER.rogues++;
    rev++;
    const un = evaluate({ rogue: r });
    save();
    emit('rogue:capture', { rogue: r }); unlocks(un); emit('stats', {});
    return r;
  }
  function resolveRogue(id, done = true) {
    const r = DB.rogues.find((x) => x.id === id);
    if (!r) return null;
    r.done = !!done; rev++; saveSoon();
    emit('rogue:change', { rogue: r, op: r.done ? 'resolve' : 'reopen' }); emit('stats', {});
    return r;
  }
  function deleteRogue(id) {
    const i = DB.rogues.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const [r] = DB.rogues.splice(i, 1);
    if (r.sessionId && r.sessionId === TIMER.sessionId && TIMER.rogues > 0) TIMER.rogues--;
    rev++; saveSoon();
    emit('rogue:change', { rogue: r, op: 'delete' }); emit('stats', {});
    return true;
  }
  const openRogues = () => DB.rogues.filter((r) => !r.done && r.note);
  function rateSession(id, rating, note) {
    let s = null;
    for (let i = DB.sessions.length - 1; i >= 0; i--) if (DB.sessions[i].id === id) { s = DB.sessions[i]; break; }
    if (!s) return null;
    s.rating = rating == null ? null : int(rating, 1, 5, null);
    if (note != null) s.note = str(note, 500).trim();
    rev++; saveSoon();
    emit('session:rated', { session: s }); emit('stats', {});
    return s;
  }
  function hoodieToggle(id) {
    const i = DB.hoodie.indexOf(id);
    if (i >= 0) DB.hoodie.splice(i, 1);
    else if (DB.patches[id] && DB.hoodie.length < 4) DB.hoodie.push(id);
    else return false;
    saveSoon(); emit('hoodie', { ids: DB.hoodie.slice() });
    return true;
  }
  function recordBreak(kind) {
    if (BREAKS.indexOf(kind) < 0) return false;
    DB.counters[kind] = (DB.counters[kind] || 0) + 1;
    const un = evaluate({}); saveSoon(); unlocks(un);
    return true;
  }
  function recordGame(kind, score) {
    if (kind !== 'bughunt') return false;
    score = int(score, 0, 1e6, 0);
    DB.counters.bugBest = Math.max(DB.counters.bugBest || 0, score); DB.counters.bugTotal = (DB.counters.bugTotal || 0) + score;
    const un = evaluate({}); saveSoon(); unlocks(un);
    return true;
  }

  // ───────── settings ─────────
  function setSetting(key, value) {
    if (!(key in DEF)) return undefined;
    const v = validSetting(key, value);
    if (v === undefined) return undefined;
    DB.settings[key] = v; syncPrefs();
    if (key === 'longEvery') TIMER.cycle = Math.min(TIMER.cycle, v - 1);
    if (MIN_KEY[TIMER.mode] === key && TIMER.state === 'idle') { TIMER.dur = TIMER.left = v * 60; emitTick(); }
    saveSoon();
    emit('settings', { key, value: v });
    if (key === 'dailyGoal') { rev++; emit('stats', {}); }
    if (key === 'wakeLock') syncLock();
    return v;
  }

  // ───────── stats (CONTRACT.md §8.1 shape; cached until the data or the day changes; treat as read-only) ─────────
  function isoWeek(ms) {
    const d = new Date(ms);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);   // the Thursday of this ISO week
    const year = t.getUTCFullYear(), jan4 = new Date(Date.UTC(year, 0, 4));
    return { year, week: 1 + Math.round(((t - jan4) / DAY_MS - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7) };
  }
  const versionOf = (ms) => { const w = isoWeek(ms); return 'v' + w.year + '.' + pad2(w.week); };
  let S = null;
  function stats() {
    const t = now(), tn = dayNumOf(t);
    if (S && S.rev === rev && S.day === tn) return S.v;
    const ix = index(), f = ix.f;
    const ts = msOfNum(tn), te = msOfNum(tn + 1), ws = weekStart(t), wn = dayNumOf(ws), we = msOfNum(wn + 7);
    const td = ix.days.get(tn);
    const all = {}, week = {};
    for (const k of KINDS) { all[k] = 0; week[k] = 0; }
    let rT = 0, rW = 0;
    for (const r of DB.rogues) { all[r.kind]++; if (r.at >= ws && r.at < we) { week[r.kind]++; rW++; } if (r.at >= ts && r.at < te) rT++; }
    let shT = 0, shW = 0, shA = 0;
    for (const x of allTasks()) if (x.doneAt) { shA++; if (x.doneAt >= ws && x.doneAt < we) shW++; if (x.doneAt >= ts && x.doneAt < te) shT++; }
    const days = [];
    let wT = 0, wS = 0;
    for (let i = 0; i < 7; i++) { const e = ix.days.get(wn + i), d = { key: keyOfNum(wn + i), label: WD[i], tomatoes: e ? e.n : 0, focusSec: e ? e.sec : 0 }; days.push(d); wT += d.tomatoes; wS += d.focusSec; }
    const heat = [];
    for (let i = 0; i < 84; i++) { const dn = wn - 77 + i, e = ix.days.get(dn); heat.push({ key: keyOfNum(dn), tomatoes: e ? e.n : 0, future: dn > tn }); }
    const byHour = new Array(24).fill(0), from = msOfNum(tn - 29);
    for (let i = f.length - 1; i >= 0 && f[i].end >= from; i--) byHour[new Date(f[i].start).getHours()]++;
    let first = DB.meta.firstOpen || t;
    for (const s of DB.sessions) if (s.start < first) first = s.start;
    const titles = {};
    for (const x of allTasks()) titles[x.id] = x.title;
    const recent = [];
    for (let i = f.length - 1; i >= 0 && recent.length < 30; i--) recent.push(Object.assign({}, f[i], { taskTitle: (f[i].taskId && titles[f[i].taskId]) || null }));
    const v = {
      today: { key: keyOfNum(tn), tomatoes: td ? td.n : 0, focusSec: td ? td.sec : 0, rogues: rT, goal: DB.settings.dailyGoal, shipped: shT },
      week: { start: ws, version: versionOf(ws), days, tomatoes: wT, focusSec: wS, rogues: rW, shipped: shW },
      streak: { current: runTo(ix.days, ix.days.has(tn) ? tn : tn - 1), longest: longestRun(ix.days), todayDone: ix.days.has(tn) },
      heat, byHour, byRogue: { week, all },
      totals: { tomatoes: f.length, focusSec: ix.sec, sessions: DB.sessions.length, rogues: DB.rogues.length, shipped: shA, avgRating: ix.rn ? Math.round((ix.rs / ix.rn) * 10) / 10 : null, since: dateKey(first) },
      recent,
    };
    S = { rev, day: tn, v };
    return v;
  }
  // any week, with the extras the Changelog shows (best day, rogues, shipped titles, patches unlocked)
  function weekOf(ms) {
    const ix = index(), ws = weekStart(ms), wn = dayNumOf(ws), we = msOfNum(wn + 7), tn = dayNumOf(now());
    const days = [];
    let n = 0, sec = 0, best = null;
    for (let i = 0; i < 7; i++) {
      const dn = wn + i, e = ix.days.get(dn);
      const d = { key: keyOfNum(dn), label: WD[i], tomatoes: e ? e.n : 0, focusSec: e ? e.sec : 0, future: dn > tn, today: dn === tn, ms: msOfNum(dn) };
      days.push(d); n += d.tomatoes; sec += d.focusSec;
      if (d.tomatoes && (!best || d.tomatoes > best.tomatoes)) best = d;
    }
    const byRogue = {};
    for (const k of KINDS) byRogue[k] = 0;
    let rogues = 0;
    for (const r of DB.rogues) if (r.at >= ws && r.at < we) { byRogue[r.kind]++; rogues++; }
    const shipped = [];
    for (const x of allTasks()) if (x.doneAt && x.doneAt >= ws && x.doneAt < we) shipped.push(x);
    shipped.sort((a, b) => a.doneAt - b.doneAt);
    const patches = TEXT.patches.filter((p) => DB.patches[p.id] >= ws && DB.patches[p.id] < we).map((p) => p.id);
    return { start: ws, end: we, version: versionOf(ws), days, tomatoes: n, focusSec: sec, rogues, byRogue, shipped, patches, best, current: wn <= tn && tn < wn + 7 };
  }

  // ───────── data: export, import, clear, onboarding ─────────
  function exportJSON() { return JSON.stringify(Object.assign({ app: 'patchs-pomodoro', exportedAt: new Date(now()).toISOString() }, DB, { timer: null })); }
  function exportCSV() {
    // quote what needs quoting; a cell that starts like a formula is defused (spreadsheets would run it)
    const q = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const titles = {};
    for (const t of allTasks()) titles[t.id] = t.title;
    const rows = ['date,start,end,kind,planned_min,actual_min,task,rating,rogues,music,note'];
    for (const s of DB.sessions) rows.push([dateKey(s.end), new Date(s.start).toISOString(), new Date(s.end).toISOString(), s.kind, (s.planned / 60).toFixed(1), (s.actual / 60).toFixed(1), q(s.taskId ? titles[s.taskId] || '' : ''), s.rating == null ? '' : s.rating, s.rogues, s.music || '', q(s.note)].join(','));
    return rows.join('\n') + '\n';
  }
  // after DB is replaced wholesale: everyone resyncs
  function resync(op, n) {
    syncPrefs();
    emit('data', { op, n }); emit('hoodie', { ids: DB.hoodie.slice() });
    emitMode(); emitState(); emitTick(); emit('stats', {});
  }
  function importJSON(text) {
    let d;
    try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, error: 'That file isn’t valid JSON.' }; }
    const clean = d && typeof d === 'object' && Array.isArray(d.sessions) ? sanitize(d) : null;
    if (!clean) return { ok: false, error: 'That file isn’t a backup from this app.' };
    clean.meta.onboarded = true;
    clean.meta.migratedV1 = clean.meta.migratedV1 || DB.meta.migratedV1;
    clean.timer = null;
    DB = clean; rev++;
    if (TIMER.state === 'idle') setup(TIMER.mode);
    TIMER.cycle = Math.min(TIMER.cycle, DB.settings.longEvery - 1);
    const un = evaluate({ all: true });
    save();
    resync('import', DB.sessions.length); unlocks(un);
    return { ok: true, n: DB.sessions.length };
  }
  // sessions, tasks, rogues and patches go; settings stay; the v1 keys stay too but never migrate again
  function clearAll() {
    disarm();
    const settings = DB.settings, onboarded = DB.meta.onboarded;
    DB = fresh(); DB.settings = settings; DB.meta.onboarded = onboarded; DB.meta.migratedV1 = true;
    rev++; setup('focus'); TIMER.cycle = 0;
    save(); syncLock();
    resync('clear', 0);
    return true;
  }
  function markOnboarded() { DB.meta.onboarded = true; save(); return true; }

  // ───────── v1 migration (the March 2026 Next.js app's Zustand keys; read-only, once, idempotent) ─────────
  function readV1(key) {
    const raw = store.raw(key);
    if (!raw) return null;
    try { const o = JSON.parse(raw); return o && typeof o === 'object' && o.state && typeof o.state === 'object' ? o.state : null; } catch (e) { return null; }
  }
  const isoMs = (v) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return isFinite(t) ? t : null; };
  function migrateV1() {
    if (DB.meta.migratedV1) return -1;
    const S1 = readV1(V1.sessions), T1 = readV1(V1.tasks), C1 = readV1(V1.settings), A1 = readV1(V1.achievements);
    if (!S1 && !T1 && !C1 && !A1) return -1;
    const KIND = { focus: 'focus', shortBreak: 'short', longBreak: 'long' };
    const have = new Set(DB.sessions.map((s) => s.id));
    let nf = 0;
    for (const v of arr(S1 && S1.sessions)) {
      if (!v || typeof v !== 'object' || !KIND[v.type]) continue;
      const end = isoMs(v.completedAt);
      if (end == null) continue;
      const planned = Math.max(0, Math.round(num(v.duration, 0))), actual = Math.max(0, Math.round(num(v.actualDuration, planned)));
      let start = isoMs(v.startedAt);
      // v1 lost the start time when the page reloaded mid-session (startedAt = completedAt): rebuild it
      if (start == null || start > end || end - start < 1000 * Math.min(60, actual)) start = end - actual * 1000;
      const id = typeof v.id === 'string' && v.id ? v.id.slice(0, 64) : 'v1-' + end;
      if (have.has(id)) continue;
      have.add(id);
      DB.sessions.push({ id, kind: KIND[v.type], planned, actual, start, end, taskId: typeof v.taskId === 'string' ? v.taskId : null,
        rating: v.focusRating == null ? null : int(v.focusRating, 1, 5, null), note: str(v.note, 500), rogues: 0, music: null, ok: true, v1: true });
      if (v.type === 'focus') nf++;
    }
    DB.sessions.sort((a, b) => a.end - b.end);
    const haveT = new Set(DB.tasks.map((t) => t.id));
    const tasks = arr(T1 && T1.tasks).filter((t) => t && typeof t.id === 'string' && t.id && !haveT.has(t.id)).map((t) => {
      const done = int(t.completedSessions, 0, 9999, 0);
      return { id: t.id.slice(0, 64), title: oneLine(t.title, 140) || 'Untitled', est: clamp(Math.max(1, done), 1, 12), done, createdAt: isoMs(t.createdAt) || now(), doneAt: null, order: 0 };
    }).sort((a, b) => a.createdAt - b.createdAt);   // v1 kept newest first; v2 lists in the order they were made
    DB.tasks = DB.tasks.concat(tasks); renumber();
    if (!DB.activeTask && T1 && typeof T1.selectedTaskId === 'string' && taskById(T1.selectedTaskId)) DB.activeTask = T1.selectedTaskId;
    if (C1) {
      const map = { workDuration: 'focusMin', shortBreakDuration: 'shortMin', longBreakDuration: 'longMin', sessionsBeforeLongBreak: 'longEvery',
        soundEnabled: 'sound', notificationsEnabled: 'notify', ambientVolume: 'musicVol', reflectionEnabled: 'reflect' };
      for (const k in map) if (k in C1) { const v = validSetting(map[k], C1[k]); if (v !== undefined) DB.settings[map[k]] = v; }
      if ('ambientSoundEnabled' in C1) DB.settings.music = C1.ambientSoundEnabled ? 'lofi' : 'off';
      if ('theme' in C1) DB.settings.theme = C1.theme === 'light' ? 'day' : C1.theme === 'dark' ? 'auto' : 'night';   // 'dark' was v1's default
    }
    for (const a of arr(A1 && A1.achievements)) {
      if (!a || typeof a !== 'object' || !a.unlockedAt) continue;
      const t = isoMs(a.unlockedAt), p = TEXT.patches.find((x) => x.v1 && x.v1 === a.id);
      if (t == null || !p) continue;
      if (!DB.patches[p.id] || DB.patches[p.id] > t) DB.patches[p.id] = t;
    }
    DB.meta.migratedV1 = true; DB.meta.v1Sessions = nf;
    DB.timer = null;   // the idle timer shows the migrated focus length (init saves once the timer is restored)
    rev++;
    emit('data', { op: 'migrated', n: nf });
    return nf;
  }

  // ───────── seed('demo'): ~6 weeks of plausible history for screenshots (dev only; deterministic) ─────────
  function seed(kind) {
    if (kind && kind !== 'demo') return false;
    const R = mulberry(0x5eed42), ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const pickW = (w) => { let x = R() * w.reduce((a, b) => a + b[1], 0); for (const [v, p] of w) if ((x -= p) <= 0) return v; return w[0][0]; };
    const t0 = now(), today = dayStart(t0), MIN = 60e3;
    const d = fresh();
    d.settings = DB.settings;
    d.meta = Object.assign({}, DB.meta, { onboarded: true, migratedV1: true, demo: true, firstOpen: addDays(today, -44) });
    const TITLES = ['Outline the launch post', 'Fix the login redirect', 'Write tests for billing', 'Record the demo video', 'Refactor the settings page',
      'Ship the pricing page', 'Answer the design review', 'Clean up analytics events', 'Draft the onboarding emails', 'Migrate the cron jobs',
      'Polish the empty states', 'Write the API docs', 'Prototype the Kanban view', 'Tune the image pipeline', 'Review open PRs'];
    const NOTES = ['Deep work on the API', 'Slack kept pinging', 'Flow after ten minutes', 'Wrote the hard part first', 'Slow start, strong finish',
      'Shipped the fix', 'Brain fog after lunch', 'Finally cracked the bug', 'Outlined the whole post', 'Paired with future me'];
    const RNOTES = { bazu: ['Try the new model release', 'That launch thread'], fukusei: ['“Urgent” email from billing', 'Calendar ping'], bagu: ['Flaky test in CI', 'Console error on boot'],
      kusarigumo: ['Reply to Sam about Friday', 'Review request from Dana'], zatsu: ['Doomscroll', 'Video rabbit hole'], kemuri: ['Idea: dark mode for the dashboard', 'Someday: rewrite in Rust'] };
    let ti = 0, cur = null;
    const nextTask = (at) => { cur = { id: uid(), title: TITLES[ti++ % TITLES.length], est: ri(1, 5), done: 0, createdAt: at - ri(1, 30) * 3600e3, doneAt: null, order: 0 }; return cur; };
    const done = [];
    nextTask(addDays(today, -44));
    const push = (kind, start, mins, extra) => { const s = Object.assign({ id: uid(), kind, planned: mins * 60, actual: mins * 60, start, end: start + mins * MIN, taskId: null, rating: null, note: '', rogues: 0, music: 'lofi', ok: true }, extra); d.sessions.push(s); return s; };
    function focusAt(start, mins) {
      const end = start + mins * MIN;
      const nr = pickW([[0, 52], [1, 30], [2, 13], [3, 5]]);
      for (let k = 0; k < nr; k++) {
        const kd = pickW([['zatsu', 28], ['kusarigumo', 22], ['fukusei', 15], ['bazu', 14], ['bagu', 12], ['kemuri', 9]]);
        const at = start + Math.round(R() * mins * MIN);
        d.rogues.push({ id: uid(), kind: kd, note: R() < 0.45 ? RNOTES[kd][ri(0, 1)] : '', at, sessionId: null, done: t0 - at > 2 * DAY_MS ? R() < 0.85 : R() < 0.3 });
      }
      const rated = R() < 0.65, rating = rated ? pickW([[2, 15], [3, 45], [5, 40]]) : null;
      const s = push('focus', start, mins, { taskId: R() < 0.8 ? cur.id : null, rating, note: rated && R() < 0.22 ? NOTES[ri(0, NOTES.length - 1)] : '', rogues: nr, music: pickW([['lofi', 72], ['rain', 14], ['city', 6], ['off', 8]]) });
      d.rogues.slice(-nr).forEach((r) => { r.sessionId = nr ? s.id : null; });
      if (s.taskId) { cur.done++; if (cur.done >= cur.est && R() < 0.7) { cur.doneAt = end + ri(2, 20) * MIN; done.push(cur); nextTask(end); } }
      return end;
    }
    for (let back = 43; back >= 0; back--) {
      const day = addDays(today, -back), wd = new Date(day).getDay();
      let n;
      if (back === 0) n = 0;
      else if (back <= 8) n = ri(3, 8);
      else if (back >= 24 && back <= 27) n = 0;                // four days off (Hotfix on the way back)
      else n = wd === 0 || wd === 6 ? (R() < 0.4 ? ri(1, 3) : 0) : R() < 0.9 ? ri(2, 8) : 0;
      let t = day + (8.5 + R() * 1.2) * 3600e3;
      for (let i = 0; i < n; i++) {
        if (i === 4) t += ri(50, 80) * MIN;                     // lunch
        const end = focusAt(t, R() < 0.12 ? 50 : 25);
        const longB = (i + 1) % 4 === 0;
        if (R() < 0.8) push(longB ? 'long' : 'short', end + MIN, longB ? 15 : 5, { music: 'lofi' });
        t = end + (longB ? 17 : 6 + ri(0, 4)) * MIN;
      }
      if (back > 0 && n && R() < 0.18) focusAt(day + (21.6 + R() * 0.8) * 3600e3, 25);   // a late one
    }
    // today: a few tomatoes that have already happened
    for (let k = 2; k >= 0; k--) { const start = t0 - (8 + 25) * MIN - k * 31 * MIN; if (start > today) focusAt(start, 25); }
    d.sessions.sort((a, b) => a.end - b.end);
    d.rogues.sort((a, b) => a.at - b.at);
    const recentCut = t0 - 6 * DAY_MS;
    for (const t of done) if (t.doneAt > t0) t.doneAt = t0 - MIN;
    d.archive = done.filter((t) => t.doneAt < recentCut);
    d.tasks = done.filter((t) => t.doneAt >= recentCut).concat([cur], [nextTask(t0 - 3 * DAY_MS), nextTask(t0 - DAY_MS)]);
    d.tasks.forEach((t, i) => { t.order = i; });
    d.activeTask = d.tasks.find((t) => !t.doneAt).id;
    d.counters = { breathe: 6, bugBest: 31, bugTotal: 188, stretch: 4, window: 9, abandoned: 3, abandonedAt: t0 - 10 * DAY_MS };
    DB = d; rev++;
    evaluate({ all: true });
    DB.patches.full_stack = DB.patches.full_stack || 1; DB.patches.clean_build = DB.patches.clean_build || 1;
    // spread the unlock dates back over the weeks they'd have happened in
    Object.keys(DB.patches).forEach((id, i, a) => { DB.patches[id] = t0 - Math.round(((a.length - i) / a.length) * 40 * DAY_MS) + i * 3600e3; });
    DB.hoodie = ['first_tomato', 'night_owl', 'hat_trick', 'clean_build'].filter((id) => DB.patches[id]).slice(0, 3);
    setup('focus'); TIMER.cycle = (index().days.get(dayNumOf(t0)) || { n: 0 }).n % DB.settings.longEvery;
    rev++; save();
    resync('seed', DB.sessions.length);
    return true;
  }

  // ───────── lifecycle ─────────
  function checkDay() { const k = dateKey(); if (k !== lastDay) { lastDay = k; rev++; emit('stats', {}); } }
  function init() {
    speed = clamp(+(QS.get('speed') || 1) || 1, 0.01, 1e5);
    load();
    try { migrateV1(); } catch (e) { reportErr('engine:migrate', e); }
    syncPrefs();
    restoreTimer();
    DB.meta.lastOpen = now();
    lastDay = dateKey();
    if (TIMER.state === 'running') { if (left() <= 0) reconcile(); else arm(); }
    unlocks(evaluate({ all: true }));   // catch-up (a streak, an import, migrated history)
    save();
    try { CSS('engine', LOG_CSS); } catch (e) { reportErr('engine:css', e); }
    BUS.on('boot', () => {
      booted = true;
      const q = queue.splice(0);
      for (const [type, p] of q) BUS.emit(type, p);
      title(); syncLock();
    });
    BUS.on('visible', () => {
      if (TIMER.state === 'running') { if (left() <= 0) reconcile(); else { arm(); emitTick(); } }
      syncLock(); checkDay();
    });
    BUS.on('hidden', () => { if (saveT) save(); });
    BUS.on('focusmode', syncLock);
    BUS.on('stats', logRefresh);
    BUS.on('rogues:ready', logRefresh);
    BUS.on('ready', warmLog);
    setInterval(checkDay, 60 * 1000);
    try { addEventListener('pagehide', () => { if (DB) save(); }); } catch (e) {}
  }

  // ═════════ the Changelog sheet ═════════
  // Josh's "receipts" ethos as a page: the week is a release, every tomato a commit. Built when the sheet opens from
  // one cached stats() pass, as a single innerHTML (inline SVG + CSS, prefix lg-); repainted on `stats` while open.
  // Nothing here runs on the frame loop; the only continuous motion is the streak flame (a composited transform).
  const LOG_CSS = `
.lg{--lg-wood:#7a5232;--lg-fix:#a9bcff;--lg-bug:#ff6b7d;--lg-gold:#f5c542;--lg-ink:#0c0f22;display:grid;gap:12px;padding:2px 0 8px;font:14px/1.45 var(--body);color:var(--text);-webkit-user-select:none;user-select:none}
html[data-theme="day"] .lg{--lg-wood:#c49264;--lg-fix:#3a52c2;--lg-bug:#c8102e;--lg-gold:#966a00;--lg-ink:#f7f1e6}
.lg *{box-sizing:border-box}
.lg-defs{position:absolute;width:0;height:0;overflow:hidden}
.lg-card{position:relative;min-width:0;background:var(--surface-2);border:1px solid var(--border);border-radius:18px;padding:13px 14px 12px}
.lg-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 10px;font:700 11px/1.2 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.lg-h span{font-weight:600;letter-spacing:.04em;text-transform:none;text-align:right}
.lg svg text{font-family:var(--mono);font-weight:700}
.lg-cap{margin:6px 0 0;min-height:1.4em;font:600 11.5px/1.4 var(--mono);color:var(--muted)}
.lg-cap b{color:var(--text)}
/* the release header */
.lg-hero{position:relative;overflow:hidden;border-radius:22px;padding:13px 14px 15px;background:var(--surface-2);border:1px solid var(--border)}
.lg-hero::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 95% at 105% -10%,rgba(var(--mint-rgb),.17),transparent 58%),radial-gradient(80% 90% at -10% 115%,rgba(255,74,61,.14),transparent 60%)}
.lg-hero>*{position:relative}
.lg-top{display:flex;align-items:center;gap:10px;min-width:0}
.lg-term{flex:1;min-width:0;font:600 11px/1.3 var(--mono);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-term b{color:var(--accent);font-weight:700}
.lg-term i{font-style:normal;color:var(--text)}
.lg-term i::after{content:"";display:inline-block;width:.55em;height:1.05em;margin-left:3px;vertical-align:-.2em;background:var(--accent);animation:lg-blink 1.1s steps(1) infinite}
@keyframes lg-blink{50%{opacity:0}}
.lg-strip{display:block;width:100%;height:auto;margin-top:12px;overflow:visible}
.lg-strip .w{fill:var(--text);opacity:.24;transition:opacity var(--t-fast)}
.lg-strip .nil .w{opacity:.14}
.lg-strip text{font-size:9px;fill:var(--muted);letter-spacing:.04em}
.lg-strip .on .w{fill:var(--accent);opacity:1}
.lg-strip g{cursor:pointer}
@media (hover:hover){.lg-strip g:hover .w{opacity:.9}}
.lg-vrow{display:flex;align-items:center;gap:2px;margin:4px -12px 0}
.lg-v{font:400 34px/1.1 var(--display);letter-spacing:.01em;color:var(--text);white-space:nowrap}
.lg-nav{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:999px;color:var(--muted);transition:background var(--t-fast),color var(--t-fast)}
.lg-nav .ic{width:22px;height:22px}
.lg-nav:hover:not([disabled]){color:var(--text);background:var(--surface-3)}
.lg-nav[disabled]{opacity:.28;cursor:default}
.lg-when{flex:none;font:700 10px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;padding:6px 9px;border-radius:999px;background:rgba(var(--mint-rgb),.14);color:var(--accent);white-space:nowrap}
.lg-when.past{background:var(--surface-3);color:var(--muted)}
.lg-range{margin-top:1px;font:600 12px/1.3 var(--mono);color:var(--muted)}
.lg-sum{margin:9px 0 0;font-size:14.5px;line-height:1.45;color:var(--muted)}
.lg-sum b{color:var(--text);font-weight:700}
.lg-sum .k{color:var(--lg-bug);white-space:nowrap}
/* Patch says something */
.lg-say{display:flex;gap:10px;align-items:flex-start;margin-top:12px}
.lg-av{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--lg-ink);color:var(--accent);font:700 10.5px/1 var(--mono);letter-spacing:-.04em;border:1.5px solid var(--accent)}
.lg-bub{margin:0;padding:8px 12px;border-radius:4px 14px 14px 14px;background:var(--surface);border:1px solid var(--border);font-size:13.5px;line-height:1.42;color:var(--text);min-width:0}
.lg-bub small{display:block;margin-bottom:2px;font:700 10px/1.3 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
/* today and the streak */
.lg-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(98px,30%);gap:12px}
.lg-tb{display:flex;align-items:center;gap:12px}
.lg-ring{flex:none;width:min(116px,50%);height:auto;overflow:visible}
.lg-vine{fill:none;stroke:#2fbf71;stroke-width:2;opacity:.45;stroke-dasharray:1 5;stroke-linecap:round}
.lg-vine.met{stroke:var(--lg-gold);opacity:.9;stroke-dasharray:none;stroke-width:1.5}
.lg-ring .n1{font:400 30px var(--display);fill:var(--text);text-anchor:middle}
.lg-ring .n2{font-size:10px;fill:var(--muted);text-anchor:middle;letter-spacing:.08em}
.lg-ghost{fill:none;stroke:var(--muted);stroke-width:1.1;stroke-dasharray:1.6 1.6;opacity:.7}
.lg-rt.bud{opacity:.62}
.lg-slot{fill:var(--surface-3)}
.lg-mini{list-style:none;margin:0;padding:0;display:grid;gap:9px;min-width:0}
.lg-mini li{display:flex;flex-direction:column;line-height:1.15;min-width:0}
.lg-mini b{font:700 17px/1.1 var(--mono);color:var(--text);white-space:nowrap}
.lg-mini span{font:700 9.5px/1.3 var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
.lg-streak{display:flex;flex-direction:column;align-items:center;text-align:center}
.lg-streak .lg-h{align-self:stretch}
.lg-flame{width:46px;height:54px;margin-top:-2px;transform-origin:50% 100%;animation:lg-flick 2.4s ease-in-out 3}
.lg-flame svg{display:block;width:100%;height:100%}
.lg-flame.dim{opacity:.62}
.lg-flame.off{animation:none}
.lg-flame.off path{fill:var(--surface-3);stroke:var(--border);stroke-width:1.5}
.lg-snum{margin-top:2px;font:400 32px/1 var(--display);color:var(--text)}
.lg-sl{font:700 10px/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.lg-best{margin-top:7px;padding:4px 8px;border-radius:999px;background:var(--surface-3);font:700 10.5px/1.2 var(--mono);color:var(--muted);white-space:nowrap}
.lg-best b{color:var(--lg-gold)}
@keyframes lg-flick{0%,100%{transform:scale(1,1) rotate(0)}22%{transform:scale(1.035,.965) rotate(-2.2deg)}48%{transform:scale(.97,1.05) rotate(1.6deg)}74%{transform:scale(1.02,.98) rotate(-.8deg)}}
html[data-q="2"] .lg-flame,html[data-q="3"] .lg-flame{animation:none}
.lg-anim .lg-rt{transform-box:fill-box;transform-origin:50% 60%;animation:lg-pop .46s var(--ease-back) both;animation-delay:calc(var(--i) * 38ms + 120ms)}
@keyframes lg-pop{from{transform:scale(0);opacity:0}}
/* the week as bars */
.lg-bars,.lg-hsvg,.lg-csvg{display:block;width:100%;height:auto;overflow:visible}
.lg-bars text{font-size:10.5px;text-anchor:middle;fill:var(--muted)}
.lg-bars .v{fill:var(--text);font-size:11px;paint-order:stroke;stroke:var(--surface-2);stroke-width:4px;stroke-linejoin:round}
.lg-bars .b{fill:url(#lg-gb)}
.lg-bars .z{fill:var(--surface-3)}
.lg-bars .tl{fill:var(--accent)}
.lg-bars .tod .z{fill:var(--accent);opacity:.55}
.lg-bars .tod .l{fill:var(--accent)}
.lg-bars .fut .z{opacity:.4}
.lg-bars .sel .l{fill:var(--text)}
.lg-bars .sel .hit{fill:var(--text);opacity:.06}
.lg-hit{fill:transparent;cursor:pointer}
.lg-goal{stroke:var(--lg-gold);stroke-width:1.4;stroke-dasharray:3 4;stroke-linecap:round}
.lg-bars .gl{fill:var(--lg-gold);text-anchor:start;font-size:10px}
.lg-anim .lg-bars .b{transform-box:fill-box;transform-origin:50% 100%;animation:lg-grow .6s var(--ease) both;animation-delay:calc(var(--i) * 55ms + 80ms)}
@keyframes lg-grow{from{transform:scaleY(0)}}
.lg-anim .lg-bars .st{transform-box:fill-box;animation:lg-drop .44s var(--ease-back) both;animation-delay:calc(var(--i) * 70ms + var(--k) * 40ms + 100ms)}
@keyframes lg-drop{from{transform:translateY(-16px);opacity:0}}
html[data-q="2"] .lg-anim .st,html[data-q="3"] .lg-anim .st,html[data-q="2"] .lg-anim .lg-rt,html[data-q="3"] .lg-anim .lg-rt{animation:none}
@media (hover:hover){.lg-bars g:hover .hit,.lg-hsvg rect.h:hover{opacity:.12}.lg-bars g:hover .hit{fill:var(--text)}.lg-csvg use[data-act]:hover{opacity:.75}}
/* the crate */
.lg-frame{fill:var(--surface);stroke:var(--lg-wood);stroke-width:3.5}
.lg-slat{stroke:var(--lg-wood);stroke-width:1.2;opacity:.32}
.lg-nail{fill:var(--lg-wood)}
.lg-csvg text{font-size:9.5px;fill:var(--muted);letter-spacing:.04em}
.lg-csvg use[data-act]{cursor:pointer}
.lg-csvg .fut{fill:var(--surface-3);opacity:.5}
.lg-tod{fill:none;stroke:var(--accent);stroke-width:1.8}
.lg-csel{fill:none;stroke:var(--text);stroke-width:1.4;stroke-dasharray:2 2}
.lg-legend{display:flex;align-items:center;justify-content:flex-end;gap:3px;margin-top:6px;font:700 9.5px/1 var(--mono);letter-spacing:.06em;color:var(--muted)}
.lg-legend svg{width:17px;height:17px}
.lg-legend span{margin:0 4px}
.lg-legend .sp{width:10px;height:10px;margin-right:-1px}
.lg-legend .g{margin-right:auto}
.lg-spk{pointer-events:none}
/* when you focus */
.lg-hsvg .h{cursor:pointer}
.lg-hsvg .n{fill:#8a95ff}.lg-hsvg .a{fill:#ffb35c}.lg-hsvg .d{fill:var(--accent)}.lg-hsvg .u{fill:#ff8a73}
.lg-hsvg .h.o{opacity:.78}
.lg-hsvg .h.e{fill:var(--surface-3);opacity:1}
.lg-hsvg .h.sel{stroke:var(--text);stroke-width:1.2}
.lg-hsvg text{font-size:9.5px;fill:var(--muted);text-anchor:middle}
.lg-hsvg .pk{fill:var(--text);font-size:10px}
.lg-axis{stroke:var(--border);stroke-width:1}
/* the rogues' gallery */
.lg-rg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.lg-rc{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0;padding:9px 4px 8px;border-radius:14px;background:var(--surface);border:1.5px solid var(--border);text-align:center;transition:transform var(--t-fast) var(--ease),border-color var(--t-fast),background var(--t-fast)}
.lg-rc:active{transform:scale(.96)}
@media (hover:hover){.lg-rc:hover{border-color:var(--sig)}}
.lg-rc.sel{background:var(--surface-3);border-color:var(--sig)}
.lg-rc.top{border-color:var(--sig)}
.lg-rc.zero .lg-rp{opacity:.45}
.lg-rp{width:50px;height:50px;display:grid;place-items:center}
.lg-rp svg{width:50px;height:50px;display:block}
.lg-rp canvas{width:48px;height:48px;display:block}
.lg-rn{max-width:100%;font:700 12.5px/1.25 var(--body);color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lg-rw{max-width:100%;font:600 10px/1.25 var(--mono);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lg-rk{margin-top:5px;font:700 10px/1 var(--mono);color:var(--muted);white-space:nowrap}
.lg-rk b{font-size:15px;color:var(--text)}
.lg-stamp{position:absolute;top:-8px;right:-5px;transform:rotate(7deg);padding:3px 5px 3px 6px;border-radius:5px;background:var(--rogue);color:#fff;font:700 8px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;box-shadow:0 2px 0 rgba(0,0,0,.18)}
/* recent sessions as a git log */
.lg-git{list-style:none;margin:0;padding:0;position:relative}
.lg-git::before{content:"";position:absolute;left:5px;top:8px;bottom:10px;width:2px;border-radius:2px;background:linear-gradient(var(--border),var(--border)) no-repeat;opacity:.9}
.lg-day{position:relative;padding:12px 0 4px 22px;font:700 10px/1.2 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.lg-day:first-child{padding-top:0}
.lg-c{position:relative;padding:6px 0 8px 22px}
.lg-c::before{content:"";position:absolute;left:0;top:10px;width:12px;height:12px;border-radius:50%;background:var(--tomato);box-shadow:0 0 0 3px var(--surface-2)}
.lg-c.v1::before{background:var(--surface-3);border:2px solid var(--muted)}
.lg-l1{display:flex;align-items:baseline;gap:8px;min-width:0}
.lg-tm{flex:none;font:700 11.5px/1.3 var(--mono);color:var(--muted)}
.lg-task{flex:1;min-width:0;font-weight:650;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lg-task.none{color:var(--muted);font-weight:500;font-style:italic}
.lg-len{flex:none;font:700 12px/1.3 var(--mono);color:var(--accent)}
.lg-l2{display:flex;align-items:center;flex-wrap:wrap;gap:3px 10px;margin-top:3px;font:600 11px/1.3 var(--mono);color:var(--muted)}
.lg-hash{color:var(--lg-gold)}
.lg-stars{display:block;width:66px;height:13px}
.lg-rq{display:inline-flex;align-items:center;gap:3px;color:var(--text)}
.lg-rq svg{width:13px;height:13px}
.lg-tag{padding:1px 5px;border-radius:5px;border:1px solid var(--border);font-size:9.5px;letter-spacing:.08em}
.lg-note{margin:4px 0 0;font:italic 500 12.5px/1.4 var(--body);color:var(--muted);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lg-more{display:block;width:100%;min-height:44px;margin-top:6px;border-radius:999px;border:1px solid var(--border);font:700 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);transition:background var(--t-fast),color var(--t-fast)}
.lg-more:hover{color:var(--text);background:var(--surface-3)}
.lg-empty{display:flex;align-items:center;gap:10px;margin:2px 0;color:var(--muted);font-size:13.5px}
.lg-empty svg{flex:none;width:30px;height:30px}
/* patch notes, like a release */
.lg-notes{position:relative;border-radius:18px;padding:14px 14px 12px;background:var(--lg-ink);border:1.5px dashed var(--border);font:500 12.5px/1.5 var(--mono);color:var(--text)}
.lg-nh{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;font:700 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.lg-nh b{color:var(--accent);letter-spacing:.04em;text-transform:none;font-size:12px}
.lg-nl{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.lg-nl>li{display:grid;grid-template-columns:6.6em minmax(0,1fr);gap:10px;align-items:baseline}
.lg-k{display:block;font:700 9.5px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;padding:4px 0;border-radius:6px;text-align:center;font-style:normal}
.lg-k.s{background:rgba(var(--mint-rgb),.15);color:var(--accent)}
.lg-k.f{background:rgba(127,140,255,.16);color:var(--lg-fix)}
.lg-k.b{background:rgba(255,35,64,.13);color:var(--lg-bug)}
.lg-k.p{background:rgba(245,197,66,.16);color:var(--lg-gold)}
.lg-k.n{background:rgba(245,197,66,.16);color:var(--lg-gold)}
.lg-sub{list-style:none;margin:4px 0 0;padding:0;color:var(--muted);font-size:12px}
.lg-sub li{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lg-sub li::before{content:"↳ ";color:var(--accent)}
.lg-sign{margin:12px 0 0;text-align:right;color:var(--muted);font:600 12px/1.4 var(--mono)}
.lg-sign q{font-family:var(--body);font-style:italic}
.lg-foot{margin:2px 4px 0;text-align:center;font:600 11px/1.7 var(--mono);color:var(--muted)}
.lg-foot b{color:var(--text)}
`;
  const LG = { root: null, wk: 0, more: false, rogue: null, pend: 0, st: null, W: null, ms: 0, gen: 0, full: false };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fx = (n) => (Math.round(n * 10) / 10).toString();
  const use = (id, x, y, s, extra) => `<use href="#${id}" x="${fx(x)}" y="${fx(y)}" width="${fx(s)}" height="${fx(s)}"${extra || ''}/>`;
  const ripe = (n) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
  // Intl formatters are slow to create and quick to use: one per shape, made once
  const DTF = {};
  const OPT = { md: { month: 'short', day: 'numeric' }, mdy: { month: 'short', day: 'numeric', year: 'numeric' }, m: { month: 'short' }, w: { weekday: 'long' },
    wmd: { weekday: 'long', month: 'short', day: 'numeric' }, swmd: { weekday: 'short', month: 'short', day: 'numeric' }, h: { hour: 'numeric' }, hm: { hour: 'numeric', minute: '2-digit' } };
  const fmt = (ms, k) => { try { return (DTF[k] || (DTF[k] = new Intl.DateTimeFormat([], OPT[k]))).format(ms); } catch (e) { return k === 'hm' ? clockTime(ms) : dateKey(ms); } };
  const hourName = (hr) => fmt(new Date(2026, 0, 1, hr).getTime(), 'h');
  const tomatoes = (n) => plural(n, 'tomato', 'tomatoes');
  const dur = (sec) => (sec > 0 ? hm(sec) : '0m');
  // a session id → a 7-character "commit hash" (FNV-1a)
  const hash7 = (s) => { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return ('0000000' + (x >>> 0).toString(16)).slice(-7); };
  const BODY = 'M10 5.6c-4.5 0-7.6 2.7-7.6 6.3 0 3.7 3.3 6.1 7.6 6.1s7.6-2.4 7.6-6.1c0-3.6-3.1-6.3-7.6-6.3z';
  const FLAME = 'M24 54c-11 0-18-7.2-18-17 0-9.2 6.6-14.6 10.2-22.8 1.4 6.4 4.4 9.8 8.2 11.8-.6-7.6 2.4-14.8 8.2-20 .8 8.8 9.4 15.2 9.4 27.6C42 46.4 35.4 54 24 54z';
  const FLAME_IN = 'M24 54c-5.6 0-9-3.8-9-8.6 0-4.6 3.4-7.2 5.2-11.4.8 3.2 2.4 5 4.2 6 0-3.8 1.4-7.4 4.2-10 .4 4.4 4.4 7.6 4.4 13.8 0 6-3.4 10.2-9 10.2z';
  const BLOB = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5c3.4 0 5.5 2.3 5.5 5.6 0 3.1-2.2 5.4-5.5 5.4S2.5 11.2 2.5 8.1C2.5 4.8 4.6 2.5 8 2.5z" fill="var(--lg-ink)" stroke="var(--muted)" stroke-width="1.2"/><circle cx="6" cy="8" r="1.4" fill="#ff2340"/><circle cx="10" cy="8" r="1.4" fill="#ff2340"/></svg>';
  // The six rogues as tiny portraits (from the Neo Dojo cast sheet: moonlit outline, signature neon, crimson eyes),
  // used until Patch.rogueURL() has her baked sprites.
  const L = '#3d4c95', CR = '#ff2340';
  const ROGUE_ART = {
    bazu: `<path d="M44 15 52 5q4 1 5 5l-8 9z" fill="#e6ff3d" stroke="${L}" stroke-width="2"/><circle cx="32" cy="35" r="21" fill="#e8c24a" stroke="${L}" stroke-width="3"/><path d="M18 26q8-9 18-10" stroke="#fff6c8" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/><path d="M13 31q19-5 38 0l-1 7q-8 5-15 1l-3-2-3 2q-7 4-15-1z" fill="#13152a"/><path d="M18 33.5l8-1.4-.6 2.6-6.8 1zM46 33.5l-8-1.4.6 2.6 6.8 1z" fill="${CR}"/><path d="M24 45h16M26.5 49h11" stroke="#e6ff3d" stroke-width="2.2" stroke-linecap="round"/>`,
    fukusei: `<circle cx="32" cy="34" r="22" fill="#1e1830" stroke="${L}" stroke-width="3"/><ellipse cx="32" cy="36" rx="15.5" ry="16.5" fill="#f4f1ea" stroke="${L}" stroke-width="2"/><path d="M32 20l-3 7 4.5 5-2.5 7" stroke="#8d86a0" stroke-width="1.3" fill="none"/><ellipse cx="25" cy="35" rx="3.7" ry="4.1" fill="#fff" stroke="${L}" stroke-width="1"/><circle cx="24.4" cy="35.6" r="2.2" fill="#13152a"/><path d="M35.5 35l8.5-3-.6 3.2-7.4 2z" fill="${CR}"/><path d="M24.5 45q7.5 5.5 15 0" stroke="#13152a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M47 30h9M45 39h11M7 42h8" stroke-width="2.2" stroke="#5ff6ff"/><path d="M45 39h11" stroke-width="2" stroke="${CR}"/>`,
    bagu: `<path d="M25 17Q19 7 10 6M39 17q6-10 15-11" stroke="${L}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="10" cy="6" r="3" fill="#7dff3a"/><circle cx="54" cy="6" r="3" fill="#7dff3a"/><circle cx="32" cy="35" r="21" fill="#3f7d4f" stroke="${L}" stroke-width="3"/><path d="M32 14v12" stroke="#24503a" stroke-width="2"/><ellipse cx="32" cy="38" rx="15" ry="10.5" fill="#081410"/><g fill="${CR}"><circle cx="21.5" cy="36" r="2.2"/><circle cx="25.5" cy="32.5" r="2.2"/><circle cx="25.5" cy="39" r="2.2"/><circle cx="29.2" cy="35.6" r="2"/><circle cx="42.5" cy="36" r="2.2"/><circle cx="38.5" cy="32.5" r="2.2"/><circle cx="38.5" cy="39" r="2.2"/><circle cx="34.8" cy="35.6" r="2"/></g><path d="M27 45q-4 7 1.5 10 0-5 3-8zM37 45q4 7-1.5 10 0-5-3-8z" fill="#e8dcb8"/>`,
    kusarigumo: `<path d="M24 17l2-10 4 6 2-8 2 8 4-6 2 10z" fill="#3d7bff" stroke="${L}" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 49q-10-1-9-10 1-8 9-9 0-10 11-11 6-7 14-3 10-2 12 8 8 2 6 11 5 7-1 13-3 3-9 2z" fill="#7d86ad" stroke="${L}" stroke-width="3"/><circle cx="25.5" cy="34" r="5.2" fill="#fff"/><circle cx="40.5" cy="34" r="5.2" fill="#fff"/><circle cx="26.5" cy="35.5" r="2.7" fill="${CR}"/><circle cx="39.5" cy="35.5" r="2.7" fill="${CR}"/><path d="M18.5 26.5l12 4M47.5 26.5l-12 4" stroke="#13152a" stroke-width="2.6" stroke-linecap="round"/><path d="M27 43.5q6 3 12-2.5" stroke="#13152a" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    zatsu: `<path d="M32 9c16 0 23 12 22 24-1 11-4 19 2 27H8c6-8 3-16 2-27C9 21 16 9 32 9z" fill="#d99ab4" stroke="${L}" stroke-width="3"/><path d="M14 20q6-8 15-9" stroke="#fff" stroke-width="2.5" fill="none" opacity=".45" stroke-linecap="round"/><circle cx="24" cy="29" r="6.6" fill="#fff" stroke="${L}" stroke-width="1.5"/><circle cx="25" cy="30.2" r="3.4" fill="${CR}"/><circle cx="41" cy="25.5" r="4.1" fill="#fff" stroke="${L}" stroke-width="1.2"/><circle cx="40.6" cy="26.4" r="2.1" fill="${CR}"/><circle cx="37.5" cy="37" r="2.7" fill="#fff" stroke="${L}" stroke-width="1"/><circle cx="37.5" cy="37.6" r="1.35" fill="${CR}"/><path d="M18 44q14 10 29-2-15 7-29 2z" fill="#3a1030"/><path d="M21 45.6q11 5.4 23-1.6" stroke="#fff" stroke-width="1.7" stroke-dasharray="2 1.5" fill="none"/><path d="M54 8q.7 2.6 3.2 3.2-2.5.7-3.2 3.2-.7-2.5-3.2-3.2 2.5-.6 3.2-3.2z" fill="#ff3d9a"/>`,
    kemuri: `<path d="M6 55q4-5 1-9M58 53q-4-5-1-9" stroke="#9a8ab4" stroke-width="2.6" fill="none" opacity=".45" stroke-linecap="round"/><path d="M15 23Q6 17 4 4q7 8 16 13z" fill="#d9b26a" stroke="${L}" stroke-width="1.6"/><path d="M49 23q9-6 11-19-7 8-16 13z" fill="#b8913f" stroke="${L}" stroke-width="1.6"/><path d="M11 34q-1-16 10-21l11-4 11 4q11 5 10 21l-5 14q-16 6-32 0z" fill="#3a2040" stroke="${L}" stroke-width="3"/><path d="M15 29q17-4 34 0l-2 15q-15 5-30 0z" fill="#160a1a"/><path d="M17 32h30l-2.6 4.6H19.6z" fill="${CR}"/><path d="M32 11.5l3 5-3 5-3-5z" fill="${CR}"/><path d="M28 41h8M29.5 44h5" stroke="#d9b26a" stroke-width="1.5"/>`,
  };
  function defs() {
    const g = (id, a, b, c) => `<radialGradient id="${id}" cx=".36" cy=".34" r=".8"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
    const tom = (id, grad, leaf, deep) => `<symbol id="${id}" viewBox="0 0 20 20"><path d="${BODY}" fill="url(#${grad})"/><ellipse cx="6.7" cy="9.5" rx="2.2" ry="1.25" fill="#fff" opacity=".42" transform="rotate(-24 6.7 9.5)"/><path d="M10 6.3 5.8 6.9l2.9 1-1.5 2.1 2.8-1.4 2.8 1.4-1.5-2.1 2.9-1z" fill="${leaf}" stroke="${deep}" stroke-width=".55" stroke-linejoin="round"/><path d="M10 6.9c0-1.4.4-2.4 1.4-3.1" fill="none" stroke="${deep}" stroke-width="1.25" stroke-linecap="round"/></symbol>`;
    let s = '<svg class="lg-defs" aria-hidden="true" focusable="false"><defs>'
      + g('lg-g1', '#d4f59c', '#8fd14f', '#4e9a2e') + g('lg-g2', '#ffd79e', '#ffa53d', '#d2601a') + g('lg-g3', '#ffa38f', '#ff4a3d', '#c8231a')
      + g('lg-g4', '#ef6a5c', '#c8231a', '#740c06') + g('lg-gg', '#fff3b8', '#f5c542', '#b07d0a')
      + '<linearGradient id="lg-gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6d55"/><stop offset="1" stop-color="#c8231a"/></linearGradient>'
      + '<linearGradient id="lg-gf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d2e"/><stop offset=".55" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ffcc5c"/></linearGradient>'
      + '<symbol id="lg-t0" viewBox="0 0 20 20"><ellipse cx="10" cy="11.4" rx="6.9" ry="6" class="lg-slot"/></symbol>'
      + `<symbol id="lg-tx" viewBox="0 0 20 20"><path d="${BODY}" class="lg-ghost"/></symbol>`
      + '<symbol id="lg-sp" viewBox="0 0 10 10"><path d="M5 0q.7 3.6 5 5-4.3 1.4-5 5-.7-3.6-5-5 4.3-1.4 5-5z" fill="#f5c542" stroke="#9a6a00" stroke-width=".4"/></symbol>'
      + tom('lg-t1', 'lg-g1', '#3c8c27', '#24601a') + tom('lg-t2', 'lg-g2', '#2fbf71', '#1b7a45') + tom('lg-t3', 'lg-g3', '#2fbf71', '#1b7a45')
      + tom('lg-t4', 'lg-g4', '#2fbf71', '#1b7a45') + tom('lg-tg', 'lg-gg', '#2fbf71', '#1b7a45');
    for (const k of KINDS) s += `<symbol id="lg-r-${k}" viewBox="0 0 64 64">${ROGUE_ART[k] || ''}</symbol>`;
    return s + '</defs></svg>';
  }
  function say(text, label) {
    return `<div class="lg-say"><span class="lg-av" aria-hidden="true">&lt;/&gt;</span><p class="lg-bub">${label ? '<small>' + esc(label) + '</small>' : ''}${esc(text)}</p></div>`;
  }
  // the rogue with the most captures in `by` (null when there are none)
  function topRogue(by) { let k = null; for (const id of KINDS) if (by[id] && (!k || by[id] > by[k])) k = id; return k; }

  function heroHTML(st, W) {
    const top = topRogue(W.byRogue), R = top ? ROGUE(top) : null;
    const when = LG.wk === 0 ? 'This week' : LG.wk === 1 ? 'Last week' : LG.wk + ' weeks ago';
    const cmd = LG.wk === 0 ? 'git log --since=monday' : 'git show ' + W.version;
    const range = fmt(W.start, 'md') + ' – ' + fmt(W.end - DAY_MS / 2, 'mdy');
    let sum;
    if (W.tomatoes || W.rogues) {
      sum = `<b>${W.tomatoes}</b> ${W.tomatoes === 1 ? 'tomato' : 'tomatoes'} shipped · <b>${W.rogues}</b> ${W.rogues === 1 ? 'rogue' : 'rogues'} quarantined`;
      if (R) sum += ` · known issue: <b class="k">${esc(R.name)} (${W.byRogue[top]})</b>`;
    } else {
      sum = LG.wk === 0 ? 'No tomatoes yet this week.' : 'A quiet week. Nothing shipped.';
      const prev = LG.wk === 0 ? weekSums(st)[10] : 0;
      if (prev) sum += ` Last week: <b>${tomatoes(prev)}</b>.`;
    }
    const empty = !st.totals.sessions && !DB.rogues.length;
    return `<header class="lg-hero"><div class="lg-top"><div class="lg-term" aria-hidden="true"><b>patch@neo-dojo</b>:~$ <i>${esc(cmd)}</i></div><span class="lg-when${LG.wk ? ' past' : ''}">${when}</span></div>`
      + `<div class="lg-vrow"><button class="lg-nav" data-act="prev" aria-label="Previous week"${LG.wk >= maxBack() ? ' disabled' : ''}>${ICON('left')}</button>`
      + `<span class="lg-v">${W.version}</span>`
      + `<button class="lg-nav" data-act="next" aria-label="Next week"${LG.wk ? '' : ' disabled'}>${ICON('right')}</button></div>`
      + `<div class="lg-range">${esc(range)}</div><p class="lg-sum">${sum}</p>`
      + (empty ? say(LINE('log_empty')) : stripHTML(st)) + '</header>';
  }
  // tomatoes per week for the 12 weeks of the crate (Monday-first columns, oldest first)
  function weekSums(st) { const w = []; for (let c = 0; c < 12; c++) { let n = 0; for (let r = 0; r < 7; r++) n += st.heat[c * 7 + r].tomatoes; w.push(n); } return w; }
  // the release train: the last 12 weeks as small bars; tap one to read its patch notes
  function stripHTML(st) {
    const w = weekSums(st), sel = 11 - LG.wk;
    let max = 1;
    for (const n of w) if (n > max) max = n;
    let s = `<svg class="lg-strip" viewBox="0 0 300 48" role="group" aria-label="The last 12 releases">`;
    w.forEach((n, c) => {
      const hh = n ? Math.max(4, (n / max) * 24) : 2.5;
      s += `<g data-act="wk" data-i="${c}" class="${c === sel ? 'on' : ''}${n ? '' : ' nil'}"><title>${esc(weekLabel(c))}: ${tomatoes(n)}</title><rect class="lg-hit" x="${c * 25}" y="0" width="25" height="38" rx="6"/><rect class="w" x="${c * 25 + 6.5}" y="${fx(30 - hh)}" width="12" height="${fx(hh)}" rx="3"/></g>`;
    });
    return s + `<line class="lg-axis" x1="2" x2="298" y1="32.5" y2="32.5"/><text x="2" y="46">${weekLabel(0)}</text><text x="298" y="46" text-anchor="end">${weekLabel(11)}</text></svg>`;
  }
  function weekLabel(c) { return versionOf(addDays(weekStart(now()), -7 * (11 - c))); }
  function ringSVG(done, goal) {
    const N = Math.max(goal, done), R = 45, sz = clamp(((TAU * R) / N) * 0.78, 9, 26);
    let s = `<svg class="lg-ring" viewBox="0 0 120 120" role="img" aria-label="${done} of ${goal} tomatoes today"><circle cx="60" cy="60" r="${R}" class="lg-vine${done >= goal ? ' met' : ''}"/>`;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / N) * TAU, x = 60 + Math.cos(a) * R - sz / 2, y = 60 + Math.sin(a) * R - sz * 0.58;
      const bud = i >= done, b = bud ? sz * 0.62 : sz;
      s += `<g class="lg-rt${bud ? ' bud' : ''}" style="--i:${i}">${use(bud ? 'lg-t1' : i < goal ? 'lg-t3' : 'lg-tg', x + (sz - b) / 2, y + (sz - b) * 0.6, b)}</g>`;
    }
    return s + `<text x="60" y="66" class="n1">${done}</text><text x="60" y="81" class="n2">OF ${goal}</text></svg>`;
  }
  function todayHTML(st) {
    const t = st.today;
    return `<section class="lg-card lg-today"><h3 class="lg-h">${TEXT.ui.today}<span>${t.tomatoes >= t.goal ? 'goal met' : plural(t.goal - t.tomatoes, 'to go', 'to go')}</span></h3><div class="lg-tb">${ringSVG(t.tomatoes, t.goal)}`
      + `<ul class="lg-mini"><li><b>${dur(t.focusSec)}</b><span>focus</span></li><li><b>${t.rogues}</b><span>${t.rogues === 1 ? 'rogue' : 'rogues'}</span></li><li><b>${t.shipped}</b><span>shipped</span></li></ul></div></section>`;
  }
  function streakHTML(st) {
    const s = st.streak, on = s.current > 0;
    return `<section class="lg-card lg-streak"><h3 class="lg-h">${TEXT.ui.streak}</h3>`
      + `<div class="lg-flame${on ? (s.todayDone ? '' : ' dim') : ' off'}" aria-hidden="true"><svg viewBox="0 0 48 56"><path d="${FLAME}" fill="url(#lg-gf)"/>${on ? `<path d="${FLAME_IN}" fill="#ffe27a" opacity=".9"/>` : ''}</svg></div>`
      + `<div class="lg-snum">${s.current}</div><div class="lg-sl">${s.current === 1 ? 'day' : 'days'}${on && !s.todayDone ? ' · today?' : ''}</div>`
      + `<div class="lg-best">best <b>${s.longest}</b></div></section>`;
  }
  // this week as bars: a pile of tomatoes per day (a plain bar once a day passes 14), the goal as a dashed line
  function weekHTML(W, goal) {
    let max = goal;
    for (const d of W.days) if (d.tomatoes > max) max = d.tomatoes;
    const base = 112, ts = 22, pile = max <= 14;
    const step = Math.min(ts * 0.66, (88 - ts * 0.62) / Math.max(1, max - 1));
    const height = (n) => (pile ? ts * 0.62 + (n - 1) * step : (n / max) * 88);   // how tall n tomatoes stand
    const gy = base - height(goal) - 2, top = Math.max(0, Math.min(gy, base - height(max)) - 20);
    let s = `<svg class="lg-bars" viewBox="0 ${fx(top)} 320 ${fx(134 - top)}" role="img" aria-label="${esc(W.days.map((d) => d.label + ' ' + d.tomatoes).join(', '))}">`
      + `<line x1="24" x2="318" y1="${fx(gy)}" y2="${fx(gy)}" class="lg-goal"/><text x="1" y="${fx(gy + 3.5)}" class="gl">${goal}</text>`;
    W.days.forEach((d, i) => {
      const cx = 46 + i * 41.5, n = d.tomatoes;
      let g = `<rect class="lg-hit hit" x="${fx(cx - 20.5)}" y="${fx(top + 2)}" width="41" height="${fx(130 - top)}" rx="8"/>`, y = base - 3;
      if (!n) g += `<rect class="z" x="${fx(cx - 12)}" y="${base - 3}" width="24" height="3" rx="1.5"/>`;
      else if (pile) {
        for (let k = 0; k < n; k++) g += `<g class="st" style="--k:${k}">${use('lg-t3', cx - ts / 2 + (k % 2 ? 1.7 : -1.7), base - ts + 1.6 - k * step, ts)}</g>`;
        y = base - height(n) - 3;
      } else { const hh = Math.max(7, height(n)); g += `<rect class="b" x="${fx(cx - 13)}" y="${fx(base - hh)}" width="26" height="${fx(hh)}" rx="7"/>`; y = base - hh; }
      if (n) g += `<text class="v" x="${fx(cx)}" y="${fx(y - 5)}">${n}</text>`;
      if (d.today) g += `<rect class="tl" x="${fx(cx - 11)}" y="${base + 3}" width="22" height="2.6" rx="1.3"/>`;
      s += `<g class="${d.today ? 'tod' : ''}${d.future ? ' fut' : ''}" data-act="day" data-i="${i}" style="--i:${i}">${g}<text class="l" x="${fx(cx)}" y="130">${d.label}</text></g>`;
    });
    return `<section class="lg-card lg-week"><h3 class="lg-h">${LG.wk ? 'That week' : TEXT.ui.week}<span>${W.focusSec ? hm(W.focusSec) + ' focus' : ''}</span></h3>${s}</svg><p class="lg-cap" data-cap="week">${dayCap(W.days.find((d) => d.today) || W.best, goal)}</p></section>`;
  }
  function dayCap(d, goal) {
    if (!d) return 'Tap a day.';
    const name = fmt(d.ms || Date.parse(d.key + 'T12:00:00'), 'wmd');
    if (d.future) return esc(name) + ' · not yet';
    return `${esc(name)} · <b>${tomatoes(d.tomatoes)}</b>${d.focusSec ? ' · ' + hm(d.focusSec) : ''}${goal && d.tomatoes >= goal ? ' · goal met' : ''}`;
  }
  function crateHTML(st) {
    const P = 25, S = 21, LX = 24, TY = 18, cells = st.heat, goal = st.today.goal, todayI = cells.findIndex((d) => d.key === st.today.key);
    let total = 0, s = '', lastM = -1;
    const starts = [];
    for (let c = 0; c < 12; c++) { const ms = Date.parse(cells[c * 7].key + 'T12:00:00'), m = new Date(ms).getMonth(); if (m !== lastM) starts.push([c, ms]); lastM = m; }
    if (starts.length > 1 && starts[1][0] - starts[0][0] < 3) starts.shift();
    for (const [c, ms] of starts) s += `<text x="${LX + c * P}" y="11">${esc(fmt(ms, 'm'))}</text>`;
    s += `<rect x="${LX - 7}" y="${TY - 3}" width="${12 * P + 10}" height="${7 * P + 10}" rx="11" class="lg-frame"/>`;
    for (let r = 1; r < 7; r++) s += `<line x1="${LX - 5}" x2="${LX + 12 * P + 1}" y1="${TY + 4 + r * P - 2}" y2="${TY + 4 + r * P - 2}" class="lg-slat"/>`;
    for (const [x, y] of [[LX - 2, TY + 2], [LX + 12 * P - 2, TY + 2], [LX - 2, TY + 7 * P + 2], [LX + 12 * P - 2, TY + 7 * P + 2]]) s += `<circle cx="${x}" cy="${y}" r="1.6" class="lg-nail"/>`;
    for (const [r, l] of [[0, 'M'], [2, 'W'], [4, 'F'], [6, 'S']]) s += `<text x="${LX - 13}" y="${TY + 4 + r * P + 14}" text-anchor="middle">${l}</text>`;
    cells.forEach((d, i) => {
      const c = (i / 7) | 0, r = i % 7, x = LX + c * P, y = TY + 4 + r * P - 2;
      total += d.tomatoes;
      if (d.future) { s += `<circle cx="${x + S / 2}" cy="${y + S / 2 + 1}" r="2" class="fut"/>`; return; }
      s += use('lg-t' + ripe(d.tomatoes), x, y, S, ` data-act="cell" data-i="${i}"`);
      if (d.tomatoes && d.tomatoes >= goal) s += use('lg-sp', x + S - 6.5, y - 1.5, 8.5, ' class="lg-spk"');
      if (i === todayI) s += `<circle cx="${x + S / 2}" cy="${y + S / 2 + 1}" r="12" class="lg-tod"/>`;
    });
    const legend = [0, 1, 2, 3, 4].map((k) => `<svg viewBox="0 0 20 20" aria-hidden="true"><use href="#lg-t${k}"/></svg>`).join('');
    return `<section class="lg-card lg-crate"><h3 class="lg-h">The crate<span>12 weeks · ${tomatoes(total)}</span></h3>`
      + `<svg class="lg-csvg" viewBox="0 0 ${LX + 12 * P + 6} ${TY + 7 * P + 10}" role="img" aria-label="${tomatoes(total)} in the last 12 weeks">${s}</svg>`
      + `<div class="lg-legend" aria-hidden="true"><svg viewBox="0 0 10 10" class="sp"><use href="#lg-sp"/></svg><span class="g">goal met</span><span>0</span>${legend}<span>6+</span></div><p class="lg-cap" data-cap="crate">Tap a day in the crate.</p></section>`;
  }
  const PART = (hr) => (hr < 5 || hr >= 22 ? 'n' : hr < 9 ? 'a' : hr < 17 ? 'd' : 'u');
  function hoursHTML(st) {
    const hrs = st.byHour;
    let max = 1, total = 0, peak = -1;
    hrs.forEach((v, i) => { total += v; if (v > max) max = v; if (v && (peak < 0 || v > hrs[peak])) peak = i; });
    let s = `<svg class="lg-hsvg" viewBox="0 0 320 98" role="img" aria-label="${total ? 'Most tomatoes start around ' + esc(hourName(peak)) : 'No tomatoes in the last 30 days'}"><line x1="0" x2="320" y1="79.5" y2="79.5" class="lg-axis"/>`;
    for (let i = 0; i < 24; i++) {
      const v = hrs[i], x = 1.5 + i * 13.27, hh = v ? Math.max(4, (v / max) * 60) : 2.5;
      s += `<rect class="h ${v ? PART(i) + (i === peak ? '' : ' o') : 'e'}" x="${fx(x)}" y="${fx(78 - hh)}" width="10.2" height="${fx(hh)}" rx="2.5" data-act="hour" data-i="${i}"/>`;
    }
    if (peak >= 0) s += `<text class="pk" x="${fx(1.5 + peak * 13.27 + 5.1)}" y="${fx(78 - (hrs[peak] / max) * 60 - 6)}">${hrs[peak]}</text>`;
    for (const hr of [0, 6, 12, 18]) s += `<text x="${fx(1.5 + hr * 13.27 + 5.1)}" y="94">${esc(hourName(hr))}</text>`;
    const cap = total ? `Peak: <b>${esc(hourName(peak))}</b> · ${hrs[peak]} of ${tomatoes(total)} start then` : 'No tomatoes in the last 30 days yet.';
    return `<section class="lg-card lg-hours"><h3 class="lg-h">When you focus<span>last 30 days</span></h3>${s}</svg><p class="lg-cap" data-cap="hours">${cap}</p></section>`;
  }
  // Patch's baked sprites. rogueURL() is a ~100 KB PNG (her 128 px bake): pasted into the HTML it made every paint
  // re-parse 600 KB, and decoding six took ~120 ms on a throttled phone. So the markup carries the small SVG
  // portrait, and after the paint each badge gets a copy of her 48 px canvas (Patch.rogue(kind, 48)): one small
  // canvas per rogue, drawn once, moved into every later paint.
  const portrait = (k) => `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#lg-r-${k}"/></svg>`;
  const RCV = {};
  function rogueCanvas(k) {
    let src = null;
    try { src = typeof Patch !== 'undefined' && Patch && typeof Patch.rogue === 'function' ? Patch.rogue(k, 48) : null; } catch (e) { src = null; }
    if (!src || !src.width || !src.height) return null;
    let e = RCV[k];
    if (!e || e.src !== src) {
      const c = makeCanvas(src.width, src.height);
      c.setAttribute('aria-hidden', 'true');
      try { c.getContext('2d').drawImage(src, 0, 0); } catch (err) { return null; }
      e = RCV[k] = { c, src };
    }
    return e.c;
  }
  function placeRogues() {
    for (const el of LG.root.querySelectorAll('.lg-rp[data-rk]')) { const c = rogueCanvas(el.getAttribute('data-rk')); if (c) { el.textContent = ''; el.appendChild(c); } }
  }
  function roguesHTML(st, W) {
    const wk = W.byRogue, all = st.byRogue.all, anyAll = KINDS.some((k) => all[k]);
    const top = topRogue(wk) || topRogue(all);
    let s = '<div class="lg-rg">';
    for (const r of TEXT.rogues) {
      const n = wk[r.id], a = all[r.id];
      s += `<button class="lg-rc${r.id === top ? ' top' : ''}${anyAll && !a ? ' zero' : ''}${LG.rogue === r.id ? ' sel' : ''}" data-act="rogue" data-k="${r.id}" style="--sig:${r.sig}" aria-pressed="${LG.rogue === r.id}" aria-label="${esc(r.name)}, ${esc(r.what)}: ${n} ${LG.wk ? 'that' : 'this'} week, ${a} all time">`
        + `<span class="lg-rp" data-rk="${r.id}">${portrait(r.id)}</span><span class="lg-rn">${esc(r.name.replace('Emperor ', ''))}</span><span class="lg-rw">${esc(r.what)}</span>`
        + `<span class="lg-rk"><b>${n}</b> · ${a}</span>${r.id === top ? '<span class="lg-stamp">Known issue</span>' : ''}</button>`;
    }
    return `<section class="lg-card lg-rogues"><h3 class="lg-h">Rogues’ gallery<span>${LG.wk ? 'that' : 'this'} week · all time</span></h3>${s}</div><div data-cap="rogue">${rogueSay(st, W)}</div></section>`;
  }
  function rogueSay(st, W) {
    if (LG.rogue) { const r = ROGUE(LG.rogue); return say(r.bio, r.name + ' · ' + r.kana + ' · ' + r.cls); }
    const top = topRogue(W.byRogue);
    if (top) return say(LINE('log_top_' + top));
    return say(LINE(DB.rogues.length ? 'log_rogues_quiet' : 'log_rogues_none'));
  }
  function stars(rating) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += use(i <= rating ? 'lg-t3' : 'lg-tx', (i - 1) * 14, 0, 14);
    return `<svg class="lg-stars" viewBox="0 0 70 14" role="img" aria-label="rated ${rating} of 5">${s}</svg>`;
  }
  function dayLabel(ms) {
    const d = dayNumOf(ms), t = dayNumOf(now());
    return d === t ? TEXT.ui.today : d === t - 1 ? 'Yesterday' : esc(fmt(ms, 'swmd'));
  }
  function recentHTML(st) {
    const all = st.recent, list = LG.more ? all : all.slice(0, 8);
    let s = `<section class="lg-card lg-recent"><h3 class="lg-h">Recent sessions<span>${all.length ? 'git log' : ''}</span></h3>`;
    if (!list.length) return s + `<p class="lg-empty"><svg viewBox="0 0 20 20" aria-hidden="true"><use href="#lg-tx"/></svg>No commits yet. Finish a tomato and it lands here.</p></section>`;
    s += '<ol class="lg-git">';
    let last = '';
    for (const r of list) {
      const dk = dateKey(r.end);
      if (dk !== last) { last = dk; s += `<li class="lg-day">${dayLabel(r.end)}</li>`; }
      s += `<li class="lg-c${r.v1 ? ' v1' : ''}"><div class="lg-l1"><span class="lg-tm">${esc(fmt(r.start, 'hm'))}</span><span class="lg-task${r.taskTitle ? '' : ' none'}">${esc(r.taskTitle || 'No task')}</span><span class="lg-len">${hm(r.actual)}</span></div>`
        + `<div class="lg-l2"><span class="lg-hash">${hash7(r.id)}</span>${r.rating ? stars(r.rating) : ''}${r.rogues ? `<span class="lg-rq" title="rogues">${BLOB}${r.rogues}</span>` : ''}${r.v1 ? '<span class="lg-tag">v1</span>' : ''}</div>`
        + (r.note ? `<p class="lg-note">“${esc(r.note)}”</p>` : '') + '</li>';
    }
    s += '</ol>';
    if (!LG.more && all.length > list.length) s += `<button class="lg-more" data-act="more">Show all ${all.length}</button>`;
    return s + '</section>';
  }
  function notesHTML(W) {
    const top = topRogue(W.byRogue), R = top ? ROGUE(top) : null;
    const ship = [plural(W.shipped.length, 'task'), tomatoes(W.tomatoes)];
    if (W.focusSec) ship.push(hm(W.focusSec) + ' of focus');
    const sub = W.shipped.slice(0, 4).map((t) => `<li>${esc(t.title)}</li>`).join('') + (W.shipped.length > 4 ? `<li>and ${W.shipped.length - 4} more</li>` : '');
    const li = (k, label, text, extra) => `<li><i class="lg-k ${k}">${label}</i><div>${text}${extra || ''}</div></li>`;
    let s = li('s', 'Shipped', esc(ship.join(' · ')), sub ? `<ul class="lg-sub">${sub}</ul>` : '');
    s += li('f', 'Fixed', W.rogues ? plural(W.rogues, 'rogue') + ' quarantined' : 'no rogues logged');
    s += li('b', 'Known issue', R ? `${esc(R.name)} (${W.byRogue[top]})` : 'none reported');
    if (W.best) s += li('p', 'Perf', `best day ${esc(fmt(W.best.ms, 'w'))} · ${tomatoes(W.best.tomatoes)}`);
    if (W.patches.length) s += li('n', 'New', esc(W.patches.map((id) => (PATCHDEF(id) || { name: id }).name).join(', ')) + ' patch' + (W.patches.length > 1 ? 'es' : ''));
    const quiet = !W.tomatoes && !W.rogues && !W.shipped.length;
    return `<section class="lg-notes" aria-label="Patch notes ${W.version}"><div class="lg-nh"><span>Patch notes</span><b>${W.version}</b></div><ul class="lg-nl">${s}</ul>`
      + `<p class="lg-sign">${quiet && LG.wk === 0 && DB.sessions.length ? '<q>' + esc(LINE('log_week_empty')) + '</q> ' : ''}— Patch</p></section>`;
  }
  function footHTML(st) {
    const t = st.totals;
    if (!t.sessions) return '';
    const since = fmt(Date.parse(t.since + 'T12:00:00'), 'mdy');
    return `<p class="lg-foot">All time · <b>${tomatoes(t.tomatoes)}</b> · <b>${hm(t.focusSec)}</b> focus · <b>${plural(t.rogues, 'rogue')}</b> · <b>${t.shipped}</b> shipped`
      + `${t.avgRating ? ' · avg <b>' + t.avgRating + '</b>/5' : ''}<br>since ${esc(since)}${DB.meta.v1Sessions ? ` · includes ${plural(DB.meta.v1Sessions, 'session')} from v1` : ''}</p>`;
  }
  // how far back the release history goes (the first week with data), at most two years
  function maxBack() {
    let first = DB.meta.firstOpen || now();
    if (DB.sessions.length && DB.sessions[0].start < first) first = DB.sessions[0].start;
    return clamp(Math.round((weekStart(now()) - weekStart(first)) / (7 * DAY_MS)), 0, 104);
  }
  // the page in two halves: what a phone shows when the sheet opens, and everything below the fold
  function topHTML() {
    LG.st = stats();
    LG.W = weekOf(addDays(weekStart(now()), -7 * LG.wk));
    return defs() + heroHTML(LG.st, LG.W) + `<div class="lg-pair">${todayHTML(LG.st)}${streakHTML(LG.st)}</div>` + weekHTML(LG.W, LG.st.today.goal);
  }
  const REST = [() => crateHTML(LG.st) + hoursHTML(LG.st), () => roguesHTML(LG.st, LG.W) + recentHTML(LG.st) + notesHTML(LG.W) + footHTML(LG.st)];
  const logHTML = () => topHTML() + REST.map((f) => f()).join('');
  // open: parse the top now and the rest in the next idle slot (still while the sheet slides up), so no single
  // task is long on a slow phone. Repaints (new data while open) redo the whole page at once.
  function paint(anim) {
    if (!LG.root) return;
    clearTimeout(LG.restT); LG.restT = 0;
    const gen = ++LG.gen;   // a later paint retires every chunk still queued by this one
    const t0 = performance.now();
    const split = !!anim, html = split ? topHTML() : logHTML();
    LG.full = !split;
    LG.msBuild = performance.now() - t0;
    LG.root.classList.toggle('lg-anim', !!anim && !RM());
    LG.root.innerHTML = html;
    LG.msParse = performance.now() - t0;
    if (split) {
      // the rest arrives in two small idle chunks, each well under a frame budget on a slow phone
      const root = LG.root;
      let k = 0;
      LG.msRest = 0;
      const later = () => { LG.restT = setTimeout(() => { if (typeof requestIdleCallback === 'function') requestIdleCallback(chunk, { timeout: 300 }); else chunk(); }, 16); };
      const chunk = () => {
        LG.restT = 0;
        if (LG.root !== root || LG.gen !== gen) return;
        const t1 = performance.now();
        root.insertAdjacentHTML('beforeend', REST[k++]());
        if (k === REST.length) { placeRogues(); LG.full = true; } else later();
        LG.msRest = Math.max(LG.msRest, performance.now() - t1);
      };
      later();
    } else placeRogues();
    LG.ms = performance.now() - t0;
  }
  // another week: only the parts that depend on the week are rebuilt
  function paintWeek() {
    if (!LG.root || !LG.full || !LG.root.querySelector('.lg-notes')) { paint(false); return; }
    const t0 = performance.now();
    LG.W = weekOf(addDays(weekStart(now()), -7 * LG.wk));
    const swap = (sel, html) => { const el = LG.root.querySelector(sel); if (el) el.outerHTML = html; };
    swap('.lg-hero', heroHTML(LG.st, LG.W)); swap('.lg-week', weekHTML(LG.W, LG.st.today.goal));
    swap('.lg-rogues', roguesHTML(LG.st, LG.W)); swap('.lg-notes', notesHTML(LG.W));
    placeRogues();
    LG.ms = performance.now() - t0;
  }
  // a dry run in idle time after boot, in small chunks (strings only, no DOM): the formatters, the stats cache and
  // the JIT are warm by the time the Changelog first opens, even on a slow phone that rarely idles
  function warmLog() {
    let st = null, W = null, i = 0;
    const steps = [
      () => { st = stats(); W = weekOf(weekStart(now())); },
      () => { defs(); heroHTML(st, W); todayHTML(st); streakHTML(st); },
      () => { weekHTML(W, st.today.goal); crateHTML(st); },
      () => { hoursHTML(st); roguesHTML(st, W); },
      () => { recentHTML(st); notesHTML(W); footHTML(st); },
    ];
    const later = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 60));
    const next = () => {
      if (LG.root || i >= steps.length) return;
      try { steps[i++](); } catch (e) { reportErr('engine:warm', e); return; }
      later(next);
    };
    setTimeout(() => later(next), 1500);
  }
  function caption(name, html) { const el = LG.root && LG.root.querySelector('[data-cap="' + name + '"]'); if (el) el.innerHTML = html; }
  function select(el, cls) { const p = el.parentNode; if (!p) return; for (const x of p.querySelectorAll('.' + cls)) x.classList.remove(cls); el.classList.add(cls); }
  function onLogClick(e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el || !LG.root || !LG.root.contains(el)) return;
    const act = el.getAttribute('data-act'), i = +el.getAttribute('data-i');
    BUS.emit('sfx', { name: 'tap', vol: 0.5 });
    if (act === 'prev' || act === 'next') {
      if (el.disabled) return;
      LG.wk = clamp(LG.wk + (act === 'prev' ? 1 : -1), 0, maxBack()); LG.rogue = null;
      paintWeek();
      const b = LG.root.querySelector(`[data-act="${act}"]`);
      try { (b && !b.disabled ? b : LG.root.querySelector('.lg-nav:not([disabled])') || LG.root).focus({ preventScroll: true }); } catch (err) {}
    } else if (act === 'wk') {
      LG.wk = clamp(11 - i, 0, maxBack()); LG.rogue = null;
      paintWeek();
    } else if (act === 'more') { LG.more = true; paint(false); }
    else if (act === 'rogue') {
      const k = el.getAttribute('data-k');
      LG.rogue = LG.rogue === k ? null : k;
      for (const b of LG.root.querySelectorAll('.lg-rc')) { const on = b.getAttribute('data-k') === LG.rogue; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); }
      caption('rogue', rogueSay(LG.st, LG.W));
    } else if (act === 'day') { select(el, 'sel'); caption('week', dayCap(LG.W.days[i], LG.st.today.goal)); }
    else if (act === 'cell') {
      const d = LG.st.heat[i], e2 = index().days.get(dayNumOf(Date.parse(d.key + 'T12:00:00')));
      const prev = LG.root.querySelector('.lg-csel');
      if (prev) prev.remove();
      const x = +el.getAttribute('x'), y = +el.getAttribute('y'), w = +el.getAttribute('width');
      el.insertAdjacentHTML('afterend', `<circle cx="${fx(x + w / 2)}" cy="${fx(y + w / 2 + 1)}" r="12.5" class="lg-csel"/>`);
      caption('crate', dayCap({ key: d.key, ms: Date.parse(d.key + 'T12:00:00'), tomatoes: d.tomatoes, focusSec: e2 ? e2.sec : 0, future: d.future }, LG.st.today.goal));
    } else if (act === 'hour') {
      select(el, 'sel');
      const v = LG.st.byHour[i];
      caption('hours', `<b>${esc(hourName(i))}</b> · ${tomatoes(v)} started in this hour, last 30 days`);
    }
  }
  function logRefresh() {
    if (!LG.root || LG.pend) return;
    LG.pend = setTimeout(() => { LG.pend = 0; if (LG.root && LG.root.isConnected !== false) paint(false); else LG.root = null; }, 40);
  }
  SHEET.def('log', {
    title: TEXT.ui.log,
    size: 'tall',
    render(body) {
      LG.wk = 0; LG.more = false; LG.rogue = null;
      const root = h('div', { class: 'lg' });
      root.addEventListener('click', onLogClick);
      body.appendChild(root);
      LG.root = root;
      paint(true);
    },
    closed() { LG.root = null; LG.gen++; clearTimeout(LG.pend); LG.pend = 0; clearTimeout(LG.restT); LG.restT = 0; },
  });

  return {
    init,
    start, pause, resume, toggle, reset, skip, finish, setMode, wind, left, progress, nextMode, setSpeed,
    addTask, updateTask, removeTask, toggleTaskDone, setActiveTask, moveTask, clearDoneTasks, activeTask: () => taskById(DB.activeTask),
    captureRogue, resolveRogue, deleteRogue, openRogues,
    rateSession, setSetting, hoodieToggle, recordBreak, recordGame,
    stats, weekOf, exportJSON, exportCSV, importJSON, clearAll, markOnboarded, seed, requestNotify,
    get speed() { return speed; },
    // dev: the last Changelog paint in ms (build the string, parse it, total; rest = the slowest deferred chunk)
    get logPerf() { return { build: LG.msBuild, parse: LG.msParse, total: LG.ms, rest: LG.msRest }; },
  };
})();
