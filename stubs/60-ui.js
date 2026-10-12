// STUB UI: a top bar, a dock, plain sheets and toasts (CONTRACT.md §8.6). The real one lives in src/60-ui.js.
const UI = (() => {
  let open = null, sheetEl = null;
  CSS('ui-stub', `
#top{position:fixed;left:0;top:0;right:0;height:var(--top-h);padding:calc(var(--sat) + 14px) 16px 0;font:400 14px/1 var(--display);letter-spacing:.04em}
#dock{position:fixed;left:0;right:0;bottom:0;height:var(--dock-h);display:flex;justify-content:space-around;align-items:flex-start;padding-top:8px;background:var(--glass)}
#dock button{display:flex;flex-direction:column;align-items:center;gap:3px;font:700 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted);min-width:64px;min-height:44px}
.us-sheet{position:fixed;left:0;right:0;bottom:0;max-height:80vh;overflow:auto;background:var(--surface);border-radius:20px 20px 0 0;padding:20px 20px calc(20px + var(--sab));pointer-events:auto;box-shadow:var(--shadow)}
.us-sheet h2{margin:0 0 12px;font:400 20px/1.1 var(--display)}.us-x{position:absolute;right:12px;top:12px;width:44px;height:44px}
.us-toast{position:fixed;left:50%;top:calc(var(--top-h) + 8px);transform:translateX(-50%);padding:10px 16px;border-radius:999px;background:var(--surface-3);font-weight:700;box-shadow:var(--shadow)}
.us-cap{display:grid;grid-template-columns:1fr 1fr;gap:8px}.us-cap button{padding:12px;border-radius:12px;background:var(--surface-2);text-align:left}`);
  SHEET.def('capture', { title: TEXT.ui.captureQ, render(body) {
    const grid = h('div', { class: 'us-cap' });
    for (const r of TEXT.rogues) grid.appendChild(h('button', { onclick: () => { Engine.captureRogue(r.id, ''); UI.close(); } }, h('b', null, r.what), h('div', null, r.name)));
    body.appendChild(grid);
  } });
  function close() { if (sheetEl) sheetEl.remove(); sheetEl = null; const was = open; open = null; if (was) { try1(SHEETS[was], 'closed'); BUS.emit('ui:sheet', { id: null }); } }
  function openSheet(id, arg) {
    close();
    const def = SHEETS[id] || { title: id, render(b) { b.appendChild(h('p', null, 'Coming soon.')); } };
    const body = h('div');
    sheetEl = h('section', { class: 'us-sheet', role: 'dialog', 'aria-label': def.title || id }, h('h2', null, def.title || id), h('button', { class: 'us-x', 'aria-label': 'Close', html: ICON('close'), onclick: close }), body);
    $('sheets').appendChild(sheetEl);
    open = id;
    try { def.render(body, arg); } catch (e) { reportErr('sheet:' + id, e); }
    try1(def, 'opened', arg);
    BUS.emit('ui:sheet', { id });
  }
  return {
    init() {
      $('top').textContent = TEXT.app.name;
      const dock = $('dock');
      for (const [id, icon, label] of [['tasks', 'tasks', TEXT.ui.tasks], ['log', 'log', TEXT.ui.log], ['patches', 'patch', TEXT.ui.patches], ['settings', 'settings', TEXT.ui.settings]])
        dock.appendChild(h('button', { onclick: () => openSheet(id), html: ICON(icon) + `<span>${label}</span>` }));
    },
    layout() {},
    update() {},
    key(e) { if (e.key === 'Escape' && open) { close(); return true; } return false; },
    open: openSheet, close,
    isOpen: () => open,
    busy: () => !!open,
    toast(text) { const el = h('div', { class: 'us-toast', role: 'status' }, String(text)); $('toasts').appendChild(el); setTimeout(() => el.remove(), 2600); },
    confirm: (text) => Promise.resolve(window.confirm(text)),
    badgeSVG(id) { const p = PATCHDEF(id); const c = p ? p.color : '#888'; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="${c}"/><circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/></svg>`; },
  };
})();
