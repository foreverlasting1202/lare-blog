import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--dist');
if (!production) {
  const build = spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { stdio:'inherit' });
  if (build.status) process.exit(build.status);
}
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 4321);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.bib': 'text/plain; charset=utf-8', '.json':'application/json; charset=utf-8', '.woff2':'font/woff2' };

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let name = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if (name.includes('..') || name.includes('\0')) throw new Error('Invalid path');
    const folders = ['dist'];
    for (const folder of folders) {
      let target = path.join(root, folder, name);
      try {
        if ((await stat(target)).isDirectory()) {
          if (!url.pathname.endsWith('/')) {
            response.writeHead(301, { Location: `${url.pathname}/${url.search}` });
            response.end();
            return;
          }
          target = path.join(target, 'index.html');
        }
        if (!(await stat(target)).isFile()) continue;
        const content = await readFile(target);
        response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        response.end(content);
        return;
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      }
    }
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Page not found.');
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain' });
    response.end('Bad request.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`LARE ${production ? 'built' : 'development'} preview: http://localhost:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
