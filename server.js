/**
 * AERO EXPRESS - Local Node.js Development Server
 * Mirrors Vercel Serverless Function routing locally with static file serving
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const BASE_DIR = __dirname;

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
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Handlers
const shipmentsListHandler = require('./api/shipments/index');
const shipmentsSingleHandler = require('./api/shipments/[code]');
const adminHandler = require('./api/admin');

function enhanceResponse(res) {
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(obj) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = function(data) {
    res.end(data);
    return res;
  };
}

const server = http.createServer(async (req, res) => {
  enhanceResponse(res);

  // Parse URL & Query
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  req.query = parsedUrl.query || {};

  // Read request body for POST/PUT/PATCH
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
      // 1. Route: /api/admin/*
      if (pathname.startsWith('/api/admin')) {
        return await adminHandler(req, res);
      }

      // 2. Route: /api/shipments (Collection)
      if (pathname === '/api/shipments' || pathname === '/api/shipments/') {
        return await shipmentsListHandler(req, res);
      }

      // 3. Route: /api/shipments/:code (Specific Consignment)
      if (pathname.startsWith('/api/shipments/')) {
        const seg = pathname.slice('/api/shipments/'.length).split('/')[0];
        req.query.code = decodeURIComponent(seg);
        return await shipmentsSingleHandler(req, res);
      }

      // 4. Static File Serving
      let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
      }

      let filePath = path.join(BASE_DIR, safePath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } catch (err) {
      console.error('[Server Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`[AERO EXPRESS] Node.js server active at http://127.0.0.1:${PORT}`);
});
