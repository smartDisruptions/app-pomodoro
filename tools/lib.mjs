// Shared by tools/shot.mjs and tools/perf.mjs: launch headless Chromium on a built dist/, run a step script.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { serve } from './serve.mjs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const CHROME = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => existsSync(p));

export const opts = (argv) => {
  const o = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  return {
    dir: path.resolve(o('dir', 'dist')), out: path.resolve(o('out', '.shots')), size: o('size', '390x844'), dpr: +o('dpr', '2'),
    query: o('query', ''), throttle: +o('throttle', '1'), touch: argv.includes('--touch'), quiet: argv.includes('--quiet'),
    v1: o('v1', ''), keep: o('keep', ''), steps: o('steps', ''), phases: o('phases', ''), reduced: argv.includes('--reduced'), dark: o('scheme', 'dark'), tz: o('tz', 'America/Los_Angeles'),
  };
};

export async function open(O) {
  mkdirSync(O.out, { recursive: true });
  const [W, H] = O.size.split('x').map(Number);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: O.dpr, hasTouch: O.touch, isMobile: O.touch, reducedMotion: O.reduced ? 'reduce' : 'no-preference', colorScheme: O.dark === 'light' ? 'light' : 'dark', timezoneId: O.tz });
  // seed localStorage before the app boots: --v1 file.json (old app keys, for migration) or --keep file.json (a saved pomo2 DB)
  const seed = {};
  if (O.v1) Object.assign(seed, JSON.parse(readFileSync(O.v1, 'utf8')));
  if (O.keep) seed['pomo2:db'] = readFileSync(O.keep, 'utf8');
  if (Object.keys(seed).length) await context.addInitScript((s) => { if (!sessionStorage.getItem('__seeded')) { for (const k in s) localStorage.setItem(k, typeof s[k] === 'string' ? s[k] : JSON.stringify(s[k])); sessionStorage.setItem('__seeded', '1'); } }, seed);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning') { if (!/favicon|net::ERR|Failed to load resource/.test(t)) errors.push(`[${m.type()}] ${t}`); } else if (!O.quiet) console.log('  console:', t); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + (e.stack || e.message)));
  if (O.throttle > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: O.throttle }); }
  const srv = await serve(O.dir);
  await page.goto(srv.url + (O.query ? '?' + O.query : ''));
  await page.waitForFunction(() => window.__pomo && window.__pomo.ready, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  return { browser, page, errors, srv, W, H };
}

// Steps, separated by ';' (write \; for a literal semicolon inside eval):
//   wait MS · shot NAME · click CSS · tap X Y · drag X0 Y0 X1 Y1 [MS] · key KEY · type CSS TEXT…
//   eval JS · start · pause · toggle · reset · skip · finish · speed F · wind SECONDS · sheet ID [ARG] · close
//   activity ID|off · focusmode on|off · seed KIND · perf · perfreset · quality Q · emit TYPE [JSON] · reload
export async function run(page, stepsStr, O, log = console.log) {
  const steps = stepsStr.replace(/\\;/g, '\u0000').split(';').map((s) => s.replace(/\u0000/g, ';').trim()).filter(Boolean);
  const results = {};
  for (const st of steps) {
    const [cmd, ...rest] = st.split(/\s+/); const arg = st.slice(cmd.length).trim();
    const P = (js, a) => page.evaluate(js, a);
    switch (cmd) {
      case 'wait': await page.waitForTimeout(+rest[0] || 0); break;
      case 'shot': { const f = path.join(O.out, rest[0] + '.png'); await page.screenshot({ path: f }); log('  shot ' + f); break; }
      case 'click': await page.click(arg, { timeout: 5000 }); break;
      case 'tap': if (O.touch) await page.touchscreen.tap(+rest[0], +rest[1]); else await page.mouse.click(+rest[0], +rest[1]); break;
      case 'drag': { const [x0, y0, x1, y1, ms = 400] = rest.map(Number); const n = Math.max(4, Math.round(ms / 16)); await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= n; i++) { await page.mouse.move(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await page.waitForTimeout(16); } await page.mouse.up(); break; }
      case 'key': await page.keyboard.press(rest[0]); break;
      case 'type': { const sel = rest[0]; await page.fill(sel, rest.slice(1).join(' ')); break; }
      case 'eval': { const r = await P(`(async () => { ${arg} })()`); if (r !== undefined) log('  eval →', JSON.stringify(r)); results.eval = r; break; }
      case 'start': case 'pause': case 'toggle': case 'reset': case 'skip': case 'finish': case 'close': await P((c) => window.__pomo[c](), cmd); break;
      case 'speed': await P((f) => window.__pomo.speed(f), +rest[0]); break;
      case 'wind': await P((s) => window.__pomo.wind(s), +rest[0]); break;
      case 'sheet': await P(([id, a]) => window.__pomo.sheet(id, a), [rest[0], rest[1]]); break;
      case 'activity': await P((id) => window.__pomo.activity(id === 'off' ? null : id), rest[0]); break;
      case 'focusmode': await P((on) => window.__pomo.focusMode(on === 'on'), rest[0]); break;
      case 'seed': await P((k) => window.__pomo.seed(k), rest[0] || 'demo'); break;
      case 'quality': await P((q) => window.__pomo.quality(q), +rest[0]); break;
      case 'emit': await P(([t, j]) => window.__pomo.emit(t, j ? JSON.parse(j) : {}), [rest[0], rest.slice(1).join(' ') || null]); break;
      case 'perfreset': await P(() => window.__pomo.perfReset()); break;
      case 'perf': { const r = await P(() => window.__pomo.perf()); log('  perf', JSON.stringify(r)); results.perf = r; break; }
      case 'reload': await page.reload(); await page.waitForFunction(() => window.__pomo && window.__pomo.ready, null, { timeout: 30000 }); break;
      default: log('  ? unknown step: ' + st);
    }
  }
  return results;
}
