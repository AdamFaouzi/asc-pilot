// Serves www/ the way Cloudflare Pages does: static files, /path served from
// /path.html, a 307 from the .html form to the clean one, and 404.html for
// anything missing. Local preview only; Pages needs no server.
//
// The 307 matters. Pages canonicalises /terms.html to /terms, so a _redirects
// rule pointing /terms back at /terms.html builds an infinite loop that only
// appears once deployed. This server reproduces the redirect so that loop shows
// up here instead.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'www');
const port = Number(process.env.PORT ?? 4321);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

const read = async (p) => {
  const full = join(root, p);
  if (!full.startsWith(root)) throw new Error('escape');
  return readFile(full);
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  // Pages redirects the .html form to the clean URL rather than serving both.
  if (path.endsWith('.html') && path !== '/404.html') {
    const clean = path.slice(0, -'.html'.length);
    res.writeHead(307, { Location: clean === '/index' ? '/' : clean });
    return res.end();
  }

  const candidates =
    path.endsWith('/') ? [join(path, 'index.html')] : [path, `${path}.html`];

  for (const candidate of candidates) {
    try {
      const body = await read(candidate);
      res.writeHead(200, { 'Content-Type': types[extname(candidate)] ?? 'application/octet-stream' });
      return res.end(body);
    } catch {
      // try the next candidate
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(await read('/404.html').catch(() => 'Not found'));
}).listen(port, '127.0.0.1', () => {
  console.log(`www/ on http://localhost:${port}`);
});
