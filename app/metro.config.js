// Metro bundler settings for TeachWise.
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro normally starts several helper processes to bundle faster. On some
// Windows PCs (antivirus, Controlled Folder Access, or a restricted terminal)
// that is blocked with "spawn EPERM" and every bundle fails. One worker runs
// everything inside the main process, which always works.
config.maxWorkers = 1;

// During development the web app calls /api on its own address
// (http://localhost:8081/api/...), and Metro forwards those calls to Laravel.
// Same-address requests avoid browser cross-origin rules entirely.
const API_TARGET = process.env.TEACHWISE_API_TARGET || 'http://127.0.0.1:8000';

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/')) {
      return middleware(req, res, next);
    }
    const target = new URL(req.url, API_TARGET);
    const proxy = http.request(
      target,
      { method: req.method, headers: { ...req.headers, host: target.host } },
      (upstream) => {
        res.writeHead(upstream.statusCode || 502, upstream.headers);
        upstream.pipe(res);
      }
    );
    proxy.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'The TeachWise API is not running. Start it with start-teachwise.bat.' }));
    });
    req.pipe(proxy);
  },
};

module.exports = config;
