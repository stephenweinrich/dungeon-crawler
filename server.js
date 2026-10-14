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
const crypto = require('crypto');

const ROOT_DIR = __dirname;

// Load settings from .env (KEY=value lines) next to this file. Real
// environment variables win, so setting one in the shell still overrides it.
(function loadDotEnv() {
  let text;
  try { text = fs.readFileSync(path.join(__dirname, '.env'), 'utf8'); } catch (e) { return; }
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((line) => {
    if (line.trim().startsWith('#')) return;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) return;
    let value = m[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    // blank values (the template's placeholders) mean "not set"
    if (value !== '' && process.env[m[1]] === undefined) process.env[m[1]] = value;
  });
}());
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
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
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

// POST /api/feedback  body: { type: 'bug'|'feature', title, description, context? }
// -> appends an entry to data/feedback.json (a JSON array, newest last)
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const FEEDBACK_TYPES = ['bug', 'feature'];

function handleFeedback(req, res) {
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

    const type = payload.type;
    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 120) : '';
    const description = typeof payload.description === 'string' ? payload.description.trim().slice(0, 4000) : '';
    if (!FEEDBACK_TYPES.includes(type)) {
      sendJson(res, 400, { error: 'Type must be "bug" or "feature".' });
      return;
    }
    if (!title || !description) {
      sendJson(res, 400, { error: 'Title and description are required.' });
      return;
    }

    let entries = [];
    if (fs.existsSync(FEEDBACK_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
        if (Array.isArray(parsed)) entries = parsed;
      } catch (readErr) {
        sendJson(res, 500, { error: 'feedback.json is corrupted - fix or delete it.' });
        return;
      }
    }

    const record = {
      id: entries.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1,
      type,
      title,
      description,
      context: payload.context && typeof payload.context === 'object' ? payload.context : undefined,
      createdAt: new Date().toISOString(),
    };
    entries.push(record);

    try {
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2), 'utf8');
      sendJson(res, 200, { ok: true, id: record.id });
    } catch (writeErr) {
      sendJson(res, 500, { error: 'Could not write feedback file.' });
    }
  });
}

// =======================================================
// Admin data editor API (the hidden editor opened from the top bar).
// POST /api/admin/login            { password }  -> { token }
// GET  /api/admin/data/:kind       items | mobs | npcs -> the raw JSON file
// PUT  /api/admin/data/:kind       full replacement JSON (validated, .bak kept)
// POST /api/admin/upload?dir=&name= raw PNG body -> assets/<dir>/<name>
// Everything but login needs the X-Admin-Token header from a login.
// Password: "damnitdonut", unless the ADMIN_PASSWORD env var overrides it.
// =======================================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'damnitdonut';
const adminTokens = new Set();
let adminFailures = 0;
const ADMIN_KINDS = { items: 'items.json', mobs: 'mobs.json', npcs: 'npcs.json' };
const UPLOAD_DIRS = ['icons', 'cards', 'mobs', 'images'];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function isAdmin(req) {
  const token = req.headers['x-admin-token'];
  return typeof token === 'string' && adminTokens.has(token);
}

function readRawBody(req, limit, callback) {
  const chunks = [];
  let received = 0;
  let tooLarge = false;
  req.on('data', (chunk) => {
    received += chunk.length;
    if (received > limit) { tooLarge = true; return; }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) callback(new Error('too large'));
    else callback(null, Buffer.concat(chunks));
  });
  req.on('error', (err) => callback(err));
}

function handleAdminLogin(req, res) {
  readRequestBody(req, (err, body) => {
    if (err) return sendJson(res, 400, { error: 'Could not read request body.' });
    let password = '';
    try { password = String(JSON.parse(body || '{}').password || ''); } catch (e) { /* bad json -> wrong password */ }
    if (!safeEqual(password, ADMIN_PASSWORD)) {
      adminFailures += 1;
      // slow every wrong guess down, more the more there have been
      return setTimeout(() => sendJson(res, 401, { error: 'Wrong password.' }), Math.min(5000, 400 * adminFailures));
    }
    adminFailures = 0;
    const token = crypto.randomBytes(24).toString('hex');
    adminTokens.add(token);
    sendJson(res, 200, { token });
  });
}

// returns an error string, or null if the file shape is fine
function validateAdminData(kind, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Top level must be an object.';
  const seen = new Set();
  const check = (list, label) => {
    if (!Array.isArray(list)) return `${label} must be a list.`;
    for (const e of list) {
      if (!e || typeof e !== 'object') return `${label} has a non-object entry.`;
      if (typeof e.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(e.id)) return `Bad id "${e.id}" (lowercase letters, digits and dashes only).`;
      if (typeof e.name !== 'string' || !e.name.trim()) return `"${e.id}" needs a name.`;
      if (e.effect !== undefined && (e.effect === null || typeof e.effect !== 'object' || Array.isArray(e.effect))) return `"${e.id}": effect must be an object like {"defense": 5}.`;
      if (seen.has(e.id)) return `Duplicate id "${e.id}".`;
      seen.add(e.id);
    }
    return null;
  };
  if (kind === 'items') return check(data.items, 'items');
  if (kind === 'npcs') return check(data.npcs, 'npcs');
  if (!data.levels || typeof data.levels !== 'object' || Array.isArray(data.levels)) return 'mobs needs a "levels" object.';
  for (const [lvl, list] of Object.entries(data.levels)) {
    const bad = check(list, `level ${lvl}`);
    if (bad) return bad;
  }
  return null;
}

function handleAdminData(req, res, kind) {
  const file = path.join(DATA_DIR, ADMIN_KINDS[kind]);
  if (req.method === 'GET') {
    if (!fs.existsSync(file)) return sendJson(res, 404, { error: `${ADMIN_KINDS[kind]} not found.` });
    try {
      return sendJson(res, 200, JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (e) {
      return sendJson(res, 500, { error: `${ADMIN_KINDS[kind]} is corrupted.` });
    }
  }
  if (req.method !== 'PUT') { res.writeHead(405); res.end('Method Not Allowed'); return; }
  readRequestBody(req, (err, body) => {
    if (err) return sendJson(res, 400, { error: 'Could not read request body.' });
    let data;
    try { data = JSON.parse(body); } catch (e) { return sendJson(res, 400, { error: 'Invalid JSON.' }); }
    const problem = validateAdminData(kind, data);
    if (problem) return sendJson(res, 400, { error: problem });
    try {
      if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, file);
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 500, { error: 'Could not write the data file.' });
    }
  });
}

function handleAdminUpload(req, res, query) {
  const dir = String(query.dir || '');
  const name = String(query.name || '');
  if (!UPLOAD_DIRS.includes(dir)) return sendJson(res, 400, { error: 'Bad target folder.' });
  if (!/^[a-z0-9][a-z0-9._-]*\.png$/i.test(name) || name.includes('..')) {
    return sendJson(res, 400, { error: 'File name must be letters/digits/dashes and end in .png.' });
  }
  readRawBody(req, MAX_UPLOAD_SIZE, (err, buf) => {
    if (err) return sendJson(res, 413, { error: 'Image is too large (5MB max).' });
    if (buf.length < PNG_MAGIC.length || !buf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
      return sendJson(res, 400, { error: 'Only PNG images are accepted.' });
    }
    try {
      const target = path.join(ROOT_DIR, 'assets', dir);
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
      const dest = path.join(target, name);
      if (fs.existsSync(dest)) {
        // never destroy existing art: park the old file under assets/_backups
        const bak = path.join(ROOT_DIR, 'assets', '_backups', dir);
        fs.mkdirSync(bak, { recursive: true });
        fs.copyFileSync(dest, path.join(bak, `${name.replace(/\.png$/i, '')}-${Date.now()}.png`));
      }
      fs.writeFileSync(dest, buf);
      sendJson(res, 200, { ok: true, path: `assets/${dir}/${name}` });
    } catch (e) {
      sendJson(res, 500, { error: 'Could not save the image.' });
    }
  });
}

// =======================================================
// Level (floor map) editor API: data/map-level<N>.json
// GET /api/admin/maps        -> [{ level, name, subtitle, cols, rows }]
// GET /api/admin/map/:n      -> the floor's JSON
// PUT /api/admin/map/:n      -> validate + write (creates a new floor if absent)
// =======================================================
const MAX_FLOOR = 99;
const MAP_TILE_CHARS = ' #.+EBDS';
const mapPath = (n) => path.join(DATA_DIR, `map-level${n}.json`);

function validateMapData(n, m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return 'Map must be an object.';
  if (Number(m.level) !== n) return `Map level must be ${n}.`;
  if (typeof m.name !== 'string' || !m.name.trim()) return 'The floor needs a name.';
  const g = m.grid;
  if (!g || !Number.isInteger(g.cols) || !Number.isInteger(g.rows) || g.cols < 5 || g.rows < 5 || g.cols > 120 || g.rows > 120) {
    return 'Grid size must be 5-120 columns by 5-120 rows.';
  }
  if (!Array.isArray(m.tiles) || m.tiles.length !== g.rows) return 'tiles must have one string per row.';
  for (const row of m.tiles) {
    if (typeof row !== 'string' || row.length !== g.cols) return 'Every tile row must be exactly `cols` characters.';
    for (const ch of row) if (!MAP_TILE_CHARS.includes(ch)) return `Unknown tile character "${ch}".`;
  }
  const inRange = (p) => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < g.cols && p.y < g.rows;
  if (!inRange(m.start)) return 'start must be a cell inside the grid.';
  if (m.safeRoom !== undefined && !inRange(m.safeRoom)) return 'safeRoom must be a cell inside the grid.';
  if (!Array.isArray(m.mobs)) return 'mobs must be a list.';
  for (const mob of m.mobs) {
    if (!mob || typeof mob.id !== 'string' || !inRange(mob)) return 'Every mob needs an id and a cell inside the grid.';
  }
  return null;
}

// GET /api/admin/feedback?type=bug|feature -> player reports, newest first
function handleAdminFeedback(req, res, query) {
  let entries = [];
  if (fs.existsSync(FEEDBACK_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
      if (Array.isArray(parsed)) entries = parsed;
    } catch (e) {
      return sendJson(res, 500, { error: 'feedback.json is corrupted.' });
    }
  }
  if (FEEDBACK_TYPES.includes(query.type)) entries = entries.filter((e) => e.type === query.type);
  entries.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  sendJson(res, 200, { entries });
}

function handleAdminMaps(req, res) {
  const out = [];
  fs.readdirSync(DATA_DIR).forEach((f) => {
    const m = /^map-level(\d+)\.json$/.exec(f);
    if (!m) return;
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      out.push({ level: Number(m[1]), name: d.name || `Floor ${m[1]}`, subtitle: d.subtitle || '', cols: d.grid && d.grid.cols, rows: d.grid && d.grid.rows });
    } catch (e) { /* skip unreadable file */ }
  });
  out.sort((a, b) => a.level - b.level);
  sendJson(res, 200, { maps: out });
}

function handleAdminMap(req, res, n) {
  if (n < 1 || n > MAX_FLOOR) return sendJson(res, 400, { error: `Floor must be 1-${MAX_FLOOR}.` });
  const file = mapPath(n);
  if (req.method === 'GET') {
    if (!fs.existsSync(file)) return sendJson(res, 404, { error: `Floor ${n} doesn't exist.` });
    try { return sendJson(res, 200, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { return sendJson(res, 500, { error: 'That map file is corrupted.' }); }
  }
  if (req.method !== 'PUT') { res.writeHead(405); res.end('Method Not Allowed'); return; }
  readRequestBody(req, (err, body) => {
    if (err) return sendJson(res, 400, { error: 'Could not read request body.' });
    let data;
    try { data = JSON.parse(body); } catch (e) { return sendJson(res, 400, { error: 'Invalid JSON.' }); }
    const problem = validateMapData(n, data);
    if (problem) return sendJson(res, 400, { error: problem });
    try {
      if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.renameSync(tmp, file);
      sendJson(res, 200, { ok: true });
    } catch (e) {
      sendJson(res, 500, { error: 'Could not write the map file.' });
    }
  });
}

// =======================================================
// AI image generation for the admin editor.
// POST /api/admin/generate  { kind, target: 'icon'|'image', entry, notes? }
//   -> { b64 }  a PROPOSED png; nothing is saved until the editor uploads it.
// Style match: the entry's current art plus a few other entries' art for
// the same field are sent to OpenAI's image-edit endpoint as references,
// along with a prompt built from the entry's description and stats.
// Config (env): OPENAI_API_KEY (required), OPENAI_IMAGE_MODEL
// (default gpt-image-1), OPENAI_IMAGE_QUALITY (low|medium|high).
// =======================================================
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_QUALITY = process.env.OPENAI_IMAGE_QUALITY || '';
const MAX_REFERENCES = 3;
const ART_PATH_RE = /^assets\/(icons|cards|mobs|images)\/[A-Za-z0-9._-]+\.png$/;

// existing art on disk for this kind + field: the entry's own first, then
// other entries' (file order), capped at MAX_REFERENCES
function entriesOfKind(kind) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, ADMIN_KINDS[kind]), 'utf8'));
    if (kind === 'items') return data.items || [];
    if (kind === 'npcs') return data.npcs || [];
    return Object.values(data.levels || {}).flat();
  } catch (e) {
    return []; // no data file yet
  }
}

function referenceImages(kind, field, entry) {
  const list = entriesOfKind(kind);
  const candidates = [entry[field], ...list.filter((e) => e.id !== entry.id).map((e) => e[field])];
  const out = [];
  for (const rel of candidates) {
    if (typeof rel !== 'string' || !ART_PATH_RE.test(rel) || out.some((o) => o.rel === rel)) continue;
    const abs = path.join(ROOT_DIR, rel);
    if (!abs.startsWith(path.join(ROOT_DIR, 'assets')) || !fs.existsSync(abs)) continue;
    out.push({ rel, abs });
    if (out.length >= MAX_REFERENCES) break;
  }
  return out;
}

function describeEntry(kind, e) {
  const lines = [`Name: ${e.name}`];
  const add = (label, v) => { if (v !== undefined && v !== null && v !== '') lines.push(`${label}: ${typeof v === 'object' ? JSON.stringify(v) : v}`); };
  if (kind === 'items') {
    const typeLabel = e.type ? e.type.charAt(0).toUpperCase() + e.type.slice(1) : 'Item';
    add('Type line', `Item — ${typeLabel}${e.toggle ? ' · Toggle' : ''}`);
    add('Value', e.value !== undefined ? `${e.value} gold` : '');
    add('Use effect (summarise in one short line)', e.tooltip || e.tooltipOff);
  } else if (kind === 'mobs') {
    add('Role', e.role);
    add('HP', e.hp); add('Attack', e.attack); add('Defense', e.defense); add('XP', e.xp);
  } else {
    add('Role', e.role);
  }
  add('Description / lore (condense to one short flavour line of at most 30 words, same voice)', e.description);
  return lines.join('\n');
}

function buildImagePrompt(kind, target, entry, notes) {
  const facts = describeEntry(kind, entry);
  let prompt;
  if (target === 'iconImage') {
    prompt = 'Create ONE game inventory icon in exactly the same art style as the attached reference icons: '
      + 'painterly dark-fantasy digital illustration, highly detailed textures, dramatic warm rim lighting, '
      + 'the subject alone, centred and filling most of the frame (slightly diagonal like the references), '
      + 'fully transparent background, no text, no border, no frame, no floor or shadow plate. '
      + 'Match the references\' colour palette, level of detail and lighting.\n\n'
      + `Subject to depict:\n${facts}`;
  } else {
    prompt = 'Create ONE collectible dungeon-crawler trading card that matches the attached reference cards exactly in '
      + 'layout, ornate gold-and-black frame, typography, parchment text boxes and overall rendering style. '
      + 'Keep every structural element the references have (title banner, central illustration, type bar, '
      + 'flavour-text box, bottom stat/value row, corner tag); replace only the content with the details below. '
      + 'The central illustration should show the subject in a fitting dark dungeon setting, painterly and dramatic. '
      + 'Render all text crisp and spelled exactly as given.\n\n'
      + `Card content:\n${facts}`;
  }
  if (notes) prompt += `\n\nExtra direction from the designer: ${notes}`;
  return prompt;
}

async function handleAdminGenerate(req, res) {
  readRequestBody(req, async (err, body) => {
    if (err) return sendJson(res, 400, { error: 'Could not read request body.' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return sendJson(res, 503, { error: 'OPENAI_API_KEY is not set on the server.' });
    let p;
    try { p = JSON.parse(body); } catch (e) { return sendJson(res, 400, { error: 'Invalid JSON.' }); }
    const { kind, target } = p;
    const entry = p.entry;
    if (!ADMIN_KINDS[kind]) return sendJson(res, 400, { error: 'Bad kind.' });
    if (!['iconImage', 'image'].includes(target)) return sendJson(res, 400, { error: 'Bad target field.' });
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') return sendJson(res, 400, { error: 'Entry needs a name.' });
    const notes = typeof p.notes === 'string' ? p.notes.trim().slice(0, 500) : '';

    const isIcon = target === 'iconImage';
    const prompt = buildImagePrompt(kind, target, entry, notes);
    const refs = referenceImages(kind, target, entry);
    const quality = OPENAI_QUALITY || (isIcon ? 'medium' : 'high');
    const size = isIcon ? '1024x1024' : '1024x1536';
    const common = { model: OPENAI_MODEL, prompt, size, quality, n: 1 };
    if (isIcon) { common.background = 'transparent'; common.output_format = 'png'; }

    try {
      let apiRes;
      if (refs.length) {
        const form = new FormData();
        Object.entries(common).forEach(([k, v]) => form.append(k, String(v)));
        refs.forEach((r) => {
          form.append('image[]', new Blob([fs.readFileSync(r.abs)], { type: 'image/png' }), path.basename(r.abs));
        });
        apiRes = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: AbortSignal.timeout(280000),
        });
      } else {
        apiRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(common),
          signal: AbortSignal.timeout(280000),
        });
      }
      const data = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        const msg = (data && data.error && data.error.message) || `OpenAI error ${apiRes.status}`;
        return sendJson(res, 502, { error: msg });
      }
      const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
      if (!b64) return sendJson(res, 502, { error: 'OpenAI returned no image.' });
      sendJson(res, 200, { b64, references: refs.map((r) => r.rel), model: OPENAI_MODEL });
    } catch (e) {
      const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      sendJson(res, 504, { error: timedOut ? 'OpenAI took too long - try again.' : `Could not reach OpenAI: ${e.message}` });
    }
  });
}

// =======================================================
// AI text generation for the editor's Description / Tooltip fields.
// POST /api/admin/generate-text { kind, target, entry, notes? } -> { text }
// Uses a general-purpose chat model (not the image model), told to write in
// the Dungeon Crawler Carl universe's voice, anchored by this game's own
// existing entries as style examples. Config: OPENAI_API_KEY (required),
// OPENAI_TEXT_MODEL (default gpt-4.1).
// =======================================================
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4.1';
const TEXT_TARGETS = {
  description: 'a flavour description: 2-4 sentences, at most 90 words. Darkly comic, in the voice of the System\'s sarcastic game-show narration; concrete and visual, ending on a wry twist. Mention what it does only in passing.',
  tooltip: 'a gameplay tooltip: one or two plain sentences, at most 45 words. Start with the item name and an em dash, then say how to use it (Use is the U key) and exactly what it does and whether it is consumed. No jokes.',
  tooltipOn: 'a gameplay tooltip for the item\'s ON / equipped / lit state: one or two plain sentences, at most 40 words. Start with the item name, an em dash and "LIT" or "EQUIPPED" as fits, then the active effect and how to turn it off (U key). No jokes.',
  tooltipOff: 'a gameplay tooltip for the item\'s OFF / unequipped / unlit state: one or two plain sentences, at most 40 words. Start with the item name, an em dash and "UNLIT" or "UNEQUIPPED" as fits, then say it has no effect yet and how to turn it on (U key) and what that gives. No jokes.',
};

function buildTextMessages(kind, target, entry, notes) {
  const examples = entriesOfKind(kind)
    .filter((e) => e.id !== entry.id && typeof e[target] === 'string' && e[target].trim())
    .slice(0, 3)
    .map((e) => `Example (${e.name}):\n${e[target].trim()}`)
    .join('\n\n');
  const skip = new Set(['description', 'tooltip', 'tooltipOn', 'tooltipOff', 'image', 'iconImage', 'portrait', 'icon', 'lines', 'basedOn']);
  const facts = Object.entries(entry)
    .filter(([k, v]) => !skip.has(k) && v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');
  const system = 'You write in-game text for a browser dungeon-crawler based on the novel series Dungeon Crawler Carl '
    + 'by Matt Dinniman: a post-apocalyptic, televised death-game dungeon run by an AI "System"; the protagonist is Carl, '
    + 'his cat is Princess Donut; the tone is dark, sardonic, gross-out comedic, with corporate-game-show absurdity. '
    + 'Stay consistent with the canon you know and with this game\'s own examples. '
    + 'Never state numbers or mechanics that are not in the given facts. '
    + 'Reply with ONLY the requested text: no quotes, no heading, no markdown.';
  const user = `Write ${TEXT_TARGETS[target]}\n\nThis is a ${kind === 'npcs' ? 'safe-room NPC' : kind === 'mobs' ? 'monster' : 'game item'}.\n`
    + `Name: ${entry.name}\n${facts ? `Known facts:\n${facts}\n` : ''}`
    + (entry.description && target !== 'description' ? `Existing flavour description (for tone/context):\n${entry.description}\n` : '')
    + (examples ? `\nMatch the style and length of these existing entries from the same game:\n\n${examples}\n` : '')
    + (notes ? `\nExtra direction from the designer: ${notes}\n` : '');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function handleAdminGenerateText(req, res) {
  readRequestBody(req, async (err, body) => {
    if (err) return sendJson(res, 400, { error: 'Could not read request body.' });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return sendJson(res, 503, { error: 'OPENAI_API_KEY is not set on the server.' });
    let p;
    try { p = JSON.parse(body); } catch (e) { return sendJson(res, 400, { error: 'Invalid JSON.' }); }
    const { kind, target, entry } = p;
    if (!ADMIN_KINDS[kind]) return sendJson(res, 400, { error: 'Bad kind.' });
    if (!TEXT_TARGETS[target]) return sendJson(res, 400, { error: 'Bad target field.' });
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string' || !entry.name.trim()) {
      return sendJson(res, 400, { error: 'Give the entry a name first.' });
    }
    const notes = typeof p.notes === 'string' ? p.notes.trim().slice(0, 500) : '';
    try {
      const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OPENAI_TEXT_MODEL, messages: buildTextMessages(kind, target, entry, notes) }),
        signal: AbortSignal.timeout(90000),
      });
      const data = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) return sendJson(res, 502, { error: (data.error && data.error.message) || `OpenAI error ${apiRes.status}` });
      let text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      text = typeof text === 'string' ? text.trim().replace(/^["“](.*)["”]$/s, '$1').trim() : '';
      if (!text) return sendJson(res, 502, { error: 'OpenAI returned no text.' });
      sendJson(res, 200, { text, model: OPENAI_TEXT_MODEL });
    } catch (e) {
      const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      sendJson(res, 504, { error: timedOut ? 'OpenAI took too long - try again.' : `Could not reach OpenAI: ${e.message}` });
    }
  });
}

function serveStaticFile(req, res, pathname) {
  const relativePath = (pathname === '/' ? '/index.html' : pathname).split('?')[0];
  const filePath = path.normalize(path.join(ROOT_DIR, relativePath));

  // never serve dotfiles (.env holds the API key) or anything in a dot folder
  if (path.relative(ROOT_DIR, filePath).split(path.sep).some((seg) => seg.startsWith('.'))) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  // player reports are read through the admin API only, not as a public file
  if (path.basename(filePath).toLowerCase() === 'feedback.json') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

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

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    handleAdminLogin(req, res);
    return;
  }
  if (pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return sendJson(res, 401, { error: 'Admin login required.' });
    const dataMatch = pathname.match(/^\/api\/admin\/data\/(items|mobs|npcs)$/);
    if (dataMatch) return handleAdminData(req, res, dataMatch[1]);
    if (pathname === '/api/admin/feedback' && req.method === 'GET') return handleAdminFeedback(req, res, url.parse(req.url, true).query);
    if (pathname === '/api/admin/maps' && req.method === 'GET') return handleAdminMaps(req, res);
    const mapMatch = pathname.match(/^\/api\/admin\/map\/(\d+)$/);
    if (mapMatch) return handleAdminMap(req, res, parseInt(mapMatch[1], 10));
    if (pathname === '/api/admin/generate' && req.method === 'POST') return handleAdminGenerate(req, res);
    if (pathname === '/api/admin/generate-text' && req.method === 'POST') return handleAdminGenerateText(req, res);
    if (pathname === '/api/admin/upload' && req.method === 'POST') {
      return handleAdminUpload(req, res, url.parse(req.url, true).query);
    }
    return sendJson(res, 404, { error: 'Unknown admin endpoint.' });
  }

  if (pathname === '/api/feedback' && req.method === 'POST') {
    handleFeedback(req, res);
    return;
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
