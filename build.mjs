#!/usr/bin/env node
// Build Patch's Pomodoro into dist/: one self-contained index.html (every module, the CSS and the fonts inlined,
// no libraries), plus public/ (icons, manifest, audio) and sw.js stamped with this build's cache version.
//
//   node build.mjs                                   # → dist/ (every real module that compiles, stubs for the rest)
//   node build.mjs --out /tmp/x                      # → /tmp/x/index.html (+ public files beside it)
//   node build.mjs --out X --real dial,ui            # only these modules real, stubs for everything else
//   node build.mjs --out X --stub audio              # force a stub
//   node build.mjs --out X --artifact Y.html         # also write Y.html: the page without the document wrapper,
//                                                    # for a claude.ai Artifact (audio must be published beside it)
//   node build.mjs --inline                          # the script inside index.html (one self-contained file)
//   node build.mjs --no-minify                       # skip esbuild even when it's installed
//   node build.mjs --check                           # compile everything, write nothing (CI / Vercel sanity check)
//
// Modules are src/NN-name.js, concatenated in NN order inside one 'use strict' IIFE. core, text and main are
// always real. Any other module falls back to stubs/NN-name.js when its src file is missing, fails
// `node --check`, or breaks the combined script.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUTDIR = path.resolve(opt('out', path.join(DIR, 'dist')));
const REAL = (opt('real', 'all') || 'all').split(',').filter(Boolean);
const STUB = (opt('stub', '') || '').split(',').filter(Boolean);
const QUIET = args.includes('--quiet');
const CHECK = args.includes('--check');

const ALWAYS = ['core', 'text', 'main'];
const ORDER = [['00', 'core'], ['10', 'text'], ['20', 'engine'], ['30', 'audio'], ['40', 'patch'], ['45', 'scene'], ['50', 'dial'], ['60', 'ui'], ['99', 'main']];
const log = (...a) => { if (!QUIET) console.log(...a); };
const warn = (...a) => console.warn('⚠', ...a);
const read = (f) => readFileSync(f, 'utf8');

function syntaxOK(file) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  return r.status === 0 ? null : (r.stderr || '').split('\n').slice(0, 6).join('\n');
}
const pick = {};
for (const [nn, name] of ORDER) {
  const src = path.join(DIR, 'src', `${nn}-${name}.js`), stub = path.join(DIR, 'stubs', `${nn}-${name}.js`);
  if (ALWAYS.includes(name)) { pick[name] = { nn, file: src, real: true }; continue; }
  const wantReal = !STUB.includes(name) && (REAL.includes('all') || REAL.includes(name));
  if (wantReal && existsSync(src) && read(src).trim()) {
    const err = syntaxOK(src);
    if (!err) { pick[name] = { nn, file: src, real: true }; continue; }
    warn(`src/${nn}-${name}.js has a syntax error, using the stub:\n${err}`);
  }
  pick[name] = { nn, file: stub, real: false };
}
const compose = () => ORDER.map(([, name]) => `// ⟪${name}${pick[name].real ? '' : ' (stub)'}⟫\n` + read(pick[name].file).replace(/\s+$/, '')).join('\n\n');
function compiles(js) { try { new vm.Script(`(() => {\n'use strict';\n${js}\n})();`, { filename: 'pomodoro.js' }); return null; } catch (e) { return e.message; } }
let js = compose(), err = compiles(js);
if (err) {
  warn('combined script fails to compile: ' + err);
  const reals = Object.keys(pick).filter((n) => pick[n].real && !ALWAYS.includes(n));
  for (const n of reals) { pick[n].real = false; pick[n].file = path.join(DIR, 'stubs', `${pick[n].nn}-${n}.js`); }
  for (const n of reals) {
    const prev = { ...pick[n] };
    pick[n].real = true; pick[n].file = path.join(DIR, 'src', `${pick[n].nn}-${n}.js`);
    const e2 = compiles(compose());
    if (e2) { warn(`src/${pick[n].nn}-${n}.js breaks the combined script (${e2}), using the stub`); pick[n] = prev; }
  }
  js = compose(); err = compiles(js);
  if (err) { console.error('✖ still fails with stubs: ' + err + ' (core/text/main?)'); process.exit(1); }
}
if (/<\/script/i.test(js)) { console.error('✖ a module contains "</script" (it would end the inline script early)'); process.exit(1); }
const modsLine = ORDER.map(([, n]) => `${n}${pick[n].real ? '' : '·stub'}`).join('  ');
if (CHECK) { log('✓ compiles  ' + modsLine); process.exit(0); }

// fonts: inline every public/fonts/*.woff2 as an @font-face (family from the file name map below)
const FONTS = { 'jbm700.woff2': ['JetBrains Mono', 700], 'dela.woff2': ['Dela Gothic One', 400] };
let fontCSS = '';
const fontDir = path.join(DIR, 'public', 'fonts');
for (const f of existsSync(fontDir) ? readdirSync(fontDir) : []) {
  const spec = FONTS[f]; if (!spec) continue;
  const b64 = readFileSync(path.join(fontDir, f)).toString('base64');
  fontCSS += `@font-face{font-family:"${spec[0]}";font-weight:${spec[1]};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}\n`;
  if (spec[0] === 'JetBrains Mono') fontCSS += `@font-face{font-family:"JetBrains Mono";font-weight:400 600;font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}\n`;
}
const shell = read(path.join(DIR, 'shell.html'));
if (!shell.includes('/*SCRIPT*/') || !shell.includes('/*FONTS*/')) { console.error('✖ shell.html needs the /*FONTS*/ and /*SCRIPT*/ markers'); process.exit(1); }
const build = createHash('sha1').update(js + fontCSS + shell).digest('hex').slice(0, 10);
// The script: one 'use strict' IIFE, minified with esbuild when it's installed (`npm install`; skip with
// --no-minify), else shipped as written. By default it's an external, content-hashed app.<build>.js: browsers
// keep compiled code for external scripts (never for inline ones), so a returning visit skips the parse, and the
// service worker precaches it. --inline puts it back in the page (one self-contained file).
let app = `(() => {\n'use strict';\nconst BUILD = '${build}';\n${js}\n})();\n`, minified = false;
if (!args.includes('--no-minify')) {
  try {
    const esbuild = await import('esbuild');
    app = (await esbuild.transform(app, { minify: true, target: ['safari14', 'chrome80', 'firefox90'], legalComments: 'none', charset: 'utf8' })).code;
    minified = true;
  } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') warn('minify failed, shipping it unminified: ' + e.message); }
}
const INLINE = args.includes('--inline') || !!opt('artifact', '');
const appName = `app.${build}.js`;
if (INLINE && /<\/script/i.test(app)) { console.error('✖ the script contains "</script"; build without --inline'); process.exit(1); }
const html = shell
  .replace('/*FONTS*/', () => fontCSS)
  .replace('<script>/*SCRIPT*/</script>', () => (INLINE ? `<script>\n${app}</script>` : `<script src="${appName}"></script>`));

// write dist/
mkdirSync(OUTDIR, { recursive: true });
for (const f of readdirSync(OUTDIR)) if (/^app\.[0-9a-f]{10}\.js$/.test(f)) unlinkSync(path.join(OUTDIR, f));   // drop older builds' scripts
writeFileSync(path.join(OUTDIR, 'index.html'), html);
if (!INLINE) writeFileSync(path.join(OUTDIR, appName), app);
let copied = 0, bytes = 0;
function copyDir(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f), st = statSync(a);
    if (st.isDirectory()) { if (f !== 'fonts') copyDir(a, b); continue; }
    if (f === 'sw.js' || f.startsWith('.') || f.endsWith('.md')) continue;
    copyFileSync(a, b); copied++; bytes += st.size;
  }
}
copyDir(path.join(DIR, 'public'), OUTDIR);
const swSrc = path.join(DIR, 'public', 'sw.js');
if (existsSync(swSrc)) writeFileSync(path.join(OUTDIR, 'sw.js'), read(swSrc).replace(/__BUILD__/g, build).replace('__APP__', JSON.stringify(INLINE ? [] : [appName])));
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
log(`built ${path.join(OUTDIR, 'index.html')} — ${kb(Buffer.byteLength(html))}${INLINE ? '' : ' + ' + appName + ' ' + kb(Buffer.byteLength(app))}${minified ? ' (minified)' : ''} (build ${build}) + ${copied} public files (${kb(bytes)})`);
log('  ' + modsLine);

const ART = opt('artifact', '');
if (ART) {
  // An Artifact page is wrapped in its own document skeleton (charset + viewport meta), so publish only what
  // goes inside: the <title> first, then the head's styles, then the body. No service worker there.
  const head = (html.match(/<head>([\s\S]*?)<\/head>/) || [])[1] || '';
  const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [])[1] || '';
  const title = (head.match(/<title>[\s\S]*?<\/title>/) || ["<title>Patch's Pomodoro</title>"])[0];
  const rest = head.replace(title, '').replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '').replace(/<link rel="manifest"[^>]*>\s*/i, '');
  const art = `${title}\n${rest.trim()}\n${body.trim()}\n`;
  writeFileSync(path.resolve(ART), art);
  log(`artifact copy → ${path.resolve(ART)} — ${kb(Buffer.byteLength(art))}`);
}
