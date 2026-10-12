// STUB Dial: a plain tomato, a readout and the controls (CONTRACT.md §8.5). The real one lives in src/50-dial.js.
const Dial = (() => {
  let root, time, label, btn;
  CSS('dial-stub', `
#dial{position:fixed;left:var(--ui-x);top:var(--ui-y);width:var(--ui-w);height:var(--ui-h);display:flex;flex-direction:column;align-items:center;gap:10px;padding-top:calc(var(--dial-cy) - var(--ui-y) - var(--dial-r))}
.ds-tom{width:calc(var(--dial-r)*2);height:calc(var(--dial-r)*1.8);border-radius:50% 50% 46% 46%;background:radial-gradient(circle at 34% 30%,#ff9a86,#ff4a3d 45%,#c8231a);pointer-events:auto}
.ds-time{font:700 44px/1 var(--mono);letter-spacing:-.02em}.ds-label{font:700 12px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.ds-row{display:flex;gap:10px}.ds-row button{min-width:44px;height:44px;padding:0 16px;border-radius:999px;background:var(--surface-2);font-weight:700}.ds-row button.go{background:var(--accent);color:var(--on-accent);min-width:120px}`);
  function render() {
    if (!root) return;
    time.textContent = mmss(TIMER.left);
    label.textContent = TEXT.modes[TIMER.mode].label + (TIMER.state === 'paused' ? ' · paused' : '');
    btn.textContent = TIMER.state === 'running' ? TEXT.ui.pause : TIMER.state === 'paused' ? TEXT.ui.resume : TEXT.ui.start;
  }
  return {
    init() {
      root = $('dial');
      const tom = h('button', { class: 'ds-tom', 'aria-label': 'Tomato timer', onclick: () => Engine.toggle() });
      time = h('div', { class: 'ds-time' }); label = h('div', { class: 'ds-label' });
      btn = h('button', { class: 'go', onclick: () => Engine.toggle() });
      root.append(tom, time, label, h('div', { class: 'ds-row' },
        h('button', { onclick: () => Engine.reset(), 'aria-label': TEXT.ui.reset, html: ICON('reset') }), btn,
        h('button', { onclick: () => Engine.skip(), 'aria-label': TEXT.ui.skip, html: ICON('skip') }),
        h('button', { onclick: () => SHEET.open('capture'), 'aria-label': TEXT.ui.distracted, html: ICON('glitch') })));
      ['timer:tick', 'timer:state', 'timer:mode'].forEach((e) => BUS.on(e, render));
      render();
    },
    layout() {},
    update() {},
    key(e) {
      if (e.key === ' ' || e.code === 'Space') { Engine.toggle(); return true; }
      if (e.key === 'r' || e.key === 'R') { Engine.reset(); return true; }
      if (e.key === 's' || e.key === 'S') { Engine.skip(); return true; }
      return false;
    },
    rect: () => { const d = LAYOUT.dial; return { x: d.cx - d.r, y: d.cy - d.r, w: d.r * 2, h: d.r * 2 }; },
    activity() {},
    focusMode(on) { FOCUSMODE.on = !!on; document.documentElement.classList.toggle('heads-down', FOCUSMODE.on); BUS.emit('focusmode', { on: FOCUSMODE.on }); },
  };
})();
