// STUB Engine: a minimal, working timer + data store (CONTRACT.md §8). The real one lives in src/20-engine.js.
const Engine = (() => {
  let speed = 1, iv = 0, lastWhole = -1;
  const now = () => Date.now();
  const save = () => { DB.timer = Object.assign({}, TIMER); store.set('db', DB); };
  const durOf = (mode) => 60 * (mode === 'focus' ? DB.settings.focusMin : mode === 'short' ? DB.settings.shortMin : DB.settings.longMin);
  const syncPrefs = () => { PREFS.haptics = DB.settings.haptics; PREFS.motion = DB.settings.motion; PREFS.talk = DB.settings.talk; PREFS.sound = DB.settings.sound; };
  function setMode(mode) { TIMER.mode = mode; TIMER.state = 'idle'; TIMER.dur = TIMER.left = durOf(mode); TIMER.endAt = TIMER.startAt = 0; TIMER.elapsed = 0; TIMER.rogues = 0; TIMER.sessionId = null; BUS.emit('timer:mode', { mode, cycle: TIMER.cycle }); state(); }
  const state = () => { BUS.emit('timer:state', { state: TIMER.state, mode: TIMER.mode }); tickEmit(true); save(); };
  function left() { return TIMER.state === 'running' ? Math.max(0, (TIMER.endAt - now()) / 1000 * speed) : TIMER.left; }
  function tickEmit(force) {
    TIMER.left = left();
    const whole = Math.ceil(TIMER.left);
    if (force || whole !== lastWhole) { lastWhole = whole; BUS.emit('timer:tick', { left: TIMER.left, dur: TIMER.dur, mode: TIMER.mode, state: TIMER.state }); }
    if (TIMER.state === 'running' && TIMER.left <= 0) complete();
  }
  function loop() { clearInterval(iv); if (TIMER.state === 'running') iv = setInterval(() => tickEmit(false), 250); }
  function start() {
    if (TIMER.state === 'running') return;
    if (TIMER.state === 'paused') return resume();
    TIMER.sessionId = uid(); TIMER.startAt = now(); TIMER.endAt = now() + TIMER.left * 1000 / speed; TIMER.state = 'running';
    BUS.emit('timer:start', { mode: TIMER.mode, dur: TIMER.dur }); state(); loop();
  }
  function pause() { if (TIMER.state !== 'running') return; TIMER.left = left(); TIMER.state = 'paused'; TIMER.endAt = 0; clearInterval(iv); BUS.emit('timer:pause', {}); state(); }
  function resume() { if (TIMER.state !== 'paused') return; TIMER.endAt = now() + TIMER.left * 1000 / speed; TIMER.state = 'running'; BUS.emit('timer:resume', {}); state(); loop(); }
  function toggle() { TIMER.state === 'running' ? pause() : start(); }
  function next() {
    if (TIMER.mode !== 'focus') return 'focus';
    return (TIMER.cycle + 1) % DB.settings.longEvery === 0 ? 'long' : 'short';
  }
  function complete() {
    clearInterval(iv);
    const mode = TIMER.mode, nx = next();
    const s = { id: TIMER.sessionId || uid(), kind: mode, planned: TIMER.dur, actual: TIMER.dur, start: TIMER.startAt || now(), end: now(), taskId: mode === 'focus' ? DB.activeTask : null, rating: null, note: '', rogues: TIMER.rogues, music: DB.settings.music, ok: true };
    DB.sessions.push(s);
    if (mode === 'focus') { TIMER.cycle = (TIMER.cycle + 1) % DB.settings.longEvery; const t = DB.tasks.find((x) => x.id === DB.activeTask); if (t) t.done++; }
    BUS.emit('session:new', { session: s });
    BUS.emit('timer:done', { mode, session: s, next: nx });
    setMode(nx);
    BUS.emit('stats', {});
    if ((nx === 'focus' && DB.settings.autoFocus) || (nx !== 'focus' && DB.settings.autoBreak)) start();
  }
  function reset() { if (TIMER.state === 'idle') return; clearInterval(iv); const ab = TIMER.mode === 'focus'; setMode(TIMER.mode); BUS.emit('timer:reset', { abandoned: ab }); }
  function skip() { clearInterval(iv); const from = TIMER.mode, to = next(); if (from === 'focus') TIMER.cycle = (TIMER.cycle + 1) % DB.settings.longEvery; setMode(to); BUS.emit('timer:skip', { from, to }); }
  function wind(sec) {
    sec = clamp(Math.round(sec), 60, 120 * 60);
    if (TIMER.state === 'running') { TIMER.endAt = now() + sec * 1000 / speed; TIMER.dur = TIMER.elapsed + sec; }
    else { TIMER.left = sec; TIMER.dur = TIMER.state === 'paused' ? TIMER.elapsed + sec : sec; }
    BUS.emit('timer:wind', { left: sec, dur: TIMER.dur }); tickEmit(true); save();
  }
  const task = (id) => DB.tasks.find((t) => t.id === id);
  const tchange = (t, op) => { save(); BUS.emit('task:change', { task: t, op }); };
  return {
    init() {
      const d = store.get('db', null);
      DB = d && d.v === 2 ? Object.assign(freshDB(), d, { settings: Object.assign(defaultSettings(), d.settings || {}) }) : freshDB();
      speed = +(QS.get('speed') || 1) || 1;
      syncPrefs();
      if (DB.timer) Object.assign(TIMER, DB.timer, { state: DB.timer.state === 'running' ? 'paused' : DB.timer.state });
      else setMode('focus');
      DB.meta.lastOpen = now(); save();
    },
    start, pause, resume, toggle, reset, skip, wind, left,
    finish() { if (TIMER.state === 'idle') start(); TIMER.endAt = now(); tickEmit(true); },
    setMode(m) { if (TIMER.state === 'idle') setMode(m); },
    progress: () => (TIMER.dur ? clamp(1 - left() / TIMER.dur, 0, 1) : 0),
    nextMode: next,
    setSpeed(f) { speed = f || 1; if (TIMER.state === 'running') { TIMER.endAt = now() + TIMER.left * 1000 / speed; loop(); } },
    addTask(title, est = 1) { const t = { id: uid(), title: String(title).slice(0, 140), est, done: 0, createdAt: now(), doneAt: null, order: DB.tasks.length }; DB.tasks.push(t); if (!DB.activeTask) DB.activeTask = t.id; tchange(t, 'add'); return t; },
    updateTask(id, p) { const t = task(id); if (t) { Object.assign(t, p); tchange(t, 'update'); } return t; },
    removeTask(id) { const t = task(id); DB.tasks = DB.tasks.filter((x) => x.id !== id); if (DB.activeTask === id) DB.activeTask = null; tchange(t, 'remove'); },
    toggleTaskDone(id) { const t = task(id); if (!t) return; t.doneAt = t.doneAt ? null : now(); tchange(t, t.doneAt ? 'done' : 'undone'); },
    setActiveTask(id) { DB.activeTask = id; tchange(task(id), 'active'); },
    moveTask(id, to) { const i = DB.tasks.findIndex((t) => t.id === id); if (i < 0) return; const [t] = DB.tasks.splice(i, 1); DB.tasks.splice(clamp(to, 0, DB.tasks.length), 0, t); tchange(t, 'move'); },
    clearDoneTasks() { DB.tasks = DB.tasks.filter((t) => !t.doneAt); tchange(null, 'clear'); },
    activeTask: () => task(DB.activeTask) || null,
    captureRogue(kind, note = '') { const r = { id: uid(), kind, note, at: now(), sessionId: TIMER.sessionId, done: false }; DB.rogues.push(r); TIMER.rogues++; save(); BUS.emit('rogue:capture', { rogue: r }); return r; },
    resolveRogue(id, done = true) { const r = DB.rogues.find((x) => x.id === id); if (r) { r.done = done; save(); BUS.emit('rogue:change', { rogue: r, op: 'resolve' }); } },
    deleteRogue(id) { DB.rogues = DB.rogues.filter((x) => x.id !== id); save(); BUS.emit('rogue:change', { rogue: null, op: 'delete' }); },
    rateSession(id, rating, note) { const s = DB.sessions.find((x) => x.id === id); if (s) { s.rating = rating; if (note != null) s.note = note; save(); BUS.emit('session:rated', { session: s }); } },
    setSetting(key, value) { DB.settings[key] = value; syncPrefs(); if (TIMER.state === 'idle' && /Min$/.test(key)) setMode(TIMER.mode); save(); BUS.emit('settings', { key, value }); },
    hoodieToggle(id) { const i = DB.hoodie.indexOf(id); if (i >= 0) DB.hoodie.splice(i, 1); else if (DB.hoodie.length < 4 && DB.patches[id]) DB.hoodie.push(id); else return false; save(); BUS.emit('hoodie', { ids: DB.hoodie.slice() }); return true; },
    recordBreak(kind) { DB.counters[kind] = (DB.counters[kind] || 0) + 1; save(); },
    recordGame(kind, score) { DB.counters.bugBest = Math.max(DB.counters.bugBest, score); DB.counters.bugTotal += score; save(); },
    stats() {
      const today = dateKey(), f = DB.sessions.filter((s) => s.kind === 'focus' && s.ok);
      const td = f.filter((s) => dateKey(s.end) === today);
      return { today: { tomatoes: td.length, focusSec: td.reduce((a, s) => a + s.actual, 0), rogues: DB.rogues.filter((r) => dateKey(r.at) === today).length, goal: DB.settings.dailyGoal },
        streak: { current: td.length ? 1 : 0, longest: 1 }, totals: { tomatoes: f.length, focusSec: f.reduce((a, s) => a + s.actual, 0), rogues: DB.rogues.length },
        week: { days: [], tomatoes: 0, focusSec: 0 }, heat: [], byHour: new Array(24).fill(0), byRogue: {}, recent: f.slice(-20).reverse() };
    },
    exportJSON: () => JSON.stringify(DB, null, 1),
    exportCSV: () => 'kind,start,end,actual\n' + DB.sessions.map((s) => [s.kind, new Date(s.start).toISOString(), new Date(s.end).toISOString(), s.actual].join(',')).join('\n'),
    importJSON(text) { try { const d = JSON.parse(text); if (d.v !== 2) return { ok: false, error: 'Not a backup from this app.' }; DB = Object.assign(freshDB(), d); save(); BUS.emit('data', { op: 'import' }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    clearAll() { DB = freshDB(); setMode('focus'); save(); BUS.emit('data', { op: 'clear' }); },
    openRogues: () => DB.rogues.filter((r) => !r.done && r.note),
    markOnboarded() { DB.meta.onboarded = true; save(); BUS.emit('onboard:done', {}); },
    requestNotify: () => Promise.resolve('default'),
    seed() {},
  };
})();
