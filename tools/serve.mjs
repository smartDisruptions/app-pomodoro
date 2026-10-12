#!/usr/bin/env node
// A tiny static server for dist/ (the service worker and audio fetches need http, not file://).
//   node tools/serve.mjs dist 5173 [--build]     (--build runs build.mjs first)
//   import { serve } from './serve.mjs'; const s = await serve('/abs/dist'); s.url … s.close()
import http from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
export function serve(dir, port = 0) {
  const root = path.resolve(dir);
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      try {
        let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
        if (!p.startsWith(root)) { rsp.writeHead(403); return rsp.end(); }
        if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
        const st = statSync(p);
        const type = TYPES[path.extname(p)] || 'application/octet-stream';
        const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
        if (range) {
          const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : st.size - 1;
          rsp.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
          return createReadStream(p, { start: a, end: b }).pipe(rsp);
        }
        rsp.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
        createReadStream(p).pipe(rsp);
      } catch (e) { rsp.writeHead(404); rsp.end(); }
    });
    srv.listen(port, '127.0.0.1', () => res({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'dist', port = +(process.argv[3] || 5173);
  if (process.argv.includes('--build')) spawnSync(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'build.mjs')], { stdio: 'inherit' });
  const s = await serve(dir, port);
  console.log('serving ' + path.resolve(dir) + ' at ' + s.url);
}
