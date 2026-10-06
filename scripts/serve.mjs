// Local preview, including the same chat handler and headers used on Vercel.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import chat from '../api/chat.js';

// Explicit process settings win; .env.local overrides the .env defaults.
for (const name of ['.env.local', '.env']) {
  try { process.loadEnvFile(fileURLToPath(new URL(`../${name}`, import.meta.url))); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Could not load ${name}; check the local settings file.`);
  }
}
const missingSettings = ['GEMINI_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']
  .filter(name => !process.env[name]?.trim());
if (missingSettings.length) {
  console.warn(`Chat is not configured. Set ${missingSettings.join(', ')} in .env.local, then restart the server.`);
}

const root = fileURLToPath(new URL('../public/', import.meta.url));
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webm': 'video/webm', '.glb': 'model/gltf-binary' };
const port = Number(process.env.PORT || 4173);

createServer(async (req, res) => {
  for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
  try {
    const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${port}`}`);
    if (url.pathname === '/api/chat') {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req);
      const response = await chat(new Request(url, { method: req.method, headers: req.headers, body, duplex: 'half' }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(root, `.${pathname === '/' || pathname === '/index' ? '/index.html' : pathname}`);
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    let start = 0, end = info.size - 1;
    if (req.headers.range) {
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!range || Number(range[1]) >= info.size || (range[2] && Number(range[2]) < Number(range[1]))) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
      }
      start = Number(range[1]);
      end = range[2] ? Math.min(Number(range[2]), end) : end;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
    }
    res.setHeader('Content-Length', end - start + 1);
    if (req.method === 'HEAD') res.end();
    else await pipeline(createReadStream(file, { start, end }), res);
  } catch (error) {
    if (!res.headersSent) res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
    res.end('This resource is unavailable.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Peppers preview: http://127.0.0.1:${port}`));
