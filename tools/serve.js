/**
 * Zero-dependency static server for developing against the source modules.
 *
 * It exists instead of `esbuild --servedir` for one reason: it sends `Cache-Control: no-store`.
 * Zx is developed with no build step, so the browser loads dozens of individual ES modules and
 * stylesheets directly. Without cache headers those responses carry no validators either, and the
 * browser heuristically caches them — which means an edit silently does not show up until a hard
 * reload. Serving everything uncached makes "save, reload, see it" reliable.
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const file = resolveFile(decodeURIComponent(url.pathname));

  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Zx dev server: http://${host}:${port}/website/docs.html`);
});

/**
 * Maps a URL path to a file inside the repository, refusing anything that escapes it.
 * @param {string} pathname Request path.
 * @returns {string|null} Absolute file path, or null when nothing matches.
 */
function resolveFile(pathname) {
  const target = resolve(root, `.${normalize(pathname)}`);
  if (target !== root && !target.startsWith(root + sep)) return null;

  for (const candidate of [target, join(target, 'index.html')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // Missing or unreadable; try the next candidate.
    }
  }
  return null;
}
