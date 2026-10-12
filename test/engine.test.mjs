// The Engine's unit tests (CONTRACT.md §8.1): node --test test/
// Every test runs src/00-core.js + 10-text.js + 20-engine.js in a fresh vm context on fake time (test/harness.mjs),
// in America/Los_Angeles, so dates, DST and day boundaries are deterministic.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boot, backup, at, memoryStorage, MIN, HOUR, DAY } from './harness.mjs';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/v1.json', import.meta.url), 'utf8'));
const v1Storage = () => memoryStorage(Object.assign({}, FIXTURE));
const focusDone = (app) => app.DB.sessions.filter((s) => s.kind === 'focus' && s.ok);
// run the current session to its end on the fake clock
const runOut = (app) => { if (app.TIMER.state !== 'running') app.E.start(); app.advance(app.E.left() * 1000 + 300); };
const unlocked = (app, id) => !!app.DB.patches[id];
const plain = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
// values from the vm realm have their own Array/Object prototypes: compare them as plain data
const eq = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg);

describe('timer state machine', () => {
  test('idle → running → paused → running → idle, with wall-clock times and events in order', () => {
    const app = boot();
    const { E, TIMER } = app;
    assert.equal(TIMER.state, 'idle'); assert.equal(TIMER.mode, 'focus'); assert.equal(TIMER.left, 1500); assert.equal(TIMER.cycle, 0);
    app.clearLog();
    assert.equal(E.start(), true);
    assert.equal(TIMER.state, 'running');
    assert.ok(TIMER.sessionId);
    assert.equal(TIMER.startAt, app.now);
    assert.equal(TIMER.endAt, app.now + 1500e3);
    eq(app.log.slice(0, 3).map((e) => e[0]), ['timer:start', 'timer:state', 'timer:tick']);
    eq(plain(app.events('timer:start')[0]), { mode: 'focus', dur: 1500 });
    assert.equal(E.start(), false, 'start while running is a no-op');
    app.advance(60e3);
    assert.equal(Math.round(E.left()), 1440);
    assert.equal(E.pause(), true);
    assert.equal(TIMER.state, 'paused'); assert.equal(Math.round(TIMER.left), 1440); assert.equal(TIMER.endAt, 0);
    app.advance(5 * MIN);
    assert.equal(Math.round(E.left()), 1440, 'paused time stands still');
    assert.equal(E.resume(), true);
    assert.equal(TIMER.state, 'running'); assert.equal(Math.round((TIMER.endAt - app.now) / 1000), 1440);
    E.toggle(); assert.equal(TIMER.state, 'paused');
    E.toggle(); assert.equal(TIMER.state, 'running');
    app.clearLog();
    E.reset();
    assert.equal(TIMER.state, 'idle'); assert.equal(TIMER.left, 1500); assert.equal(TIMER.sessionId, null);
    eq(app.log.map((e) => e[0]).slice(0, 4), ['timer:reset', 'timer:mode', 'timer:state', 'timer:tick']);
    assert.equal(app.DB.sessions.length, 0, 'a reset records nothing');
  });

  test('timer:tick fires once per shown second, and the title follows', () => {
    const app = boot();
    app.E.start(); app.clearLog();
    app.advance(10e3);
    const ticks = app.events('timer:tick');
    assert.ok(ticks.length >= 9 && ticks.length <= 11, 'ticks: ' + ticks.length);
    assert.equal(app.doc.title, '24:50 · Focus');
    app.E.pause(); assert.equal(app.doc.title, '24:50 · Paused');
    app.E.reset(); assert.equal(app.doc.title, "Patch's Pomodoro");
  });

  test('wind() in idle, running and paused; clamped; the setting keeps its default', () => {
    const app = boot();
    const { E, TIMER } = app;
    E.wind(600); assert.equal(TIMER.dur, 600); assert.equal(TIMER.left, 600);
    E.wind(10); assert.equal(TIMER.left, 60);
    E.wind(1e6); assert.equal(TIMER.left, 7200);
    E.wind(1500); E.start(); app.advance(5 * MIN);
    app.clearLog();
    E.wind(600);
    assert.equal(Math.round(E.left()), 600); assert.equal(Math.round(TIMER.dur), 900); assert.equal(TIMER.endAt, app.now + 600e3);
    eq(plain(app.events('timer:wind')[0]), { left: 600, dur: 900 });
    app.advance(2 * MIN); E.pause();
    E.wind(1200);
    assert.equal(TIMER.left, 1200); assert.equal(Math.round(TIMER.dur), 420 + 1200);
    assert.equal(app.DB.settings.focusMin, 25);
    E.resume(); runOut(app);
    const s = app.DB.sessions[0];
    assert.equal(s.planned, 1620); assert.equal(s.actual, 1620);
  });

  test('setMode only when idle; skip goes to the next mode without recording or advancing the cycle', () => {
    const app = boot();
    const { E, TIMER } = app;
    assert.equal(E.setMode('short'), true); assert.equal(TIMER.mode, 'short'); assert.equal(TIMER.left, 300);
    E.setMode('long'); assert.equal(TIMER.left, 900);
    E.setMode('focus'); E.start();
    assert.equal(E.setMode('short'), false); assert.equal(TIMER.mode, 'focus');
    app.clearLog();
    E.skip();
    eq(plain(app.events('timer:skip')[0]), { from: 'focus', to: 'short' });
    assert.equal(TIMER.mode, 'short'); assert.equal(TIMER.state, 'idle'); assert.equal(TIMER.cycle, 0);
    assert.equal(app.DB.sessions.length, 0);
    E.skip(); assert.equal(TIMER.mode, 'focus');
  });

  test('finish() completes now, as if time ran out (also from idle)', () => {
    const app = boot();
    app.E.finish();
    const s = app.DB.sessions[0];
    assert.equal(s.kind, 'focus'); assert.equal(s.planned, 1500); assert.equal(s.actual, 1500); assert.equal(s.end, app.now);
    assert.equal(app.TIMER.mode, 'short');
  });
});

describe('completion and cycles', () => {
  test('a completed focus records the exact session shape and bumps the active task', () => {
    const app = boot();
    const task = app.E.addTask('Write the intro', 2);
    app.E.start();
    const t0 = app.now, sid = app.TIMER.sessionId;
    app.clearLog();
    app.advance(1500e3 + 400);
    const s = app.DB.sessions[0];
    eq(plain(s), { id: sid, kind: 'focus', planned: 1500, actual: 1500, start: t0, end: t0 + 1500e3, taskId: task.id, rating: null, note: '', rogues: 0, music: 'lofi', ok: true });
    assert.equal(app.DB.tasks[0].done, 1);
    const names = app.log.map((e) => e[0]);
    assert.ok(names.indexOf('session:new') < names.indexOf('timer:done'));
    assert.ok(names.indexOf('timer:done') < names.indexOf('timer:mode'));
    const done = app.events('timer:done')[0];
    assert.equal(done.mode, 'focus'); assert.equal(done.next, 'short'); assert.equal(done.away, false); assert.equal(done.session.id, sid);
    assert.equal(app.TIMER.mode, 'short'); assert.equal(app.TIMER.state, 'idle'); assert.equal(app.TIMER.left, 300);
  });

  test('during timer:done the TIMER shows the finished session at zero; the save is already the next session', () => {
    const app = boot();
    let seen = null;
    app.BUS.on('timer:done', () => { seen = { mode: app.TIMER.mode, state: app.TIMER.state, left: app.TIMER.left, saved: JSON.parse(app.storage.getItem('pomo2:db')).timer.mode }; });
    runOut(app);
    eq(seen, { mode: 'focus', state: 'idle', left: 0, saved: 'short' });
  });

  test('cycle: a long break after every longEvery focus sessions, then a fresh cycle', () => {
    const app = boot();
    const { E, TIMER } = app;
    const seq = [];
    for (let i = 0; i < 8; i++) { runOut(app); seq.push(TIMER.mode + TIMER.cycle); runOut(app); seq.push(TIMER.mode + TIMER.cycle); }
    eq(seq, ['short1', 'focus1', 'short2', 'focus2', 'short3', 'focus3', 'long0', 'focus0', 'short1', 'focus1', 'short2', 'focus2', 'short3', 'focus3', 'long0', 'focus0']);
    E.setSetting('longEvery', 2);
    runOut(app); assert.equal(TIMER.mode, 'short');
    runOut(app); runOut(app); assert.equal(TIMER.mode, 'long');
    assert.equal(E.nextMode(), 'focus');
  });

  test('a skipped long break still closes the cycle', () => {
    const app = boot();
    app.E.setSetting('longEvery', 2);
    runOut(app); app.E.skip(); assert.equal(app.TIMER.cycle, 1);
    app.E.skip(); assert.equal(app.TIMER.mode, 'long', 'skipping the 2nd focus still lands on the long break');
    app.E.skip(); assert.equal(app.TIMER.mode, 'focus'); assert.equal(app.TIMER.cycle, 0);
  });

  test('autoBreak starts the break from the focus end time; autoFocus starts the next focus', () => {
    const app = boot();
    app.E.setSetting('autoBreak', true);
    runOut(app);
    const f = app.DB.sessions[0];
    assert.equal(app.TIMER.mode, 'short'); assert.equal(app.TIMER.state, 'running'); assert.equal(app.TIMER.startAt, f.end);
    app.advance(300e3);
    assert.equal(app.TIMER.mode, 'focus'); assert.equal(app.TIMER.state, 'idle', 'autoFocus is off');
    app.E.setSetting('autoFocus', true);
    runOut(app); app.advance(300e3 + 400);
    assert.equal(app.TIMER.mode, 'focus'); assert.equal(app.TIMER.state, 'running');
  });
});

describe('away and back', () => {
  test('single: a session that ended while hidden completes at its own end, away: true', () => {
    const app = boot();
    app.E.start();
    const endAt = app.TIMER.endAt;
    app.hide(); app.jump(40 * MIN);   // the phone slept: no interval ran
    assert.equal(app.TIMER.state, 'running');
    app.clearLog(); app.show();
    const s = app.DB.sessions[0];
    assert.equal(s.end, endAt);
    assert.equal(app.events('timer:done')[0].away, true);
    assert.equal(app.TIMER.mode, 'short'); assert.equal(app.TIMER.state, 'idle');
  });

  test('chained: autoBreak + autoFocus completes each session from its own end time', () => {
    const app = boot();
    app.E.setSetting('autoBreak', true); app.E.setSetting('autoFocus', true);
    const T = app.now;
    app.E.start(); app.hide(); app.jump(37 * MIN); app.show();
    const ss = app.DB.sessions;
    assert.equal(ss.length, 2);
    eq(ss.map((s) => [s.kind, s.start - T, s.end - T]), [['focus', 0, 25 * MIN], ['short', 25 * MIN, 30 * MIN]]);
    assert.equal(app.TIMER.mode, 'focus'); assert.equal(app.TIMER.state, 'running'); assert.equal(app.TIMER.startAt, T + 30 * MIN);
    assert.equal(Math.round(app.E.left()), 18 * 60);
    assert.ok(app.events('timer:done').every((d) => d.away));
    assert.equal(app.events('timer:start').slice(-1)[0].away, true);
  });

  test('chained: capped at one full cycle when both autos are on and you were gone for days', () => {
    const app = boot();
    app.E.setSetting('autoBreak', true); app.E.setSetting('autoFocus', true);
    app.E.start(); app.hide(); app.jump(3 * DAY); app.show();
    assert.equal(app.DB.sessions.length, 8);
    assert.equal(app.TIMER.state, 'idle');
  });

  test('a reload mid-session carries on in wall time; a reload after the end completes it on boot (events after boot)', () => {
    const a = boot();
    a.E.addTask('Draft', 3);
    a.E.start(); a.advance(10 * MIN);
    const endAt = a.TIMER.endAt;
    const saved = Object.fromEntries(a.storage.map);
    const b = boot({ storage: a.storage, now: a.now + 5 * MIN });
    assert.equal(b.TIMER.state, 'running'); assert.equal(b.TIMER.endAt, endAt);
    assert.equal(Math.round(b.E.left()), 10 * 60);
    assert.ok(b.timerCount() > 0, 'the tick interval is armed again');
    b.advance(10 * MIN + 400);
    assert.equal(b.DB.sessions.length, 1);
    const c = boot({ storage: memoryStorage(saved), now: endAt + HOUR, init: false });
    c.T.Engine.init();
    assert.equal(c.DB.sessions.length, 1, 'completed during init, so other modules init with the right state');
    assert.equal(c.events('timer:done').length, 0, 'events wait for boot');
    c.BUS.emit('boot', {});
    assert.equal(c.events('timer:done')[0].away, true);
    assert.equal(c.DB.sessions[0].end, endAt);
    assert.equal(c.DB.tasks[0].done, 1);
  });

  test('a paused session survives a reload paused', () => {
    const a = boot();
    a.E.start(); a.advance(3 * MIN); a.E.pause();
    const b = boot({ storage: a.storage, now: a.now + DAY });
    assert.equal(b.TIMER.state, 'paused'); assert.equal(Math.round(b.TIMER.left), 22 * 60);
  });
});

describe('abandons, milestones', () => {
  test('reset of a focus with ≥ 60 s on it is abandoned; less is not; a break never is', () => {
    const app = boot();
    app.E.start(); app.advance(30e3); app.E.reset();
    assert.equal(app.events('timer:reset').pop().abandoned, false); assert.equal(app.DB.counters.abandoned, 0);
    app.E.start(); app.advance(61e3); app.E.reset();
    assert.equal(app.events('timer:reset').pop().abandoned, true); assert.equal(app.DB.counters.abandoned, 1);
    assert.equal(app.DB.counters.abandonedAt, app.now);
    app.E.setMode('short'); app.E.start(); app.advance(2 * MIN); app.E.reset();
    assert.equal(app.events('timer:reset').pop().abandoned, false); assert.equal(app.DB.counters.abandoned, 1);
  });

  test('reset keeps the planned (wound) duration; reset when idle un-winds to the default', () => {
    const app = boot();
    app.E.wind(40 * 60); app.E.start(); app.advance(MIN); app.E.reset();
    assert.equal(app.TIMER.left, 2400);
    app.E.reset(); assert.equal(app.TIMER.left, 1500);
    assert.equal(app.E.reset(), false);
  });

  test('half, five and one fire once each, in order, for a focus ≥ 10 min; never for breaks or short focus', () => {
    const app = boot();
    runOut(app);
    eq(app.events('timer:milestone').map((m) => m.kind), ['half', 'five', 'one']);
    app.clearLog(); runOut(app);
    assert.equal(app.events('timer:milestone').length, 0, 'break');
    app.E.wind(9 * 60); runOut(app);
    assert.equal(app.events('timer:milestone').length, 0, '9-minute focus');
  });

  test('milestones already passed don’t fire again after a reload', () => {
    const a = boot();
    a.E.start(); a.advance(21 * MIN);
    const b = boot({ storage: a.storage, now: a.now });
    b.advance(5 * MIN);
    eq(b.events('timer:milestone').map((m) => m.kind), ['one']);
  });
});

describe('patches: every rule, an unlock and a near miss', () => {
  const T0 = at('2026-10-14 15:00');   // a Wednesday afternoon
  const hist = (list, extra) => backup(list, extra);
  function withHistory(list, extra, o = {}) { const app = boot(Object.assign({ now: T0 }, o)); app.E.importJSON(hist(list, extra)); return app; }
  const sessionsAt = (n, day = '2026-10-14', from = 9) => Array.from({ length: n }, (_, i) => `${day} ${String(from + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '50' : '20'}`);

  test('first_tomato', () => {
    const app = boot({ now: T0 });
    assert.equal(unlocked(app, 'first_tomato'), false);
    app.clearLog(); runOut(app);
    assert.equal(unlocked(app, 'first_tomato'), true);
    eq(app.events('patch:unlock').map((e) => e.id), ['first_tomato']);
    const names = app.log.map((e) => e[0]);
    assert.ok(names.indexOf('timer:done') < names.indexOf('patch:unlock'), 'the celebration comes first');
  });

  for (const [id, n] of [['ten_down', 10], ['full_crate', 50], ['hundred_club', 100]]) {
    test(id, () => {
      const list = Array.from({ length: n - 1 }, (_, i) => ({ end: at('2026-08-01 10:00') + i * DAY / 4 }));
      const app = withHistory(list);
      assert.equal(unlocked(app, id), false, 'near miss: ' + (n - 1));
      runOut(app);
      assert.equal(unlocked(app, id), true);
    });
  }

  test('hour_power and deep_worker (total focus seconds)', () => {
    const app = withHistory([{ end: at('2026-10-01 10:00'), min: 0, actual: 3540 }]);
    assert.equal(unlocked(app, 'hour_power'), false);
    app.E.wind(60); runOut(app);
    assert.equal(unlocked(app, 'hour_power'), true);
    const b = withHistory([{ end: at('2026-10-01 10:00'), actual: 17940 }]);
    assert.equal(unlocked(b, 'deep_worker'), false);
    b.E.wind(60); runOut(b);
    assert.equal(unlocked(b, 'deep_worker'), true);
  });

  test('hat_trick, weekly_warrior, monthly_master (a streak ending today)', () => {
    const app = withHistory(['2026-10-12 10:00', '2026-10-13 10:00']);
    assert.equal(unlocked(app, 'hat_trick'), false);
    runOut(app); assert.equal(unlocked(app, 'hat_trick'), true);
    const gap = withHistory(['2026-10-11 10:00', '2026-10-13 10:00']);
    runOut(gap); assert.equal(unlocked(gap, 'hat_trick'), false, 'a gap day breaks it');
    const six = withHistory(Array.from({ length: 6 }, (_, i) => ({ end: at('2026-10-08 10:00') + i * DAY })));
    runOut(six); assert.equal(unlocked(six, 'weekly_warrior'), true);
    const five = withHistory(Array.from({ length: 5 }, (_, i) => ({ end: at('2026-10-09 10:00') + i * DAY })));
    runOut(five); assert.equal(unlocked(five, 'weekly_warrior'), false);
    const m = withHistory(Array.from({ length: 29 }, (_, i) => ({ end: at('2026-09-15 10:00') + i * DAY })));
    runOut(m); assert.equal(unlocked(m, 'monthly_master'), true);
    const m2 = withHistory(Array.from({ length: 28 }, (_, i) => ({ end: at('2026-09-16 10:00') + i * DAY })));
    runOut(m2); assert.equal(unlocked(m2, 'monthly_master'), false);
  });

  test('night_owl (ends ≥ 22:00 or < 04:00) and early_bird (04:00–06:59)', () => {
    const owl = (when) => withHistory([when]);
    assert.equal(unlocked(owl('2026-10-13 22:00'), 'night_owl'), true);
    assert.equal(unlocked(owl('2026-10-13 21:59'), 'night_owl'), false);
    assert.equal(unlocked(owl('2026-10-13 03:59'), 'night_owl'), true);
    assert.equal(unlocked(owl('2026-10-13 04:00'), 'night_owl'), false);
    assert.equal(unlocked(owl('2026-10-13 04:00'), 'early_bird'), true);
    assert.equal(unlocked(owl('2026-10-13 06:59'), 'early_bird'), true);
    assert.equal(unlocked(owl('2026-10-13 07:00'), 'early_bird'), false);
    const live = boot({ now: at('2026-10-14 21:40') });
    runOut(live);
    assert.equal(unlocked(live, 'night_owl'), true, 'a live session ending 22:05');
  });

  test('full_stack: a whole cycle on one day with no abandon in between', () => {
    const app = boot({ now: at('2026-10-14 09:00') });
    for (let i = 0; i < 4; i++) { runOut(app); if (i < 3) runOut(app); }
    assert.equal(unlocked(app, 'full_stack'), true);
    const ab = boot({ now: at('2026-10-14 09:00') });
    runOut(ab); runOut(ab);
    ab.E.start(); ab.advance(2 * MIN); ab.E.reset();
    for (let i = 0; i < 3; i++) { runOut(ab); if (i < 2) runOut(ab); }
    assert.equal(ab.TIMER.mode, 'long', 'the cycle did complete');
    assert.equal(unlocked(ab, 'full_stack'), false, 'near miss: an abandoned focus mid-cycle');
    const night = boot({ now: at('2026-10-14 22:30') });
    for (let i = 0; i < 4; i++) { runOut(night); if (i < 3) runOut(night); }
    assert.equal(unlocked(night, 'full_stack'), false, 'near miss: the cycle crossed midnight');
  });

  test('marathon: 8 completed focus sessions on one local day', () => {
    const app = withHistory(sessionsAt(7));
    assert.equal(unlocked(app, 'marathon'), false);
    runOut(app); assert.equal(unlocked(app, 'marathon'), true);
    const split = withHistory(sessionsAt(4, '2026-10-13').concat(sessionsAt(3)));
    runOut(split); assert.equal(unlocked(split, 'marathon'), false);
  });

  test('weekend_shift: a Saturday and the Sunday right after it', () => {
    assert.equal(unlocked(withHistory(['2026-10-10 11:00', '2026-10-11 11:00']), 'weekend_shift'), true);
    assert.equal(unlocked(withHistory(['2026-10-04 11:00', '2026-10-10 11:00']), 'weekend_shift'), false, 'Sunday then the next Saturday');
    assert.equal(unlocked(withHistory(['2026-10-10 11:00', '2026-10-12 11:00']), 'weekend_shift'), false, 'Saturday and Monday');
  });

  test('clean_build: 4 consecutive focus sessions, no rogues, no abandon between', () => {
    const app = boot({ now: T0 });
    for (let i = 0; i < 4; i++) { runOut(app); app.E.skip(); }
    assert.equal(unlocked(app, 'clean_build'), true);
    const rog = boot({ now: T0 });
    for (let i = 0; i < 4; i++) { rog.E.start(); if (i === 2) rog.E.captureRogue('zatsu'); runOut(rog); rog.E.skip(); }
    assert.equal(unlocked(rog, 'clean_build'), false, 'near miss: one rogue');
    const ab = boot({ now: T0 });
    for (let i = 0; i < 4; i++) { if (i === 2) { ab.E.start(); ab.advance(90e3); ab.E.reset(); } runOut(ab); ab.E.skip(); }
    assert.equal(unlocked(ab, 'clean_build'), false, 'near miss: an abandon between');
    for (let i = 0; i < 2; i++) { runOut(ab); ab.E.skip(); }
    assert.equal(unlocked(ab, 'clean_build'), true, 'four clean ones after the abandon');
  });

  test('quarantine (10 rogues) and rogues_gallery (all six kinds)', () => {
    const app = boot({ now: T0 });
    for (let i = 0; i < 9; i++) app.E.captureRogue('zatsu');
    assert.equal(unlocked(app, 'quarantine'), false);
    app.E.captureRogue('bazu'); assert.equal(unlocked(app, 'quarantine'), true);
    for (const k of ['fukusei', 'bagu', 'kusarigumo']) app.E.captureRogue(k);
    assert.equal(unlocked(app, 'rogues_gallery'), false, 'five kinds');
    app.E.captureRogue('kemuri'); assert.equal(unlocked(app, 'rogues_gallery'), true);
    assert.equal(app.E.captureRogue('nobody'), null);
  });

  test('shipped_it: a task finished with 1 ≤ done ≤ est', () => {
    const app = boot({ now: T0 });
    const over = app.E.addTask('Over', 1); app.E.updateTask(over.id, { done: 2 });
    app.E.toggleTaskDone(over.id); assert.equal(unlocked(app, 'shipped_it'), false, 'over estimate');
    const zero = app.E.addTask('Zero', 2); app.E.toggleTaskDone(zero.id); assert.equal(unlocked(app, 'shipped_it'), false, 'no tomatoes on it');
    const ok = app.E.addTask('On time', 2);
    app.E.setActiveTask(ok.id); runOut(app); app.E.skip(); runOut(app);
    assert.equal(app.DB.tasks.find((t) => t.id === ok.id).done, 2);
    app.clearLog(); app.E.toggleTaskDone(ok.id);
    assert.equal(unlocked(app, 'shipped_it'), true);
    eq(app.log.filter((e) => e[0] === 'task:change' || e[0] === 'patch:unlock').map((e) => e[0]), ['task:change', 'patch:unlock']);
  });

  test('hotfix: a focus completes ≥ 3 local days after the previous one', () => {
    const app = withHistory(['2026-10-11 20:00']);
    runOut(app); assert.equal(unlocked(app, 'hotfix'), true);
    const near = withHistory(['2026-10-12 08:00']);
    runOut(near); assert.equal(unlocked(near, 'hotfix'), false, 'two days');
  });

  test('lofi_forever: 10 focus sessions with the lo-fi radio on and sound on', () => {
    const app = withHistory(Array.from({ length: 9 }, (_, i) => ({ end: at('2026-10-01 10:00') + i * HOUR, music: 'lofi' })));
    assert.equal(unlocked(app, 'lofi_forever'), false);
    app.E.setSetting('sound', false); runOut(app); app.E.skip();
    assert.equal(app.DB.sessions.slice(-1)[0].music, 'off', 'sound off records the music as off');
    assert.equal(unlocked(app, 'lofi_forever'), false);
    app.E.setSetting('sound', true); runOut(app);
    assert.equal(unlocked(app, 'lofi_forever'), true);
  });

  test('exterminator (a Bug Hunt score ≥ 25) and breathe_easy (5 breathing breaks)', () => {
    const app = boot({ now: T0 });
    app.E.recordGame('bughunt', 24); assert.equal(unlocked(app, 'exterminator'), false);
    app.E.recordGame('bughunt', 25); assert.equal(unlocked(app, 'exterminator'), true);
    assert.equal(app.DB.counters.bugBest, 25); assert.equal(app.DB.counters.bugTotal, 49);
    for (let i = 0; i < 4; i++) app.E.recordBreak('breathe');
    assert.equal(unlocked(app, 'breathe_easy'), false);
    app.E.recordBreak('stretch'); app.E.recordBreak('window');
    assert.equal(unlocked(app, 'breathe_easy'), false);
    app.E.recordBreak('breathe'); assert.equal(unlocked(app, 'breathe_easy'), true);
    eq([app.DB.counters.stretch, app.DB.counters.window], [1, 1]);
  });

  test('every patch has a rule (no id in TEXT.patches is unreachable)', () => {
    const ids = new Set(['first_tomato', 'ten_down', 'full_crate', 'hundred_club', 'hour_power', 'deep_worker', 'hat_trick', 'weekly_warrior', 'monthly_master', 'night_owl', 'early_bird',
      'full_stack', 'marathon', 'weekend_shift', 'clean_build', 'quarantine', 'rogues_gallery', 'shipped_it', 'hotfix', 'lofi_forever', 'exterminator', 'breathe_easy']);
    const app = boot();
    eq(app.T.TEXT.patches.map((p) => p.id).sort(), [...ids].sort());
  });

  test('hoodie: only unlocked patches, at most four', () => {
    const app = boot({ now: T0 });
    assert.equal(app.E.hoodieToggle('first_tomato'), false);
    app.DB.patches = { first_tomato: 1, ten_down: 1, hour_power: 1, hat_trick: 1, night_owl: 1 };
    for (const id of ['first_tomato', 'ten_down', 'hour_power', 'hat_trick']) assert.equal(app.E.hoodieToggle(id), true);
    assert.equal(app.E.hoodieToggle('night_owl'), false);
    assert.equal(app.E.hoodieToggle('ten_down'), true);
    eq(plain(app.events('hoodie').pop().ids), ['first_tomato', 'hour_power', 'hat_trick']);
  });
});

describe('streaks across boundaries', () => {
  test('across a month boundary', () => {
    const app = boot({ now: at('2026-10-01 18:00') });
    app.E.importJSON(backup(['2026-09-29 10:00', '2026-09-30 23:30', '2026-10-01 09:00']));
    eq(plain(app.E.stats().streak), { current: 3, longest: 3, todayDone: true });
    assert.equal(unlocked(app, 'hat_trick'), true);
  });

  test('across the DST change (fall back: a 25-hour day) and spring forward (a 23-hour day)', () => {
    const fall = boot({ now: at('2026-11-02 12:00') });
    fall.E.importJSON(backup(['2026-10-31 23:50', '2026-11-01 00:30', '2026-11-01 23:59', '2026-11-02 08:00']));
    const s = fall.E.stats();
    eq(plain(s.streak), { current: 3, longest: 3, todayDone: true });
    eq(s.week.days.map((d) => d.tomatoes), [1, 0, 0, 0, 0, 0, 0]);
    assert.equal(s.heat.find((d) => d.key === '2026-11-01').tomatoes, 2);
    const spring = boot({ now: at('2026-03-09 12:00') });
    spring.E.importJSON(backup(['2026-03-07 23:30', '2026-03-08 03:30', '2026-03-09 00:10']));
    assert.equal(spring.E.stats().streak.current, 3);
    assert.equal(unlocked(spring, 'hat_trick'), true);
  });

  test('current streak stays alive through today until you focus; longest remembers', () => {
    const app = boot({ now: at('2026-10-14 08:00') });
    app.E.importJSON(backup(['2026-10-01 10:00', '2026-10-02 10:00', '2026-10-03 10:00', '2026-10-04 10:00', '2026-10-12 10:00', '2026-10-13 10:00']));
    eq(plain(app.E.stats().streak), { current: 2, longest: 4, todayDone: false });
    runOut(app);
    eq(plain(app.E.stats().streak), { current: 3, longest: 4, todayDone: true });
    app.setNow(at('2026-10-16 09:00'));
    assert.equal(app.E.stats().streak.current, 0, 'a missed day ends it');
  });
});

describe('stats()', () => {
  test('the exact shape', () => {
    const app = boot({ now: at('2026-10-14 15:00') });
    const t = app.E.addTask('Ship it', 1);
    app.E.importJSON(backup([{ end: at('2026-10-12 10:00'), taskId: t.id, rating: 5, note: 'nice', rogues: 1 }, { end: at('2026-10-14 09:30'), rating: 2 }, { end: at('2026-08-01 10:00') }], {
      tasks: [{ id: 'tk', title: 'Ship it', est: 1, done: 1, createdAt: at('2026-10-10 09:00'), doneAt: at('2026-10-13 12:00') }],
      rogues: [{ id: 'r1', kind: 'zatsu', note: '', at: at('2026-10-14 09:10'), sessionId: null, done: false }, { id: 'r2', kind: 'bazu', note: 'x', at: at('2026-09-01 09:10'), sessionId: null, done: true }],
    }));
    const s = app.E.stats();
    eq(Object.keys(s), ['today', 'week', 'streak', 'heat', 'byHour', 'byRogue', 'totals', 'recent']);
    eq(plain(s.today), { key: '2026-10-14', tomatoes: 1, focusSec: 1500, rogues: 1, goal: 8, shipped: 0 });
    eq(Object.keys(s.week), ['start', 'version', 'days', 'tomatoes', 'focusSec', 'rogues', 'shipped']);
    assert.equal(s.week.start, at('2026-10-12 00:00')); assert.equal(s.week.version, 'v2026.42');
    eq(s.week.days.map((d) => d.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    eq(s.week.days.map((d) => d.key), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    eq(plain(s.week.days[0]), { key: '2026-10-12', label: 'Mon', tomatoes: 1, focusSec: 1500 });
    eq([s.week.tomatoes, s.week.focusSec, s.week.rogues, s.week.shipped], [2, 3000, 1, 1]);
    eq(plain(s.streak), { current: 1, longest: 1, todayDone: true });
    assert.equal(s.heat.length, 84);
    eq(Object.keys(s.heat[0]), ['key', 'tomatoes', 'future']);
    assert.equal(s.heat[0].key, '2026-07-27', 'a Monday, 11 weeks before this one');
    assert.equal(new Date(at(s.heat[0].key + ' 12:00')).getDay(), 1);
    assert.equal(s.heat[83].key, '2026-10-18', 'ends with this week’s Sunday');
    assert.equal(s.heat.filter((d) => d.future).length, 4);
    assert.equal(s.heat.find((d) => d.key === '2026-08-01').tomatoes, 1);
    assert.equal(s.byHour.length, 24);
    assert.equal(s.byHour[9], 2, 'by start hour (09:35 and 09:05), last 30 days only');
    assert.equal(s.byHour.reduce((a, b) => a + b, 0), 2);
    eq(plain(s.byRogue), { week: { bazu: 0, fukusei: 0, bagu: 0, kusarigumo: 0, zatsu: 1, kemuri: 0 }, all: { bazu: 1, fukusei: 0, bagu: 0, kusarigumo: 0, zatsu: 1, kemuri: 0 } });
    eq(plain(s.totals), { tomatoes: 3, focusSec: 4500, sessions: 3, rogues: 2, shipped: 1, avgRating: 3.5, since: '2026-08-01' });
    assert.equal(s.recent.length, 3);
    eq(s.recent.map((r) => r.end), [at('2026-10-14 09:30'), at('2026-10-12 10:00'), at('2026-08-01 10:00')]);
    assert.equal(s.recent[1].taskTitle, null, 'the backup replaced the tasks');
    assert.equal(s.recent[0].taskTitle, null);
  });

  test('recent: newest first, at most 30, with taskTitle (also for archived tasks)', () => {
    const app = boot({ now: at('2026-10-14 15:00') });
    app.E.importJSON(backup(Array.from({ length: 40 }, (_, i) => ({ end: at('2026-10-01 08:00') + i * HOUR * 6, taskId: 'a1' })), {
      archive: [{ id: 'a1', title: 'Old shipped thing', est: 3, done: 3, createdAt: 1, doneAt: at('2026-10-05 10:00') }] }));
    const r = app.E.stats().recent;
    assert.equal(r.length, 30); assert.ok(r[0].end > r[1].end); assert.equal(r[0].taskTitle, 'Old shipped thing');
  });

  test('version is the ISO year.week, at the year boundary too', () => {
    const v = (d) => boot({ now: at(d) }).E.stats().week.version;
    assert.equal(v('2026-10-12 09:00'), 'v2026.42');
    assert.equal(v('2027-01-01 09:00'), 'v2026.53');
    assert.equal(v('2027-01-04 09:00'), 'v2027.01');
    assert.equal(v('2026-01-01 09:00'), 'v2026.01');
    assert.equal(v('2024-12-30 09:00'), 'v2025.01');
  });

  test('cached until the data or the day changes; emits stats after changes', () => {
    const app = boot();
    const a = app.E.stats();
    assert.equal(app.E.stats(), a);
    app.clearLog(); runOut(app);
    assert.ok(app.events('stats').length >= 1);
    const b = app.E.stats();
    assert.notEqual(b, a); assert.equal(b.today.tomatoes, 1);
    app.setNow(app.now + DAY);
    assert.equal(app.E.stats().today.tomatoes, 0, 'a new day');
    app.E.setSetting('dailyGoal', 5); assert.equal(app.E.stats().today.goal, 5);
  });

  test('perf: 5 000 sessions in under 5 ms (cold), ~0 cached', () => {
    const app = boot({ now: at('2026-10-14 15:00') });
    const list = Array.from({ length: 5000 }, (_, i) => ({ end: at('2025-06-01 08:00') + i * 2.3 * HOUR, rating: i % 3 ? 4 : null, rogues: i % 4, taskId: i % 2 ? 't' + (i % 9) : null }));
    const rogues = Array.from({ length: 3000 }, (_, i) => ({ id: 'r' + i, kind: ['zatsu', 'bazu', 'bagu', 'kemuri', 'fukusei', 'kusarigumo'][i % 6], note: '', at: at('2025-06-01 08:00') + i * 3.7 * HOUR, sessionId: null, done: false }));
    app.E.importJSON(backup(list, { rogues }));
    app.E.stats(); app.setNow(app.now + DAY);   // warm the JIT, then invalidate by day
    let best = Infinity;
    for (let k = 0; k < 12; k++) {   // best of 12: other processes share this machine
      app.E.addTask('x' + k);   // a data change: invalidates the cache
      const t0 = process.hrtime.bigint(); const s = app.E.stats(); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      best = Math.min(best, ms); assert.equal(s.totals.tomatoes, 5000);
    }
    const t1 = process.hrtime.bigint(); app.E.stats(); const cached = Number(process.hrtime.bigint() - t1) / 1e6;
    console.log(`    stats() over 5 000 sessions + 3 000 rogues: ${best.toFixed(2)} ms cold, ${cached.toFixed(3)} ms cached`);
    assert.ok(best < 5, best + ' ms');
    assert.ok(cached < 0.2);
  });
});

describe('v1 migration', () => {
  const v1 = (key) => JSON.parse(FIXTURE[key]).state;

  test('every session, exactly mapped', () => {
    const app = boot({ storage: v1Storage(), now: at('2026-10-12 09:00') });
    const old = v1('pomo-sessions-v1').sessions;
    assert.equal(app.DB.sessions.length, old.length);
    assert.equal(old.length, 39);
    const KIND = { focus: 'focus', shortBreak: 'short', longBreak: 'long' };
    for (const o of old) {
      const s = app.DB.sessions.find((x) => x.id === o.id);
      assert.ok(s, 'session ' + o.id);
      assert.equal(s.kind, KIND[o.type]); assert.equal(s.end, Date.parse(o.completedAt)); assert.equal(s.planned, o.duration); assert.equal(s.actual, o.actualDuration);
      assert.equal(s.rating, o.focusRating); assert.equal(s.note, o.note || ''); assert.equal(s.taskId, o.taskId); assert.equal(s.ok, true); assert.equal(s.v1, true);
      if (o.startedAt !== o.completedAt) assert.equal(s.start, Date.parse(o.startedAt));
      else assert.equal(s.start, s.end - o.actualDuration * 1000, 'the lost start time is rebuilt');
    }
    assert.equal(focusDone(app).length, 28);
    assert.ok(app.DB.sessions.every((s, i, a) => !i || a[i - 1].end <= s.end), 'chronological');
  });

  test('tasks, settings and achievement dates', () => {
    const app = boot({ storage: v1Storage(), now: at('2026-10-12 09:00') });
    const old = v1('pomo-tasks-v1');
    assert.equal(app.DB.tasks.length, 5);
    eq(app.DB.tasks.map((t) => t.title), old.tasks.slice().reverse().map((t) => t.title), 'oldest first');
    for (const o of old.tasks) {
      const t = app.DB.tasks.find((x) => x.id === o.id);
      assert.equal(t.done, o.completedSessions); assert.equal(t.est, Math.max(1, o.completedSessions)); assert.equal(t.createdAt, Date.parse(o.createdAt)); assert.equal(t.doneAt, null);
    }
    assert.equal(app.DB.activeTask, old.selectedTaskId);
    const st = app.DB.settings;
    eq([st.focusMin, st.shortMin, st.longMin, st.longEvery, st.theme, st.sound, st.notify, st.music, st.musicVol, st.reflect], [30, 7, 20, 3, 'day', true, true, 'lofi', 0.35, true]);
    assert.equal(app.TIMER.left, 30 * 60, 'the timer shows the migrated focus length');
    const ach = v1('pomo-achievements-v1').achievements;
    const map = { 'first-session': 'first_tomato', 'ten-sessions': 'ten_down', 'one-hour': 'hour_power', 'five-hours': 'deep_worker' };
    for (const a of ach.filter((x) => x.unlockedAt)) assert.equal(app.DB.patches[map[a.id]], Date.parse(a.unlockedAt), a.id);
    assert.equal(ach.filter((x) => x.unlockedAt).length, 4);
  });

  test('meta, the migrated event after boot, catch-up unlocks, v1 keys untouched, idempotent', () => {
    const storage = v1Storage();
    const before = new Map(storage.map);
    const app = boot({ storage, now: at('2026-10-12 09:00'), init: false });
    app.T.Engine.init();
    assert.equal(app.events('data').length, 0);
    app.BUS.emit('boot', {});
    eq(plain(app.events('data')), [{ op: 'migrated', n: 28 }]);
    assert.equal(app.DB.meta.migratedV1, true); assert.equal(app.DB.meta.v1Sessions, 28);
    eq(app.events('patch:unlock').map((e) => e.id).sort(), ['hotfix', 'weekend_shift'], 'history earns what v1 never had');
    for (const [k, v] of before) assert.equal(storage.getItem(k), v, k + ' unchanged');
    assert.equal([...storage.map.keys()].filter((k) => k.startsWith('pomo-')).length, 5);
    const again = boot({ storage, now: at('2026-10-13 09:00') });
    assert.equal(again.DB.sessions.length, 39); assert.equal(again.events('data').length, 0);
    const db = JSON.parse(storage.getItem('pomo2:db')); db.meta.migratedV1 = false; storage.setItem('pomo2:db', JSON.stringify(db));
    const forced = boot({ storage, now: at('2026-10-13 09:00') });
    assert.equal(forced.DB.sessions.length, 39, 'even forced to re-run, nothing doubles'); assert.equal(forced.DB.tasks.length, 5);
    for (const [k, v] of before) assert.equal(storage.getItem(k), v);
  });

  test('broken or missing v1 keys never stop the boot', () => {
    const app = boot({ storage: memoryStorage({ 'pomo-sessions-v1': '{nope', 'pomo-settings-v1': JSON.stringify({ state: { workDuration: 999, theme: 'premium' }, version: 0 }) }) });
    assert.equal(app.DB.sessions.length, 0); assert.equal(app.DB.settings.focusMin, 120); assert.equal(app.DB.settings.theme, 'night');
    const none = boot();
    assert.equal(none.DB.meta.migratedV1, false);
  });
});

describe('data', () => {
  function busyApp() {
    const app = boot({ now: at('2026-10-14 10:00') });
    const t = app.E.addTask('Write tests', 3);
    app.E.addTask('Ship', 1);
    app.E.setSetting('focusMin', 30); app.E.setSetting('music', 'rain');
    app.E.start(); app.E.captureRogue('zatsu', 'feed'); runOut(app);
    app.E.rateSession(app.DB.sessions[0].id, 5, 'locked');
    app.E.skip(); runOut(app); app.E.toggleTaskDone(t.id);
    app.E.recordBreak('breathe');
    return app;
  }

  test('export → import round trip', () => {
    const a = busyApp();
    const json = a.E.exportJSON();
    const b = boot({ now: at('2026-10-15 10:00') });
    b.clearLog();
    const r = b.E.importJSON(json);
    assert.equal(r.ok, true);
    for (const k of ['settings', 'tasks', 'activeTask', 'sessions', 'rogues', 'patches', 'hoodie', 'counters', 'archive']) eq(plain(b.DB[k]), plain(a.DB[k]), k);
    eq(plain(b.events('data')), [{ op: 'import', n: 2 }]);
    assert.equal(b.TIMER.left, 30 * 60, 'idle timer picks up the imported focus length');
    assert.equal(b.E.importJSON('nope').ok, false);
    assert.equal(b.E.importJSON('{"v":1,"sessions":[]}').ok, false);
    assert.equal(b.E.importJSON('{"v":2}').ok, false);
    assert.equal(b.DB.sessions.length, 2, 'a failed import changes nothing');
    const csv = a.E.exportCSV().trim().split('\n');
    assert.equal(csv.length, 1 + a.DB.sessions.length);
    assert.match(csv[0], /^date,start,end,kind/);
    assert.match(csv[1], /,Write tests,5,1,rain,locked$/);
  });

  test('import cleans what it reads', () => {
    const app = boot();
    const r = app.E.importJSON(JSON.stringify({ v: 2, settings: { focusMin: 999, music: 'polka', volume: '0.5', notify: 'true' }, sessions: [{ kind: 'focus', start: 1, end: 2 }, { kind: 'nap', start: 1, end: 2 }, null],
      tasks: [{ id: 'a', title: '  hi  ', est: 50 }, { id: 'a', title: 'dupe' }, { title: 'no id' }], rogues: [{ kind: 'zatsu', at: 5 }, { kind: 'nope', at: 5 }], patches: { first_tomato: 5, made_up: 9 }, hoodie: ['first_tomato', 'ten_down'] }));
    assert.equal(r.ok, true);
    const d = app.DB;
    eq([d.settings.focusMin, d.settings.music, d.settings.volume, d.settings.notify], [120, 'lofi', 0.5, true]);
    assert.equal(d.sessions.length, 1); assert.equal(d.tasks.length, 1); assert.equal(d.tasks[0].title, 'hi'); assert.equal(d.tasks[0].est, 12);
    assert.equal(d.rogues.length, 1); eq(plain(d.patches).made_up, undefined); eq(plain(d.hoodie), ['first_tomato']);
  });

  test('clearAll: history goes, settings stay, v1 never comes back', () => {
    const storage = v1Storage();
    const app = boot({ storage, now: at('2026-10-14 10:00') });
    app.E.setSetting('dailyGoal', 4);
    app.clearLog();
    app.E.clearAll();
    for (const k of ['sessions', 'tasks', 'rogues', 'hoodie', 'archive']) eq(plain(app.DB[k]), [], k);
    eq(plain(app.DB.patches), {});
    assert.equal(app.DB.settings.dailyGoal, 4); assert.equal(app.DB.meta.migratedV1, true);
    eq(plain(app.events('data')), [{ op: 'clear', n: 0 }]);
    assert.equal(app.TIMER.mode, 'focus'); assert.equal(app.TIMER.state, 'idle');
    const again = boot({ storage, now: at('2026-10-14 11:00') });
    assert.equal(again.DB.sessions.length, 0);
    assert.ok(storage.getItem('pomo-sessions-v1'), 'v1 keys are still there, untouched');
  });

  test('seed("demo"): ~6 weeks of plausible history', () => {
    const app = boot({ now: at('2026-10-14 16:00') });
    app.clearLog();
    assert.equal(app.E.seed('demo'), true);
    const s = app.E.stats();
    assert.equal(app.DB.meta.demo, true);
    assert.equal(app.events('data')[0].op, 'seed');
    assert.ok(s.totals.tomatoes > 80, 'tomatoes ' + s.totals.tomatoes);
    assert.ok(s.streak.current >= 8, 'streak ' + s.streak.current);
    assert.ok(s.today.tomatoes >= 1 && s.today.tomatoes <= 3);
    assert.ok(app.DB.sessions.every((x) => x.end <= app.now), 'nothing in the future');
    assert.ok(app.DB.rogues.length > 20);
    assert.ok(Object.keys(app.DB.patches).length >= 8);
    assert.ok(app.DB.tasks.some((t) => t.doneAt) && app.DB.tasks.some((t) => !t.doneAt));
    assert.ok(app.E.activeTask());
    assert.ok(s.week.shipped >= 1 || s.totals.shipped >= 3);
  });

  test('a corrupt saved document is kept aside, never thrown away', () => {
    const storage = memoryStorage({ 'pomo2:db': '{"v":3,"future":true}' });
    const app = boot({ storage });
    assert.equal(app.DB.v, 2);
    assert.equal(storage.getItem('pomo2:db.bak'), '{"v":3,"future":true}');
    const half = memoryStorage({ 'pomo2:db': '{"v":2,"sessions":[{"id":"a","ki' });
    boot({ storage: half });
    assert.equal(half.getItem('pomo2:db.bak'), '{"v":2,"sessions":[{"id":"a","ki', 'a half-written save is kept verbatim');
  });
});

describe('settings, tasks, rogues, reflection', () => {
  test('setSetting validates, clamps, syncs PREFS and emits', () => {
    const app = boot();
    const { E } = app;
    assert.equal(E.setSetting('focusMin', 500), 120); assert.equal(E.setSetting('focusMin', 0), 1); assert.equal(E.setSetting('focusMin', '45'), 45);
    assert.equal(E.setSetting('shortMin', 99), 30); assert.equal(E.setSetting('longMin', 99), 60); assert.equal(E.setSetting('longEvery', 0), 1); assert.equal(E.setSetting('dailyGoal', 30), 24);
    assert.equal(E.setSetting('volume', 2), 1); assert.equal(E.setSetting('musicVol', -1), 0);
    assert.equal(E.setSetting('music', 'jazz'), undefined); assert.equal(app.DB.settings.music, 'lofi');
    assert.equal(E.setSetting('nope', 1), undefined);
    assert.equal(E.setSetting('focusMin', null), undefined);
    E.setSetting('talk', false); E.setSetting('motion', 'reduced'); E.setSetting('haptics', 0); E.setSetting('sound', false);
    eq(plain(app.T.PREFS), { haptics: false, motion: 'reduced', talk: false, sound: false });
    eq(plain(app.events('settings').pop()), { key: 'sound', value: false });
  });

  test('changing a duration while idle in that mode resets the shown time; while running it waits', () => {
    const app = boot();
    app.E.setSetting('focusMin', 40); assert.equal(app.TIMER.left, 2400);
    app.E.setSetting('shortMin', 10); assert.equal(app.TIMER.left, 2400);
    app.E.start(); app.E.setSetting('focusMin', 20);
    assert.equal(Math.round(app.E.left()), 2400);
    app.E.reset(); app.E.reset(); assert.equal(app.TIMER.left, 1200);
  });

  test('tasks: add (first becomes active), update, move, ship (active moves on), undo, remove, clear to the archive', () => {
    const app = boot();
    const { E } = app;
    const a = E.addTask('  A  task ', 3), b = E.addTask('B', 99), c = E.addTask('C');
    assert.equal(E.addTask('   '), null);
    assert.equal(a.title, 'A task'); assert.equal(b.est, 12); assert.equal(c.est, 1);
    assert.equal(E.activeTask().id, a.id);
    E.updateTask(b.id, { title: 'Bee', est: 0 }); assert.equal(b.title, 'Bee'); assert.equal(b.est, 1);
    E.moveTask(c.id, 0); eq(app.DB.tasks.map((t) => t.title), ['C', 'A task', 'Bee']); eq(app.DB.tasks.map((t) => t.order), [0, 1, 2]);
    E.toggleTaskDone(a.id); assert.ok(a.doneAt); assert.equal(app.DB.activeTask, c.id, 'the next open task');
    assert.equal(E.setActiveTask(a.id), false, 'a shipped task can’t be active');
    E.toggleTaskDone(a.id); assert.equal(a.doneAt, null);
    E.toggleTaskDone(a.id);
    assert.equal(E.removeTask(c.id), true); assert.equal(app.DB.activeTask, b.id);
    assert.equal(E.clearDoneTasks(), 1);
    eq(app.DB.tasks.map((t) => t.title), ['Bee']); assert.equal(app.DB.archive.length, 1);
    assert.equal(E.stats().totals.shipped, 1, 'cleared tasks still count as shipped');
    eq(app.events('task:change').map((e) => e.op), ['add', 'add', 'add', 'update', 'move', 'done', 'undone', 'done', 'remove', 'clear']);
    E.setActiveTask(null); assert.equal(E.activeTask(), null);
  });

  test('rogues count toward the running or paused focus only; resolve, reopen, delete', () => {
    const app = boot();
    const { E } = app;
    const idle = E.captureRogue('bazu', 'later');
    assert.equal(idle.sessionId, null); assert.equal(app.TIMER.rogues, 0);
    E.start();
    const r = E.captureRogue('zatsu', '  feed  ');
    assert.equal(r.sessionId, app.TIMER.sessionId); assert.equal(r.note, 'feed'); assert.equal(app.TIMER.rogues, 1);
    E.pause(); E.captureRogue('bagu'); assert.equal(app.TIMER.rogues, 2);
    E.resume(); runOut(app);
    assert.equal(app.DB.sessions[0].rogues, 2);
    eq(E.openRogues().map((x) => x.kind), ['bazu', 'zatsu']);
    E.resolveRogue(r.id); E.resolveRogue(r.id, false); E.deleteRogue(idle.id);
    eq(app.events('rogue:change').map((e) => e.op), ['resolve', 'reopen', 'delete']);
    assert.equal(app.DB.rogues.length, 2);
    assert.ok(JSON.parse(app.storage.getItem('pomo2:db')).rogues.length >= 2, 'a capture is saved at once');
  });

  test('rateSession clamps the rating and keeps a note', () => {
    const app = boot();
    runOut(app);
    const id = app.DB.sessions[0].id;
    app.E.rateSession(id, 9, '  good one  ');
    assert.equal(app.DB.sessions[0].rating, 5); assert.equal(app.DB.sessions[0].note, 'good one');
    assert.equal(app.events('session:rated')[0].session.id, id);
    app.E.rateSession(id, null); assert.equal(app.DB.sessions[0].rating, null); assert.equal(app.DB.sessions[0].note, 'good one');
    assert.equal(app.E.rateSession('nope', 3), null);
  });
});

describe('platform', () => {
  test('a notification when a session ends in a hidden tab (not when you are looking)', () => {
    const shown = [];
    class N { constructor(title, opts) { shown.push([title, opts.body]); } }
    N.permission = 'granted';
    const app = boot({ Notification: N });
    app.E.setSetting('notify', true);
    runOut(app);
    assert.equal(shown.length, 0, 'visible and focused');
    app.E.skip(); app.E.start(); app.doc.hidden = true; app.advance(25 * MIN + 400);
    eq(shown, [['Tomato’s done', 'Take a 5-minute break. — Patch']]);
    assert.equal(app.events('timer:done').pop().away, true);
    app.E.setSetting('notify', false); app.E.start(); app.advance(5 * MIN + 400);
    assert.equal(shown.length, 1);
  });

  test('a background tab whose timers run a minute late still notifies; news older than 10 minutes doesn’t', () => {
    const shown = [];
    class N { constructor(title) { shown.push(title); } }
    N.permission = 'granted';
    const app = boot({ Notification: N });
    app.E.setSetting('notify', true);
    app.doc.hidden = true;
    app.E.start(); app.jump(26 * MIN); app.advance(300);   // the throttled interval fires a minute late
    assert.deepEqual(shown, ['Tomato’s done']);
    app.E.start(); app.jump(20 * MIN); app.advance(300);   // a frozen tab wakes 15 minutes after the break ended
    assert.equal(shown.length, 1);
    assert.equal(app.DB.sessions.length, 2);
  });

  test('screen wake lock while running (and in heads-down), released on pause', async () => {
    const wl = { requests: 0, released: 0, request() { wl.requests++; const s = { release() { wl.released++; return Promise.resolve(); }, addEventListener() {} }; return Promise.resolve(s); } };
    const app = boot({ navigator: { wakeLock: wl } });
    const tick = () => new Promise((r) => setImmediate(r));
    app.E.start(); await tick();
    assert.equal(wl.requests, 1);
    app.E.pause(); await tick();
    assert.equal(wl.released, 1);
    app.T.FOCUSMODE.on = true; app.BUS.emit('focusmode', { on: true }); await tick();
    assert.equal(wl.requests, 2);
    app.E.setSetting('wakeLock', false); await tick();
    assert.equal(wl.released, 2);
  });

  test('speed: ?speed=60 makes a 25-minute focus take 25 seconds', () => {
    const app = boot({ query: 'speed=60' });
    app.E.start(); app.advance(25e3 + 300);
    assert.equal(app.DB.sessions.length, 1); assert.equal(app.DB.sessions[0].actual, 1500);
    app.E.setSpeed(1); app.E.start(); app.advance(60e3);
    assert.equal(Math.round(app.E.left()), 240);
  });

  test('NEW_TEXT lines are merged into TEXT.lines and LINE() can read them', () => {
    const app = boot();
    for (const k of ['log_empty', 'log_top_zatsu', 'log_rogues_none']) assert.ok(app.T.LINE(k).length > 10, k);
    for (const k of Object.keys(app.T.TEXT.lines).filter((x) => x.startsWith('log_'))) for (const s of app.T.TEXT.lines[k]) assert.ok(s.length <= 72, k + ': ' + s.length);
  });

  test('the Changelog sheet is defined', () => {
    const app = boot();
    assert.equal(app.T.SHEETS.log.title, 'Changelog'); assert.equal(app.T.SHEETS.log.size, 'tall');
  });

  // the sheet parses its top half at once and the rest a moment later (idle time): let the fake clock run
  const renderLog = (app) => { const body = app.doc.createElement('div'); app.T.SHEETS.log.render(body); const top = body.children[0].innerHTML; app.advance(50); const all = body.children[0].innerHTML; assert.ok(all.length > top.length && all.startsWith(top), 'the rest arrives after the top'); return all; };
  const count = (html, needle) => html.split(needle).length - 1;

  test('the Changelog renders every section from stats(), escapes what people typed', () => {
    const app = boot({ now: at('2026-10-14 16:00') });
    app.E.seed('demo');
    app.E.addTask('<img src=x onerror=alert(1)> "quoted" & co', 2);
    app.E.setActiveTask(app.DB.tasks.slice(-1)[0].id);
    runOut(app);
    const html = renderLog(app), st = app.E.stats();
    assert.match(html, /v2026\.42/);
    for (const c of ['lg-hero', 'lg-today', 'lg-streak', 'lg-week', 'lg-crate', 'lg-hours', 'lg-rogues', 'lg-recent', 'lg-notes', 'lg-foot']) assert.ok(html.includes(c), c);
    assert.equal(count(html, 'data-act="cell"'), st.heat.filter((d) => !d.future).length, 'one tomato per day so far in the crate');
    assert.equal(count(html, 'class="lg-rc'), 6, 'the six rogues');
    assert.ok(!html.includes('<img src=x'), 'no raw markup from a task title');
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &quot;quoted&quot; &amp; co'));
    assert.ok(html.includes('Patch notes'));
    assert.ok(count(html, 'class="lg-c') >= 8, 'recent sessions as commits');
  });

  test('a repaint while the lower half is still queued never doubles a section', () => {
    const app = boot({ idle: true, now: at('2026-10-14 16:00') });
    app.E.seed('demo');
    const body = app.doc.createElement('div');
    app.T.SHEETS.log.render(body);
    app.advance(20);                       // the first chunk is now waiting on an idle callback
    app.BUS.emit('stats', {});             // new data: a full repaint 40 ms later
    app.advance(2000);
    const html = body.children[0].innerHTML;
    for (const c of ['lg-crate', 'lg-hours', 'lg-rogues', 'lg-recent', 'lg-notes', 'lg-foot']) assert.equal(count(html, 'class="lg-card ' + c + '"') + count(html, 'class="' + c + '"'), 1, c);
  });

  test('day one: the Changelog reads well with no data at all', () => {
    const app = boot();
    const html = renderLog(app);
    assert.ok(html.includes(app.T.TEXT.lines.log_empty[0].replace(/’/g, '’')));
    assert.ok(html.includes('No tomatoes yet this week.'));
    assert.ok(html.includes('No commits yet.'));
    assert.ok(html.includes(app.T.TEXT.lines.log_rogues_none[0]));
    assert.equal(count(html, 'data-act="cell"'), app.E.stats().heat.filter((d) => !d.future).length);
    assert.ok(!html.includes('undefined') && !html.includes('NaN'), 'no undefined/NaN anywhere');
  });

  test('after a v1 migration the Changelog shows the history with v1 tags', () => {
    const app = boot({ storage: v1Storage(), now: at('2026-10-12 09:00') });
    const html = renderLog(app);
    assert.ok(html.includes('class="lg-tag">v1<'));
    assert.ok(html.includes('includes 28 sessions from v1'));
    assert.ok(html.includes('Last week: <b>8 tomatoes</b>'));
    assert.ok(!html.includes('undefined') && !html.includes('NaN'));
  });
});

test('v1 default theme "dark" migrates to auto', () => {
  const app = boot({ storage: memoryStorage({ 'pomo-settings-v1': JSON.stringify({ state: { workDuration: 25, theme: 'dark' }, version: 0 }) }) });
  assert.equal(app.DB.settings.theme, 'auto');
});
