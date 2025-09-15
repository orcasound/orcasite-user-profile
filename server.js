// Simple static file server for OrcaHello1
// Usage: node server.js
// Serves files from current directory on http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function send(res, status, content, headers={}) {
  res.writeHead(status, Object.assign({'Cache-Control':'no-cache'}, headers));
  res.end(content);
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return send(res, 404, 'Not Found');
      }
      return send(res, 500, 'Server Error');
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = mimeTypes[ext] || 'application/octet-stream';
    send(res, 200, data, {'Content-Type': type});
  });
}

const server = http.createServer((req, res) => {
  let requested = decodeURIComponent(req.url.split('?')[0]);
  if (requested === '/' || requested === '') {
    requested = '/index.html';
  }
  // Prevent directory traversal
  requested = requested.replace(/\\/g,'/');
  if (requested.includes('..')) {
    return send(res, 400, 'Bad Request');
  }
  const filePath = path.join(process.cwd(), requested);
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // Try custom 404 page
      const fourOhFour = path.join(process.cwd(), '404.html');
      return fs.readFile(fourOhFour, (e2, data404) => {
        if (e2) return send(res, 404, 'Not Found');
        send(res, 404, data404, {'Content-Type': 'text/html; charset=UTF-8'});
      });
    }
    if (stats.isDirectory()) {
      return serveFile(path.join(filePath, 'index.html'), res);
    }
    serveFile(filePath, res);
  });
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
});
