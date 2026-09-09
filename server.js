// =======================================================
// Dungeon Crawler - local dev server
// Serves the static site and a small save-game API backed
// by real JSON files under /data (slot-1.json ... slot-10.json).
//
// Run with: npm start   (or: node server.js)
// Then open: http://localhost:3000
// =======================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MAX_SLOTS = 10;
const PORT = process.env.PORT || 3000;
const MAX_BODY_SIZE = 1024 * 1024; // 1MB safety cap on save payloads

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function slotPath(slot) {
  return path.join(DATA_DIR, `slot-${slot}.json`);
}

function isValidSlot(slot) {
  return Number.isInteger(slot) && slot >= 1 && slot <= MAX_SLOTS;
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readRequestBody(req, callback) {
  const chunks = [];
  let tooLarge = false;
  let received = 0;

  req.on('data', (chunk) => {
    received += chunk.length;
    if (received > MAX_BODY_SIZE) {
      tooLarge = true;
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) {
      callback(new Error('Request body too large'));
      return;
    }
    callback(null, Buffer.concat(chunks).toString('utf8'));
  });
  req.on('error', (err) => callback(err));
}

// GET /api/saves -> list all 10 slots with occupied/name/savedAt
function handleListSaves(req, res) {
  const slots = [];
  for (let slot = 1; slot <= MAX_SLOTS; slot += 1) {
    const filePath = slotPath(slot);
    let entry = { slot, occupied: false, name: null, savedAt: null };
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        entry = {
          slot,
          occupied: true,
          name: typeof data.name === 'string' ? data.name : `Save ${slot}`,
          savedAt: data.savedAt || null,
        };
      } catch (err) {
        // corrupted file - report as empty rather than crashing the list
      }
    }
    slots.push(entry);
  }
  sendJson(res, 200, { slots });
}

// GET /api/saves/:slot -> full save payload, used when loading a game
function handleGetSave(req, res, slot) {
  const filePath = slotPath(slot);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: 'Slot is empty.' });
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    sendJson(res, 200, data);
  } catch (err) {
    sendJson(res, 500, { error: 'Save file is corrupted.' });
  }
}

// POST /api/saves/:slot  body: { name, ...gameState } -> writes data/slot-N.json
function handleSaveSlot(req, res, slot) {
  readRequestBody(req, (err, body) => {
    if (err) {
      sendJson(res, 400, { error: 'Could not read request body.' });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (parseErr) {
      sendJson(res, 400, { error: 'Invalid JSON.' });
      return;
    }

    const name = typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim().slice(0, 60)
      : `Save ${slot}`;

    const record = {
      ...payload,
      name,
      savedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(slotPath(slot), JSON.stringify(record, null, 2), 'utf8');
      sendJson(res, 200, { ok: true, slot, name: record.name, savedAt: record.savedAt });
    } catch (writeErr) {
      sendJson(res, 500, { error: 'Could not write save file.' });
    }
  });
}

// DELETE /api/saves/:slot -> removes data/slot-N.json
function handleDeleteSlot(req, res, slot) {
  const filePath = slotPath(slot);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: 'Slot is already empty.' });
    return;
  }
  try {
    fs.unlinkSync(filePath);
    sendJson(res, 200, { ok: true, slot });
  } catch (err) {
    sendJson(res, 500, { error: 'Could not delete save file.' });
  }
}

function serveStaticFile(req, res, pathname) {
  const relativePath = (pathname === '/' ? '/index.html' : pathname).split('?')[0];
  const filePath = path.normalize(path.join(ROOT_DIR, relativePath));

  // prevent path traversal outside the project root
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  const saveSlotMatch = pathname.match(/^\/api\/saves\/(\d+)$/);

  if (pathname === '/api/saves' && req.method === 'GET') {
    handleListSaves(req, res);
    return;
  }

  if (saveSlotMatch) {
    const slot = parseInt(saveSlotMatch[1], 10);
    if (!isValidSlot(slot)) {
      sendJson(res, 400, { error: `Slot must be between 1 and ${MAX_SLOTS}.` });
      return;
    }
    if (req.method === 'GET') return handleGetSave(req, res, slot);
    if (req.method === 'POST' || req.method === 'PUT') return handleSaveSlot(req, res, slot);
    if (req.method === 'DELETE') return handleDeleteSlot(req, res, slot);
  }

  if (req.method === 'GET') {
    serveStaticFile(req, res, pathname);
    return;
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Dungeon Crawler server running at http://localhost:${PORT}`);
});
