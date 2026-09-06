/**
 * AERO EXPRESS - Production Node.js Server
 * Serves static frontend assets and routes API requests to serverless handlers
 * Designed for standard Linux VPS deployment with PM2 & reverse proxy (Nginx/Caddy)
 */

// 1. Load Environment Variables (.env) via dotenv
const fs = require('fs');
const path = require('path');

try {
  require('dotenv').config();
} catch (e) {
  // Fallback for Node.js 20.6+ native env loader
  if (typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(); } catch (_) {}
  }
}

// Fallback manual .env parser if dotenv is not yet installed
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envLines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const line of envLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (_) {}
}

const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const BASE_DIR = path.resolve(__dirname);

// Comprehensive MIME Type Dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

// API Route Handlers
const shipmentsListHandler = require('./api/shipments/index');
const shipmentsSingleHandler = require('./api/shipments/[code]');
const adminHandler = require('./api/admin');

/**
 * Polyfill Express-style helper methods onto native http.ServerResponse
 */
function enhanceResponse(res) {
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(obj) {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = function(data) {
    if (!res.headersSent) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.end(data);
    return res;
  };
}

const server = http.createServer(async (req, res) => {
  enhanceResponse(res);

  // Parse URL & Query using WHATWG URL standard
  const host = req.headers.host || '127.0.0.1';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname || '/';
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());

  // Global CORS Preflight OPTIONS Handling
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // Read request body for POST/PUT/PATCH requests
  let bodyBuffer = [];
  req.on('data', chunk => bodyBuffer.push(chunk));
  req.on('end', async () => {
    const rawBody = Buffer.concat(bodyBuffer).toString('utf-8');
    if (rawBody) {
      try {
        req.body = JSON.parse(rawBody);
      } catch (e) {
        req.body = rawBody;
      }
    } else {
      req.body = {};
    }

    try {
      // -----------------------------------------------------------------------
      // 1. API Route: /api/admin/* (Authentication & Account Settings)
      // -----------------------------------------------------------------------
      if (pathname.startsWith('/api/admin')) {
        return await adminHandler(req, res);
      }

      // -----------------------------------------------------------------------
      // 2. API Route: /api/shipments (Collection GET / POST)
      // -----------------------------------------------------------------------
      if (pathname === '/api/shipments' || pathname === '/api/shipments/') {
        return await shipmentsListHandler(req, res);
      }

      // -----------------------------------------------------------------------
      // 3. API Route: /api/shipments/:code (Specific Consignment GET/PUT/DELETE)
      // -----------------------------------------------------------------------
      if (pathname.startsWith('/api/shipments/')) {
        const seg = pathname.slice('/api/shipments/'.length).split('/')[0];
        req.query.code = decodeURIComponent(seg);
        return await shipmentsSingleHandler(req, res);
      }

      // -----------------------------------------------------------------------
      // 4. Static Frontend Assets Serving
      // -----------------------------------------------------------------------
      let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
      }

      let filePath = path.join(BASE_DIR, safePath);

      // Prevent Directory Traversal Attack
      if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('403 Forbidden: Access Denied');
      }

      // Directory index fallback (e.g. / -> /index.html)
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      // Clean URLs / Extensionless resolution (e.g. /admin -> admin.html, /track -> track.html)
      if (!fs.existsSync(filePath) && !path.extname(filePath)) {
        const htmlCandidate = filePath + '.html';
        if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
          filePath = htmlCandidate;
        }
      }

      // Serve static file if exists
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // -----------------------------------------------------------------------
      // 5. 404 Not Found Fallback
      // -----------------------------------------------------------------------
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>404 Not Found - Aero Express</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { text-align: center; max-width: 480px; padding: 32px; background: #151d2f; border: 1px solid #1e293b; border-radius: 12px; }
            h1 { font-size: 48px; margin: 0 0 12px; color: #ef4444; }
            p { color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
            a { display: inline-block; background: #ef4444; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>404</h1>
            <p>The requested file or endpoint could not be found on the Aero Express server.</p>
            <a href="/">Return to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      console.error('[Server Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`[AERO EXPRESS] Node.js Production Server Active`);
  console.log(`Local Address: http://127.0.0.1:${PORT}`);
  console.log(`Bound to all interfaces: http://0.0.0.0:${PORT}`);
  console.log(`Database Status: ${process.env.DATABASE_URL ? 'Configured (DATABASE_URL loaded)' : 'Notice: DATABASE_URL not set, local JSON active'}`);
  console.log(`====================================================`);
});
