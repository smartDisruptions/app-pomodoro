// ───────────────────────────── 60. UI: top bar, dock, sheets, toasts, the embroidered patches ─────────────────────────────
// Owned by the UI agent (CONTRACT.md §8.6; DESIGN.md §3–4, §9–10). Prefix ui-. The chrome around Patch's room: the top
// bar and the dock, one sheet at a time (a springy bottom sheet on phones, a right-hand panel when LAYOUT.wide), a small
// confirm above it, queued toasts, and badgeSVG(): the 22 embroidered patches Patch sews onto her hoodie.
// Sheets build their DOM on open and drop it on close. Nothing here runs per frame: update() is empty and, while the
// timer runs, the only DOM write is the open sheet's timer chip, once a second (the Engine owns the document title).
const UI = (() => {
  // ───────── interface words (plain labels; Patch's own lines come from TEXT.lines via LINE) ─────────
  const W = {
    close: 'Close', cancel: 'Cancel', undo: 'Undo', next: 'Next', skip: 'Skip', back: 'Back', paused: 'Paused',
    mute: 'Mute', unmute: 'Unmute', soundOn: 'Sound on', soundOff: 'Sound off',
    today: (n, g) => `${n} of ${g} tomatoes today`, streak: (n) => `${plural(n, 'day')} in a row`, openLog: 'Open the changelog',
    showTimer: (t) => `${t} left. Show the timer`,
    est: 'Estimate', estN: (n) => plural(n, 'tomato', 'tomatoes'), addAria: 'Add the task',
    noTasks: 'No tasks yet. Add one and it rides along with the timer.',
    queue: 'Up next', move: (t) => `Reorder: ${t}`, moved: (i, n) => `Moved to ${i} of ${n}`,
    work: (t) => `Work on: ${t}`, stop: (t) => `Stop working on: ${t}`,
    ship: (t) => `Mark shipped: ${t}`, unship: (t) => `Not shipped yet: ${t}`, del: (t) => `Delete: ${t}`,
    deleted: 'Task deleted', cleared: (n) => `Cleared ${plural(n, 'shipped task')}`,
    laterLead: 'Notes you quarantined mid-focus. Deal with them now, or turn one into a task.', laterEmpty: 'Nothing in quarantine.',
    resolve: (t) => `Dealt with: ${t}`, resolved: 'Dealt with', toTask: (t) => `Make it a task: ${t}`, toTaskDone: 'Added to tasks',
    have: (n, t) => `${n}/${t} collected`, worn: (n) => `${n}/4 on her hoodie`, hoodie: 'Patch’s hoodie',
    newPatch: 'New patch', newPatches: (n) => `${n} new patches`, sewIt: 'Sew it on', sewn: 'Sewn on', isNew: 'New',
    unlocked: (d) => `Unlocked ${d}`, howTo: 'How to earn it', onHoodie: 'On her hoodie', slot: 'An empty spot on her hoodie',
    patchAria: (n, d) => `${n}, ${d}`, lockedAria: (n) => `${n}, not yet`,
    pick: (n, w) => `${n}: ${w}`,
    reflectNote: 'Add a note (optional)',
    imported: (n) => `Backup imported · ${plural(n, 'session')}`, importFail: 'That file isn’t a backup from this app.',
    replaceQ: 'Replace everything on this device with this backup?', replace: 'Replace',
    wiped: 'All data deleted. Fresh start.', wipe: 'Delete everything', saved: 'Saved to your downloads',
    notifyBlocked: 'Blocked in your browser settings', notifyNone: 'Not supported in this browser',
    preview: 'Preview', keys: 'Keyboard shortcuts', about: 'About', site: 'smartdisruptions.com', version: (v) => `Version ${v}`,
    migrated: (n) => `${plural(n, 'session')} moved in from your old timer.`,
    onboardStep: (i, n) => `Card ${i} of ${n}`, showAll: (n) => `Show all ${n}`,
    rename: 'Task name', editTip: 'Click to work on it · double-click to edit',
  };
  // Settings: key → [label, hint]. Groups follow DESIGN: Timer · Sound · Patch · Display · Data.
  const SET = {
    focusMin: ['Focus', 'Minutes per tomato'], shortMin: ['Short break', 'Minutes'], longMin: ['Long break', 'Minutes'],
    longEvery: ['Long break after', 'Tomatoes in a cycle'], dailyGoal: ['Daily goal', 'Tomatoes a day'],
    autoBreak: ['Start breaks on their own'], autoFocus: ['Start the next tomato on its own'],
    sound: ['Sound', 'Effects and music'], volume: ['Volume'], tick: ['Ticking clock', 'A soft tick while you focus'],
    music: ['Music'], musicVol: ['Music volume'], haptics: ['Haptics', 'Little buzzes, on phones that can'],
    talk: ['Patch talks', 'Off: she still reacts, quietly'], reflect: ['Ask how it went', 'After each focus session'],
    weather: ['Out the window'], theme: ['Theme'], motion: ['Motion'], quality: ['Quality', 'Lite saves battery on older phones'],
    wakeLock: ['Keep the screen awake', 'While the timer runs'], notify: ['Notifications', 'When a tomato finishes in the background'],
  };
  const OPTS = {
    music: [['lofi', 'Lo-fi'], ['rain', 'Rain'], ['city', 'Night city'], ['off', 'Off']],
    weather: [['auto', 'Auto'], ['rain', 'Rain'], ['clear', 'Clear']],
    theme: [['auto', 'Auto'], ['night', 'Night'], ['day', 'Day']],
    motion: [['auto', 'Auto'], ['reduced', 'Less'], ['full', 'Full']],
    quality: [['auto', 'Auto'], ['high', 'High'], ['lite', 'Lite']],
  };
  const RANGE = { focusMin: [1, 120], shortMin: [1, 30], longMin: [1, 60], longEvery: [1, 12], dailyGoal: [1, 24] };
  // a terminal-ish eyebrow over each sheet title: Patch "types" the chrome
  const EYEBROW = { tasks: '~/tasks', log: '~/changelog', patches: '~/hoodie', settings: '~/.config/pomodoro', capture: '$ quarantine --now', reflect: '$ git commit', help: '$ man pomodoro' };
  const KEYMAP = [
    [['Space'], 'Start, pause, resume'], [['←', '→'], 'Wind the tomato a minute (Shift: five)'], [['R'], 'Reset (twice while focusing)'],
    [['S'], 'Skip (twice while focusing)'], [['D'], TEXT.ui.distracted], [['F'], TEXT.ui.focusMode], [['T'], TEXT.ui.tasks],
    [['L'], TEXT.ui.log], [['P'], TEXT.ui.patches], [[','], TEXT.ui.settings], [['M'], 'Mute / unmute'], [['?'], 'This list'],
    [['Esc'], 'Close · leave heads-down · end an activity'],
  ];

  // ───────── small helpers ─────────
  const E = (fn, ...a) => try1(typeof Engine !== 'undefined' ? Engine : null, fn, ...a);
  const sfx = (name, o) => { try1(typeof Snd !== 'undefined' ? Snd : null, 'sfx', name, o); };
  const buzz = (name) => { try1(typeof Snd !== 'undefined' ? Snd : null, 'haptic', name); };
  const now = () => performance.now();
  const frames2 = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
  const typingIn = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || !!t.isContentEditable);
  const sets = () => (DB && DB.settings) || defaultSettings();
  const DTF = {};
  const dtf = (k, o) => DTF[k] || (DTF[k] = (() => { try { return new Intl.DateTimeFormat([], o); } catch (e) { return null; } })());
  // dates by hand (the app speaks English; the first Intl formatter costs ~15 ms on an old phone), times via Intl, warmed at idle
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDay = (ms, yr) => { const d = new Date(ms); return MON[d.getMonth()] + ' ' + d.getDate() + (yr ? ', ' + d.getFullYear() : ''); };
  const timeFmt = () => dtf('t', { hour: 'numeric', minute: '2-digit' });
  const fmtTime = (ms) => { const f = timeFmt(); return f ? f.format(ms) : clockTime(ms); };
  function ago(ms) {
    const s = (Date.now() - ms) / 1000, dd = dayDiff(ms, Date.now());
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (dd === 0) return fmtTime(ms);
    if (dd === 1) return 'yesterday';
    return fmtDay(ms);
  }
  const ST = (() => { const v = store.get('ui', null); return v && typeof v === 'object' ? v : {}; })();   // { seenAt, toastedAt }
  const saveST = () => store.set('ui', ST);
  const rogueOf = (kind) => ROGUE(kind) || { id: kind, name: kind, sig: '#ff2340', what: '', examples: '' };
  // A rogue's sprite: a copy of Patch's baked canvas at the size it's shown (cheap: no PNG encoding, no data URL),
  // or a neon badge with their initial until Patch has baked them (swapped on rogues:ready).
  const PATCH_ = () => (typeof Patch !== 'undefined' ? Patch : null);
  const RIMG = Object.create(null);                 // kind → blob: URL of the sprite (one decode, shared by every <img>)
  function blobRogues() {
    for (const r of TEXT.rogues) {
      if (RIMG[r.id] !== undefined) continue;
      const c = try1(PATCH_(), 'rogue', r.id, 128);
      if (!c || !c.toBlob) continue;
      RIMG[r.id] = null;
      try { c.toBlob((b) => { RIMG[r.id] = b ? URL.createObjectURL(b) : undefined; }, 'image/png'); } catch (e) { RIMG[r.id] = undefined; }
    }
  }
  function rogueArt(kind, cls, css) {
    css = css || 48;
    if (RIMG[kind]) return h('img', { class: 'ui-rimg ' + (cls || ''), src: RIMG[kind], alt: '', draggable: 'false', decoding: 'async' });
    const src = try1(PATCH_(), 'rogue', kind, css), r = rogueOf(kind);
    if (src && src.width) {
      const px = Math.round(css * Math.min(2, Math.max(1, window.devicePixelRatio || 1)));
      const c = makeCanvas(px, px);
      try { c.getContext('2d').drawImage(src, 0, 0, px, px); } catch (e) { reportErr('ui:rogue', e); }
      c.className = 'ui-rimg ' + (cls || ''); c.setAttribute('aria-hidden', 'true');
      return c;
    }
    return h('span', { class: 'ui-rfb ' + (cls || ''), 'data-rogue': kind, 'data-css': String(css), style: `--sig:${r.sig}`, 'aria-hidden': 'true' }, r.name.replace('Emperor ', '').charAt(0));
  }
  function swapRogues(root) {
    if (!root) return;
    for (const el of root.querySelectorAll('.ui-rfb[data-rogue]')) {
      const art = rogueArt(el.getAttribute('data-rogue'), el.className.replace('ui-rfb', '').trim(), +el.getAttribute('data-css') || 48);
      if (art.tagName !== 'SPAN') el.replaceWith(art);
    }
  }
  function download(name, text, type) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = h('a', { href: url, download: name, style: 'display:none' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch (e) { reportErr('ui:download', e); return false; }
  }

  // ───────── springs: a real damped spring as a CSS linear() easing where supported ─────────
  const LINEAR_OK = (() => { try { return !!(window.CSS && window.CSS.supports && window.CSS.supports('transition-timing-function', 'linear(0, 1)')); } catch (e) { return false; } })();
  function spring(zeta, w0, ms, n = 40) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta), pts = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * ms / 1000;
      const x = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
      pts.push(i === n ? 1 : +x.toFixed(4));
    }
    return 'linear(' + pts.join(',') + ')';
  }

  // ───────── art: small inline SVGs for the chrome ─────────
  const SV = (vb, body, cls) => `<svg class="${cls || 'ic'}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
  const TOMATO_PATH = 'M14 9.2c-5.3 0-8.6 3-8.6 7.1 0 4.3 3.8 7.5 8.6 7.5s8.6-3.2 8.6-7.5c0-4.1-3.3-7.1-8.6-7.1z';
  const MINI_TOMATO = SV('0 0 28 28', `<circle class="ui-ringbg" cx="14" cy="14" r="12.6"/><circle class="ui-ring" cx="14" cy="14" r="12.6" transform="rotate(-90 14 14)"/>
    <path d="${TOMATO_PATH}" fill="#ff4a3d"/><path d="M8.2 18.6c.8 2 2.6 3.4 4.8 3.8" stroke="#c8231a" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="10" cy="14.2" rx="1.5" ry="2.3" fill="#ffd0c4" transform="rotate(26 10 14.2)"/>
    <path d="M14 11.6l-3.6-2.2 2.5-.1L14 7.2l1.1 2.1 2.5.1z" fill="#2fbf71"/><path d="M14 9.5V6.4" stroke="#1b7a45" stroke-width="1.5" stroke-linecap="round"/>`, 'ui-tomsvg');
  const FLAME = SV('0 0 24 24', '<path class="ui-fo" d="M12 22c-4.3 0-7-2.8-7-6.6 0-3.5 2.6-5.6 3.9-8.8.6 2.4 1.8 3.8 3.2 4.5-.2-3 1-5.8 3.2-7.8.3 3.4 3.5 6 3.5 10.8C18.8 18.8 16.1 22 12 22z"/><path class="ui-fi" d="M12 21.4c-2 0-3.3-1.3-3.3-3.2 0-1.8 1.3-2.9 2-4.4.4 1.2 1 1.9 1.8 2.3.1-1.4.6-2.5 1.5-3.4.3 1.8 1.6 2.8 1.6 5.1 0 2.2-1.4 3.6-3.6 3.6z"/>', 'ui-flsvg');
  const PHONES = SV('0 0 24 24', '<path d="M4 15v-3a8 8 0 0 1 16 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="2.6" y="13.6" width="5.4" height="7.6" rx="2.2" fill="currentColor"/><rect x="16" y="13.6" width="5.4" height="7.6" rx="2.2" fill="currentColor"/>');
  const CHECKRING = SV('0 0 28 28', '<circle cx="14" cy="14" r="11" class="ui-cr"/><path d="m9 14.5 3.4 3.4L19.2 11" class="ui-ck"/>', 'ui-cksvg');
  const JAR = SV('0 0 24 24', '<rect x="5.5" y="7.5" width="13" height="13.5" rx="3.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4.5" y="3.5" width="15" height="4" rx="1.5" fill="currentColor"/><circle cx="10" cy="15" r="1.4" fill="currentColor"/><circle cx="14" cy="15" r="1.4" fill="currentColor"/>');
  const PLAY = SV('0 0 24 24', '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>');
  const ARROW_UP_RIGHT = SV('0 0 24 24', '<path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>');

  // ════════════════════════════════════ the embroidered patches (badgeSVG) ════════════════════════════════════
  // Each patch: a merrowed edge, a satin-stitch border (a thick ring under a hatch of fine thread), a twill field in
  // deep tones of its colour, a running stitch, and one bold pictogram with a dark outline thread so it reads at 28 px
  // on Patch's hoodie and at 120 px in the detail card. Numerals are stitched paths (an SVG image can't see web fonts).
  const NAVY = '#14173a';
  const hx2 = (n) => (n < 16 ? '0' : '') + n.toString(16);
  const h2r = (x) => { const n = parseInt(x.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const A = h2r(a), B = h2r(b); return '#' + hx2(Math.round(A[0] + (B[0] - A[0]) * t)) + hx2(Math.round(A[1] + (B[1] - A[1]) * t)) + hx2(Math.round(A[2] + (B[2] - A[2]) * t)); };
  const C = { tom: '#ff4a3d', tomD: '#c8231a', tomH: '#ffb2a3', leaf: '#2fbf71', leafD: '#1b7a45', cream: '#fff4e2', ink: '#1d2040', gold: '#f5c542', amber: '#ffb35c', mint: '#3dffc2', crim: '#ff2340', kraft: '#e2b47a' };
  let OL = '#000';                                           // the outline thread of the badge being built
  const r1 = (n) => Math.round(n * 10) / 10;
  const bp = (d, f, w = 4, x = '') => `<path d="${d}" fill="${f}" stroke="${OL}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke" ${x}/>`;
  const bc = (cx, cy, r, f, w = 4, x = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" stroke="${OL}" stroke-width="${w}" paint-order="stroke" ${x}/>`;
  const be = (cx, cy, rx, ry, f, w = 4, x = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${OL}" stroke-width="${w}" paint-order="stroke" ${x}/>`;
  const brc = (x, y, w, hh, r, f, sw = 4, ex = '') => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${r}" fill="${f}" stroke="${OL}" stroke-width="${sw}" paint-order="stroke" ${ex}/>`;
  const bl = (d, c, w, x = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;
  const bt = (d, c, w) => bl(d, OL, w + 4) + bl(d, c, w);   // a thick thread with its outline
  function starD(cx, cy, ro, ri, n, rot = -90, sy = 1) {
    let d = '';
    for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? ri : ro; d += (i ? 'L' : 'M') + r1(cx + Math.cos(a) * r) + ' ' + r1(cy + Math.sin(a) * r * sy); }
    return d + 'Z';
  }
  // a crescent: circle 0 minus circle 1
  function crescentD(x0, y0, R0, x1, y1, R1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), a = (R0 * R0 - R1 * R1 + d * d) / (2 * d), q = Math.sqrt(Math.max(0, R0 * R0 - a * a));
    const px = x0 + a * dx / d, py = y0 + a * dy / d, ux = -dy / d, uy = dx / d;
    const p1 = [r1(px + q * ux), r1(py + q * uy)], p2 = [r1(px - q * ux), r1(py - q * uy)];
    return `M${p1[0]} ${p1[1]}A${R0} ${R0} 0 1 1 ${p2[0]} ${p2[1]}A${R1} ${R1} 0 0 0 ${p1[0]} ${p1[1]}Z`;
  }
  // stitched numerals (10 × 16 glyph boxes)
  const GLYPH = {
    0: ['M5 .9C8.3.9 9.4 4.4 9.4 8S8.3 15.1 5 15.1.6 11.6.6 8 1.7.9 5 .9Z', 10],
    1: ['M1.4 3.9 5.2.9V15.1', 6.4],
    3: ['M1 2.7C2.2 1.4 3.5.9 5 .9c2.5 0 4 1.5 4 3.5 0 2.2-1.9 3.5-4.4 3.5 3 0 4.8 1.4 4.8 3.7 0 2.3-1.9 3.6-4.6 3.6-1.6 0-3-.6-4.2-1.7', 10],
    7: ['M.8 1.3h8.6L3.9 15.1', 10],
  };
  function numerals(str, cx, cy, ht, sw, col, bare) {
    const s = ht / 16, gap = 2.8;
    let w = 0; for (const ch of str) w += GLYPH[ch][1] + gap; w -= gap;
    let d = '', x = 0;
    for (const ch of str) { d += `<path d="${GLYPH[ch][0]}" transform="translate(${r1(x)} 0)"/>`; x += GLYPH[ch][1] + gap; }
    const g = (c, sw2) => `<g fill="none" stroke="${c}" stroke-width="${r1(sw2 / s)}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${r1(cx - w * s / 2)} ${r1(cy - ht / 2)}) scale(${r1(s * 100) / 100})">${d}</g>`;
    return (bare ? '' : g(OL, sw + 4)) + g(col, sw);
  }
  function tomatoArt(cx, cy, r, o = {}) {
    const ry = r * 0.88, X = (k) => r1(cx + r * k), Y = (k) => r1(cy + ry * k);
    let s = bp(`M${cx} ${Y(-1)}C${X(-.7)} ${Y(-1.1)} ${X(-1)} ${Y(-.5)} ${X(-1)} ${Y(.08)}C${X(-1)} ${Y(.68)} ${X(-.55)} ${Y(1)} ${cx} ${Y(1)}C${X(.55)} ${Y(1)} ${X(1)} ${Y(.68)} ${X(1)} ${Y(.08)}C${X(1)} ${Y(-.5)} ${X(.7)} ${Y(-1.1)} ${cx} ${Y(-1)}Z`, o.fill || C.tom, o.w || 4.4);
    s += bl(`M${X(-.32)} ${Y(-.8)}C${X(-.5)} ${Y(-.3)} ${X(-.48)} ${Y(.3)} ${X(-.3)} ${Y(.66)}M${X(.32)} ${Y(-.8)}C${X(.5)} ${Y(-.3)} ${X(.48)} ${Y(.3)} ${X(.3)} ${Y(.66)}`, C.tomD, r1(r * .08), 'opacity=".5"');
    s += `<ellipse cx="${X(-.5)}" cy="${Y(-.14)}" rx="${r1(r * .15)}" ry="${r1(ry * .3)}" fill="${C.tomH}" transform="rotate(24 ${X(-.5)} ${Y(-.14)})"/>`;
    if (o.crown !== false) {
      s += bp(starD(cx, cy - ry * .84, r * .58, r * .2, 5, -90, .52), C.leaf, 3);
      s += bl(`M${cx} ${Y(-.92)}c0 ${r1(-r * .22)} ${r1(r * .06)} ${r1(-r * .34)} ${r1(r * .2)} ${r1(-r * .42)}`, C.leafD, r1(r * .12));
    }
    return s;
  }
  // a rogue's face for the gallery and the jar: sig-coloured hood, dark visor, crimson eyes
  const rogueFace = (x, y, r, sig) => bc(x, y, r, sig, 3.4) + brc(r1(x - r * .78), r1(y - r * .2), r1(r * 1.56), r1(r * .72), r1(r * .36), '#1b1430', 0) + `<circle cx="${r1(x - r * .36)}" cy="${r1(y + r * .16)}" r="${r1(r * .2)}" fill="${C.crim}"/><circle cx="${r1(x + r * .36)}" cy="${r1(y + r * .16)}" r="${r1(r * .2)}" fill="${C.crim}"/>`;

  const PICTO = {
    first_tomato: (K) => tomatoArt(50, 55, 23),
    ten_down: (K) => tomatoArt(50, 55, 25) + numerals('10', 50, 59, 17, 4.4, C.cream),
    full_crate: (K) => tomatoArt(36.5, 45, 9.5, { w: 3.4 }) + tomatoArt(63.5, 45, 9.5, { w: 3.4 }) + tomatoArt(50, 41.5, 10, { w: 3.4 }) +
      brc(24, 47, 52, 29, 3.5, K.wood) + bl('M26.5 56.6H73.5M26.5 66.4H73.5', K.woodD, 2.2) + bl('M31.5 49.5V73.5M68.5 49.5V73.5', K.woodD, 2.6) +
      `<circle cx="31.5" cy="52" r="1.2" fill="${C.cream}"/><circle cx="68.5" cy="52" r="1.2" fill="${C.cream}"/><circle cx="31.5" cy="71" r="1.2" fill="${C.cream}"/><circle cx="68.5" cy="71" r="1.2" fill="${C.cream}"/>`,
    hundred_club: (K) => bp('M33.5 42 35.5 28.5 43 35.5 50 24.5 57 35.5 64.5 28.5 66.5 42Z', C.gold, 3.6) + `<circle cx="50" cy="35" r="2.3" fill="${C.crim}"/><circle cx="40.5" cy="38" r="1.6" fill="${C.cream}"/><circle cx="59.5" cy="38" r="1.6" fill="${C.cream}"/>` +
      numerals('100', 50, 59, 19, 4.6, C.cream),
    hour_power: (K) => bc(47, 52, 22.5, C.cream, 4.4) + (() => { let s = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, q = i % 3 === 0, r0 = q ? 15.5 : 17.5; s += bl(`M${r1(47 + Math.sin(a) * r0)} ${r1(52 - Math.cos(a) * r0)}L${r1(47 + Math.sin(a) * 19.5)} ${r1(52 - Math.cos(a) * 19.5)}`, K.dk, q ? 2.6 : 1.5); } return s; })() +
      bl('M47 52V37.5', C.ink, 3.4) + bl('M47 52L55.5 46.5', C.ink, 3.4) + `<circle cx="47" cy="52" r="2.6" fill="${K.c}"/>` + bp('M72.5 44 63.5 58.5H69.5L65.5 71 77 54H70.8L74.5 44Z', C.gold, 3.4),
    deep_worker: (K) => bp('M25.5 77Q27.5 63 39 60.5H61Q72.5 63 74.5 77Z', '#c98a35', 4) + brc(45.5, 21.5, 9, 6, 2, '#c98a35', 3) +
      bc(29.5, 45.5, 6, '#d99c40', 3.4) + bc(70.5, 45.5, 6, '#d99c40', 3.4) + bc(50, 44.5, 20.5, '#ebb253', 4.2) + bl('M33.5 52Q36 61.5 50 63.5', '#b9772c', 2.6, 'opacity=".7"') +
      `<circle cx="50" cy="45.5" r="11.4" fill="#123847" stroke="${C.cream}" stroke-width="3.4"/><path d="M50 34.6V56.4M39.1 45.5H60.9" stroke="${C.cream}" stroke-width="1.7" opacity=".9"/>` + bl('M42.6 41.4Q44.6 38.4 48 37.6', '#c4f7ff', 2.2, 'opacity=".9"') +
      `<circle cx="29.5" cy="45.5" r="2.6" fill="#123847"/><circle cx="70.5" cy="45.5" r="2.6" fill="#123847"/>` +
      `<circle cx="33" cy="70.5" r="1.6" fill="${C.cream}"/><circle cx="41.5" cy="66" r="1.6" fill="${C.cream}"/><circle cx="58.5" cy="66" r="1.6" fill="${C.cream}"/><circle cx="67" cy="70.5" r="1.6" fill="${C.cream}"/>` +
      `<circle cx="74.5" cy="28.5" r="3" fill="none" stroke="${C.cream}" stroke-width="1.8"/><circle cx="78" cy="21.5" r="2" fill="none" stroke="${C.cream}" stroke-width="1.6"/><circle cx="71" cy="20" r="1.3" fill="${C.cream}"/>`,
    hat_trick: (K) => bp(starD(32, 34.5, 7, 2.9, 5), C.cream, 3) + bp(starD(50, 26.5, 7.8, 3.2, 5), C.cream, 3) + bp(starD(68, 34.5, 7, 2.9, 5), C.cream, 3) +
      bp('M36 68 38 43.5Q50 39.5 62 43.5L64 68Z', K.hat, 4) + bp('M37.1 58H62.9L63.5 64.4H36.5Z', K.c, 0) + bl('M41.5 46.5Q42.5 52 42 56', '#ffffff', 2, 'opacity=".35"') +
      be(50, 68.5, 24, 5.6, K.hat, 4) + bl('M30 68Q50 72.6 70 68', K.lt, 1.6, 'opacity=".7"'),
    weekly_warrior: (K) => bp('M50 22.5 72.5 30.5C72.5 49.5 67 65 50 77C33 65 27.5 49.5 27.5 30.5Z', K.c, 4.4) +
      bl('M50 28.6 67.2 34.8C66.8 49 62.2 61.5 50 70.7C37.8 61.5 33.2 49 32.8 34.8Z', K.xl, 1.4, 'stroke-dasharray="2.4 2" opacity=".85"') + numerals('7', 50, 49.5, 22, 5.2, C.cream),
    monthly_master: (K) => brc(27.5, 31, 45, 44, 6, C.cream, 4.4) + `<path d="M27.5 37a6 6 0 0 1 6-6h33a6 6 0 0 1 6 6v6.5h-45Z" fill="${K.c}"/>` +
      brc(35.5, 25, 5, 11, 2.5, '#d3d9ea', 2.6) + brc(59.5, 25, 5, 11, 2.5, '#d3d9ea', 2.6) + bl('M33 69.5H67', '#d9cdb8', 1.4) + numerals('30', 50, 57.5, 16, 3.7, C.ink, true),
    night_owl: (K) => bp(crescentD(73.5, 33, 7.2, 70, 36.5, 6), C.cream, 2.6) + bp('M36.5 44 34 30.5 45 38Z', K.c, 3.4) + bp('M63.5 44 66 30.5 55 38Z', K.c, 3.4) +
      be(50, 56, 19.5, 21.5, K.c, 4.4) + be(50, 63, 11.5, 12, K.lt, 0) + bl('M45 61.5l2.5 2 2.5-2 2.5 2 2.5-2M45 67l2.5 2 2.5-2 2.5 2 2.5-2', K.dk, 1.5, 'opacity=".7"') +
      bc(42.5, 49, 8, C.cream, 3.4) + bc(57.5, 49, 8, C.cream, 3.4) + `<circle cx="43.4" cy="50" r="4" fill="${C.ink}"/><circle cx="56.6" cy="50" r="4" fill="${C.ink}"/><circle cx="44.8" cy="48.4" r="1.4" fill="#fff"/><circle cx="58" cy="48.4" r="1.4" fill="#fff"/>` +
      bp('M50 54.5 46.6 59 50 61.6 53.4 59Z', C.amber, 2.4),
    early_bird: (K) => (() => { let s = ''; for (let i = 0; i < 7; i++) { const a = Math.PI * (1 + (i + .5) / 7); s += bl(`M${r1(50 + Math.cos(a) * 23)} ${r1(64 + Math.sin(a) * 23)}L${r1(50 + Math.cos(a) * 29)} ${r1(64 + Math.sin(a) * 29)}`, C.gold, 3); } return s; })() +
      bp('M30.5 64A19.5 19.5 0 0 1 69.5 64Z', '#ffd36b', 4) + bt('M21 64.5H79', C.cream, 3) + bl('M31 71.5H69M38.5 77.5H61.5', K.lt, 2.6, 'opacity=".85"') +
      bp('M59 34.5q-6-8.5-12.5-6.5 5.5 2 7.5 8.5Z', K.lt, 2.4) + be(64.5, 37, 7, 5.6, C.cream, 3.4) + bp('M71 35.6 76 37.1 71 38.6Z', C.amber, 2) + `<circle cx="66.6" cy="35.6" r="1.3" fill="${C.ink}"/>` + bp('M63 37.5q-4.5 6-11 4.5 5-1.5 6.5-6Z', K.lt, 2.2),
    full_stack: (K) => [[61, K.c, K.dk, K.fdd], [48.5, K.lt, K.c, K.dk], [36, C.cream, K.xl, K.lt]].map(([y, top, l, r]) =>
      bp(`M28 ${y}L50 ${y + 9.5}V${y + 16}L28 ${y + 6.5}Z`, l, 3.6) + bp(`M72 ${y}L50 ${y + 9.5}V${y + 16}L72 ${y + 6.5}Z`, r, 3.6) + bp(`M50 ${y - 9.5}L72 ${y}L50 ${y + 9.5}L28 ${y}Z`, top, 3.6)).join(''),
    marathon: (K) => bl('M17.5 45.5H29M14.5 53H26.5M18.5 60.5H28', K.lt, 2.8) +
      bp('M30.5 62.5H74Q79.5 62.5 79 67.2Q78.4 71.4 73 71.4H32.5Q28 71.4 28 67Q28 62.5 30.5 62.5Z', C.cream, 4) +
      bp('M31 62.5 33 45.5Q33.8 40.6 38.2 41.7L45 43.5Q48.5 50 53.6 50L58 50Q66.5 51.5 73 56Q77 58.6 76.6 62.5Z', K.c, 4) +
      bl('M39.5 57.6Q52 58.6 62 51.6', C.cream, 3) + bl('M47.6 47 51.8 44.6M52.2 49.8 56.4 47.4', C.cream, 2.2) + bp('M31 46.5 27.6 42.4 34.4 41.2Z', K.lt, 2.4),
    weekend_shift: (K) => (() => { let s = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .2; s += bl(`M${r1(39 + Math.cos(a) * 15.5)} ${r1(43 + Math.sin(a) * 15.5)}L${r1(39 + Math.cos(a) * 20)} ${r1(43 + Math.sin(a) * 20)}`, C.gold, 3); } return s; })() +
      bc(39, 43, 11.5, C.gold, 3.8) + bp(crescentD(61, 59, 15, 67.5, 52.5, 12.6), C.cream, 3.8) + bp(starD(72.5, 72, 3.6, 1.3, 4), C.cream, 1.8),
    clean_build: (K) => bt('M31.5 51.5 45 65 69.5 36.5', K.neon, 8.6) + bp(starD(71, 64.5, 6, 1.7, 4), C.cream, 2.4) + bp(starD(31.5, 33.5, 4.8, 1.4, 4), C.cream, 2.2),
    quarantine: (K) => brc(31, 37.5, 38, 39, 9, '#cfe9ff', 4, 'fill-opacity=".28"') + bp('M38.5 73.5C36.5 63 40.5 54.5 50 54.5S63.5 63 61.5 73.5Z', '#2c1d42', 2.8) +
      `<circle cx="45.4" cy="63.2" r="2.8" fill="${C.crim}"/><circle cx="54.6" cy="63.2" r="2.8" fill="${C.crim}"/><circle cx="46.2" cy="62.2" r=".9" fill="#fff"/><circle cx="55.4" cy="62.2" r=".9" fill="#fff"/>` +
      bl('M37.5 45V67', '#ffffff', 2.6, 'opacity=".55"') + brc(28.5, 29.5, 43, 9.5, 3, K.c, 4) + bl('M34 34.2H66', K.dk, 1.6, 'stroke-dasharray="1.6 2.4"'),
    rogues_gallery: (K) => ['#e6ff3d', '#e8f4ff', '#7dff3a', '#3d7bff', '#ff3d9a', '#ff2340'].map((sig, i) => rogueFace(32 + (i % 3) * 18, 41.5 + Math.floor(i / 3) * 18, 8.4, sig)).join(''),
    shipped_it: (K) => bp('M50 26.5 73.5 37 50 47.5 26.5 37Z', '#efcb94', 3.8) + bp('M26.5 37 50 47.5V74.5L26.5 64Z', '#cf9a57', 3.8) + bp('M73.5 37 50 47.5V74.5L73.5 64Z', '#b47e41', 3.8) +
      `<path d="M37.2 31.8 42.6 29.4 66.4 40 61 42.4Z" fill="${K.c}"/><path d="M61 42.4 66.4 40V48.4L61 50.8Z" fill="${K.dk}"/>` + bl('M33 57.5 41 61.2M33 62.5 38.6 65', '#9c6a33', 1.8),
    hotfix: (K) => bt('M32.5 70 57 45.5', C.cream, 8.4) + bc(61, 40.5, 11.6, C.cream, 4.4) + `<path d="M60.5 41 70.5 31 77 37.5 67 47.5Z" fill="${K.fd2}"/>` + `<circle cx="32.5" cy="70" r="2.2" fill="${K.dk}"/>` +
      bp('M31 26.5 25 39.5H31.6L27.4 51 39.5 35H32.8L37 26.5Z', C.gold, 3.2),
    lofi_forever: (K) => bt('M29 59C29 31.5 71 31.5 71 59', C.cream, 5) + brc(21.5, 51.5, 14, 22, 6, '#262a46', 4) + brc(64.5, 51.5, 14, 22, 6, '#262a46', 4) +
      brc(24.6, 56, 3.4, 13, 1.7, C.mint, 0) + brc(72, 56, 3.4, 13, 1.7, C.mint, 0) + bl('M53.2 60.4V45.5L60 48.4', C.mint, 2.8) + be(49.4, 61, 4.4, 3.4, C.mint, 2.6, 'transform="rotate(-18 49.4 61)"'),
    exterminator: (K) => bp(starD(50, 54, 26, 17, 9, -80), K.neon, 3.6) + bl('M38 47 31 42M37 55H29M38.5 62 31.5 67.5M62 47 69 42M63 55H71M61.5 62 68.5 67.5', '#22401f', 3) +
      be(50, 55, 13, 9.5, '#2e5a2a', 3.4) + bl('M43.6 50.4 47.6 54.4M47.6 50.4 43.6 54.4M52.4 50.4 56.4 54.4M56.4 50.4 52.4 54.4', C.cream, 2.2) + bl('M45.5 60Q50 57.6 54.5 60', C.cream, 1.8),
    breathe_easy: (K) => bt('M23.5 40.5H50.5C58.5 40.5 61.5 33.5 57.5 29.5 53.6 25.8 47.6 28.4 49.4 33.4', C.cream, 4.8) +
      bt('M23.5 52.5H62.5C71.5 52.5 75.5 59 71.5 65 67.6 70 60.6 67 62.6 62', C.cream, 4.8) + bt('M31 64.5H47', C.cream, 4.8),
    _: (K) => bp(starD(50, 50, 20, 8.5, 5), C.cream, 4),
  };
  const BADGE = Object.create(null), BADGEURL = Object.create(null);
  function badgeSVG(id) {
    if (BADGE[id]) return BADGE[id];
    const p = PATCHDEF(id), c = p && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#9aa3cf';
    const K = { c, lt: mix(c, '#ffffff', .38), xl: mix(c, '#ffffff', .68), dk: mix(c, NAVY, .38), fdd: mix(c, NAVY, .58), fd: mix(c, NAVY, .72), fd2: mix(c, NAVY, .55),
      ed: mix(c, '#05060e', .8), th: mix(c, '#ffffff', .55), wood: mix(c, '#fff3d8', .25), woodD: mix(c, '#3a2410', .45), hat: mix(c, '#14101c', .8), neon: mix(c, '#ffffff', .2) };
    OL = K.ed;
    const u = 'ui-b' + String(id).replace(/[^a-z0-9]/gi, '');
    let pic = '';
    try { pic = (PICTO[id] || PICTO._)(K); } catch (e) { reportErr('badgeSVG', e); pic = PICTO._(K); }
    return (BADGE[id] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>` +
      `<pattern id="${u}t" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(36)"><rect width="1.2" height="3" fill="#fff" fill-opacity=".085"/></pattern>` +
      `<radialGradient id="${u}f" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="${K.fd2}"/><stop offset="1" stop-color="${K.fd}"/></radialGradient>` +
      `<radialGradient id="${u}s" cx=".33" cy=".24" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient></defs>` +
      `<circle cx="50" cy="52" r="47" fill="#000" fill-opacity=".3"/><circle cx="50" cy="50" r="47" fill="${K.ed}"/>` +
      `<circle cx="50" cy="50" r="42.6" fill="none" stroke="${c}" stroke-width="7.6"/><circle cx="50" cy="50" r="42.6" fill="none" stroke="${K.xl}" stroke-width="7.6" stroke-dasharray=".55 1.05" stroke-opacity=".55"/>` +
      `<circle cx="50" cy="50" r="38.8" fill="url(#${u}f)"/><circle cx="50" cy="50" r="38.8" fill="url(#${u}t)"/>` +
      `<circle cx="50" cy="50" r="35.3" fill="none" stroke="${K.th}" stroke-width="1.3" stroke-dasharray="2.3 1.9" stroke-linecap="round" stroke-opacity=".8"/>` +
      pic + `<circle cx="50" cy="50" r="47" fill="url(#${u}s)"/></svg>`);
  }
  const badgeURL = (id) => BADGEURL[id] || (BADGEURL[id] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(badgeSVG(id)));
  const BMP = Object.create(null);                 // id → blob: URL of a PNG raster, for sizes up to 72 CSS px
  const BMPX = Math.round(72 * Math.min(3, Math.max(1, window.devicePixelRatio || 1)));
  function rasterBadge(id) {
    return new Promise((res) => {
      if (BMP[id]) return res();
      const im = new Image();
      im.onload = () => {
        try {
          const c = makeCanvas(BMPX, BMPX); c.getContext('2d').drawImage(im, 0, 0, BMPX, BMPX);
          if (!c.toBlob) return res();
          c.toBlob((b) => { if (b) BMP[id] = URL.createObjectURL(b); res(); }, 'image/png');
        } catch (e) { res(); }
      };
      im.onerror = () => res();
      im.src = badgeURL(id);
    });
  }
  const badgeSrc = (id, size) => ((size || 64) <= 72 && BMP[id]) || badgeURL(id);
  const badgeImg = (id, cls, size) => h('img', { class: 'ui-bimg ' + (cls || ''), src: badgeSrc(id, size), alt: '', width: size || 64, height: size || 64, draggable: 'false', decoding: 'async' });

  // ════════════════════════════════════ state ════════════════════════════════════
  let host = null, scrim = null;          // #sheets and its scrim
  let cur = null;                         // the open sheet { id, def, arg, panel, body, head, live, opener }
  let seq = 0, booted = false, lastOpenMs = 0;
  const T = {};                           // top bar parts
  const D = {};                           // dock parts

  // ════════════════════════════════════ top bar ════════════════════════════════════
  function buildTop() {
    const top = $('top'); if (!top) return;
    top.textContent = '';
    const [a, ...b] = TEXT.app.name.replace("'", '’').split(' ');
    T.mark = h('h1', { class: 'ui-mark' }, h('b', null, a), h('span', null, b.join(' ')));
    T.n = h('b', { class: 'ui-nb' }, '0'); T.g = h('i', null, '/8'); T.sk = h('b', { class: 'ui-nb' }, '0');
    T.tom = h('span', { class: 'ui-tom', html: MINI_TOMATO }); T.fl = h('span', { class: 'ui-fl', html: FLAME });
    T.stats = h('button', { class: 'ui-stats', type: 'button', onclick: () => toggleSheet('log') },
      h('span', { class: 'ui-pill' }, T.tom, h('span', { class: 'ui-num' }, T.n, T.g), h('span', { class: 'ui-sep', 'aria-hidden': 'true' }), T.fl, h('span', { class: 'ui-num' }, T.sk)));
    T.mute = h('button', { class: 'ui-ib', type: 'button', onclick: () => toggleMute() }, h('span', { class: 'ui-ibi' }));
    T.hd = h('button', { class: 'ui-ib ui-hd', type: 'button', 'aria-label': TEXT.ui.focusMode, title: TEXT.ui.focusMode + ' (F)', onclick: () => try1(Dial, 'focusMode', !FOCUSMODE.on) }, h('span', { class: 'ui-ibi', html: PHONES }));
    top.append(T.mark, h('div', { class: 'ui-tr' }, T.stats, T.mute, T.hd));
    T.ring = top.querySelector('.ui-ring');
    T.last = { n: -1, sk: -1 };
    refreshMute();
  }
  let countHold = 0, countT = 0;
  function refreshTop(force) {
    if (!T.stats || !DB) return;
    const t = now();
    if (!force && t < countHold) { clearTimeout(countT); countT = setTimeout(() => refreshTop(true), countHold - t + 20); return; }
    let st = null;
    try { st = typeof Engine !== 'undefined' && Engine.stats ? Engine.stats() : null; } catch (e) { reportErr('ui:stats', e); }
    const n = st && st.today ? st.today.tomatoes | 0 : 0, g = (st && st.today && st.today.goal) || sets().dailyGoal || 8;
    const sk = st && st.streak ? st.streak.current | 0 : 0, lit = !!(st && st.streak && (st.streak.todayDone || n > 0));
    const L = T.last;
    if (n !== L.n) {
      const up = L.n >= 0 && n > L.n;
      const nb = h('b', { class: 'ui-nb' + (up ? ' ui-roll' : '') }, String(n)); T.n.replaceWith(nb); T.n = nb;
      if (up) { T.tom.classList.remove('ui-pop'); void T.tom.offsetWidth; T.tom.classList.add('ui-pop'); }
    }
    if (sk !== L.sk) {
      const up = L.sk >= 0 && sk > L.sk;
      const sb = h('b', { class: 'ui-nb' + (up ? ' ui-roll' : '') }, String(sk)); T.sk.replaceWith(sb); T.sk = sb;
      if (up) { T.fl.classList.remove('ui-flare'); void T.fl.offsetWidth; T.fl.classList.add('ui-flare'); }
    }
    T.g.textContent = '/' + g;
    T.fl.classList.toggle('ui-lit', lit && sk > 0);
    T.stats.classList.toggle('ui-goal', n >= g);
    if (T.ring) T.ring.style.strokeDashoffset = String(r1(79.17 * (1 - clamp(n / g, 0, 1))));
    T.stats.setAttribute('aria-label', W.today(n, g) + '. ' + W.streak(sk) + '. ' + W.openLog);
    L.n = n; L.sk = sk;
  }
  function isMuted() { const m = typeof Snd !== 'undefined' && !!Snd.muted; return m || !sets().sound; }
  function refreshMute() {
    if (!T.mute) return;
    const m = isMuted();
    T.mute.firstChild.innerHTML = ICON(m ? 'mute' : 'sound');
    T.mute.setAttribute('aria-label', m ? W.unmute : W.mute);
    T.mute.setAttribute('aria-pressed', String(m));
    T.mute.title = (m ? W.unmute : W.mute) + ' (M)';
    T.mute.classList.toggle('ui-off', m);
  }
  function toggleMute() {
    if (!sets().sound) { E('setSetting', 'sound', true); try1(Snd, 'mute', false); }
    else try1(Snd, 'mute');
    refreshMute();
    const m = isMuted();
    if (!m) sfx('toggle');
    ANNOUNCE(m ? W.soundOff : W.soundOn);
  }

  // ════════════════════════════════════ dock ════════════════════════════════════
  const TABS = [['tasks', 'tasks', TEXT.ui.tasks, 'T'], ['log', 'log', TEXT.ui.log, 'L'], ['patches', 'patch', TEXT.ui.patches, 'P'], ['settings', 'settings', TEXT.ui.settings, ',']];
  function buildDock() {
    const d = $('dock'); if (!d) return;
    d.textContent = '';
    for (const [id, ic, label, k] of TABS) {
      const icon = h('span', { class: 'ui-tabi', html: ICON(ic) });
      const b = h('button', { class: 'ui-tab', type: 'button', 'aria-keyshortcuts': k, title: TOUCH ? null : `${label} (${k})`, onclick: () => toggleSheet(id) }, icon, h('span', { class: 'ui-tabl' }, label));
      if (id === 'tasks') icon.appendChild(D.count = h('em', { class: 'ui-count', hidden: true }));
      if (id === 'patches') icon.appendChild(D.dot = h('em', { class: 'ui-dot', hidden: true }));
      D[id] = b; d.appendChild(b);
    }
  }
  function openTaskCount() { const hide = pend ? pend.ids : []; return DB ? DB.tasks.filter((t) => !t.doneAt && hide.indexOf(t.id) < 0).length : 0; }
  function unseen() { if (!DB) return 0; const s = ST.seenAt || 0; let n = 0; for (const k in DB.patches) if (DB.patches[k] > s) n++; return n; }
  function refreshDock() {
    if (!D.tasks) return;
    const n = openTaskCount();
    D.count.hidden = !n; D.count.textContent = n > 99 ? '99+' : String(n);
    D.tasks.setAttribute('aria-label', TEXT.ui.tasks + (n ? `, ${n} open` : ''));
    const u = unseen();
    D.dot.hidden = !u;
    D.patches.setAttribute('aria-label', TEXT.ui.patches + (u ? `, ${u} new` : ''));
    for (const [id] of TABS) { if (cur && cur.id === id) D[id].setAttribute('aria-current', 'true'); else D[id].removeAttribute('aria-current'); }
  }

  // ════════════════════════════════════ the sheet system ════════════════════════════════════
  const FALLBACK = { log: { title: TEXT.ui.log, size: 'tall', render(b) { b.appendChild(h('p', { class: 'ui-lead' }, '…')); } } };
  function toggleSheet(id) { if (cur && cur.id === id) close(); else open(id); }
  function open(id, arg) {
    const def = SHEETS[id] || FALLBACK[id];
    if (!def || !host) return;
    if (cur && cur.id === id) {                  // already open: re-target (e.g. Tasks → For later)
      if (arg !== undefined) { cur.arg = arg; if (def.retarget) try1(def, 'retarget', arg); else { renderInto(cur, arg); try1(def, 'opened', arg); } }
      return;
    }
    const t0 = now();
    if (SHEET_CSS[id]) CSS('ui-' + id, SHEET_CSS[id]);
    if (modal) modal.done(false);
    const opener = cur ? cur.opener : document.activeElement;
    if (cur) { const old = cur; cur = null; try1(old.def, 'closed'); dismiss(old, { fast: true }); if (old.id === 'onboard') finishOnboard(); }
    const c = build(id, def, arg);
    c.opener = opener; cur = c;
    host.insertBefore(c.panel, modalWrap && modalWrap.isConnected ? modalWrap : null);
    showScrim(true);
    lockChrome(true);
    frames2(() => {
      if (cur !== c) return;
      const a = document.activeElement;
      if (!a || a === document.body || !c.panel.contains(a)) {
        const f = !TOUCH && def.focus ? try1(def, 'focus', c.panel) : null;
        try { (f || c.panel).focus({ preventScroll: true }); } catch (e) {}
      }
      c.panel.classList.add('ui-on');
    });
    try1(def, 'opened', arg);
    syncLive(); refreshDock();
    BUS.emit('ui:sheet', { id });
    lastOpenMs = now() - t0;
  }
  function build(id, def, arg) {
    const n = ++seq, size = def.size === 'tall' || def.size === 'half' ? def.size : 'auto';
    const panel = h('section', { class: `ui-sheet ui-${size} ui-s-${id}`, role: 'dialog', 'aria-modal': 'true', tabindex: '-1', 'data-hit': '' });
    const c = { id, def, arg, panel, body: null, head: null, live: null, liveT: null };
    if (!def.bare) {
      const title = h('h2', { class: 'ui-title', id: 'ui-st' + n }, def.title || '');
      panel.setAttribute('aria-labelledby', 'ui-st' + n);
      c.liveT = h('span', null, '');
      c.live = h('button', { class: 'ui-live', type: 'button', hidden: true, onclick: () => close() }, h('i'), c.liveT);
      c.head = h('header', { class: 'ui-head' },
        h('div', { class: 'ui-ht' }, EYEBROW[id] ? h('div', { class: 'ui-eyebrow', 'aria-hidden': 'true' }, EYEBROW[id]) : null, title),
        c.live, h('button', { class: 'ui-x', type: 'button', 'aria-label': W.close, title: TOUCH ? null : W.close + ' (Esc)', html: ICON('close'), onclick: () => close() }));
      const grab = h('div', { class: 'ui-grab', 'aria-hidden': 'true' }, h('i'));
      panel.append(grab, c.head);
      dragify(c, grab); dragify(c, c.head);
    } else panel.setAttribute('aria-label', def.title || id);
    c.body = h('div', { class: 'ui-body' });
    panel.appendChild(c.body);
    if (c.head) {
      let sq = 0, was = false;
      c.body.addEventListener('scroll', () => { if (sq) return; sq = requestAnimationFrame(() => { sq = 0; const on = c.body.scrollTop > 4; if (on !== was) { was = on; c.head.classList.toggle('ui-scrolled', on); } }); }, { passive: true });
    }
    renderInto(c, arg);
    return c;
  }
  function renderInto(c, arg) {
    const old = c.panel.querySelector(':scope > .ui-foot'); if (old) old.remove();
    c.body.textContent = '';
    try { c.def.render(c.body, arg); } catch (e) { reportErr('sheet:' + c.id, e); }
  }
  function dismiss(c, o) {
    const p = c.panel;
    p.classList.remove('ui-on', 'ui-drag'); p.classList.add('ui-out');
    p.removeAttribute('data-hit'); p.inert = true;
    if (o.ms) p.style.transition = `transform ${Math.round(o.ms)}ms cubic-bezier(.3,.7,.4,1),opacity ${Math.round(o.ms)}ms`;
    else if (o.fast) p.style.transition = 'transform 200ms var(--ease-in),opacity 200ms';
    p.style.transform = '';
    let gone = false;
    const end = () => { if (gone) return; gone = true; p.remove(); };
    p.addEventListener('transitionend', (e) => { if (e.target === p && e.propertyName === 'transform') end(); });
    setTimeout(end, (o.ms || 320) + 180);
  }
  function close(o) {
    if (!cur) return;
    const c = cur; cur = null;
    if (modal) modal.done(false);
    dismiss(c, o || {});
    showScrim(false);
    lockChrome(false);
    try1(c.def, 'closed');
    refreshDock();
    const op = c.opener, a = document.activeElement;
    if (op && op !== document.body && op.isConnected && typeof op.focus === 'function' && !(op.closest && op.closest('.ui-sheet'))) { try { op.focus({ preventScroll: true }); } catch (e) {} }
    else if (a && c.panel.contains(a)) a.blur();
    BUS.emit('ui:sheet', { id: null });
    if (c.id === 'onboard') finishOnboard();
    setTimeout(flushReflect, 450);
    setTimeout(pump, 120);
  }
  function showScrim(on) {
    if (!scrim) return;
    scrim.classList.toggle('ui-on', on);
    if (on) scrim.setAttribute('data-hit', ''); else { scrim.removeAttribute('data-hit'); scrim.style.opacity = ''; }
  }
  function lockChrome(on) {
    const top = $('top'), dock = $('dock');
    const lift = on && LAYOUT.wide && !LAYOUT.short;
    if (top) top.inert = on;
    if (dock) { dock.inert = on && !lift; dock.classList.toggle('ui-lift', lift); }
  }
  // drag the grabber / header down (or right, as a panel) to close; let go early and it springs back
  function dragify(c, el) {
    el.addEventListener('pointerdown', (e) => {
      if (cur !== c || e.button > 0 || (e.target.closest && e.target.closest('button, a, input, textarea'))) return;
      const p = c.panel, wide = LAYOUT.wide, size = Math.max(1, wide ? p.offsetWidth : p.offsetHeight);
      const d = { id: e.pointerId, x0: e.clientX, y0: e.clientY, off: 0, v: 0, lt: now(), moved: false };
      try { el.setPointerCapture(e.pointerId); } catch (er) {}
      const move = (ev) => {
        if (ev.pointerId !== d.id) return;
        const raw = wide ? ev.clientX - d.x0 : ev.clientY - d.y0;
        if (!d.moved) { if (Math.abs(raw) < 5) return; d.moved = true; p.classList.add('ui-drag'); }
        const off = raw > 0 ? raw : -Math.sqrt(-raw) * 2.4;          // rubber band past fully open
        const t = now(), dt = Math.max(1, t - d.lt);
        d.v = 0.65 * ((off - d.off) / dt) + 0.35 * d.v; d.lt = t; d.off = off;
        p.style.transform = wide ? `translate3d(${off.toFixed(1)}px,0,0)` : `translate3d(0,${off.toFixed(1)}px,0)`;
        if (scrim) scrim.style.opacity = String(r1(1 - clamp(off / size, 0, 1) * 0.85));
      };
      const up = (ev) => {
        if (ev.pointerId !== d.id) return;
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (!d.moved) return;
        if (now() - d.lt > 80) d.v = 0;
        p.classList.remove('ui-drag');
        if (cur === c && (d.off > size * 0.28 || (d.v > 0.5 && d.off > 14))) close({ ms: clamp((size - d.off) / Math.max(d.v, 1), 130, 320) });
        else { p.style.transform = ''; if (scrim) scrim.style.opacity = ''; }
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }
  // the timer chip in the sheet header: you can still see the time while a sheet covers the tomato
  function syncLive(p) {
    if (!cur || !cur.live) return;
    const st = (p && p.state) || TIMER.state, on = st === 'running' || st === 'paused';
    if (cur.live.hidden === on) cur.live.hidden = !on;
    if (!on) return;
    const mode = (p && p.mode) || TIMER.mode, txt = mmss(p && p.left != null ? p.left : TIMER.left);
    if (cur.liveT.textContent !== txt) cur.liveT.textContent = txt;
    const cls = 'ui-live' + (mode === 'focus' ? '' : ' ui-brk') + (st === 'paused' ? ' ui-psd' : '');
    if (cur.live.className !== cls) cur.live.className = cls;
    cur.live.setAttribute('aria-label', W.showTimer(txt) + (st === 'paused' ? ' (' + W.paused + ')' : ''));
  }

  // ── focus trap ──
  const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function focusables(root) { return Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => !el.hidden && el.getClientRects().length && !el.closest('[inert]')); }
  function trapTab(e, root) {
    const f = focusables(root);
    if (!f.length) { root.focus(); return true; }
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey) { if (i <= 0) { f[f.length - 1].focus(); return true; } }
    else if (i < 0 || i === f.length - 1) { f[0].focus(); return true; }
    return false;
  }

  // ════════════════════════════════════ confirm: a small modal above any sheet ════════════════════════════════════
  let modal = null, modalWrap = null;
  function confirmBox(text, o = {}) {
    if (modal) modal.done(false);
    return new Promise((resolve) => {
      const opener = document.activeElement;
      const okB = h('button', { class: 'ui-btn ' + (o.danger ? 'ui-danger' : 'ui-primary'), type: 'button' }, o.ok || 'OK');
      const noB = h('button', { class: 'ui-btn ui-ghost', type: 'button' }, o.cancel || W.cancel);
      const box = h('div', { class: 'ui-modal' + (o.danger ? ' ui-mdanger' : ''), role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'ui-mt', 'data-hit': '' },
        o.danger ? h('span', { class: 'ui-mico', html: ICON('trash') }) : null, h('p', { id: 'ui-mt', class: 'ui-mtext' }, String(text)), h('div', { class: 'ui-mrow' }, noB, okB));
      const back = h('div', { class: 'ui-mscrim', 'data-hit': '' });
      const wrap = h('div', { class: 'ui-mwrap' }, back, box);
      let settled = false;
      const done = (v) => {
        if (settled) return; settled = true;
        if (modal && modal.wrap === wrap) { modal = null; modalWrap = null; }
        wrap.classList.remove('ui-on'); setTimeout(() => wrap.remove(), 240);
        if (opener && opener.isConnected && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch (e) {} }
        resolve(!!v);
      };
      okB.onclick = () => { sfx('tap'); done(true); }; noB.onclick = () => done(false); back.onclick = () => done(false);
      modal = { wrap, done, box }; modalWrap = wrap;
      (host || document.body).appendChild(wrap);
      frames2(() => wrap.classList.add('ui-on'));
      try { (o.danger ? noB : okB).focus({ preventScroll: true }); } catch (e) {}
    });
  }

  // ════════════════════════════════════ toasts ════════════════════════════════════
  // Queued, one at a time, in the band at the very top (above a sheet's header, never over its buttons). Patch
  // unlocks that land together merge into one toast. Held while onboarding runs and through a tomato's celebration.
  const TQ = [];
  let tCur = null, tTimer = 0, tHold = 0, tHoldT = 0, obWait = false;
  function holdToasts(ms) { tHold = Math.max(tHold, now() + ms); }
  function pushToast(o) {
    if (o.urgent) {
      TQ.unshift(o);
      if (tCur && tCur.hide && tCur.o.kind !== 'patch') tCur.hide();
    } else TQ.push(o);
    pump();
  }
  function pump() {
    if (tCur || !TQ.length || !booted || obWait) return;
    if (cur && cur.id === 'onboard') return;
    const t = now();
    if (t < tHold) { clearTimeout(tHoldT); tHoldT = setTimeout(pump, tHold - t + 30); return; }
    let o = TQ.shift();
    if (o.kind === 'patch') {
      const more = TQ.filter((x) => x.kind === 'patch');
      if (more.length) { for (const m of more) TQ.splice(TQ.indexOf(m), 1); o = patchGroupToast(more.reduce((a, m) => a.concat(m.ids), o.ids.slice())); }
    }
    showToast(o);
  }
  function showToast(o) {
    const wrap = $('toasts'); if (!wrap) return;
    const art = o.img ? h('span', { class: 'ui-tart ui-timg' }, o.img) : h('span', { class: 'ui-tart', style: o.color ? `--c:${o.color}` : null, html: ICON(o.icon || 'info') });
    const txt = h('span', { class: 'ui-ttxt' }, o.eyebrow ? h('small', null, o.eyebrow) : null, h('b', null, String(o.text)), o.sub ? h('span', null, String(o.sub)) : null);
    const el = h('div', { class: 'ui-toast' + (o.kind ? ' ui-k-' + o.kind : ''), 'data-hit': '' }, art, txt);
    let acted = false;
    if (o.action) el.appendChild(h('button', { class: 'ui-tact', type: 'button', onclick: (e) => { e.stopPropagation(); acted = true; try { o.action.fn(); } catch (er) { reportErr('ui:toast', er); } hide(); } }, o.action.label));
    if (o.onTap) { el.classList.add('ui-tap'); el.addEventListener('click', () => { acted = true; try { o.onTap(); } catch (er) { reportErr('ui:toast', er); } hide(); }); }
    const tc = { el, o, hidden: false };
    tCur = tc;
    wrap.appendChild(el);
    frames2(() => el.classList.add('ui-on'));
    ANNOUNCE([o.eyebrow, o.text, o.sub, o.action && o.action.label].filter(Boolean).join('. '));
    const ms = o.ms || (o.action ? 5200 : 3400);
    let left = ms, since = now();
    const arm = () => { clearTimeout(tTimer); since = now(); tTimer = setTimeout(hide, left); };
    const pause = () => { clearTimeout(tTimer); left = Math.max(1200, left - (now() - since)); };
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pause(); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') arm(); });
    el.addEventListener('focusin', pause); el.addEventListener('focusout', arm);
    // swipe up to dismiss
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const y0 = e.clientY, id = e.pointerId; let dy = 0;
      const mv = (ev) => { if (ev.pointerId !== id) return; dy = Math.min(0, ev.clientY - y0); if (dy < -4) { el.classList.add('ui-drag'); el.style.transform = `translate3d(0,${dy}px,0)`; } };
      const upf = (ev) => { if (ev.pointerId !== id) return; el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', upf); el.removeEventListener('pointercancel', upf); el.classList.remove('ui-drag'); if (dy < -22) hide(); else el.style.transform = ''; };
      try { el.setPointerCapture(id); } catch (er) {}
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', upf); el.addEventListener('pointercancel', upf);
    });
    arm();
    function hide() {
      if (tc.hidden) return; tc.hidden = true;
      clearTimeout(tTimer);
      el.classList.remove('ui-on'); el.classList.add('ui-out'); el.style.transform = '';
      setTimeout(() => el.remove(), 320);
      if (!acted && o.onEnd) { try { o.onEnd(); } catch (er) { reportErr('ui:toast', er); } }
      if (tCur === tc) tCur = null;
      setTimeout(pump, TQ.length && TQ[0].urgent ? 120 : 260);
    }
    tc.hide = hide;
  }
  function dropToast(o) {
    if (!o) return;
    const i = TQ.indexOf(o); if (i >= 0) TQ.splice(i, 1);
    if (tCur && tCur.o === o && tCur.hide) { o.onEnd = null; tCur.hide(); }
  }
  function toast(text, o = {}) { pushToast({ text: String(text), icon: o.icon, color: o.color, ms: o.ms, eyebrow: o.eyebrow, sub: o.sub, action: o.action, urgent: !!o.urgent }); }
  function patchToast(id) {
    const p = PATCHDEF(id); if (!p) return null;
    return { kind: 'patch', id, ids: [id], eyebrow: W.newPatch, text: p.name, sub: null, img: badgeImg(id, 'ui-tbadge', 44), color: p.color, ms: 5600,
      action: (DB.hoodie || []).indexOf(id) < 0 ? { label: W.sewIt, fn: () => sewFromToast(id) } : null, onTap: () => open('patches', { id }) };
  }
  function patchGroupToast(ids) {
    if (ids.length === 1) return patchToast(ids[0]);
    const stack = h('span', { class: 'ui-tstack' }, ids.slice(0, 4).map((id) => badgeImg(id, 'ui-tbadge', 40)));
    const names = ids.map((id) => (PATCHDEF(id) || { name: id }).name);
    return { kind: 'patch', ids: ids.slice(), eyebrow: W.newPatches(ids.length), text: names.slice(0, 2).join(' · ') + (names.length > 2 ? ' +' + (names.length - 2) : ''), img: stack, ms: 6000, onTap: () => open('patches') };
  }
  function sewFromToast(id) {
    if ((DB.hoodie || []).length >= 4) { open('patches', { id }); return; }
    if (E('hoodieToggle', id)) { buzz('tick'); toast(W.sewn, { icon: 'check', sub: (PATCHDEF(id) || {}).name, color: 'var(--accent)', ms: 2200 , urgent: true }); }
  }

  // ════════════════════════════════════ shared bits for sheets ════════════════════════════════════
  const sec = (title, extra) => h('div', { class: 'ui-sech' }, h('h3', null, title), extra || null);
  const pips = (done, est) => {
    const n = Math.max(done, est), out = h('span', { class: 'ui-pips', 'aria-hidden': 'true' });
    if (n > 12) { out.appendChild(h('i', { class: 'ui-pip' })); return out; }
    for (let i = 0; i < n; i++) out.appendChild(h('i', { class: 'ui-pip' + (i < done ? (i >= est ? ' ui-over' : '') : ' ui-g') }));
    return out;
  };

  // ════════════════════════════════════ Tasks ════════════════════════════════════
  const TS = { body: null, list: null, doneWrap: null, doneList: null, doneHead: null, later: null, input: null, est: 1, estRow: null, hold: 0, ht: 0, fresh: null };
  let pend = null;                         // a delete waiting on its undo toast: { ids, active, toast }
  function commitPend(which) {
    if (!pend || (which && which !== pend)) return;
    const p = pend; pend = null;
    dropToast(p.toast);
    if (p.clear) E('clearDoneTasks');                  // shipped work moves to the archive, so the Changelog keeps it
    else for (const id of p.ids) E('removeTask', id);
    refreshDock();
  }
  function undoPend(which) {
    if (!pend || (which && which !== pend)) return;
    const p = pend; pend = null;
    if (p.active) E('setActiveTask', p.active);
    tasksFill(); refreshDock();
  }
  function removeTasks(list, msg, clear) {
    if (!list.length) return;
    commitPend();
    const ids = list.map((t) => t.id), act = ids.indexOf(DB.activeTask) >= 0 ? DB.activeTask : null;
    const p = pend = { ids, active: act, toast: null, clear: !!clear };
    if (act) { const nx = DB.tasks.find((t) => !t.doneAt && ids.indexOf(t.id) < 0); E('setActiveTask', nx ? nx.id : null); }
    tasksFill(); refreshDock();
    p.toast = { kind: 'undo', urgent: true, icon: 'trash', text: msg, sub: list.length === 1 ? list[0].title : null, action: { label: W.undo, fn: () => undoPend(p) }, onEnd: () => commitPend(p), ms: 5200 };
    pushToast(p.toast);
  }
  function estPicker() {
    const row = h('div', { class: 'ui-est', role: 'radiogroup', 'aria-label': W.est });
    const lab = h('span', { class: 'ui-estn' });
    const btns = [];
    const set = (n, quiet) => {
      TS.est = clamp(n, 1, 8);
      btns.forEach((b, i) => { b.setAttribute('aria-checked', String(i + 1 === TS.est)); b.classList.toggle('ui-on', i < TS.est); b.tabIndex = i + 1 === TS.est ? 0 : -1; });
      lab.textContent = W.estN(TS.est);
      if (!quiet) { sfx('tap', { vol: 0.4 }); buzz('tick'); }
    };
    for (let i = 1; i <= 8; i++) {
      const b = h('button', { class: 'ui-et', type: 'button', role: 'radio', 'aria-label': W.estN(i), 'data-n': i }, h('i'));
      b.addEventListener('keydown', (e) => {
        const k = e.key, d = k === 'ArrowRight' || k === 'ArrowUp' ? 1 : k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 0;
        if (!d) return; e.preventDefault(); set(TS.est + d); btns[TS.est - 1].focus();
      });
      btns.push(b);
    }
    const track = h('div', { class: 'ui-ets' }, btns);
    // tap or slide a finger across the tomatoes
    track.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      const rects = btns.map((b) => b.getBoundingClientRect()), mouse = e.pointerType === 'mouse', x0 = e.clientX;
      const pickAt = (x) => { let k = 1; for (let i = 0; i < rects.length; i++) if (x >= rects[i].left) k = i + 1; return k; };
      let last = TS.est, sliding = mouse;
      const to = (x) => { const k = pickAt(x); if (k !== last) { last = k; set(k); } };
      if (mouse) { e.preventDefault(); to(e.clientX); try { track.setPointerCapture(e.pointerId); } catch (er) {} }
      const mv = (ev) => { if (!sliding && Math.abs(ev.clientX - x0) > 6) { sliding = true; try { track.setPointerCapture(e.pointerId); } catch (er) {} } if (sliding) to(ev.clientX); };
      const end = (ev) => {
        track.removeEventListener('pointermove', mv); track.removeEventListener('pointerup', end); track.removeEventListener('pointercancel', end);
        if (ev.type === 'pointerup' && !mouse) to(ev.clientX);
      };
      track.addEventListener('pointermove', mv); track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
    });
    track.addEventListener('click', (e) => { if (e.detail === 0 && e.target.closest('.ui-et')) set(+e.target.closest('.ui-et').getAttribute('data-n')); });
    row.append(h('div', { class: 'ui-esth' }, h('span', { class: 'ui-label' }, W.est), lab), track);
    TS.estRow = row; TS.estSet = set; set(TS.est || 1, true);
    return row;
  }
  function taskRow(t, idx, n) {
    const act = DB.activeTask === t.id;
    const li = h('li', { class: 'ui-task' + (act ? ' ui-act' : '') + (TS.fresh === t.id ? ' ui-fresh' : ''), 'data-id': t.id });
    const handle = h('button', { class: 'ui-handle', type: 'button', 'aria-label': W.move(t.title), 'aria-describedby': null, html: ICON('drag') });
    handle.addEventListener('pointerdown', (e) => dragRow(e, li, t));
    handle.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      if (!d) return; e.preventDefault(); e.stopPropagation(); moveBy(t.id, d);
    });
    const main = h('button', { class: 'ui-tmain', type: 'button', 'aria-pressed': String(act), 'aria-label': (act ? W.stop(t.title) : W.work(t.title)) + `, ${t.done} of ${W.estN(t.est)}` },
      act ? h('span', { class: 'ui-tnow' }, TEXT.ui.workingOn) : null,
      h('span', { class: 'ui-ttl' }, t.title),
      h('span', { class: 'ui-tmeta' }, pips(t.done | 0, t.est | 0), h('span', { class: 'ui-tn' }, `${t.done | 0}/${t.est | 0}`)));
    main.onclick = (e) => {
      if (TS.swallow) { TS.swallow = false; return; }
      if (e.detail > 1) return;                                   // the second click of a double-click edits instead
      E('setActiveTask', DB.activeTask === t.id ? null : t.id);
    };
    if (!TOUCH) main.title = W.editTip;
    main.addEventListener('dblclick', (e) => { e.preventDefault(); if (DB.activeTask !== t.id) E('setActiveTask', t.id); editTask(t, li); });
    main.addEventListener('contextmenu', (e) => { if (TOUCH) e.preventDefault(); });
    main.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const x0 = e.clientX, y0 = e.clientY;
      let lp = setTimeout(() => { lp = 0; TS.swallow = true; buzz('tick'); editTask(t, li); }, 520);
      const stop = () => { clearTimeout(lp); main.removeEventListener('pointermove', mv); main.removeEventListener('pointerup', stop); main.removeEventListener('pointercancel', stop); };
      const mv = (ev) => { if (Math.abs(ev.clientX - x0) > 8 || Math.abs(ev.clientY - y0) > 8) stop(); };
      main.addEventListener('pointermove', mv); main.addEventListener('pointerup', stop); main.addEventListener('pointercancel', stop);
    });
    const ship = h('button', { class: 'ui-ship', type: 'button', 'aria-label': W.ship(t.title), title: TOUCH ? null : W.ship(t.title), html: CHECKRING, onclick: () => shipTask(t, li) });
    const del = h('button', { class: 'ui-del', type: 'button', 'aria-label': W.del(t.title), title: TOUCH ? null : W.del(t.title), html: ICON('trash'), onclick: () => removeTasks([t], W.deleted) });
    li.append(handle, main, ship, del);
    return li;
  }
  function doneRow(t) {
    return h('li', { class: 'ui-task ui-shipped', 'data-id': t.id },
      h('span', { class: 'ui-stampmini', 'aria-hidden': 'true' }, TEXT.ui.shipped),
      h('span', { class: 'ui-tmain ui-static' }, h('span', { class: 'ui-ttl' }, t.title), h('span', { class: 'ui-tmeta' }, `${W.estN(t.done | 0)} · ${fmtDay(t.doneAt)}`)),
      h('button', { class: 'ui-ship ui-on', type: 'button', 'aria-label': W.unship(t.title), html: CHECKRING, onclick: () => E('toggleTaskDone', t.id) }),
      h('button', { class: 'ui-del', type: 'button', 'aria-label': W.del(t.title), html: ICON('trash'), onclick: () => removeTasks([t], W.deleted) }));
  }
  // inline edit: the title becomes a field, the pips an estimate picker; Enter or tapping away saves, Esc cancels
  function editTask(t, li) {
    if (TS.editing) finishEdit(true);
    const main = li.querySelector('.ui-tmain'); if (!main || t.doneAt) return;
    let est = clamp(t.est | 0, 1, 12);
    const inp = h('input', { class: 'ui-in ui-edit', type: 'text', maxlength: '140', 'aria-label': W.rename, enterkeyhint: 'done', autocomplete: 'off' });
    inp.value = t.title;
    const btns = [];
    const sync = () => btns.forEach((b, i) => { b.setAttribute('aria-checked', String(i + 1 === est)); b.classList.toggle('ui-on', i < est); });
    for (let n = 1; n <= 8; n++) {
      const b = h('button', { class: 'ui-et', type: 'button', role: 'radio', 'aria-label': W.estN(n), tabindex: '-1' }, h('i'));
      b.addEventListener('pointerdown', (e) => e.preventDefault());            // keep the field focused
      b.onclick = () => { est = n; sync(); sfx('tap', { vol: 0.4 }); buzz('tick'); };
      btns.push(b);
    }
    const box = h('div', { class: 'ui-editbox' }, inp, h('div', { class: 'ui-ets ui-ets-s', role: 'radiogroup', 'aria-label': W.est }, btns));
    main.replaceWith(box); li.classList.add('ui-editing'); sync();
    TS.editing = { t, li, box, inp, est: () => est };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); est = clamp(est + (e.key === 'ArrowUp' ? 1 : -1), 1, 8); sync(); }
    });
    box.addEventListener('focusout', () => setTimeout(() => { if (TS.editing && TS.editing.box === box && !box.contains(document.activeElement)) finishEdit(true); }, 0));
    try { inp.focus({ preventScroll: true }); inp.select(); } catch (e) {}
  }
  function finishEdit(save) {
    const ed = TS.editing; if (!ed) return false;
    TS.editing = null;
    if (save) {
      const v = ed.inp.value.trim(), p = {};
      if (v && v !== ed.t.title) p.title = v.slice(0, 140);
      if (ed.est() !== ed.t.est) p.est = ed.est();
      if (p.title || p.est) E('updateTask', ed.t.id, p);
    }
    tasksFill();
    const hd = TS.list && TS.list.querySelector(`[data-id="${ed.t.id}"] .ui-tmain`); if (hd && !TOUCH) try { hd.focus({ preventScroll: true }); } catch (e) {}
    return true;
  }
  function shipTask(t, li) {
    if (RM()) { E('toggleTaskDone', t.id); buzz('done'); return; }
    li.classList.add('ui-stamping');
    li.appendChild(h('span', { class: 'ui-stampfx', 'aria-hidden': 'true' }, h('b', null, TEXT.ui.shipped)));
    TS.hold = now() + 1250;
    setTimeout(() => { buzz('done'); E('toggleTaskDone', t.id); }, 330);
  }
  const openVisible = () => { const hide = pend ? pend.ids : []; return DB.tasks.filter((t) => !t.doneAt && hide.indexOf(t.id) < 0); };
  // move task `id` so it sits at visible position `to` among the open tasks (Engine.moveTask takes a full-array index)
  function moveTo(id, to) {
    const vis = openVisible().map((t) => t.id), from = vis.indexOf(id);
    if (from < 0 || to === from) return;
    vis.splice(from, 1); vis.splice(to, 0, id);
    const arr = DB.tasks.filter((t) => t.id !== id), next = vis[to + 1], prev = vis[to - 1];
    let idx = next ? arr.findIndex((t) => t.id === next) : prev ? arr.findIndex((t) => t.id === prev) + 1 : 0;
    if (idx < 0) idx = arr.length;
    E('moveTask', id, idx);
  }
  function moveBy(id, d) {
    const vis = openVisible(), from = vis.findIndex((t) => t.id === id), to = clamp(from + d, 0, vis.length - 1);
    if (from < 0 || to === from) return;
    moveTo(id, to); sfx('tap', { vol: 0.4 });
    tasksFill();
    const hd = TS.list && TS.list.querySelector(`[data-id="${id}"] .ui-handle`); if (hd) hd.focus({ preventScroll: false });
    ANNOUNCE(W.moved(to + 1, vis.length));
  }
  function dragRow(e, li, t) {
    if (e.button > 0) return;
    e.preventDefault();
    const items = Array.from(TS.list.querySelectorAll(':scope > .ui-task'));
    const idx = items.indexOf(li); if (idx < 0) return;
    const rects = items.map((x) => x.getBoundingClientRect());
    const step = items.length > 1 ? (idx < items.length - 1 ? rects[idx + 1].top - rects[idx].top : rects[idx].top - rects[idx - 1].top) : rects[idx].height;
    const y0 = e.clientY, mid0 = rects[idx].top + rects[idx].height / 2, body = TS.body;
    const sc0 = body.scrollTop;
    let to = idx, dy = 0, raf = 0, lastY = y0;
    li.classList.add('ui-lift'); TS.list.classList.add('ui-sorting'); TS.dragging = true;
    const handle = e.currentTarget || li.querySelector('.ui-handle');
    try { handle.setPointerCapture(e.pointerId); } catch (er) {}
    buzz('tick');
    const apply = () => {
      raf = 0;
      dy = lastY - y0 + (body.scrollTop - sc0);
      li.style.transform = `translate3d(0,${dy.toFixed(1)}px,0) scale(1.02)`;
      const cy = mid0 + dy;
      let nt = idx;
      for (let i = 0; i < items.length; i++) {
        if (i === idx) continue;
        const m = rects[i].top + rects[i].height / 2;
        if (i > idx && cy > m) nt = Math.max(nt, i);
        if (i < idx && cy < m) nt = Math.min(nt, i);
      }
      if (nt !== to) { to = nt; buzz('tick'); for (let i = 0; i < items.length; i++) { if (i === idx) continue; const s = idx < to && i > idx && i <= to ? -step : idx > to && i >= to && i < idx ? step : 0; items[i].style.transform = s ? `translate3d(0,${s}px,0)` : ''; } }
      // nudge the list when the finger nears an edge
      const br = TS.bodyRect;
      if (br) { const edge = 48; if (lastY < br.top + edge) { body.scrollTop -= 8; raf = raf || requestAnimationFrame(apply); } else if (lastY > br.bottom - edge) { body.scrollTop += 8; raf = raf || requestAnimationFrame(apply); } }
    };
    TS.bodyRect = body.getBoundingClientRect();
    const mv = (ev) => { if (ev.pointerId !== e.pointerId) return; lastY = ev.clientY; if (!raf) raf = requestAnimationFrame(apply); };
    const upf = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', upf); handle.removeEventListener('pointercancel', upf);
      cancelAnimationFrame(raf); TS.dragging = false;
      if (!TS.list) return;
      TS.list.classList.remove('ui-sorting'); li.classList.remove('ui-lift');
      for (const x of items) x.style.transform = '';
      if (to !== idx) { moveTo(t.id, to); sfx('tap', { vol: 0.5 }); }
      tasksFill();
    };
    handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', upf); handle.addEventListener('pointercancel', upf);
  }
  function laterRow(r) {
    const R = rogueOf(r.kind);
    const li = h('li', { class: 'ui-later', style: `--sig:${R.sig}`, 'data-id': r.id },
      h('span', { class: 'ui-lart' }, rogueArt(r.kind, 'ui-lsp', 44)),
      h('span', { class: 'ui-lmain' }, h('span', { class: 'ui-ltxt' }, r.note), h('span', { class: 'ui-lmeta' }, h('b', null, R.name), ' · ' + ago(r.at))),
      h('button', { class: 'ui-lbtn', type: 'button', 'aria-label': W.toTask(r.note), title: TOUCH ? null : W.toTask(r.note), html: ICON('plus'), onclick: () => {
        E('addTask', r.note.slice(0, 140), 1); E('resolveRogue', r.id, true); toast(W.toTaskDone, { icon: 'tasks', sub: r.note, color: 'var(--accent)', ms: 2400 , urgent: true });
      } }),
      h('button', { class: 'ui-ship ui-lres', type: 'button', 'aria-label': W.resolve(r.note), title: TOUCH ? null : W.resolve(r.note), html: CHECKRING, onclick: (e) => {
        const b = e.currentTarget; b.classList.add('ui-on'); li.classList.add('ui-gone'); sfx('tap');
        setTimeout(() => { E('resolveRogue', r.id, true); pushToast({ kind: 'undo', urgent: true, icon: 'check', text: W.resolved, sub: r.note, action: { label: W.undo, fn: () => E('resolveRogue', r.id, false) }, ms: 4200 }); }, RM() ? 0 : 260);
      } }));
    return li;
  }
  function tasksFill() {
    if (!TS.list || !DB || TS.editing || TS.dragging) return;
    const t0 = now();
    if (t0 < TS.hold) { clearTimeout(TS.ht); TS.ht = setTimeout(tasksFill, TS.hold - t0 + 10); return; }
    const hide = pend ? pend.ids : [];
    const all = DB.tasks.filter((t) => hide.indexOf(t.id) < 0);
    const open = all.filter((t) => !t.doneAt), done = all.filter((t) => t.doneAt);
    TS.list.textContent = '';
    if (!open.length) TS.list.appendChild(h('li', { class: 'ui-empty' }, h('span', { class: 'ui-emptyart', html: MINI_TOMATO }), h('span', null, W.noTasks)));
    open.forEach((t, i) => TS.list.appendChild(taskRow(t, i, open.length)));
    TS.fresh = null;
    TS.doneWrap.hidden = !done.length;
    TS.doneHead.firstChild.textContent = `${TEXT.ui.shipped} · ${done.length}`;
    TS.doneList.textContent = '';
    const dsorted = done.slice().sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)), dcap = TS.allDone ? dsorted.length : 6;
    for (const t of dsorted.slice(0, dcap)) TS.doneList.appendChild(doneRow(t));
    if (dsorted.length > dcap) TS.doneList.appendChild(h('li', { class: 'ui-more' }, h('button', { class: 'ui-link', type: 'button', onclick: () => { TS.allDone = true; tasksFill(); } }, W.showAll(dsorted.length))));
    const later = (E('openRogues') || []).slice().sort((a, b) => b.at - a.at);
    TS.later.hidden = !later.length && !TS.showLater;
    TS.laterHead.firstChild.textContent = later.length ? `${TEXT.ui.later} · ${later.length}` : TEXT.ui.later;
    TS.laterList.textContent = '';
    if (!later.length) TS.laterList.appendChild(h('li', { class: 'ui-empty ui-empty-s' }, W.laterEmpty));
    const cap = TS.allLater ? later.length : 10;
    for (const r of later.slice(0, cap)) TS.laterList.appendChild(laterRow(r));
    if (later.length > cap) TS.laterList.appendChild(h('li', { class: 'ui-more' }, h('button', { class: 'ui-link', type: 'button', onclick: () => { TS.allLater = true; tasksFill(); } }, W.showAll(later.length))));
  }
  function markActive() {
    if (!TS.list || TS.editing) return;
    for (const li of TS.list.querySelectorAll(':scope > .ui-task')) {
      const id = li.getAttribute('data-id'), t = DB.tasks.find((x) => x.id === id), on = id === DB.activeTask;
      if (!t || li.classList.contains('ui-act') === on) continue;
      li.classList.toggle('ui-act', on);
      const main = li.querySelector('.ui-tmain'); if (!main) continue;
      main.setAttribute('aria-pressed', String(on));
      main.setAttribute('aria-label', (on ? W.stop(t.title) : W.work(t.title)) + `, ${t.done} of ${W.estN(t.est)}`);
      const lab = main.querySelector('.ui-tnow');
      if (on && !lab) main.insertBefore(h('span', { class: 'ui-tnow' }, TEXT.ui.workingOn), main.firstChild);
      if (!on && lab) lab.remove();
    }
  }
  function scrollToLater() {
    TS.showLater = true; tasksFill();
    frames2(() => {
      if (!TS.later || !TS.later.isConnected) return;
      const top = Math.max(0, TS.later.offsetTop - 8);
      try { TS.body.scrollTo({ top, behavior: RM() ? 'auto' : 'smooth' }); } catch (e) { TS.body.scrollTop = top; }
      TS.later.classList.remove('ui-flash'); void TS.later.offsetWidth; TS.later.classList.add('ui-flash');
    });
  }
  SHEET.def('tasks', {
    title: TEXT.ui.tasks, size: 'tall',
    render(body, arg) {
      TS.body = body; TS.showLater = !!(arg && arg.section === 'later');
      TS.input = h('input', { class: 'ui-in', type: 'text', placeholder: TEXT.ui.addTask, 'aria-label': TEXT.ui.addTask, maxlength: '140', autocomplete: 'off', enterkeyhint: 'done', spellcheck: 'true' });
      const go = h('button', { class: 'ui-addgo', type: 'submit', 'aria-label': W.addAria, html: ICON('plus') });
      const form = h('form', { class: 'ui-add' }, h('div', { class: 'ui-addrow' }, TS.input, go), estPicker());
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = TS.input.value.trim();
        if (!v) { TS.input.focus(); form.classList.remove('ui-nudge'); void form.offsetWidth; form.classList.add('ui-nudge'); return; }
        const t = E('addTask', v.slice(0, 140), TS.est);
        if (t && t.id) TS.fresh = t.id;
        TS.input.value = ''; buzz('tick');
        if (TS.estSet) TS.estSet(1, true);
        if (!TOUCH) TS.input.focus();
        tasksFill();
      });
      TS.list = h('ol', { class: 'ui-tasks', 'aria-label': W.queue });
      TS.doneHead = sec(TEXT.ui.shipped, h('button', { class: 'ui-link', type: 'button', onclick: () => { const d = DB.tasks.filter((t) => t.doneAt && !(pend && pend.ids.indexOf(t.id) >= 0)); removeTasks(d, W.cleared(d.length), true); } }, TEXT.ui.clearShipped));
      TS.doneList = h('ol', { class: 'ui-tasks ui-donelist' });
      TS.doneWrap = h('section', { class: 'ui-sec' }, TS.doneHead, TS.doneList);
      TS.laterHead = sec(TEXT.ui.later);
      TS.laterList = h('ul', { class: 'ui-laters' });
      TS.later = h('section', { class: 'ui-sec ui-latersec', 'aria-label': TEXT.ui.later }, TS.laterHead, h('p', { class: 'ui-hint' }, W.laterLead), TS.laterList);
      body.append(form, TS.list, TS.doneWrap, TS.later);
      tasksFill();
    },
    focus() { return TS.input; },
    opened(arg) { if (arg && arg.section === 'later') scrollToLater(); },
    retarget(arg) { if (arg && arg.section === 'later') scrollToLater(); },
    refresh() { tasksFill(); },
    esc() { return finishEdit(false); },
    swap() { swapRogues(TS.laterList); },
    closed() { if (TS.editing) finishEdit(true); clearTimeout(TS.ht); TS.hold = 0; TS.list = null; TS.body = null; TS.showLater = false; TS.allLater = false; TS.allDone = false; },
  });

  // ════════════════════════════════════ Patches ════════════════════════════════════
  const PS = { body: null, grid: null, hood: null, cap: null, detail: null, seen: 0 };
  // the hoodie: Patch's slate hoodie with its </> print; four spots, oldest patch first
  const HOOD_SLOTS = [[36.5, 45], [63.5, 45], [14.5, 70], [85.5, 70]];   // % of the art box (left chest, right chest, sleeves)
  const HOODIE_ART = `<svg viewBox="0 0 320 160" class="ui-hoodart" aria-hidden="true"><defs><linearGradient id="ui-hg" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#5f6889"/><stop offset=".5" stop-color="#3f455f"/><stop offset="1" stop-color="#2a2e43"/></linearGradient></defs>
    <path d="M116 42C104 6 216 6 204 42Z" fill="#30354d" stroke="#3d4c95" stroke-width="4" stroke-linejoin="round"/><path d="M130 38C126 16 194 16 190 38Z" fill="#1c2031"/>
    <path d="M124 34 86 46C62 54 44 80 30 118L21 141 50 151 70 106 89 92 92 157H228L231 92 250 106 270 151 299 141 290 118C276 80 258 54 234 46L196 34C184 52 136 52 124 34Z" fill="url(#ui-hg)" stroke="#3d4c95" stroke-width="5" stroke-linejoin="round"/>
    <path d="M24 133 52 143 50 151 21 141ZM296 133 268 143 270 151 299 141ZM92 145H228V157H92Z" fill="#2a2e43"/><path d="M27 137l23 8M293 137l-23 8M96 151h128" stroke="#4a5170" stroke-width="1.6" stroke-dasharray="2 3"/>
    <path d="M70 106 89 92M250 106 231 92" stroke="#2a2e43" stroke-width="3" stroke-linecap="round"/>
    <path d="M118 116H202L212 145H108Z" fill="#363b53"/><path d="M118 116H202" stroke="#4a5170" stroke-width="2"/>
    <path d="M124 34C136 52 184 52 196 34" fill="none" stroke="#4d5576" stroke-width="7" stroke-linecap="round"/>
    <path d="M147 48 145 82M173 48 175 82" stroke="#c9d2e8" stroke-width="2.6" stroke-linecap="round"/><circle cx="145" cy="84" r="3.2" fill="#3dffc2"/><circle cx="175" cy="84" r="3.2" fill="#3dffc2"/>
    <text x="160" y="108" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="17" fill="#3dffc2">&lt;/&gt;</text>
    <path d="M84 50C62 58 46 82 33 116" stroke="#a9bcff" stroke-width="2.4" fill="none" opacity=".35" stroke-linecap="round"/></svg>`;
  function hoodFill() {
    if (!PS.hood) return;
    const worn = (DB.hoodie || []).filter((id) => DB.patches[id]);
    for (const el of PS.hood.querySelectorAll('.ui-slot')) el.remove();
    HOOD_SLOTS.forEach(([x, y], i) => {
      const id = worn[i], p = id && PATCHDEF(id);
      const el = p ? h('button', { class: 'ui-slot ui-worn', type: 'button', style: `left:${x}%;top:${y}%`, 'data-id': id, 'aria-label': `${p.name}, ${W.onHoodie}`, onclick: () => detail(id) }, badgeImg(id, '', 52))
        : h('span', { class: 'ui-slot', style: `left:${x}%;top:${y}%`, role: 'img', 'aria-label': W.slot });
      PS.hood.appendChild(el);
    });
    if (PS.cap) PS.cap.textContent = W.worn(worn.length);
  }
  function patchesFill() {
    if (!PS.grid || !DB) return;
    const got = TEXT.patches.filter((p) => DB.patches[p.id]).length;
    PS.have.textContent = W.have(got, TEXT.patches.length);
    PS.grid.textContent = '';
    for (const p of TEXT.patches) {
      const at = DB.patches[p.id], worn = (DB.hoodie || []).indexOf(p.id) >= 0, isNew = at && at > PS.seen;
      const b = h('button', { class: 'ui-pc' + (at ? '' : ' ui-locked') + (worn ? ' ui-worn' : '') + (isNew ? ' ui-new' : '') + (isNew && PS.firstFill ? ' ui-newanim' : ''), type: 'button', style: `--pc:${p.color}`, 'data-id': p.id,
        'aria-label': at ? W.patchAria(p.name, W.unlocked(fmtDay(at, true))) + (worn ? ', ' + W.onHoodie : '') : W.lockedAria(p.name), title: TOUCH ? null : p.desc, onclick: () => detail(p.id) },
        h('span', { class: 'ui-pcb' }, at ? badgeImg(p.id, '', 64) : h('span', { class: 'ui-ghostb' }, badgeImg(p.id, '', 64)), worn ? h('span', { class: 'ui-pin', html: ICON('check') }) : null, isNew ? h('span', { class: 'ui-newtag' }, W.isNew) : null),
        h('span', { class: 'ui-pcn' }, p.name), h('span', { class: 'ui-pcd' }, at ? fmtDay(at) : TEXT.ui.locked));
      PS.grid.appendChild(b);
    }
    PS.firstFill = false;
    hoodFill();
  }
  function detail(id) {
    const p = PATCHDEF(id); if (!p || !PS.body) return;
    closeDetail(true);
    const opener = document.activeElement;
    const at = DB.patches[id], worn = () => (DB.hoodie || []).indexOf(id) >= 0;
    const big = h('span', { class: 'ui-pdb' + (at ? '' : ' ui-locked') }, at ? badgeImg(id, '', 132) : h('span', { class: 'ui-ghostb' }, badgeImg(id, '', 132)));
    const note = h('p', { class: 'ui-pdnote', 'aria-live': 'polite' });
    const act = h('button', { class: 'ui-btn ui-primary ui-wide', type: 'button' });
    const sync = () => {
      const w = worn(), full = (DB.hoodie || []).length >= 4;
      act.textContent = w ? TEXT.ui.unpick : TEXT.ui.sewOn;
      act.className = 'ui-btn ui-wide ' + (w ? 'ui-ghost' : 'ui-primary');
      act.disabled = !at || (!w && full);
      note.textContent = !at ? '' : (!w && full) ? TEXT.ui.hoodieFull : '';
    };
    act.onclick = () => {
      const was = worn(), from = big.getBoundingClientRect();
      if (!E('hoodieToggle', id)) { sync(); note.textContent = TEXT.ui.hoodieFull; return; }
      buzz('tick');
      hoodFill(); patchesFillQuiet();
      if (!was) { closeDetail(); flySew(id, from); } else sync();
    };
    const card = h('div', { class: 'ui-pdcard', role: 'group', 'aria-label': p.name, style: `--pc:${p.color}` },
      h('button', { class: 'ui-x ui-pdx', type: 'button', 'aria-label': W.back, html: ICON('close'), onclick: () => closeDetail() }),
      big, h('h3', { class: 'ui-pdname' }, p.name), h('p', { class: 'ui-pddesc' }, at ? p.desc : h('span', null, h('b', null, W.howTo + ': '), p.desc)),
      h('p', { class: 'ui-pdwhen' }, at ? W.unlocked(fmtDay(at, true)) : TEXT.ui.locked), act, note);
    PS.detail = h('div', { class: 'ui-pd', 'data-hit': '', 'data-id': id }, h('div', { class: 'ui-pdback', onclick: () => closeDetail() }), card);
    PS.detailOpener = opener && opener !== document.body && cur.panel.contains(opener) && !opener.closest('.ui-pd') ? opener : null;
    sync();
    cur.panel.appendChild(PS.detail);
    frames2(() => PS.detail && PS.detail.classList.add('ui-on'));
    try { (at ? act : card.querySelector('.ui-pdx')).focus({ preventScroll: true }); } catch (e) {}
  }
  function closeDetail(instant) {
    const d = PS.detail; if (!d) return false;
    PS.detail = null;
    const id = d.getAttribute('data-id');
    if (instant || RM()) d.remove(); else { d.classList.remove('ui-on'); setTimeout(() => d.remove(), 260); }
    const op = PS.detailOpener && PS.detailOpener.isConnected ? PS.detailOpener : null;
    const back = op || (PS.grid && PS.grid.querySelector(`.ui-pc[data-id="${id}"]`)) || (PS.hood && PS.hood.querySelector(`.ui-slot[data-id="${id}"]`));
    PS.detailOpener = null;
    if (back && !instant) try { back.focus({ preventScroll: true }); } catch (e) {}
    return true;
  }
  function patchesFillQuiet() { const sc = PS.body ? PS.body.scrollTop : 0; patchesFill(); if (PS.body) PS.body.scrollTop = sc; }
  // the badge flies from the detail card onto its spot on the hoodie
  function flySew(id, from) {
    const slot = PS.hood && PS.hood.querySelector(`.ui-slot[data-id="${id}"]`);
    if (!slot || RM() || !from || !from.width) return;
    const to = slot.getBoundingClientRect();
    const ghost = h('img', { class: 'ui-fly', src: badgeURL(id), alt: '', style: `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px` });
    slot.classList.add('ui-await');
    host.appendChild(ghost);
    const s = to.width / from.width, dx = to.left - from.left, dy = to.top - from.top;
    frames2(() => { ghost.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${s}) rotate(-8deg)`; });
    setTimeout(() => { ghost.remove(); slot.classList.remove('ui-await'); slot.classList.add('ui-landed'); }, 560);
  }
  SHEET.def('patches', {
    title: TEXT.ui.patches, size: 'tall',
    render(body) {
      PS.body = body; PS.seen = ST.seenAt || 0; PS.firstFill = true;
      PS.hood = h('div', { class: 'ui-hood', html: HOODIE_ART });
      PS.cap = h('span', { class: 'ui-hoodcap' });
      PS.have = h('span', { class: 'ui-have' });
      PS.grid = h('div', { class: 'ui-pgrid' });
      body.append(h('div', { class: 'ui-hoodwrap' }, PS.hood, h('div', { class: 'ui-hoodmeta' }, h('b', null, W.hoodie), PS.cap)), sec(TEXT.ui.patches, PS.have), PS.grid);
      patchesFill();
    },
    opened(arg) { ST.seenAt = Date.now(); saveST(); refreshDock(); if (arg && arg.id) detail(arg.id); },
    retarget(arg) { if (arg && arg.id) detail(arg.id); },
    refresh() { patchesFillQuiet(); },
    esc() { return closeDetail(); },
    closed() { PS.detail = null; PS.grid = null; PS.hood = null; PS.body = null; ST.seenAt = Date.now(); saveST(); refreshDock(); },
  });

  // ════════════════════════════════════ Settings ════════════════════════════════════
  const CTRL = Object.create(null);           // setting key → sync()
  function rowLabel(key) { const [l, s] = SET[key] || [key]; return h('span', { class: 'ui-rl' }, h('span', { class: 'ui-rt' }, l), s ? h('span', { class: 'ui-rs', 'data-sub': key }, s) : null); }
  function switchRow(key, onFlip) {
    const b = h('button', { class: 'ui-row ui-sw', type: 'button', role: 'switch' }, rowLabel(key), h('span', { class: 'ui-swt', 'aria-hidden': 'true' }, h('i')));
    const sync = () => b.setAttribute('aria-checked', String(!!sets()[key]));
    b.onclick = () => { const v = !sets()[key]; if (onFlip) onFlip(v, sync); else { E('setSetting', key, v); sfx('toggle'); buzz('tick'); } sync(); };
    CTRL[key] = sync; sync();
    return b;
  }
  function stepperRow(key, unit) {
    const [min, max] = RANGE[key];
    const val = h('span', { class: 'ui-sv', role: 'spinbutton', tabindex: '0', 'aria-label': SET[key][0], 'aria-valuemin': String(min), 'aria-valuemax': String(max) });
    const minus = h('button', { class: 'ui-step', type: 'button', tabindex: '-1', 'aria-label': 'Less', html: ICON('minus') });
    const plus = h('button', { class: 'ui-step', type: 'button', tabindex: '-1', 'aria-label': 'More', html: ICON('plus') });
    const sync = () => {
      const v = sets()[key];
      val.innerHTML = ''; val.append(h('b', null, String(v)), h('small', null, unit(v)));
      val.setAttribute('aria-valuenow', String(v)); val.setAttribute('aria-valuetext', `${v} ${unit(v)}`);
      minus.disabled = v <= min; plus.disabled = v >= max;
    };
    const set = (v) => { v = clamp(Math.round(v), min, max); if (v === sets()[key]) return false; E('setSetting', key, v); sync(); sfx('tap', { vol: 0.35 }); buzz('tick'); return true; };
    let hold = 0, acted = false;
    const repeat = (d) => { let n = 0; const go = () => { if (!set(sets()[key] + d)) return; acted = true; n++; hold = setTimeout(go, n > 6 ? 55 : 120); }; hold = setTimeout(go, 420); };
    const stop = () => clearTimeout(hold);
    for (const [b, d] of [[minus, -1], [plus, 1]]) {
      b.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        acted = false; stop();
        if (e.pointerType === 'mouse') { e.preventDefault(); set(sets()[key] + d); acted = true; }
        repeat(d);
      });
      b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
      b.addEventListener('click', () => { if (acted) { acted = false; return; } set(sets()[key] + d); });   // a tap, or Enter / Space
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    val.addEventListener('keydown', (e) => {
      const v = sets()[key], k = e.key;
      const nv = k === 'ArrowUp' || k === 'ArrowRight' ? v + 1 : k === 'ArrowDown' || k === 'ArrowLeft' ? v - 1 : k === 'PageUp' ? v + 5 : k === 'PageDown' ? v - 5 : k === 'Home' ? min : k === 'End' ? max : null;
      if (nv === null) return; e.preventDefault(); e.stopPropagation(); set(nv);
    });
    CTRL[key] = sync; sync();
    return h('div', { class: 'ui-row' }, rowLabel(key), h('span', { class: 'ui-stepper' }, minus, val, plus));
  }
  function segRow(key, onPick, extra) {
    const opts = OPTS[key], group = h('div', { class: 'ui-seg', role: 'radiogroup', 'aria-label': SET[key][0], style: `--n:${opts.length}` });
    const thumb = h('i', { class: 'ui-segthumb', 'aria-hidden': 'true' });
    group.appendChild(thumb);
    const btns = opts.map(([v, label], i) => {
      const b = h('button', { class: 'ui-segb', type: 'button', role: 'radio', 'data-v': v }, label);
      b.onclick = () => { if (sets()[key] !== v) { E('setSetting', key, v); sfx('toggle'); buzz('tick'); } sync(); if (onPick) onPick(v); };
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return; e.preventDefault(); e.stopPropagation();
        const j = (i + d + opts.length) % opts.length; btns[j].click(); btns[j].focus();
      });
      group.appendChild(b); return b;
    });
    const sync = () => {
      const v = sets()[key], i = Math.max(0, opts.findIndex((o) => o[0] === v));
      group.style.setProperty('--i', String(i));
      btns.forEach((b, j) => { b.setAttribute('aria-checked', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    };
    CTRL[key] = sync; sync();
    return h('div', { class: 'ui-row ui-stack' }, h('span', { class: 'ui-rrow' }, rowLabel(key), extra || null), group);
  }
  function sliderRow(key) {
    const inp = h('input', { class: 'ui-range', type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': SET[key][0] });
    const out = h('span', { class: 'ui-rv' });
    let raf = 0, pending = null;
    const sync = () => { const v = +sets()[key] || 0; if (document.activeElement !== inp) inp.value = String(v); inp.style.setProperty('--v', Math.round(v * 100) + '%'); out.textContent = Math.round(v * 100) + '%'; };
    inp.addEventListener('input', () => {
      pending = +inp.value; inp.style.setProperty('--v', Math.round(pending * 100) + '%'); out.textContent = Math.round(pending * 100) + '%';
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pending !== null) { E('setSetting', key, pending); pending = null; } });
    });
    inp.addEventListener('change', () => { E('setSetting', key, +inp.value); sync(); });
    CTRL[key] = sync; sync();
    return h('div', { class: 'ui-row ui-stack' }, h('span', { class: 'ui-rrow' }, rowLabel(key), out), inp);
  }
  function actRow(icon, label, fn, cls) {
    return h('button', { class: 'ui-row ui-act ' + (cls || ''), type: 'button', onclick: fn }, h('span', { class: 'ui-ai', html: typeof icon === 'string' && icon.indexOf('<') === 0 ? icon : ICON(icon) }), h('span', { class: 'ui-rt' }, label), h('span', { class: 'ui-chev', html: ICON('right') }));
  }
  const group = (title, ...rows) => h('section', { class: 'ui-group' }, h('h3', { class: 'ui-gt' }, title), h('div', { class: 'ui-card' }, rows));
  function notifySub() {
    let s = SET.notify[1];
    try {
      if (!('Notification' in window)) s = W.notifyNone;
      else if (Notification.permission === 'denied') s = W.notifyBlocked;
    } catch (e) {}
    return s;
  }
  function stampName(ext) { return `patchs-pomodoro-${dateKey()}.${ext}`; }
  function doImport(file) {
    if (!file) return;
    const read = file.text ? file.text() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(file); });
    read.then((text) => confirmBox(W.replaceQ, { ok: W.replace, danger: true }).then((yes) => {
      if (!yes) return;
      const r = E('importJSON', text) || { ok: false };
      if (r.ok) { sfx('chime'); toast(W.imported((DB.sessions || []).length), { icon: 'upload', color: 'var(--accent)' , urgent: true }); }
      else { sfx('error'); buzz('error'); toast(r.error || W.importFail, { icon: 'info', color: 'var(--tomato)', ms: 4200 , urgent: true }); }
    })).catch((e) => { reportErr('ui:import', e); toast(W.importFail, { icon: 'info', color: 'var(--tomato)' , urgent: true }); });
  }
  SHEET.def('settings', {
    title: TEXT.ui.settings, size: 'tall',
    render(body) {
      for (const k in CTRL) delete CTRL[k];
      const mins = (v) => (v === 1 ? 'min' : 'min'), toms = (v) => (v === 1 ? 'tomato' : 'tomatoes');
      const file = h('input', { type: 'file', accept: '.json,application/json', class: 'ui-file', tabindex: '-1', 'aria-hidden': 'true' });
      file.addEventListener('change', () => { const f = file.files && file.files[0]; file.value = ''; doImport(f); });
      const notify = switchRow('notify', (v, sync) => {
        if (!v) { E('setSetting', 'notify', false); sfx('toggle'); sync(); return; }
        const p = E('requestNotify');
        const finish = (perm) => { E('setSetting', 'notify', perm === 'granted'); sync(); const s = body.querySelector('[data-sub="notify"]'); if (s) s.textContent = perm === 'granted' ? SET.notify[1] : notifySub(); if (perm === 'granted') sfx('toggle'); };
        if (p && typeof p.then === 'function') p.then(finish, () => finish('denied')); else finish('default');
      });
      const nsub = notify.querySelector('[data-sub="notify"]'); if (nsub) nsub.textContent = notifySub();
      const prev = h('button', { class: 'ui-chip', type: 'button', onclick: () => { const m = sets().music; try1(Snd, 'preview', m === 'off' ? 'lofi' : m); } }, h('span', { html: PLAY }), W.preview);
      const about = h('div', { class: 'ui-about' },
        h('div', { class: 'ui-aboutmark' }, h('b', null, TEXT.app.name), h('span', null, W.version(VERSION) + (typeof BUILD !== 'undefined' ? ' · ' + BUILD : ''))),
        h('p', null, TEXT.app.tagline), h('p', { class: 'ui-hint' }, TEXT.app.credit),
        h('a', { class: 'ui-btn ui-ghost ui-sitebtn', href: TEXT.app.site, target: '_blank', rel: 'noopener' }, W.site, h('span', { html: ARROW_UP_RIGHT })));
      body.append(
        group('Timer', stepperRow('focusMin', mins), stepperRow('shortMin', mins), stepperRow('longMin', mins), stepperRow('longEvery', toms), stepperRow('dailyGoal', toms), switchRow('autoBreak'), switchRow('autoFocus')),
        group('Sound', switchRow('sound', (v) => { E('setSetting', 'sound', v); if (v) try1(Snd, 'mute', false); refreshMute(); sfx('toggle'); }), sliderRow('volume'), segRow('music', null, prev), sliderRow('musicVol'), switchRow('tick'), switchRow('haptics')),
        group('Patch', switchRow('talk'), switchRow('reflect'), segRow('weather')),
        group('Display', segRow('theme'), segRow('motion'), segRow('quality'), switchRow('wakeLock'), notify),
        group('Data',
          actRow('download', TEXT.ui.exportJSON, () => { const s = E('exportJSON'); if (s && download(stampName('json'), s, 'application/json')) toast(W.saved, { icon: 'download', sub: stampName('json'), color: 'var(--accent)', ms: 2600 , urgent: true }); }),
          actRow('download', TEXT.ui.exportCSV, () => { const s = E('exportCSV'); if (s && download(stampName('csv'), s, 'text/csv')) toast(W.saved, { icon: 'download', sub: stampName('csv'), color: 'var(--accent)', ms: 2600 , urgent: true }); }),
          actRow('upload', TEXT.ui.importJSON, () => file.click()),
          actRow('keyboard', W.keys, () => open('help')),
          actRow('trash', TEXT.ui.clearAll, () => confirmBox(TEXT.ui.confirmClear, { ok: W.wipe, danger: true }).then((yes) => {
            if (!yes) return;
            commitPend(); E('clearAll'); sfx('whoosh'); toast(W.wiped, { icon: 'trash', ms: 3000 , urgent: true });
          }), 'ui-dangerrow')),
        group(W.about, about), file);
    },
    sync(key) { if (!key) { for (const k in CTRL) CTRL[k](); } else if (CTRL[key]) CTRL[key](); },
    closed() { for (const k in CTRL) delete CTRL[k]; },
  });

  // ════════════════════════════════════ Capture: name the rogue that tried it ════════════════════════════════════
  const CS = { pick: null, cards: [], go: null, note: null, grid: null };
  function capPick(kind, go) {
    if (CS.pick === kind && go) return capGo();
    CS.pick = kind;
    for (const b of CS.cards) { const on = b.getAttribute('data-k') === kind; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; b.classList.toggle('ui-on', on); }
    if (CS.go) CS.go.disabled = !kind;
    sfx('tap', { vol: 0.5 }); buzz('tick');
  }
  function capGo() {
    if (!CS.pick) return;
    const note = CS.note ? CS.note.value.trim().slice(0, 200) : '';
    E('captureRogue', CS.pick, note);
    close();
  }
  SHEET.def('capture', {
    title: TEXT.ui.quarantine, size: 'auto',
    render(body) {
      CS.pick = null; CS.cards = [];
      CS.grid = h('div', { class: 'ui-rgrid', role: 'radiogroup', 'aria-label': TEXT.ui.captureQ });
      TEXT.rogues.forEach((r, i) => {
        const b = h('button', { class: 'ui-rc', type: 'button', role: 'radio', 'aria-checked': 'false', tabindex: i ? '-1' : '0', 'data-k': r.id, style: `--sig:${r.sig}`, 'aria-label': W.pick(r.name, r.what) + '. ' + r.examples },
          h('span', { class: 'ui-rstage' }, rogueArt(r.id, 'ui-rsp', 76), h('kbd', { class: 'ui-rkey', 'aria-hidden': 'true' }, String(i + 1))),
          h('span', { class: 'ui-rinfo' }, h('b', { class: 'ui-rname' }, r.name), h('span', { class: 'ui-rwhat' }, r.what), h('span', { class: 'ui-rex' }, r.examples)),
          h('span', { class: 'ui-rcheck', html: ICON('check') }));
        b.onclick = () => capPick(r.id, true);
        b.addEventListener('keydown', (e) => {
          const k = e.key, cols = Math.max(1, (getComputedStyle(CS.grid).gridTemplateColumns || '').split(' ').filter(Boolean).length || 2);
          const d = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'ArrowDown' ? cols : k === 'ArrowUp' ? -cols : 0;
          if (!d) return; e.preventDefault(); e.stopPropagation();
          const j = clamp(i + d, 0, CS.cards.length - 1); CS.cards[j].focus(); capPick(TEXT.rogues[j].id);
        });
        CS.cards.push(b); CS.grid.appendChild(b);
      });
      CS.note = h('input', { class: 'ui-in', type: 'text', placeholder: TEXT.ui.captureNote, 'aria-label': TEXT.ui.captureNote, maxlength: '200', autocomplete: 'off', enterkeyhint: 'go' });
      CS.note.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); capGo(); } });
      CS.go = h('button', { class: 'ui-btn ui-primary ui-go', type: 'button', disabled: true, onclick: capGo }, h('span', { html: JAR }), TEXT.ui.captureGo);
      body.append(h('p', { class: 'ui-lead' }, TEXT.ui.captureQ), CS.grid);
      body.after(h('div', { class: 'ui-foot ui-capfoot' }, CS.note, CS.go));
    },
    focus() { return CS.cards[0]; },
    key(e) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= TEXT.rogues.length && !e.shiftKey) { capPick(TEXT.rogues[n - 1].id); CS.cards[n - 1].focus(); return true; }
      return false;
    },
    swap() { if (CS.grid) swapRogues(CS.grid); },
    closed() { CS.cards = []; CS.grid = null; CS.note = null; CS.go = null; },
  });

  // ════════════════════════════════════ Reflect: how did that one go? ════════════════════════════════════
  const FACES = {
    2: '<path d="M14 18c-6.6 0-12 3.9-12 9.6S7.2 38 14 38s12-4.7 12-10.4S20.6 18 14 18z" transform="translate(10 4)" fill="#ff4a3d"/><path d="M18 31.5c2-1.6 4-1.6 6 0" stroke="#3a0f0a" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M28 31.5c2-1.6 4-1.6 6 0" stroke="#3a0f0a" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M21 38.5q2.5-2 5 0t5 0" stroke="#3a0f0a" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M29 24l6 6M35 24l-6 6" stroke="#fff4e2" stroke-width="3.4" stroke-linecap="round"/><path d="M36.5 18.5c1.6 2.4 1.6 4 0 5.2-1.6-1.2-1.6-2.8 0-5.2z" fill="#8fe0ff"/>',
    3: '<path d="M24 20c-6.6 0-12 3.9-12 9.6S17.2 40 24 40s12-4.7 12-10.4S30.6 20 24 20z" fill="#ff4a3d"/><circle cx="20" cy="30" r="1.8" fill="#3a0f0a"/><circle cx="28" cy="30" r="1.8" fill="#3a0f0a"/><path d="M20.5 34.5q3.5 2.4 7 0" stroke="#3a0f0a" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    5: '<path d="M24 20c-6.6 0-12 3.9-12 9.6S17.2 40 24 40s12-4.7 12-10.4S30.6 20 24 20z" fill="#ff4a3d"/><path d="M17.5 30.5q2.5-2.6 5 0M25.5 30.5q2.5-2.6 5 0" stroke="#3a0f0a" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M19.5 34q4.5 4 9 0" stroke="#3a0f0a" stroke-width="2.2" fill="#3a0f0a" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 31v-4a13.5 13.5 0 0 1 27 0v4" stroke="#262a46" stroke-width="3" fill="none"/><rect x="8" y="27" width="5.5" height="9" rx="2.5" fill="#262a46"/><rect x="34.5" y="27" width="5.5" height="9" rx="2.5" fill="#262a46"/><rect x="9.5" y="29" width="2" height="5" rx="1" fill="#3dffc2"/><rect x="36.5" y="29" width="2" height="5" rx="1" fill="#3dffc2"/><path d="M40 12l1.2 2.8 2.8 1.2-2.8 1.2L40 20l-1.2-2.8L36 16l2.8-1.2zM8 10l.8 1.8 1.8.8-1.8.8L8 15.2l-.8-1.8-1.8-.8 1.8-.8z" fill="#f5c542"/>',
  };
  const faceSVG = (v) => `<svg viewBox="5 7 38 38" class="ui-face" aria-hidden="true"><ellipse cx="24" cy="43.5" rx="11" ry="2" fill="#000" opacity=".2"/>${FACES[v]}<path d="M24 22.6l-3.4-2 2.2-.2.9-2.4 1 2.3 2.4.2z" fill="#2fbf71"/></svg>`;
  const RS = { t: 0, sess: null, bar: null, live: false };
  function reflectStop() { if (!RS.live) return; RS.live = false; clearTimeout(RS.t); if (RS.bar) RS.bar.classList.add('ui-stop'); }
  SHEET.def('reflect', {
    title: TEXT.ui.reflectQ, size: 'auto',
    render(body, arg) {
      RS.sess = arg && arg.session ? arg.session : null;
      const note = h('textarea', { class: 'ui-in ui-ta', rows: '2', maxlength: '280', placeholder: W.reflectNote, 'aria-label': W.reflectNote });
      const rate = (v, b) => {
        reflectStop();
        for (const x of body.querySelectorAll('.ui-rate')) x.classList.toggle('ui-on', x === b);
        if (RS.sess) E('rateSession', RS.sess.id, v, note.value.trim());
        sfx('tap'); buzz('tick');
        setTimeout(() => { if (cur && cur.id === 'reflect') close(); }, RM() ? 120 : 420);
      };
      const row = h('div', { class: 'ui-rates' }, TEXT.ui.reflect.map((o) => {
        const b = h('button', { class: 'ui-rate ui-r' + o.v, type: 'button' }, h('span', { html: faceSVG(o.v) }), h('b', null, o.label));
        b.onclick = () => rate(o.v, b); return b;
      }));
      RS.bar = h('i', { class: 'ui-rbar', 'aria-hidden': 'true' });
      const meta = RS.sess ? h('p', { class: 'ui-hint ui-rmeta' }, `${TEXT.modes.focus.label} · ${hm(RS.sess.actual || RS.sess.planned || 0)}` + (RS.sess.rogues ? ` · ${plural(RS.sess.rogues, 'rogue')} quarantined` : '')) : null;
      body.append(meta, row, note, RS.bar);
    },
    opened() {
      RS.live = true; clearTimeout(RS.t);
      const c = cur;
      frames2(() => { if (RS.bar && RS.live) RS.bar.classList.add('ui-run'); });
      RS.t = setTimeout(() => { if (cur === c && RS.live) close(); }, 20000);
      const stop = (e) => { if (e.type === 'focusin' && e.target === c.panel) return; reflectStop(); };
      setTimeout(() => { if (cur === c) for (const ev of ['pointerdown', 'keydown', 'focusin', 'input']) c.panel.addEventListener(ev, stop); }, 0);
    },
    closed() { RS.live = false; clearTimeout(RS.t); RS.bar = null; RS.sess = null; },
  });
  let reflT = 0, pendRef = null;
  function flushReflect() { if (!pendRef || cur) return; const r = pendRef; pendRef = null; if (Date.now() - r.at < 90000) open('reflect', { session: r.s }); }

  // ════════════════════════════════════ Onboarding ════════════════════════════════════
  // Patch, from the Neo Dojo cast sheet (Tools/neo-dojo-cast, "05 PATCH"): her head and shoulders only, same shapes.
  const PATCH_AVATAR = (() => {
    const N = 22, cx = 100, cy = 80, rx = 86, ry = 80, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    const at = (a, k) => `${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`;
    let afro = `M${at(a0, 1)}`;
    for (let i = 0; i < N; i++) { const b0 = a0 + (a1 - a0) * i / N, b1 = a0 + (a1 - a0) * (i + 1) / N; afro += `Q${at((b0 + b1) / 2, 1.12)} ${at(b1, 1)}`; }
    afro += `Q${cx} ${cy + 30} ${at(a0, 1)}Z`;
    const L = '#3d4c95', sp = (d, f, w = 6) => `<path d="${d}" fill="${f}" stroke="${L}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke"/>`;
    const eye = (x) => `<ellipse cx="${x}" cy="95.5" rx="12.5" ry="14" fill="#fff"/><circle cx="${x + 1}" cy="97.5" r="8" fill="#13152a"/><circle cx="${x + 4}" cy="93.5" r="3" fill="#fff"/>`;
    return `<svg viewBox="-12 -22 224 222" class="ui-patchart" aria-hidden="true"><defs><linearGradient id="ui-pa-h" x1="48" y1="24" x2="152" y2="156" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4a3024"/><stop offset=".5" stop-color="#24160f"/><stop offset="1" stop-color="#120a06"/></linearGradient>
      <linearGradient id="ui-pa-b" x1="0" y1="140" x2="0" y2="200" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#565e7c"/><stop offset=".5" stop-color="#3b4058"/><stop offset="1" stop-color="#262a3d"/></linearGradient><clipPath id="ui-pa-c"><path d="${afro}"/></clipPath></defs>
      ${sp('M14 200 Q18 158 66 148 L134 148 Q182 158 186 200 Z', 'url(#ui-pa-b)', 6)}
      <text x="100" y="188" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="15" font-weight="700" fill="#3dffc2">&lt;/&gt;</text>
      <path d="M92 152 L90 170 M108 152 L110 170" stroke="#c9d2e8" stroke-width="2.4" stroke-linecap="round"/><circle cx="90" cy="172" r="2.8" fill="#3dffc2"/><circle cx="110" cy="172" r="2.8" fill="#3dffc2"/>
      ${sp('M58 152 Q62 138 100 136 Q138 138 142 152 Q132 160 100 160 Q68 160 58 152 Z', '#4a5170', 4)}
      ${sp(afro, 'url(#ui-pa-h)')}
      <g clip-path="url(#ui-pa-c)"><ellipse cx="132" cy="128" rx="82" ry="62" fill="#050302" opacity=".45"/><ellipse cx="64" cy="38" rx="36" ry="14" fill="#fff" opacity=".09" transform="rotate(-24 64 38)"/></g>
      <path d="M24 100 Q20 2 100 -2 Q180 2 176 100" fill="none" stroke="${L}" stroke-width="11" stroke-linecap="round"/><path d="M24 100 Q20 2 100 -2 Q180 2 176 100" fill="none" stroke="#262a3d" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="24" cy="106" rx="13" ry="20" fill="#262a3d" stroke="${L}" stroke-width="5" paint-order="stroke"/><ellipse cx="176" cy="106" rx="13" ry="20" fill="#1d2030" stroke="${L}" stroke-width="5" paint-order="stroke"/>
      <ellipse cx="24" cy="106" rx="5" ry="10" fill="#3dffc2"/><ellipse cx="24" cy="106" rx="9" ry="15" fill="#3dffc2" opacity=".18"/>
      <circle cx="30" cy="134" r="5.5" fill="none" stroke="${L}" stroke-width="4.5"/><circle cx="30" cy="134" r="5.5" fill="none" stroke="#f5c542" stroke-width="2.2"/><circle cx="170" cy="134" r="5.5" fill="none" stroke="${L}" stroke-width="4.5"/><circle cx="170" cy="134" r="5.5" fill="none" stroke="#d9a72e" stroke-width="2.2"/>
      <path d="M44 80 C70 68 130 68 156 80 C168 86 168 112 152 130 C134 148 66 148 48 130 C32 112 32 86 44 80 Z" fill="#8a5634"/>
      <path d="M44 80 C70 68 130 68 156 80 C160 82 162 85 163 88 C130 77 70 77 37 88 C38 85 40 82 44 80 Z" fill="#6b3d22" opacity=".8"/>
      <path d="M44 80 C66 66 134 66 156 80 C146 74 128 72 100 74 C72 72 54 74 44 80 Z" fill="#24160f"/>
      <path d="M47 50 Q33 68 31 95" fill="none" stroke="#a9bcff" stroke-width="3.2" stroke-linecap="round" opacity=".6"/>
      <ellipse cx="57" cy="116" rx="7" ry="3.4" fill="#c0584a" opacity=".35"/><ellipse cx="143" cy="116" rx="7" ry="3.4" fill="#c0584a" opacity=".35"/>
      <g class="ui-blink">${eye(76)}${eye(124)}</g>
      <path d="M91 128 Q100 134 109 128" fill="none" stroke="#2a120a" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="56" y="80" width="40" height="30" rx="9" fill="#3dffc2" fill-opacity=".22" stroke="#3dffc2" stroke-width="3"/><rect x="104" y="80" width="40" height="30" rx="9" fill="#3dffc2" fill-opacity=".22" stroke="#3dffc2" stroke-width="3"/>
      <path d="M96 92 Q100 88 104 92" fill="none" stroke="#3dffc2" stroke-width="3" stroke-linecap="round"/><path d="M62 86 L72 86 M110 86 L116 86" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".75"/>
      <path d="M61 75 Q74 74.5 87 77 M139 75 Q126 74.5 113 77" fill="none" stroke="#1d0f0a" stroke-width="4.5" stroke-linecap="round"/></svg>`;
  })();
  const term = (x, y, w, cls) => `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="${w * .7}" rx="5" fill="#3dffc2" fill-opacity=".1" stroke="#3dffc2" stroke-width="2"/><path d="M${x + 6} ${y + 8}h${w * .42}M${x + 6} ${y + 15}h${w * .62}M${x + 6} ${y + 22}h${w * .3}" stroke="#3dffc2" stroke-width="2.4" stroke-linecap="round" opacity=".85"/></g>`;
  const OB_ART = [
    () => h('div', { class: 'ui-oba ui-oba1', html: `<svg viewBox="0 0 300 180" class="ui-obterms" aria-hidden="true">${term(18, 38, 64, 'ui-fl1')}${term(222, 22, 58, 'ui-fl2')}${term(232, 108, 50, 'ui-fl3')}</svg>` + PATCH_AVATAR }),
    () => h('div', { class: 'ui-oba ui-oba2', html: `<svg viewBox="0 0 300 180" aria-hidden="true"><defs><clipPath id="ui-obband"><rect x="72" y="86" width="156" height="34" rx="6"/></clipPath><radialGradient id="ui-obt" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#ff9a86"/><stop offset=".45" stop-color="#ff4a3d"/><stop offset="1" stop-color="#c8231a"/></radialGradient></defs>
      <ellipse cx="150" cy="166" rx="70" ry="8" fill="#000" opacity=".22"/>
      <path d="M150 34C96 34 62 62 62 102S96 164 150 164 238 142 238 102 204 34 150 34Z" fill="url(#ui-obt)" stroke="#3d4c95" stroke-width="5"/>
      <path d="M150 42C138 46 122 36 112 46 124 46 130 52 132 58 140 50 146 52 150 56 154 52 160 50 168 58 170 52 176 46 188 46 178 36 162 46 150 42Z" fill="#2fbf71" stroke="#1b7a45" stroke-width="2"/><path d="M150 44C150 34 154 26 162 22" stroke="#1b7a45" stroke-width="5" stroke-linecap="round" fill="none"/>
      <rect x="72" y="86" width="156" height="34" rx="6" fill="#fff4e2"/>
      <g clip-path="url(#ui-obband)"><g class="ui-obnums">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `<path d="M${40 + i * 30} 88v${i % 1 ? 6 : 10}M${55 + i * 30} 88v5" stroke="#13152a" stroke-width="2"/><text x="${40 + i * 30}" y="115" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="11" fill="#13152a">${i * 5}</text>`).join('')}</g></g>
      <path d="M150 80l-7-9h14z" fill="#3dffc2" stroke="#052a1f" stroke-width="2" stroke-linejoin="round"/><rect x="149" y="86" width="2" height="34" fill="#3dffc2"/>
      <ellipse cx="112" cy="66" rx="10" ry="16" fill="#fff" opacity=".35" transform="rotate(30 112 66)"/>
      <g class="ui-obfinger"><circle cx="192" cy="104" r="14" fill="#3dffc2" opacity=".18"/><circle cx="192" cy="104" r="7" fill="#3dffc2"/></g>
      <path d="M118 140h64M126 148l-8-8 8-8M174 132l8 8-8 8" stroke="#a9bcff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/></svg>` }),
    () => {
      const box = h('div', { class: 'ui-oba ui-oba3' });
      box.innerHTML = `<svg viewBox="0 0 300 180" aria-hidden="true"><ellipse cx="150" cy="166" rx="40" ry="6" fill="#000" opacity=".25"/><rect x="118" y="78" width="64" height="86" rx="16" fill="#cfe9ff" fill-opacity=".14" stroke="#a9bcff" stroke-width="3.4"/><rect x="112" y="66" width="76" height="16" rx="5" fill="#3d4c95" stroke="#a9bcff" stroke-width="2"/><path d="M128 92v52" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".4"/>
        <path d="M136 156c-3-16 3-28 14-28s17 12 14 28z" fill="#2c1d42"/><circle cx="145" cy="142" r="3" fill="#ff2340"/><circle cx="155" cy="142" r="3" fill="#ff2340"/></svg>`;
      const ring = h('div', { class: 'ui-obrogues' });
      TEXT.rogues.forEach((r, i) => {
        const a = (196 + i * 29.6) * Math.PI / 180, x = 50 + Math.cos(a) * 39, y = 62 + Math.sin(a) * 50;
        ring.appendChild(h('span', { class: 'ui-obr', style: `left:${r1(x)}%;top:${r1(y)}%;--i:${i};--sig:${r.sig}` }, rogueArt(r.id, 'ui-obrsp', 52)));
      });
      box.appendChild(ring);
      return box;
    },
    () => h('div', { class: 'ui-oba ui-oba4', html: `<svg viewBox="0 0 300 180" aria-hidden="true"><defs><linearGradient id="ui-obsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a46"/><stop offset="1" stop-color="#3b2d6e"/></linearGradient><clipPath id="ui-obwin"><rect x="66" y="10" width="168" height="136" rx="8"/></clipPath></defs>
      <rect x="66" y="10" width="168" height="136" rx="8" fill="url(#ui-obsky)"/>
      <g clip-path="url(#ui-obwin)"><circle cx="92" cy="30" r="1.4" fill="#fff" opacity=".8"/><circle cx="122" cy="22" r="1" fill="#fff" opacity=".6"/><circle cx="104" cy="52" r="1.2" fill="#fff" opacity=".7"/><circle cx="216" cy="62" r="1" fill="#fff" opacity=".6"/><circle cx="188" cy="26" r="1.3" fill="#fff" opacity=".7"/>
        <path d="${crescentD(206, 36, 11, 211, 31, 9.5)}" fill="#fff4e2"/>
        <path d="M66 146V112h18V98h14v14h12V90h20v22h16v-12h14v20h12V96h22v18h14v-8h12v40Z" fill="#0e1130"/>
        <g fill="#ffb35c" opacity=".85"><rect x="72" y="118" width="3" height="3"/><rect x="118" y="96" width="3" height="3"/><rect x="124" y="104" width="3" height="3"/><rect x="188" y="102" width="3" height="3"/><rect x="196" y="110" width="3" height="3"/><rect x="88" y="124" width="3" height="3"/><rect x="160" y="112" width="3" height="3"/></g></g>
      <rect x="66" y="10" width="168" height="136" rx="8" fill="none" stroke="#3d4c95" stroke-width="5"/><path d="M150 12V144M68 74H232" stroke="#3d4c95" stroke-width="4"/>
      <rect x="42" y="144" width="216" height="13" rx="4" fill="#4a5170" stroke="#3d4c95" stroke-width="3"/><rect x="60" y="157" width="180" height="10" rx="3" fill="#2a2e43"/>
      <path d="M150 124V38M150 106C140 106 128 104 121 99M150 96C162 96 174 92 181 88M150 76C144 74 138 70 135 65M150 64C158 60 166 56 170 52" stroke="#1b7a45" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M132 90c-12-2-20 4-22 12 11 2 20-3 22-12zM168 80c12-4 22 2 25 10-11 3-21-1-25-10zM146 48c-8-8-6-18 1-22 5 9 5 17-1 22z" fill="#2fbf71"/>
      ${[[121, 100, 0], [181, 89, 1], [134, 65, 2], [170, 52, 3], [150, 34, 4]].map(([x, y, i]) => `<g class="ui-obtom" style="--d:${i * .45}s"><circle cx="${x}" cy="${y}" r="10.5" fill="#8fd14f" stroke="#3d4c95" stroke-width="3"/><circle class="ui-obripe" cx="${x}" cy="${y}" r="10.5" fill="#ff4a3d"/><ellipse cx="${x - 3.6}" cy="${y - 3}" rx="2.4" ry="3.8" fill="#fff" opacity=".45"/><path d="M${x - 4} ${y - 9.5}l4 2.5 4-2.5" stroke="#1b7a45" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`).join('')}
      <path d="M127 145 121 124H179L173 145Z" fill="#c8653a" stroke="#3d4c95" stroke-width="4" stroke-linejoin="round"/><rect x="116" y="116" width="68" height="11" rx="3" fill="#dd7a4a" stroke="#3d4c95" stroke-width="3"/></svg>` }),
  ];
  const OB = { i: 0, track: null, dots: [], nextB: null, slides: [] };
  function obGo(i) {
    OB.i = clamp(i, 0, TEXT.onboard.length - 1);
    if (OB.track) { try { OB.track.scrollTo({ left: OB.i * OB.track.clientWidth, behavior: RM() ? 'auto' : 'smooth' }); } catch (e) { OB.track.scrollLeft = OB.i * OB.track.clientWidth; } }
    obSync();
  }
  function obSync() {
    const last = OB.i === TEXT.onboard.length - 1;
    OB.dots.forEach((d, j) => d.classList.toggle('ui-on', j === OB.i));
    OB.slides.forEach((s, j) => { s.setAttribute('aria-hidden', String(j !== OB.i)); s.inert = j !== OB.i; });
    if (OB.nextB) { OB.nextB.textContent = ''; OB.nextB.append(last ? TEXT.ui.letsGo : W.next, h('span', { html: ICON(last ? 'check' : 'right') })); OB.nextB.classList.toggle('ui-final', last); }
    if (OB.skipB) OB.skipB.style.visibility = last ? 'hidden' : '';
    if (OB.i === 0) try1(Patch, 'pose', 'wave', { hold: 1.6 });
  }
  function finishOnboard() {
    if (!DB || !DB.meta || DB.meta.onboarded) return;
    let heard = false; const f = () => { heard = true; };
    BUS.on('onboard:done', f);
    E('markOnboarded');
    BUS.off('onboard:done', f);
    if (!heard) BUS.emit('onboard:done', {});
    setTimeout(pump, 400);
  }
  SHEET.def('onboard', {
    title: TEXT.onboard[0].title, size: 'auto', bare: true,
    render(body) {
      OB.i = 0; OB.dots = []; OB.slides = [];
      OB.track = h('div', { class: 'ui-obtrack' });
      TEXT.onboard.forEach((card, i) => {
        const extra = i === 0 && DB.meta && DB.meta.migratedV1 && DB.meta.v1Sessions ? h('p', { class: 'ui-obmig', html: ICON('check') + '<span></span>' }) : null;
        if (extra) extra.lastChild.textContent = W.migrated(DB.meta.v1Sessions);
        const s = h('section', { class: 'ui-obs', role: 'group', 'aria-roledescription': 'slide', 'aria-label': W.onboardStep(i + 1, TEXT.onboard.length) },
          OB_ART[i] ? OB_ART[i]() : null, h('div', { class: 'ui-obtxt' }, h('small', null, `0${i + 1} / 0${TEXT.onboard.length}`), h('h2', { class: 'ui-obh' }, card.title), h('p', null, card.body), extra));
        OB.slides.push(s); OB.track.appendChild(s);
      });
      let rq = 0;
      OB.track.addEventListener('scroll', () => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; const w = OB.track.clientWidth || 1, i = Math.round(OB.track.scrollLeft / w); if (i !== OB.i) { OB.i = clamp(i, 0, TEXT.onboard.length - 1); obSync(); } }); }, { passive: true });
      const dots = h('div', { class: 'ui-obdots', 'aria-hidden': 'true' }, TEXT.onboard.map((c, i) => { const d = h('i'); OB.dots.push(d); return d; }));
      OB.skipB = h('button', { class: 'ui-btn ui-ghost', type: 'button', onclick: () => close() }, W.skip);
      OB.nextB = h('button', { class: 'ui-btn ui-primary', type: 'button', onclick: () => { if (OB.i >= TEXT.onboard.length - 1) close(); else { sfx('tap'); obGo(OB.i + 1); } } });
      body.append(OB.track, h('div', { class: 'ui-obbar' }, OB.skipB, dots, OB.nextB));
      obSync();
    },
    focus() { return OB.nextB; },
    key(e) {
      if (e.key === 'ArrowRight') { obGo(OB.i + 1); return true; }
      if (e.key === 'ArrowLeft') { obGo(OB.i - 1); return true; }
      return false;
    },
    swap() { if (OB.track) swapRogues(OB.track); },
    closed() { OB.track = null; OB.nextB = null; OB.skipB = null; },
  });

  // ════════════════════════════════════ Help: the key map ════════════════════════════════════
  SHEET.def('help', {
    title: W.keys, size: 'auto',
    render(body) {
      body.append(h('dl', { class: 'ui-keys' }, KEYMAP.map(([ks, what]) => h('div', { class: 'ui-krow' }, h('dt', null, ks.map((k) => h('kbd', null, k))), h('dd', null, what)))));
      if (TOUCH) body.appendChild(h('p', { class: 'ui-hint' }, 'These work with a keyboard attached.'));
    },
  });

  // ════════════════════════════════════ CSS ════════════════════════════════════
  const STYLE = `
#top [hidden],#dock [hidden],#sheets [hidden],#toasts [hidden]{display:none !important}
/* ── top bar ── */
#top{position:fixed;left:0;right:0;top:0;height:var(--top-h);box-sizing:border-box;padding:var(--sat) calc(var(--sar) + 8px) 0 calc(var(--sal) + 16px);display:flex;align-items:center;gap:6px;z-index:10;transition:opacity var(--t-slow) var(--ease),visibility 0s 0s}
#top::before{content:"";position:absolute;left:0;right:0;top:0;height:calc(100% + 30px);background:linear-gradient(var(--bg),rgba(0,0,0,0));opacity:.8;pointer-events:none;z-index:-1}
@supports (background:color-mix(in srgb,red,blue)){#top::before{opacity:1;background:linear-gradient(color-mix(in srgb,var(--bg) 92%,transparent) 0%,color-mix(in srgb,var(--bg) 70%,transparent) 50%,color-mix(in srgb,var(--bg) 0%,transparent) 100%)}}
.ui-mark{margin:0 auto 0 0;display:flex;flex-direction:column;justify-content:center;min-width:0;line-height:1;font-weight:400;white-space:nowrap;color:var(--text);text-shadow:0 1px 10px rgba(0,0,0,.35)}
.ui-mark b{font:400 9.5px/1 var(--display);letter-spacing:.3em;color:var(--accent);margin:0 0 4px 1px;text-transform:uppercase}
.ui-mark span{font:400 17px/1 var(--display);letter-spacing:.03em;text-transform:uppercase}
[data-theme="day"] .ui-mark{text-shadow:none}
html.wide .ui-mark,html.short .ui-mark{flex-direction:row;align-items:baseline;gap:.5em}
html.wide .ui-mark b,html.short .ui-mark b{font-size:15px;letter-spacing:.05em;margin:0}
html.wide .ui-mark span,html.short .ui-mark span{font-size:15px;letter-spacing:.05em}
html.short .ui-mark b,html.short .ui-mark span{font-size:13px}
.ui-tr{display:flex;align-items:center;gap:2px;flex:none}
.ui-stats{height:44px;display:flex;align-items:center;padding:0 2px;border-radius:999px}
.ui-pill{display:flex;align-items:center;gap:7px;height:36px;box-sizing:border-box;padding:0 12px 0 4px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font:700 13.5px/1 var(--mono);font-variant-numeric:tabular-nums;color:var(--text);transition:transform var(--t-fast) var(--ease),border-color var(--t-med)}
.ui-num{display:inline-flex;align-items:baseline;overflow:hidden;height:15px}
.ui-num i{font-style:normal;color:var(--muted);font-weight:700}
.ui-nb{display:inline-block}
.ui-nb.ui-roll{animation:ui-roll .48s var(--ease-back) both}
@keyframes ui-roll{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}
.ui-sep{width:1px;height:16px;background:var(--border);margin:0 1px}
.ui-tom{display:grid;place-items:center;width:28px;height:28px}
.ui-tomsvg{width:28px;height:28px;display:block;overflow:visible}
.ui-ringbg,.ui-ring{fill:none;stroke-width:2.2}
.ui-ringbg{stroke:var(--border)}
.ui-ring{stroke:var(--accent);stroke-linecap:round;stroke-dasharray:79.17;stroke-dashoffset:79.17;transition:stroke-dashoffset .9s var(--ease),stroke .3s}
.ui-goal .ui-ring{stroke:var(--gold)}
.ui-goal .ui-pill{border-color:color-mix(in srgb,var(--gold) 55%,var(--border))}
.ui-tom.ui-pop{animation:ui-pop .6s var(--ease-back)}
@keyframes ui-pop{0%{transform:scale(1)}35%{transform:scale(1.32) rotate(-8deg)}100%{transform:none}}
.ui-fl{display:grid;place-items:center;width:18px;height:20px}
.ui-flsvg{width:18px;height:20px;display:block}
.ui-fo{fill:none;stroke:var(--dim);stroke-width:1.6}
.ui-fi{fill:none}
.ui-fl.ui-lit .ui-fo{fill:var(--gold);stroke:none}
.ui-fl.ui-lit .ui-fi{fill:#fff1c2}
[data-theme="day"] .ui-fl.ui-lit .ui-fo{fill:#e8a21c}
.ui-fl.ui-flare{animation:ui-flare .7s var(--ease-back)}
@keyframes ui-flare{0%{transform:scale(1)}40%{transform:scale(1.45) translateY(-2px)}100%{transform:none}}
.ui-ib{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;color:var(--text)}
.ui-ibi{width:38px;height:38px;box-sizing:border-box;display:grid;place-items:center;border-radius:50%;background:var(--surface);border:1px solid var(--border);transition:transform var(--t-fast) var(--ease),background-color var(--t-fast),color var(--t-fast)}
.ui-ibi .ic{width:19px;height:19px}
.ui-ib.ui-off .ui-ibi{color:var(--muted)}
html[data-q="0"] .ui-pill,html[data-q="1"] .ui-pill,html[data-q="0"] .ui-ibi,html[data-q="1"] .ui-ibi{background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
@media (hover:hover){.ui-stats:hover .ui-pill,.ui-ib:hover .ui-ibi{border-color:var(--accent)}}
.ui-stats:active .ui-pill,.ui-ib:active .ui-ibi{transform:scale(.93)}
html.short #top{gap:4px}
html.short .ui-pill{height:32px}
html.short .ui-ibi{width:34px;height:34px}
@media (max-width:359px){.ui-mark span{font-size:15px}.ui-mark b{font-size:8.5px}.ui-pill{gap:5px;padding-right:9px}.ui-ib{width:42px}.ui-ib.ui-hd{display:none}}

/* ── dock ── */
#dock{position:fixed;left:0;right:0;bottom:0;height:var(--dock-h);box-sizing:border-box;padding:0 calc(var(--sar) + 4px) var(--sab) calc(var(--sal) + 4px);display:flex;align-items:stretch;z-index:10;background:var(--surface);border-top:1px solid var(--border);transition:opacity var(--t-slow) var(--ease),visibility 0s 0s}
html[data-q="0"] #dock,html[data-q="1"] #dock{background:var(--glass);-webkit-backdrop-filter:blur(16px) saturate(1.2);backdrop-filter:blur(16px) saturate(1.2)}
.ui-tab{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:var(--muted);font:700 10px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;position:relative;transition:color var(--t-fast)}
.ui-tab::before{content:"";position:absolute;top:-1px;left:50%;width:28px;height:3px;margin-left:-14px;border-radius:0 0 3px 3px;background:var(--accent);transform:scaleX(0);transition:transform var(--t-med) var(--ease-back)}
.ui-tab[aria-current]{color:var(--accent)}
.ui-tab[aria-current]::before{transform:none}
.ui-tabi{position:relative;display:grid;place-items:center;width:44px;height:28px;border-radius:14px;transition:transform var(--t-fast) var(--ease),background-color var(--t-fast)}
.ui-tabi .ic{width:22px;height:22px}
.ui-tab:active .ui-tabi{transform:scale(.88)}
@media (hover:hover){.ui-tab:hover{color:var(--text)}.ui-tab:hover .ui-tabi{background:var(--surface-2)}.ui-tab[aria-current]:hover{color:var(--accent)}}
.ui-tabl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ui-count{position:absolute;top:-4px;right:2px;min-width:17px;height:17px;box-sizing:border-box;padding:0 4px;border-radius:9px;background:var(--accent);color:var(--on-accent);font:700 10px/17px var(--mono);letter-spacing:0;font-style:normal;text-align:center;border:2px solid var(--surface)}
.ui-dot{position:absolute;top:0;right:8px;width:9px;height:9px;border-radius:50%;background:var(--gold);border:2px solid var(--surface);box-shadow:0 0 8px rgba(245,197,66,.8)}
html.short .ui-tab{gap:2px;font-size:8.5px;letter-spacing:.06em}
html.short .ui-tabi{width:36px;height:22px}
html.short .ui-tabi .ic{width:19px;height:19px}
html.short .ui-count{top:-5px;right:-2px}
html.wide #dock{left:calc(var(--ui-x) + 12px);right:auto;width:calc(var(--ui-w) - 24px);bottom:calc(var(--sab) + 8px);height:calc(var(--dock-h) - var(--sab) - 16px);padding:0 6px;border:1px solid var(--border);border-radius:22px;box-shadow:var(--shadow)}
html.wide.short #dock{bottom:calc(var(--sab) + 5px);height:calc(var(--dock-h) - var(--sab) - 10px);border-radius:16px}
html[data-q="2"].wide #dock,html[data-q="3"].wide #dock{box-shadow:none}
#dock.ui-lift{z-index:35}
html.heads-down #top,html.heads-down #dock{opacity:0;visibility:hidden;transition:opacity var(--t-slow) var(--ease),visibility 0s var(--t-slow)}
html.heads-down #top button,html.heads-down #dock button{pointer-events:none}

/* ── sheets ── */
#sheets{position:fixed;inset:0;z-index:30}
.ui-scrim{position:fixed;inset:0;background:var(--scrim);opacity:0;transition:opacity var(--t-med) var(--ease)}
.ui-scrim.ui-on{opacity:1}
html.wide .ui-scrim{background:color-mix(in srgb,var(--scrim) 70%,transparent)}
.ui-sheet{position:fixed;left:var(--sal);right:var(--sar);bottom:0;box-sizing:border-box;display:flex;flex-direction:column;max-height:calc(100% - var(--top-h) - 6px);background:var(--surface);color:var(--text);border-radius:26px 26px 0 0;box-shadow:0 -10px 44px rgba(0,0,0,.38);transform:translate3d(0,calc(100% + 30px),0);transition:transform 260ms var(--ease-in),opacity 260ms;outline:none;will-change:transform;contain:layout style}
.ui-sheet.ui-on{transform:none;transition:transform 600ms var(--ui-spring)}
.ui-sheet.ui-drag,.ui-sheet.ui-drag.ui-on{transition:none}
.ui-sheet::before{content:"";position:absolute;left:14%;right:14%;top:0;height:1px;background:linear-gradient(90deg,rgba(169,188,255,0),rgba(169,188,255,.55),rgba(169,188,255,0));pointer-events:none}
[data-theme="day"] .ui-sheet::before{display:none}
.ui-sheet::after{content:"";position:absolute;left:0;right:0;top:calc(100% - 1px);height:160px;background:var(--surface);pointer-events:none}
html:not(.wide) .ui-sheet{bottom:var(--ui-kb,0px);max-height:calc(100% - var(--top-h) - 6px - var(--ui-kb,0px))}
.ui-tall{height:calc(100% - var(--top-h) - 6px - var(--ui-kb,0px))}
.ui-half{max-height:min(68%,calc(100% - var(--top-h) - 6px - var(--ui-kb,0px)))}
html[data-q="2"] .ui-sheet,html[data-q="3"] .ui-sheet{box-shadow:0 -1px 0 var(--border)}
.ui-grab{flex:none;height:22px;display:flex;justify-content:center;align-items:center;touch-action:none;cursor:grab}
.ui-grab i{display:block;width:40px;height:5px;border-radius:3px;background:var(--border)}
.ui-head{flex:none;display:flex;align-items:center;gap:6px;padding:0 10px 12px 22px;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:0 1px 0 transparent;transition:box-shadow var(--t-med);position:relative;z-index:1}
.ui-head.ui-scrolled{box-shadow:0 1px 0 var(--border)}
.ui-ht{flex:1;min-width:0}
.ui-eyebrow{font:700 11px/1 var(--mono);letter-spacing:.04em;color:var(--accent);margin:0 0 7px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-theme="day"] .ui-eyebrow{color:color-mix(in srgb,var(--accent) 78%,var(--text))}
.ui-title{margin:0;font:400 23px/1.08 var(--display);letter-spacing:.02em;text-transform:uppercase;overflow-wrap:anywhere}
.ui-s-reflect .ui-title{font-size:19px}
.ui-x{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;color:var(--muted);transition:background-color var(--t-fast),color var(--t-fast),transform var(--t-fast) var(--ease)}
.ui-x .ic{width:22px;height:22px}
@media (hover:hover){.ui-x:hover{background:var(--surface-2);color:var(--text)}}
.ui-x:active{transform:scale(.9)}
.ui-live{flex:none;display:flex;align-items:center;gap:7px;height:32px;padding:0 12px 0 10px;border-radius:999px;background:color-mix(in srgb,var(--accent) 14%,transparent);border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);color:var(--accent);font:700 13px/1 var(--mono);font-variant-numeric:tabular-nums;contain:layout paint}
[data-theme="day"] .ui-live{color:color-mix(in srgb,var(--accent) 70%,var(--text))}
.ui-live i{width:7px;height:7px;border-radius:50%;background:currentColor;animation:ui-blinkdot 2s ease-in-out infinite}
.ui-live.ui-brk{color:var(--break);background:color-mix(in srgb,var(--break) 14%,transparent);border-color:color-mix(in srgb,var(--break) 45%,transparent)}
.ui-live.ui-psd i{animation:none;border-radius:1px;width:6px;height:8px;background:none;border-left:2px solid currentColor;border-right:2px solid currentColor;box-sizing:border-box}
@keyframes ui-blinkdot{50%{opacity:.25}}
.ui-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:2px 20px calc(26px + var(--sab));position:relative;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.ui-auto .ui-body{flex:0 1 auto}
.ui-foot{flex:none;display:flex;gap:10px;align-items:center;padding:12px 20px calc(14px + var(--sab));border-top:1px solid var(--border);background:var(--surface);position:relative;z-index:1}
.ui-body:has(+ .ui-foot){padding-bottom:16px}
html.wide .ui-sheet{left:auto;right:calc(var(--sar) + 12px);top:calc(var(--top-h) + 6px);bottom:calc(var(--dock-h) + 2px);width:min(max(calc(var(--ui-w) - 24px),360px),520px,calc(100vw - 24px));max-height:none;height:auto;border-radius:24px;box-shadow:-14px 10px 50px rgba(0,0,0,.4);transform:translate3d(calc(100% + 60px),0,0)}
html.wide.short .ui-sheet{top:calc(var(--sat) + 6px);bottom:calc(var(--sab) + 6px)}
html.wide .ui-sheet.ui-on{transform:none}
html.wide .ui-sheet::after{display:none}
html.wide .ui-sheet.ui-auto,html.wide .ui-sheet.ui-half{bottom:auto;max-height:calc(100% - var(--top-h) - var(--dock-h) - 10px)}
html.wide.short .ui-sheet.ui-auto,html.wide.short .ui-sheet.ui-half{max-height:calc(100% - var(--sat) - var(--sab) - 12px)}
html.wide .ui-grab{height:12px;cursor:default}
html.wide .ui-grab i{display:none}
html.wide .ui-head{padding-top:6px}
html.wide .ui-foot{border-radius:0 0 24px 24px;padding-bottom:14px}
html.wide .ui-body{padding-bottom:22px}
html[data-q="2"].wide .ui-sheet,html[data-q="3"].wide .ui-sheet{box-shadow:0 0 0 1px var(--border)}
html.rm .ui-sheet,html.rm .ui-sheet.ui-on,html.rm.wide .ui-sheet{transform:none !important;opacity:0;transition:opacity 200ms linear !important}
html.rm .ui-sheet.ui-on{opacity:1}

/* ── shared controls ── */
.ui-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 20px;box-sizing:border-box;border-radius:999px;font:700 15px/1.1 var(--body);background:var(--surface-2);color:var(--text);border:1px solid var(--border);text-decoration:none;transition:transform var(--t-fast) var(--ease),background-color var(--t-fast),box-shadow var(--t-fast),opacity var(--t-fast);-webkit-user-select:none;user-select:none}
.ui-btn .ic{width:18px;height:18px}
.ui-btn:active:not(:disabled){transform:scale(.95)}
.ui-btn:disabled{opacity:.42;cursor:default}
.ui-primary{background:var(--accent);color:var(--on-accent);border-color:transparent}
[data-theme="day"] .ui-primary{background:color-mix(in srgb,var(--accent) 84%,#000)}
.ui-danger{background:#e23a2e;color:#fff;border-color:transparent}
.ui-ghost{background:transparent}
.ui-wide{width:100%}
@media (hover:hover){.ui-btn:hover:not(:disabled){box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}.ui-danger:hover:not(:disabled){box-shadow:0 0 0 4px rgba(226,58,46,.22)}.ui-ghost:hover:not(:disabled){background:var(--surface-2)}}
.ui-in{width:100%;min-width:0;box-sizing:border-box;height:48px;padding:0 16px;border-radius:14px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);font:400 16px/1.2 var(--body);outline:none;transition:border-color var(--t-fast),box-shadow var(--t-fast)}
.ui-in::placeholder{color:var(--muted);opacity:.9}
.ui-in:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
.ui-ta{height:auto;min-height:56px;padding:12px 16px;resize:none;line-height:1.35}
.ui-label,.ui-sech h3,.ui-gt{font:700 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0}
.ui-sech{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:18px 2px 6px;min-height:44px}
.ui-link{min-height:44px;padding:0 6px;color:var(--accent);font:700 12px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;border-radius:8px}
[data-theme="day"] .ui-link{color:color-mix(in srgb,var(--accent) 75%,var(--text))}
@media (hover:hover){.ui-link:hover{text-decoration:underline;text-underline-offset:3px}}
.ui-lead{margin:0 2px 14px;color:var(--muted);font-size:15px}
.ui-hint{margin:4px 2px 10px;color:var(--muted);font-size:13px;line-height:1.4}
.ui-empty{display:flex;align-items:center;gap:14px;padding:18px 16px;border-radius:16px;border:1.5px dashed var(--border);color:var(--muted);font-size:14px;line-height:1.4;list-style:none}
.ui-empty-s{padding:12px 14px}
.ui-emptyart{flex:none;width:34px;height:34px;opacity:.85}
.ui-emptyart .ui-tomsvg{width:34px;height:34px}
.ui-emptyart .ui-ring,.ui-emptyart .ui-ringbg{display:none}
.ui-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px 0 9px;border-radius:999px;border:1px solid var(--border);color:var(--accent);font:700 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase}
.ui-chip .ic{width:14px;height:14px}
[data-theme="day"] .ui-chip{color:color-mix(in srgb,var(--accent) 75%,var(--text))}
@media (hover:hover){.ui-chip:hover{background:var(--surface-2)}}

/* ── toasts ── */
#toasts{position:fixed;left:0;right:0;top:0;z-index:40;display:flex;flex-direction:column;align-items:center;padding:calc(var(--sat) + 6px) 10px 0;pointer-events:none}
html.wide #toasts{right:auto;width:var(--stage-w);box-sizing:border-box}
.ui-toast{position:relative;display:flex;align-items:center;gap:12px;width:max-content;max-width:min(440px,100%);min-height:52px;box-sizing:border-box;padding:6px 8px 6px 7px;border-radius:20px;background:var(--surface-2);border:1px solid var(--border);box-shadow:0 14px 34px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.2);color:var(--text);transform:translate3d(0,calc(-100% - var(--sat) - 20px),0);opacity:0;transition:transform 300ms var(--ease-in),opacity 300ms;touch-action:none;overflow:hidden}
.ui-toast.ui-on{transform:none;opacity:1;transition:transform 560ms var(--ui-bounce),opacity 200ms}
.ui-toast.ui-drag{transition:none}
.ui-toast.ui-tap{cursor:pointer}
html[data-q="2"] .ui-toast,html[data-q="3"] .ui-toast{box-shadow:0 4px 12px rgba(0,0,0,.25)}
.ui-tart{flex:none;width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:color-mix(in srgb,var(--c,var(--accent)) 18%,transparent);color:var(--c,var(--accent))}
.ui-tart .ic{width:20px;height:20px}
.ui-timg{width:auto;min-width:44px;height:44px;background:none;border-radius:50%}
.ui-tbadge{width:44px;height:44px;display:block}
.ui-k-ship .ui-timg{border-radius:10px;width:auto;padding:0 2px}
.ui-tstamp{display:block;padding:5px 6px 4px;border:2.5px solid var(--tomato);border-radius:6px;color:var(--tomato);font:400 10px/1 var(--display);letter-spacing:.08em;text-transform:uppercase;transform:rotate(-9deg);animation:ui-stamp .45s cubic-bezier(.2,.9,.3,1.3) both .15s}
[data-theme="day"] .ui-tstamp{border-color:var(--tomato-deep);color:var(--tomato-deep)}
.ui-k-patch .ui-timg .ui-tbadge{animation:ui-spin .8s var(--ease-back) both .1s}
.ui-tstack{display:flex}
.ui-tstack .ui-tbadge{width:36px;height:36px;margin-left:-14px}
.ui-tstack .ui-tbadge:first-child{margin-left:0}
.ui-k-patch .ui-tstack{width:auto}
.ui-ttxt{display:flex;flex-direction:column;gap:2px;min-width:0;padding-right:4px}
.ui-ttxt small{font:700 10px/1.1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.ui-k-patch .ui-ttxt small{color:var(--gold)}
[data-theme="day"] .ui-k-patch .ui-ttxt small{color:#a87700}
.ui-ttxt b{font:700 15px/1.2 var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ui-k-patch .ui-ttxt b{font:400 15px/1.15 var(--display);text-transform:uppercase;letter-spacing:.02em}
.ui-ttxt span{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
.ui-tact{flex:none;min-height:44px;padding:0 14px;border-radius:14px;background:var(--accent);color:var(--on-accent);font:700 13px/1 var(--body);transition:transform var(--t-fast) var(--ease)}
[data-theme="day"] .ui-tact{background:color-mix(in srgb,var(--accent) 84%,#000)}
.ui-tact:active{transform:scale(.94)}
.ui-k-patch::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:30%;background:linear-gradient(100deg,transparent,rgba(255,236,170,.32),transparent);transform:translateX(-100%) skewX(-12deg);pointer-events:none}
.ui-k-patch.ui-on::after{animation:ui-shine 1.4s .45s ease-out}
@keyframes ui-shine{to{transform:translateX(560%) skewX(-12deg)}}
html.rm .ui-toast,html.rm .ui-toast.ui-on{transform:none !important;transition:opacity 200ms linear !important}

/* ── confirm ── */
.ui-mwrap{position:fixed;inset:0;z-index:5;display:grid;place-items:center;padding:24px}
.ui-mscrim{position:absolute;inset:0;background:var(--scrim);opacity:0;transition:opacity var(--t-med)}
.ui-mwrap.ui-on .ui-mscrim{opacity:1}
.ui-modal{position:relative;width:min(100%,360px);box-sizing:border-box;padding:24px 20px 18px;border-radius:24px;background:var(--surface);border:1px solid var(--border);box-shadow:0 24px 60px rgba(0,0,0,.45);text-align:center;transform:scale(.9) translateY(10px);opacity:0;transition:transform 460ms var(--ui-spring),opacity 180ms}
.ui-mwrap.ui-on .ui-modal{transform:none;opacity:1}
.ui-mico{display:grid;place-items:center;width:48px;height:48px;margin:0 auto 12px;border-radius:50%;background:rgba(226,58,46,.14);color:#ff6b61}
.ui-mico .ic{width:24px;height:24px}
.ui-mtext{margin:0 0 18px;font:600 16px/1.45 var(--body)}
.ui-mrow{display:flex;gap:10px}
.ui-mrow .ui-btn{flex:1 1 auto;padding:0 14px;white-space:nowrap}
.ui-mrow .ui-ghost{flex:0 1 auto}
html.rm .ui-modal{transform:none !important;transition:opacity 160ms linear !important}
/* ── shared art ── */
@keyframes ui-stamp{0%{transform:scale(2.4) rotate(-20deg);opacity:0}55%{transform:scale(.92) rotate(-9deg);opacity:1}75%{transform:scale(1.04) rotate(-8deg)}100%{transform:rotate(-8deg);opacity:1}}
.ui-rimg{display:block;width:100%;height:100%;object-fit:contain}
.ui-rfb{display:grid;place-items:center;width:78%;height:78%;border-radius:50%;box-sizing:border-box;border:2px solid var(--sig);color:var(--sig);background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--sig) 28%,#120c1c),#120c1c 70%);box-shadow:0 0 14px color-mix(in srgb,var(--sig) 45%,transparent),inset 0 0 10px color-mix(in srgb,var(--sig) 30%,transparent);font:400 17px/1 var(--display);text-shadow:0 0 8px currentColor}
.ui-lsp.ui-rfb{font-size:15px}
@keyframes ui-spin{0%{transform:scale(.5) rotate(-120deg);opacity:0}100%{transform:none;opacity:1}}
`;
  // each sheet's styles arrive with its first open (sheets build lazily; their CSS can too)
  const SHEET_CSS = {
    tasks: `
/* ── tasks ── */
.ui-add{display:flex;flex-direction:column;gap:12px;padding:14px;margin:2px 0 6px;border-radius:20px;background:var(--surface-2);border:1px solid var(--border)}
.ui-add.ui-nudge{animation:ui-nudge .36s}
@keyframes ui-nudge{25%{transform:translateX(-6px)}50%{transform:translateX(5px)}75%{transform:translateX(-3px)}}
.ui-addrow{display:flex;gap:10px}
.ui-add .ui-in{background:var(--surface)}
.ui-addgo{flex:none;width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);transition:transform var(--t-fast) var(--ease)}
[data-theme="day"] .ui-addgo{background:color-mix(in srgb,var(--accent) 84%,#000)}
.ui-addgo .ic{width:24px;height:24px}
.ui-addgo:active{transform:scale(.92)}
.ui-est{display:flex;flex-direction:column;gap:4px;min-width:0}
.ui-esth{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 2px}
.ui-ets{display:flex;min-width:0;justify-content:space-between;touch-action:pan-y;margin:0 -4px}
.ui-et{flex:1;max-width:46px;height:44px;display:grid;place-items:center;border-radius:12px}
@media (hover:hover){.ui-et:hover i{transform:scale(1.12)}}
.ui-et i{position:relative;display:block;width:22px;height:20px;border-radius:50% 50% 46% 46%;box-sizing:border-box;border:2px dashed var(--dim);transition:transform var(--t-fast) var(--ease-back),background var(--t-fast),border-color var(--t-fast)}
.ui-et.ui-on i{border:0;background:radial-gradient(circle at 34% 30%,#ffb2a3,#ff4a3d 48%,#c8231a);transform:scale(1.06)}
.ui-et.ui-on i::before{content:"";position:absolute;left:50%;top:-3px;width:10px;height:5px;margin-left:-5px;border-radius:5px 5px 2px 2px;background:#2fbf71}
.ui-et[aria-checked="true"] i{transform:scale(1.18)}
.ui-estn{font:700 12px/1 var(--mono);color:var(--text);font-variant-numeric:tabular-nums}
.ui-tasks{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.ui-task{position:relative;display:flex;align-items:center;gap:2px;min-height:64px;padding:4px 4px 4px 0;box-sizing:border-box;border-radius:18px;background:var(--surface-2);border:1px solid var(--border);transition:transform 220ms var(--ease),box-shadow 220ms,border-color var(--t-fast),opacity 220ms}
.ui-sorting .ui-task{transition:transform 200ms var(--ease)}
.ui-task.ui-lift{z-index:3;transition:box-shadow 160ms;box-shadow:0 14px 30px rgba(0,0,0,.35);border-color:var(--accent)}
.ui-task.ui-fresh{animation:ui-rowin .5s var(--ease-back) both}
@keyframes ui-rowin{from{transform:translateY(-10px) scale(.97);opacity:0}to{transform:none;opacity:1}}
.ui-task.ui-act{border-color:color-mix(in srgb,var(--accent) 70%,var(--border));background:color-mix(in srgb,var(--accent) 7%,var(--surface-2));box-shadow:inset 3px 0 0 var(--accent)}
.ui-handle{flex:none;width:34px;height:56px;display:grid;place-items:center;color:var(--dim);cursor:grab;touch-action:none;border-radius:12px}
.ui-handle .ic{width:20px;height:20px}
@media (hover:hover){.ui-handle:hover{color:var(--muted)}}
.ui-tmain{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:9px 6px;text-align:left;border-radius:12px;color:var(--text)}
.ui-tmain.ui-static{padding-left:2px}
.ui-tnow{font:700 10px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
[data-theme="day"] .ui-tnow{color:color-mix(in srgb,var(--accent) 75%,var(--text))}
.ui-ttl{font:600 15.5px/1.3 var(--body);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ui-tmeta{display:flex;align-items:center;gap:8px;font:700 11px/1 var(--mono);color:var(--muted);font-variant-numeric:tabular-nums}
.ui-pips{display:flex;gap:3px;flex-wrap:wrap}
.ui-pip{position:relative;display:block;width:11px;height:10px;border-radius:50% 50% 46% 46%;background:radial-gradient(circle at 34% 30%,#ffb2a3,#ff4a3d 48%,#c8231a)}
.ui-pip::before{content:"";position:absolute;left:3px;top:-2px;width:5px;height:3px;border-radius:2px 2px 1px 1px;background:#2fbf71}
.ui-pip.ui-g{background:radial-gradient(circle at 34% 30%,#e3f7c4,#8fd14f 50%,#4e9a2e);opacity:.6}
.ui-pip.ui-over{background:radial-gradient(circle at 34% 30%,#ffe0b0,#ffb35c 50%,#c9721a)}
.ui-ship{flex:none;width:46px;height:46px;display:grid;place-items:center;border-radius:50%;color:var(--muted)}
.ui-cksvg{width:28px;height:28px;display:block}
.ui-cr{fill:none;stroke:currentColor;stroke-width:2;transition:fill var(--t-fast),stroke var(--t-fast)}
.ui-ck{fill:none;stroke:var(--accent);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;opacity:0;transition:opacity var(--t-fast)}
@media (hover:hover){.ui-ship:hover .ui-ck{opacity:.55}.ui-ship:hover{color:var(--accent)}}
.ui-ship.ui-on .ui-cr{fill:var(--accent);stroke:var(--accent)}
.ui-ship.ui-on .ui-ck{stroke:var(--on-accent);opacity:1}
.ui-del{flex:none;width:42px;height:46px;display:grid;place-items:center;border-radius:12px;color:var(--dim);transition:color var(--t-fast)}
.ui-del .ic{width:19px;height:19px}
@media (hover:hover){.ui-del:hover{color:var(--tomato)}}
.ui-ship:active,.ui-del:active,.ui-lbtn:active{transform:scale(.9)}
.ui-editbox{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;padding:8px 6px 6px 0}
.ui-edit{height:42px;padding:0 12px;border-radius:12px;background:var(--surface);font-weight:600}
.ui-ets-s{margin:0 -4px}
.ui-ets-s .ui-et{height:36px}
.ui-ets-s .ui-et i{width:18px;height:16px}
.ui-task.ui-editing{border-color:var(--accent)}
#sheets .ui-task.ui-editing .ui-ship,#sheets .ui-task.ui-editing .ui-del,#sheets .ui-task.ui-editing .ui-handle{opacity:.35;pointer-events:none}
.ui-shipped{min-height:56px;padding-left:12px;opacity:.86}
.ui-shipped .ui-ttl{text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--text) 40%,transparent);color:var(--muted)}
.ui-stampmini{flex:none;margin-right:8px;padding:4px 6px 3px;text-transform:uppercase;border:2px solid var(--tomato);border-radius:5px;color:var(--tomato);font:400 9px/1 var(--display);letter-spacing:.08em;transform:rotate(-8deg);opacity:.85}
[data-theme="day"] .ui-stampmini{border-color:var(--tomato-deep);color:var(--tomato-deep)}
.ui-stampfx{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:2}
.ui-stampfx b{text-transform:uppercase;padding:7px 14px 6px;border:3.5px solid var(--tomato);border-radius:8px;color:var(--tomato);font:400 22px/1 var(--display);letter-spacing:.12em;background:color-mix(in srgb,var(--surface-2) 30%,transparent);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--tomato) 30%,transparent);animation:ui-stamp .5s cubic-bezier(.2,.9,.3,1.3) both;-webkit-mask:radial-gradient(circle at 20% 30%,#000 1.4px,transparent 1.6px) 0 0/7px 7px,linear-gradient(#000,#000);-webkit-mask-composite:xor;mask-composite:exclude}
[data-theme="day"] .ui-stampfx b{border-color:var(--tomato-deep);color:var(--tomato-deep)}
.ui-stamping{animation:ui-thump .5s .3s ease-out}
@keyframes ui-thump{0%{transform:none}30%{transform:scale(.975) translateY(2px)}100%{transform:none}}
.ui-donelist .ui-task{background:transparent}
.ui-sec{margin-top:6px}
.ui-latersec{border-radius:20px;transition:box-shadow .6s}
.ui-latersec.ui-flash{animation:ui-flash 1.4s ease-out}
@keyframes ui-flash{0%,30%{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 50%,transparent)}100%{box-shadow:0 0 0 3px transparent}}
.ui-laters{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ui-more{list-style:none;display:flex;justify-content:center;padding:2px 0 4px}
.ui-later{display:flex;align-items:center;gap:10px;min-height:62px;padding:6px 4px 6px 8px;border-radius:18px;background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--sig);transition:transform .26s var(--ease),opacity .26s}
.ui-later.ui-gone{transform:translateX(40px);opacity:0}
.ui-lart{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:14px;background:radial-gradient(circle at 50% 70%,color-mix(in srgb,var(--sig) 30%,transparent),transparent 70%),#120c1c;overflow:hidden}
.ui-lmain{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.ui-ltxt{font:600 15px/1.3 var(--body);overflow-wrap:anywhere}
.ui-lmeta{font:700 11px/1 var(--mono);color:var(--muted);letter-spacing:.02em}
.ui-lmeta b{color:var(--sig)}
[data-theme="day"] .ui-lmeta b{color:var(--text)}
.ui-lbtn{flex:none;width:42px;height:46px;display:grid;place-items:center;border-radius:12px;color:var(--muted)}
.ui-lbtn .ic{width:20px;height:20px}
@media (hover:hover){.ui-lbtn:hover{color:var(--accent)}}
`,
    patches: `
/* ── patches ── */
.ui-hoodwrap{position:relative;margin:2px 0 4px;padding:14px 10px 12px;border-radius:22px;background:radial-gradient(ellipse 70% 60% at 50% 40%,rgba(61,255,194,.10),transparent 70%),linear-gradient(#1a1f42,#11152d);border:1px solid #2a3366;overflow:hidden}
[data-theme="day"] .ui-hoodwrap{border-color:var(--border)}
.ui-hood{position:relative;width:100%;max-width:340px;margin:0 auto}
.ui-hood::before{content:"";display:block;padding-top:50%}
.ui-hoodart{position:absolute;inset:0;width:100%;height:100%;display:block}
.ui-slot{position:absolute;width:15.5%;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;box-sizing:border-box}
span.ui-slot{border:2px dashed rgba(61,255,194,.45);background:rgba(61,255,194,.05)}
span.ui-slot::before{content:"";display:block;padding-top:100%}
.ui-slot img{width:100%;height:100%;display:block;filter:drop-shadow(0 3px 4px rgba(0,0,0,.4))}
html[data-q="2"] .ui-slot img,html[data-q="3"] .ui-slot img{filter:none}
.ui-slot.ui-await img{opacity:0}
.ui-slot.ui-landed img{animation:ui-land .45s var(--ease-back)}
@keyframes ui-land{0%{transform:scale(1.35)}100%{transform:none}}
button.ui-slot{min-width:44px;min-height:44px}
@media (hover:hover){button.ui-slot:hover img{transform:scale(1.08) rotate(-4deg);transition:transform var(--t-fast) var(--ease-back)}}
.ui-hoodmeta{display:flex;flex-wrap:wrap;gap:4px 12px;justify-content:space-between;align-items:baseline;margin:8px 6px 0;font:700 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:#9aa3cf}
.ui-hoodmeta b{color:#eef1f8;font-weight:700}
.ui-have{font:700 12px/1 var(--mono);color:var(--muted);font-variant-numeric:tabular-nums}
.ui-pgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px 4px}
@media (min-width:520px){.ui-pgrid{grid-template-columns:repeat(5,minmax(0,1fr))}}
html.wide .ui-pgrid{grid-template-columns:repeat(4,minmax(0,1fr))}
.ui-pc{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 2px 10px;border-radius:16px;min-width:0;transition:background-color var(--t-fast),transform var(--t-fast) var(--ease)}
.ui-pc:active{transform:scale(.95)}
@media (hover:hover){.ui-pc:hover{background:var(--surface-2)}.ui-pc:hover .ui-pcb img{transform:rotate(-6deg) scale(1.05)}}
.ui-pcb{position:relative;width:64px;height:64px;display:grid;place-items:center}
.ui-pcb img{width:64px;height:64px;display:block;transition:transform var(--t-med) var(--ease-back)}
.ui-ghostb{position:relative;display:grid;place-items:center;width:100%;height:100%;border-radius:50%;box-sizing:border-box;border:2px dashed var(--dim)}
.ui-ghostb img{opacity:.13;filter:grayscale(1);width:84%;height:84%}
[data-theme="day"] .ui-ghostb img{opacity:.2}
.ui-pcn{font:600 11.5px/1.2 var(--body);text-align:center;color:var(--text);overflow-wrap:anywhere;padding:0 2px}
.ui-pcd{font:700 9.5px/1 var(--mono);letter-spacing:.06em;color:var(--muted);text-transform:uppercase}
.ui-locked .ui-pcn{color:var(--muted)}
.ui-locked .ui-pcd{color:var(--dim)}
.ui-pin{position:absolute;right:-1px;bottom:1px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:var(--on-accent);border:2px solid var(--surface)}
.ui-pin .ic{width:12px;height:12px;stroke-width:3}
.ui-newtag{position:absolute;left:50%;top:-6px;transform:translateX(-50%);padding:3px 6px;border-radius:6px;background:var(--gold);color:#2a1d00;font:700 9px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;box-shadow:0 2px 8px rgba(245,197,66,.4)}
.ui-newanim .ui-pcb img{animation:ui-newb 1.1s var(--ease-back) both}
@keyframes ui-newb{0%{transform:scale(.4) rotate(-200deg);opacity:0}100%{transform:none;opacity:1}}
.ui-pd{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:20px;border-radius:inherit;overflow:hidden}
.ui-pdback{position:absolute;inset:0;background:color-mix(in srgb,var(--surface) 72%,transparent);opacity:0;transition:opacity var(--t-med)}
html[data-q="0"] .ui-pdback,html[data-q="1"] .ui-pdback{-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ui-pd.ui-on .ui-pdback{opacity:1}
.ui-pdcard{position:relative;width:min(100%,340px);box-sizing:border-box;padding:26px 22px 20px;border-radius:26px;background:var(--surface-2);border:1px solid var(--border);box-shadow:var(--shadow);text-align:center;transform:translateY(24px) scale(.94);opacity:0;transition:transform 520ms var(--ui-spring),opacity var(--t-med)}
.ui-pd.ui-on .ui-pdcard{transform:none;opacity:1}
.ui-pdcard::before{content:"";position:absolute;left:50%;top:18px;width:180px;height:180px;margin-left:-90px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--pc) 34%,transparent),transparent 68%);pointer-events:none}
.ui-pdx{position:absolute;right:6px;top:6px}
.ui-pdb{position:relative;display:block;width:132px;height:132px;margin:0 auto 12px}
.ui-pdb img{width:132px;height:132px;display:block}
.ui-pd.ui-on .ui-pdb img{animation:ui-spin .7s var(--ease-back) both}
.ui-pdname{margin:0 0 6px;font:400 22px/1.1 var(--display);text-transform:uppercase;letter-spacing:.02em}
.ui-pddesc{margin:0 0 6px;color:var(--text);font-size:15px;line-height:1.4}
.ui-pddesc b{color:var(--muted);font-weight:600}
.ui-pdwhen{margin:0 0 16px;font:700 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.ui-pdnote{margin:10px 0 0;min-height:1em;color:var(--muted);font-size:13px}
.ui-pdnote:empty{display:none}
.ui-fly{position:fixed;z-index:4;pointer-events:none;transform-origin:0 0;transition:transform 520ms cubic-bezier(.5,0,.3,1);will-change:transform}
`,
    settings: `
/* ── settings ── */
.ui-group{margin:0 0 20px}
.ui-gt{margin:16px 6px 9px}
.ui-card{border-radius:20px;background:var(--surface-2);border:1px solid var(--border);overflow:hidden}
.ui-row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;min-height:58px;padding:9px 14px 9px 16px;text-align:left;color:var(--text)}
.ui-row + .ui-row{box-shadow:inset 0 1px 0 var(--border)}
.ui-card :focus-visible,.ui-seg :focus-visible{outline-offset:-3px;border-radius:12px}
button.ui-row{transition:background-color var(--t-fast)}
@media (hover:hover){button.ui-row:hover{background:var(--surface-3)}}
button.ui-row:active{background:var(--surface-3)}
.ui-row.ui-stack{flex-direction:column;align-items:stretch;gap:10px;padding:12px 14px 14px 16px}
.ui-rrow{display:flex;align-items:center;justify-content:space-between;gap:10px}
.ui-rl{display:flex;flex-direction:column;gap:3px;min-width:0}
.ui-rt{font:600 15px/1.25 var(--body)}
.ui-rs{font-size:12.5px;line-height:1.3;color:var(--muted)}
.ui-swt{flex:none;position:relative;width:50px;height:30px;border-radius:15px;background:var(--surface-3);border:1px solid var(--border);box-sizing:border-box;transition:background-color var(--t-med) var(--ease),border-color var(--t-med)}
.ui-swt i{position:absolute;left:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.3);transition:transform 340ms var(--ease-back)}
.ui-sw[aria-checked="true"] .ui-swt{background:var(--accent);border-color:transparent}
[data-theme="day"] .ui-sw[aria-checked="true"] .ui-swt{background:color-mix(in srgb,var(--accent) 88%,#000)}
.ui-sw[aria-checked="true"] .ui-swt i{transform:translateX(20px)}
.ui-sw:active .ui-swt i{width:28px}
.ui-sw[aria-checked="true"]:active .ui-swt i{transform:translateX(16px)}
.ui-stepper{flex:none;display:flex;align-items:center;gap:0;padding:2px;border-radius:999px;background:var(--surface);border:1px solid var(--border)}
.ui-step{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;color:var(--text);transition:background-color var(--t-fast),transform var(--t-fast) var(--ease);touch-action:manipulation}
.ui-step .ic{width:18px;height:18px}
.ui-step:active:not(:disabled){transform:scale(.88);background:var(--surface-3)}
.ui-step:disabled{opacity:.3}
@media (hover:hover){.ui-step:hover:not(:disabled){background:var(--surface-2)}}
.ui-sv{min-width:64px;display:flex;flex-direction:column;align-items:center;gap:2px;font-variant-numeric:tabular-nums;border-radius:10px;padding:2px 0}
.ui-sv b{font:700 17px/1 var(--mono)}
.ui-sv small{font:700 9px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.ui-seg{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));padding:3px;border-radius:14px;background:var(--surface);border:1px solid var(--border);isolation:isolate}
.ui-segthumb{position:absolute;left:3px;top:3px;bottom:3px;width:calc((100% - 6px) / var(--n));border-radius:11px;background:var(--accent);transform:translateX(calc(var(--i, 0) * 100%));transition:transform 420ms var(--ui-spring);z-index:-1;box-shadow:0 2px 8px rgba(0,0,0,.18)}
[data-theme="day"] .ui-segthumb{background:color-mix(in srgb,var(--accent) 86%,#000)}
.ui-segb{min-height:44px;padding:0 4px;border-radius:11px;font:600 13.5px/1.1 var(--body);color:var(--muted);transition:color var(--t-med);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ui-segb[aria-checked="true"]{color:var(--on-accent);font-weight:700}
@media (hover:hover){.ui-segb:hover:not([aria-checked="true"]){color:var(--text)}}
.ui-range{-webkit-appearance:none;appearance:none;width:100%;height:30px;margin:0;background:transparent;--v:50%;touch-action:pan-y}
.ui-range::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--accent) var(--v),var(--surface-3) var(--v))}
.ui-range::-moz-range-track{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--accent) var(--v),var(--surface-3) var(--v))}
.ui-range::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;margin-top:-9px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.06);transition:transform var(--t-fast) var(--ease-back)}
.ui-range::-moz-range-thumb{width:26px;height:26px;border:0;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.ui-range:active::-webkit-slider-thumb{transform:scale(1.15)}
.ui-range:focus-visible{outline:none}
.ui-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px var(--accent),0 2px 6px rgba(0,0,0,.35)}
.ui-rv{font:700 13px/1 var(--mono);color:var(--muted);font-variant-numeric:tabular-nums}
.ui-act{justify-content:flex-start;gap:14px}
.ui-act .ui-rt{flex:1}
.ui-ai{flex:none;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface);border:1px solid var(--border);color:var(--accent)}
[data-theme="day"] .ui-ai{color:color-mix(in srgb,var(--accent) 75%,var(--text))}
.ui-ai .ic{width:18px;height:18px}
.ui-chev{color:var(--dim)}
.ui-chev .ic{width:18px;height:18px}
.ui-dangerrow .ui-rt,.ui-dangerrow .ui-ai{color:#ff6b61}
[data-theme="day"] .ui-dangerrow .ui-rt,[data-theme="day"] .ui-dangerrow .ui-ai{color:#c42a1f}
.ui-file{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.ui-about{padding:18px 16px 16px}
.ui-about p{margin:0 0 6px;font-size:14px;line-height:1.45}
.ui-aboutmark{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.ui-aboutmark b{font:400 18px/1 var(--display);text-transform:uppercase;letter-spacing:.03em}
.ui-aboutmark span{font:700 11px/1 var(--mono);letter-spacing:.08em;color:var(--muted)}
.ui-sitebtn{margin-top:8px;min-height:42px;font-size:14px}
.ui-sitebtn .ic{width:16px;height:16px}
`,
    capture: `
/* ── capture ── */
.ui-rgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
html.wide .ui-rgrid{grid-template-columns:repeat(2,minmax(0,1fr))}
@media (min-width:700px){html:not(.wide) .ui-rgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.ui-rc{position:relative;display:flex;flex-direction:column;min-width:0;border-radius:18px;overflow:hidden;background:#1a1428;border:1.5px solid #3a2340;text-align:left;color:#eef1f8;transition:transform var(--t-fast) var(--ease),border-color var(--t-fast),box-shadow var(--t-med)}
.ui-rc:active{transform:scale(.97)}
@media (hover:hover){.ui-rc:hover{border-color:color-mix(in srgb,var(--sig) 60%,#3a2340);transform:translateY(-2px)}}
.ui-rc.ui-on{border-color:var(--sig);box-shadow:0 0 0 3px color-mix(in srgb,var(--sig) 30%,transparent),0 8px 24px color-mix(in srgb,var(--sig) 18%,transparent)}
.ui-rstage{position:relative;height:84px;display:grid;place-items:center;background:radial-gradient(ellipse 60% 16% at 50% 92%,color-mix(in srgb,var(--sig) 32%,transparent),transparent 70%),radial-gradient(circle at 50% 70%,color-mix(in srgb,var(--sig) 18%,transparent),transparent 62%),linear-gradient(#1f1430,#0e0914)}
.ui-rsp.ui-rimg{width:auto;height:76px;max-width:90%;transition:transform var(--t-med) var(--ease-back)}
.ui-rsp.ui-rfb{width:52px;height:52px;font-size:22px}
.ui-rc.ui-on .ui-rsp{transform:scale(1.08) rotate(-3deg)}
.ui-rkey{position:absolute;left:8px;top:7px;font:700 10px/1 var(--mono);color:rgba(238,241,248,.45);padding:3px 5px;border-radius:5px;border:1px solid rgba(238,241,248,.18)}
html:not(.wide) .ui-rkey{display:none}
@media (hover:none){.ui-rkey{display:none}}
.ui-rinfo{display:flex;flex-direction:column;gap:4px;padding:9px 12px 12px}
.ui-rname{font:400 15px/1.05 var(--display);letter-spacing:.02em}
.ui-rwhat{font:700 10.5px/1.1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--sig)}
.ui-rex{font-size:12px;line-height:1.3;color:#b9bedf}
.ui-rcheck{position:absolute;right:8px;top:8px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--sig);color:#120c1c;transform:scale(0);transition:transform 300ms var(--ease-back)}
.ui-rcheck .ic{width:14px;height:14px;stroke-width:3.2}
.ui-rc.ui-on .ui-rcheck{transform:none}
.ui-capfoot{flex-direction:column;align-items:stretch}
.ui-capfoot .ui-in{height:46px}
.ui-go .ic{width:20px;height:20px}
@media (max-height:720px){html:not(.wide) .ui-rstage{height:62px}html:not(.wide) .ui-rsp.ui-rimg{height:56px}html:not(.wide) .ui-rex{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
html.wide.short .ui-rstage{height:58px}
html.wide.short .ui-rsp.ui-rimg{height:52px}
`,
    reflect: `
/* ── reflect ── */
.ui-rmeta{margin:-4px 2px 14px}
.ui-rates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}
.ui-rate{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px 12px;border-radius:20px;background:var(--surface-2);border:1.5px solid var(--border);color:var(--text);transition:transform var(--t-fast) var(--ease),border-color var(--t-fast),background-color var(--t-fast)}
.ui-rate b{font:700 12px/1.1 var(--mono);letter-spacing:.08em;text-transform:uppercase}
.ui-face{width:64px;height:64px;display:block;transition:transform var(--t-med) var(--ease-back)}
@media (hover:hover){.ui-rate:hover{border-color:var(--accent)}.ui-rate:hover .ui-face{transform:translateY(-3px) rotate(-4deg)}}
.ui-rate:active{transform:scale(.95)}
.ui-rate.ui-on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface-2))}
.ui-rate.ui-on .ui-face{transform:scale(1.12)}
.ui-rbar{position:absolute;left:26px;right:26px;top:0;height:3px;background:var(--accent);transform-origin:0 50%;opacity:.75;border-radius:0 0 3px 3px}
.ui-s-reflect .ui-body{position:static}
.ui-rbar.ui-run{transform:scaleX(0);transition:transform 20s linear}
.ui-rbar.ui-stop{opacity:0;transition:opacity .4s}
`,
    onboard: `
/* ── onboarding ── */
.ui-s-onboard .ui-body{padding:16px 0 calc(16px + var(--sab))}
.ui-obtrack{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
.ui-obtrack::-webkit-scrollbar{display:none}
.ui-obs{flex:0 0 100%;scroll-snap-align:center;scroll-snap-stop:always;box-sizing:border-box;padding:0 24px;display:flex;flex-direction:column;align-items:center;text-align:center}
.ui-oba{position:relative;width:100%;max-width:320px;height:180px;margin:4px auto 10px}
.ui-oba > svg{position:absolute;inset:0;width:100%;height:100%}
.ui-oba1{background:radial-gradient(circle at 50% 58%,rgba(61,255,194,.22),transparent 58%)}
.ui-oba1 .ui-patchart{left:50%;top:6px;width:168px;height:168px;inset:auto;transform:translateX(-50%)}
.ui-obterms{opacity:.9}
.ui-fl1,.ui-fl2,.ui-fl3{animation:ui-float 3.6s ease-in-out infinite}
.ui-fl2{animation-delay:-1.2s}
.ui-fl3{animation-delay:-2.4s}
@keyframes ui-float{50%{transform:translateY(-6px)}}
.ui-blink{animation:ui-blink 5s infinite;transform-box:fill-box;transform-origin:50% 50%}
@keyframes ui-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
.ui-obnums{animation:ui-wind 3.2s var(--ease) infinite}
.ui-obfinger{animation:ui-wind 3.2s var(--ease) infinite}
@keyframes ui-wind{0%,12%{transform:translateX(0)}50%,62%{transform:translateX(-36px)}100%{transform:translateX(0)}}
.ui-oba3 > svg{opacity:1}
.ui-obrogues{position:absolute;inset:0}
.ui-obr{position:absolute;width:52px;height:52px;margin:-26px 0 0 -26px;display:grid;place-items:center;animation:ui-float 3s ease-in-out infinite;animation-delay:calc(var(--i) * -0.5s)}
.ui-obrsp.ui-rimg{width:52px;height:52px}
.ui-obrsp.ui-rfb{width:40px;height:40px;font-size:17px}
.ui-obtom .ui-obripe{opacity:0;animation:ui-ripen 4.8s ease-in-out infinite;animation-delay:var(--d)}
@keyframes ui-ripen{0%,15%{opacity:0}45%,85%{opacity:1}100%{opacity:0}}
html.rm .ui-obtom .ui-obripe{opacity:1}
.ui-obtxt{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:400px}
.ui-obtxt small{font:700 11px/1 var(--mono);letter-spacing:.2em;color:var(--accent)}
[data-theme="day"] .ui-obtxt small{color:color-mix(in srgb,var(--accent) 75%,var(--text))}
.ui-obh{margin:0;font:400 25px/1.1 var(--display);text-transform:uppercase;letter-spacing:.02em}
.ui-obtxt p{margin:0;color:var(--muted);font-size:15.5px;line-height:1.5;text-wrap:pretty}
.ui-obmig{display:flex;align-items:center;gap:8px;margin-top:4px !important;padding:8px 12px;border-radius:12px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--text) !important;font-size:13.5px !important}
.ui-obmig .ic{color:var(--accent);width:18px;height:18px}
.ui-obbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:18px 20px 0}
.ui-obdots{display:flex;gap:7px}
.ui-obdots i{width:7px;height:7px;border-radius:4px;background:var(--border);transition:width var(--t-med) var(--ease),background-color var(--t-med)}
.ui-obdots i.ui-on{width:22px;background:var(--accent)}
.ui-obbar .ui-btn{min-width:110px}
.ui-obbar .ui-btn .ic{width:18px;height:18px}
.ui-final{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 50%,transparent);animation:ui-pulse 1.8s ease-out infinite}
@keyframes ui-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 45%,transparent)}100%{box-shadow:0 0 0 14px transparent}}
html.short .ui-oba{height:120px}
html.short .ui-obh{font-size:20px}
`,
    help: `
/* ── help ── */
.ui-keys{margin:0;display:flex;flex-direction:column;gap:2px}
.ui-krow{display:flex;align-items:center;gap:14px;min-height:42px;padding:2px 2px;border-bottom:1px solid var(--border)}
.ui-krow:last-child{border-bottom:0}
.ui-krow dt{flex:none;width:96px;display:flex;gap:5px}
.ui-krow dd{margin:0;font-size:14.5px;color:var(--text)}
.ui-keys kbd{display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 7px;box-sizing:border-box;border-radius:7px;background:var(--surface-2);border:1px solid var(--border);box-shadow:0 2px 0 var(--border);font:700 12px/1 var(--mono);color:var(--text)}
`,
  };

  // ════════════════════════════════════ BUS wiring ════════════════════════════════════
  function wire() {
    BUS.on('timer:tick', (p) => { syncLive(p); });
    BUS.on('timer:state', () => { syncLive(); });
    BUS.on('timer:mode', () => { syncLive(); });
    BUS.on('timer:done', (p) => {
      if (p.mode !== 'focus') return;
      if (!p.away) { if (!RM()) countHold = now() + 1600; holdToasts(3300); }
      if (!sets().reflect || p.away || !p.session) return;
      clearTimeout(reflT);
      const s = p.session;
      reflT = setTimeout(() => {
        if (cur && cur.id !== 'reflect') { pendRef = { s, at: Date.now() }; return; }
        if (DB.meta && !DB.meta.onboarded && cur) return;
        open('reflect', { session: s });
      }, 2600);
    });
    BUS.on('stats', () => refreshTop());
    BUS.on('task:change', (p) => {
      refreshDock();
      if (cur && cur.id === 'tasks') { if (p && p.op === 'active') markActive(); else tasksFill(); }
      if (p && p.op === 'done' && p.task) pushToast({ kind: 'ship', urgent: true, img: h('span', { class: 'ui-tstamp', 'aria-hidden': 'true' }, TEXT.ui.shipped), eyebrow: TEXT.ui.shipped, text: p.task.title, action: { label: W.undo, fn: () => E('toggleTaskDone', p.task.id) }, ms: 4200, color: 'var(--tomato)' });
    });
    BUS.on('rogue:capture', () => { if (cur && cur.id === 'tasks') tasksFill(); });
    BUS.on('rogue:change', () => { if (cur && cur.id === 'tasks') tasksFill(); });
    BUS.on('rogues:ready', () => { if (cur && cur.def.swap) try1(cur.def, 'swap'); setTimeout(blobRogues, 300); });
    BUS.on('patch:unlock', (p) => {
      if (!p || !p.id || !DB.patches[p.id]) return;
      ST.toastedAt = Math.max(ST.toastedAt || 0, DB.patches[p.id]); saveST();
      refreshDock();
      if (cur && cur.id === 'patches') patchesFillQuiet();
      const t = patchToast(p.id); if (t) pushToast(t);
    });
    BUS.on('hoodie', () => { if (cur && cur.id === 'patches') { hoodFill(); patchesFillQuiet(); } });
    BUS.on('settings', (p) => {
      if (cur && cur.id === 'settings') try1(SHEETS.settings, 'sync', p.key);
      if (!p.key || p.key === 'sound') refreshMute();
      if (!p.key || p.key === 'dailyGoal') refreshTop(true);
    });
    BUS.on('data', (p) => {
      if (p.op === 'clear') { pend = null; for (const k in ST) delete ST[k]; ST.seenAt = Date.now(); }
      if (p.op === 'import' || p.op === 'seed') ST.seenAt = Date.now();
      let mx = ST.toastedAt || 0; for (const k in DB.patches) mx = Math.max(mx, DB.patches[k]);
      ST.toastedAt = mx; saveST();
      T.last = { n: -1, sk: -1 };
      refreshTop(true); refreshDock(); refreshMute();
      if (cur) { if (cur.id === 'tasks') tasksFill(); else if (cur.id === 'patches') patchesFillQuiet(); else if (cur.id === 'settings') try1(SHEETS.settings, 'sync'); }
    });
    BUS.on('focusmode', (p) => { if (p.on && cur) close(); });
    BUS.on('hidden', () => commitPend());
    BUS.on('snd:mute', () => refreshMute());
    BUS.on('ready', onReady);
    addEventListener('pagehide', () => commitPend());
    // a phone keyboard covers the bottom of the screen: lift the open sheet above it
    const vv = window.visualViewport;
    if (vv) {
      let kq = 0;
      const kb = () => { kq = 0; const k = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)); document.documentElement.style.setProperty('--ui-kb', (k > 60 ? k : 0) + 'px'); };
      vv.addEventListener('resize', () => { if (!kq) kq = requestAnimationFrame(kb); });
    }
  }
  // after boot, in idle time: rasterise the patches (so the Patches sheet paints at once) and blob the rogue sprites
  function idleQueue(jobs) {
    const idle = window.requestIdleCallback ? (fn) => requestIdleCallback(fn, { timeout: 3000 }) : (fn) => setTimeout(fn, 80);
    const step = () => { const job = jobs.shift(); if (!job) return; Promise.resolve(job()).then(() => idle(step), () => idle(step)); };
    idle(step);
  }
  function warmBadges() { idleQueue(TEXT.patches.map((p) => () => rasterBadge(p.id))); }
  function onReady() {
    booted = true;
    setTimeout(warmBadges, 1200);
    setTimeout(() => { try1(PATCH_(), 'rogue', 'bazu', 48); }, 700);
    setTimeout(blobRogues, 4000);
    idleQueue([timeFmt]);
    refreshTop(true); refreshDock(); refreshMute();
    // patches the Engine unlocked while booting (catch-up) toast now; old ones (a v1 move-in) just light the dot
    const fresh = [], since = Date.now() - 10 * 60 * 1000;
    let mx = ST.toastedAt || 0;
    for (const p of TEXT.patches) { const t = DB.patches[p.id]; if (t && t > (ST.toastedAt || 0) && t > since) fresh.push(p.id); if (t) mx = Math.max(mx, t); }
    ST.toastedAt = mx; saveST();
    if (fresh.length) pushToast(fresh.length === 1 ? patchToast(fresh[0]) : patchGroupToast(fresh));
    if (DB.meta && !DB.meta.onboarded) {
      // first run: the four cards. Under automation (headless screenshots) skip them, unless ?onboard=1 asks.
      if (navigator.webdriver && QS.get('onboard') !== '1') finishOnboard();
      else { obWait = true; setTimeout(() => { obWait = false; if (!cur && !DB.meta.onboarded) open('onboard'); else pump(); }, 650); }
    }
    pump();
  }

  // ════════════════════════════════════ keys (CONTRACT.md §6) ════════════════════════════════════
  function key(e) {
    const k = e.key, t = e.target;
    if (modal) {
      if (k === 'Escape') { modal.done(false); return true; }
      if (k === 'Tab') return trapTab(e, modal.box);
      return false;
    }
    if (k === 'Tab') return cur ? trapTab(e, cur.panel) : false;
    if (k === 'Escape') {
      if (!cur) return false;
      if (cur.def.esc && try1(cur.def, 'esc')) return true;
      close(); return true;
    }
    if (typingIn(t)) return false;
    if (cur && cur.def.key && try1(cur.def, 'key', e)) return true;
    if (e.repeat) return false;
    switch (k) {
      case 't': case 'T': toggleSheet('tasks'); return true;
      case 'l': case 'L': toggleSheet('log'); return true;
      case 'p': case 'P': toggleSheet('patches'); return true;
      case ',': toggleSheet('settings'); return true;
      case '?': toggleSheet('help'); return true;
      case 'm': case 'M': toggleMute(); return true;
    }
    return false;
  }

  return {
    init() {
      CSS('ui', STYLE);
      const root = document.documentElement.style;
      root.setProperty('--ui-spring', LINEAR_OK ? spring(0.8, 15, 600) : 'cubic-bezier(.3,1.25,.5,1)');
      root.setProperty('--ui-bounce', LINEAR_OK ? spring(0.6, 17, 560) : 'cubic-bezier(.34,1.56,.64,1)');
      host = $('sheets');
      if (host) { host.textContent = ''; scrim = h('div', { class: 'ui-scrim', 'aria-hidden': 'true' }); scrim.addEventListener('click', () => close()); host.appendChild(scrim); }
      buildTop(); buildDock(); wire();
      refreshDock();
    },
    layout() { lockChrome(!!cur); },
    update() {},
    key,
    open, close,
    isOpen: () => (cur ? cur.id : null),
    busy: () => !!(cur || modal),
    toast,
    confirm: confirmBox,
    badgeSVG,
    // beyond the contract (dev & other modules): the cost of the last sheet open in ms, and a badge data: URL
    badgeURL,
    perf: () => ({ lastOpenMs: +lastOpenMs.toFixed(2), badgeRasters: Object.keys(BMP).length }),
  };
})();
