import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

export const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.webp':'image/webp', '.png':'image/png', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2' };
export function createAppServer() {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow:'GET, HEAD' }); response.end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let path = resolve(publicRoot, '.' + pathname);
      if (path !== resolve(publicRoot) && !path.startsWith(resolve(publicRoot) + sep)) { response.writeHead(403); response.end(); return; }
      let info;
      try { info = await stat(path); } catch { /* Fallback only for client routes, never for missing assets. */ }
      if (!info?.isFile()) {
        if (extname(pathname)) { response.writeHead(404); response.end('Archivo no encontrado'); return; }
        path = resolve(publicRoot, 'index.html');
      }
      const content = await readFile(path);
      response.writeHead(200, { 'Content-Type':types[extname(path)] ?? 'application/octet-stream', 'Content-Length':content.length, 'Cache-Control':'no-store' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(400); response.end('Solicitud no válida'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createAppServer();
  server.listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? '127.0.0.1', () => {
    console.log(`CONNECT recuperado: servidor iniciado en puerto ${server.address().port}`);
  });
}
