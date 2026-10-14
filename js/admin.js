// =======================================================
// Admin data editor — hidden. Click the E in the top-bar title, enter the
// admin password, and a full-screen editor opens for items, mobs and NPCs
// (data/items.json, data/mobs.json, data/npcs.json) with PNG uploads for
// the icon / card / portrait art. The server enforces the password on
// every request; nothing here is trusted. See server.js (/api/admin/*).
// =======================================================
(function adminEditor() {
  const overlay = document.getElementById('admin-overlay');
  const secretE = document.getElementById('admin-secret-e');
  if (!overlay || !secretE) return;

  const $ = (id) => document.getElementById(id);
  const loginBox = $('admin-login');
  const shell = $('admin-shell');
  const listEl = $('admin-list');
  const formEl = $('admin-form');
  const statusEl = $('admin-status');
  const searchEl = $('admin-search');
  const newBtn = $('admin-new-btn');
  const cloneBtn = $('admin-clone-btn');
  const saveBtn = $('admin-save-btn');
  const deleteBtn = $('admin-delete-btn');

  const TOKEN_KEY = 'dc-admin-token';
  let token = '';
  try { token = sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { /* ignore */ }

  // editor state
  let kind = null;          // 'items' | 'mobs' | 'npcs'
  let fileData = null;      // the whole parsed JSON file
  let selected = null;      // { entry, level? } — the list row being edited
  let isNew = false;        // selected row was just created and never saved
  let dirty = false;        // form changed since last save
  let fields = [];          // live field descriptors for the open form
  let borrowedPaths = new Set(); // image paths a clone shares with its original (see cloneRow)
  let touchedFiles = false; // anything saved this session -> refresh the game on exit

  const KIND_LABEL = { items: 'ITEMS', mobs: 'MOBS', npcs: 'NPCS' };
  const LONG_TEXT_KEYS = new Set(['description', 'basedOn', 'tooltip', 'tooltipOn', 'tooltipOff']);
  const IMAGE_KEYS = new Set(['image', 'iconImage', 'portrait']);
  const JSON_KEYS = new Set(['effect', 'drops']); // fields the game reads as objects / lists
  const TEXT_GEN_KEYS =new Set(['description', 'tooltip', 'tooltipOn', 'tooltipOff']);

  // ---------- api ----------
  async function api(method, url, body, raw) {
    const headers = { 'X-Admin-Token': token };
    if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method,
      headers,
      cache: 'no-store',
      body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-json */ }
    if (res.status === 401 && token) { token = ''; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  // shared with js/admin-levels.js
  window.adminApi = { api: (...a) => api(...a) };

  function setStatus(text, ok) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('ok', !!ok);
  }

  // ---------- open / login / close ----------
  function showLogin(message) {
    shell.hidden = true;
    loginBox.hidden = false;
    $('admin-login-status').textContent = message || '';
    $('admin-password').value = '';
    overlay.classList.add('active');
    $('admin-password').focus();
  }

  async function openEditor() {
    if (!token) { showLogin(); return; }
    try {
      // a cheap authenticated call tells us whether the stored token is still good
      await api('GET', '/api/admin/data/npcs');
    } catch (e) {
      showLogin(token ? '' : 'Session expired - log in again.');
      return;
    }
    loginBox.hidden = true;
    shell.hidden = false;
    overlay.classList.add('active');
    if (!kind) clearPanes(); else loadKind(kind);
  }

  async function submitLogin() {
    const status = $('admin-login-status');
    status.textContent = 'Checking…';
    try {
      const data = await api('POST', '/api/admin/login', { password: $('admin-password').value });
      token = data.token;
      try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) { /* ignore */ }
      openEditor();
    } catch (e) {
      status.textContent = e.message;
    }
  }

  function closeEditor() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    if (window.adminLevels && !window.adminLevels.leave()) return;
    overlay.classList.remove('active');
    dirty = false;
    isNew = false;
    selected = null;
    if (touchedFiles) {
      touchedFiles = false;
      if (typeof window.refreshGameData === 'function') window.refreshGameData();
    }
  }

  function clearPanes() {
    $('admin-list-title').textContent = 'Pick a category';
    listEl.innerHTML = '';
    formEl.innerHTML = '';
    $('admin-form-title').textContent = 'Nothing selected';
    newBtn.hidden = true;
    saveBtn.hidden = true;
    deleteBtn.hidden = true;
    cloneBtn.hidden = deleteBtn.hidden; // clone is offered whenever a saved entry is selected
    setStatus('');
  }

  // ---------- data access per kind ----------
  // every kind is flattened to rows of { entry, level? } for the list
  function rows() {
    if (!fileData) return [];
    if (kind === 'items') return (fileData.items || []).map((entry) => ({ entry }));
    if (kind === 'npcs') return (fileData.npcs || []).map((entry) => ({ entry }));
    const out = [];
    Object.keys(fileData.levels || {}).sort((a, b) => Number(a) - Number(b)).forEach((level) => {
      (fileData.levels[level] || []).forEach((entry) => out.push({ entry, level }));
    });
    return out;
  }

  function listFor(row) {
    if (kind === 'items') return fileData.items;
    if (kind === 'npcs') return fileData.npcs;
    return fileData.levels[row.level];
  }

  function newEntryTemplate() {
    if (kind === 'items') {
      return { id: 'new-item', name: 'New Item', type: 'consumable', icon: '❓', image: '', iconImage: '', value: 0, description: '', tooltip: '' };
    }
    if (kind === 'mobs') {
      return { id: 'new-mob', name: 'New Mob', icon: '❓', image: '', iconImage: '', role: '', hp: 10, attack: 4, defense: 0, xp: 10, description: '' };
    }
    return { id: 'new-npc', name: 'New NPC', tile: '', chat: '', icon: '❓', role: '', image: '', description: '', lines: [] };
  }

  // the Levels category is its own module (js/admin-levels.js)
  function openLevels() {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    if (isNew) discardNewEntry();
    dirty = false;
    isNew = false;
    selected = null;
    kind = null;
    viewMode = null;
    clearPanes();
    shell.classList.add('mode-levels');
    document.querySelectorAll('.admin-menu-btn[data-kind]').forEach((b) => {
      b.classList.toggle('active', b.dataset.kind === 'levels');
    });
    if (window.adminLevels) window.adminLevels.open();
  }

  // ---------- player reports (read-only) ----------
  // BUG REPORTS / FEATURE REQUESTS: what players sent through the in-game
  // forms, from data/feedback.json via /api/admin/feedback.
  let viewMode = null;      // null | 'bug' | 'feature' — a read-only report list is showing
  let reports = [];
  let shownReport = null;

  const REPORT_LABEL = { bug: 'BUG REPORTS', feature: 'FEATURE REQUESTS' };
  const REPORT_ICON = { bug: '\u{1F41E}', feature: '\u{1F4A1}' };

  function fmtDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  async function openReports(type) {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    if (window.adminLevels && !window.adminLevels.leave()) return;
    if (isNew) discardNewEntry();
    dirty = false;
    isNew = false;
    selected = null;
    kind = null;
    fileData = null;
    shell.classList.remove('mode-levels');
    clearPanes();
    viewMode = type;
    shownReport = null;
    document.querySelectorAll('.admin-menu-btn[data-kind]').forEach((b) => {
      b.classList.toggle('active', b.dataset.kind === type);
    });
    searchEl.value = '';
    setStatus('Loading…', true);
    try {
      const data = await api('GET', `/api/admin/feedback?type=${encodeURIComponent(type)}`);
      reports = data.entries || [];
      setStatus('');
    } catch (e) {
      reports = [];
      setStatus(e.message);
    }
    renderReportList();
    $('admin-form-title').textContent = reports.length ? 'Pick a report' : 'Nothing here yet';
  }

  function renderReportList() {
    $('admin-list-title').textContent = `${REPORT_LABEL[viewMode]} (${reports.length})`;
    const q = searchEl.value.trim().toLowerCase();
    listEl.innerHTML = '';
    if (!reports.length) {
      listEl.innerHTML = '<p class="admin-empty">No reports yet. Players send them from the top bar in the game.</p>';
      return;
    }
    reports
      .filter((r) => !q || `${r.title} ${r.description}`.toLowerCase().includes(q))
      .forEach((r) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `admin-list-row${shownReport === r ? ' active' : ''}`;
        btn.innerHTML = `<span class="admin-thumb">${REPORT_ICON[viewMode]}</span>`
          + `<span class="admin-list-text"><strong>${esc(r.title)}</strong><small>#${esc(r.id)} · ${esc(fmtDate(r.createdAt))}</small></span>`;
        btn.addEventListener('click', () => { shownReport = r; renderReportList(); renderReportDetail(r); });
        listEl.appendChild(btn);
      });
  }

  function renderReportDetail(r) {
    $('admin-form-title').textContent = `#${r.id} — ${REPORT_LABEL[viewMode].slice(0, -1)}`;
    const ctx = r.context && typeof r.context === 'object' ? r.context : {};
    const ctxRows = Object.entries(ctx).map(([k, v]) => {
      let shown = v;
      if (k === 'position' && v && typeof v === 'object') shown = `${v.x}, ${v.y}`;
      else if (typeof v === 'boolean') shown = v ? 'yes' : 'no';
      else if (v && typeof v === 'object') shown = JSON.stringify(v);
      return `<div class="admin-ctx-row"><span>${esc(k)}</span><span>${esc(shown)}</span></div>`;
    }).join('');
    formEl.innerHTML = `<div class="admin-report">`
      + `<h3 class="admin-report-title">${esc(r.title)}</h3>`
      + `<p class="admin-report-meta">${esc(fmtDate(r.createdAt))}</p>`
      + `<p class="admin-label">${viewMode === 'bug' ? 'WHAT HAPPENED' : 'THE IDEA'}</p>`
      + `<p class="admin-report-body">${esc(r.description)}</p>`
      + (ctxRows ? `<p class="admin-label">CONTEXT</p><div class="admin-ctx">${ctxRows}</div>` : '')
      + `</div>`;
  }

  // ---------- kind loading + list ----------
  async function loadKind(next) {
    if (window.adminLevels && !window.adminLevels.leave()) return;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    kind = next;
    viewMode = null;
    shell.classList.remove('mode-levels');
    dirty = false;
    isNew = false;
    selected = null;
    document.querySelectorAll('.admin-menu-btn[data-kind]').forEach((b) => {
      b.classList.toggle('active', b.dataset.kind === kind);
    });
    formEl.innerHTML = '';
    $('admin-form-title').textContent = 'Nothing selected';
    saveBtn.hidden = true;
    deleteBtn.hidden = true;
    cloneBtn.hidden = deleteBtn.hidden; // clone is offered whenever a saved entry is selected
    setStatus('Loading…', true);
    try {
      fileData = await api('GET', `/api/admin/data/${kind}`);
      setStatus('');
    } catch (e) {
      fileData = null;
      setStatus(e.message);
      if (!token) showLogin('Session expired - log in again.');
    }
    searchEl.value = '';
    renderList();
    newBtn.hidden = !fileData;
  }

  function thumb(entry) {
    const src = entry.iconImage || entry.portrait || entry.image;
    if (src) return `<img class="admin-thumb" src="${esc(src)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'admin-thumb',textContent:${JSON.stringify(entry.icon || '')}}))">`;
    return `<span class="admin-thumb">${esc(entry.icon || '')}</span>`;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderList() {
    const all = rows();
    $('admin-list-title').textContent = `${KIND_LABEL[kind] || ''} (${all.length})`;
    const q = searchEl.value.trim().toLowerCase();
    listEl.innerHTML = '';
    all.filter((r) => !q || `${r.entry.name} ${r.entry.id}`.toLowerCase().includes(q)).forEach((row) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-list-row';
      if (selected && selected.entry === row.entry) btn.classList.add('active');
      btn.innerHTML = `${thumb(row.entry)}<span class="admin-list-text"><strong>${esc(row.entry.name || row.entry.id)}</strong>`
        + `<small>${esc(row.entry.id)}${row.level ? ` · floor ${esc(row.level)}` : ''}</small></span>`;
      btn.addEventListener('click', () => selectRow(row));
      listEl.appendChild(btn);
    });
  }

  function discardNewEntry() {
    if (isNew && selected) {
      const list = listFor(selected);
      const i = list.indexOf(selected.entry);
      if (i >= 0) list.splice(i, 1);
    }
    isNew = false;
  }

  function selectRow(row) {
    if (selected && selected.entry === row.entry) return;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    if (isNew) discardNewEntry();
    dirty = false;
    borrowedPaths = new Set();
    selected = row;
    renderList();
    renderForm();
  }

  // ---------- form ----------
  function fieldKind(key, value) {
    if (JSON_KEYS.has(key)) return 'json';
    if (IMAGE_KEYS.has(key) && (typeof value === 'string' || value == null)) return 'image';
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') {
      return (LONG_TEXT_KEYS.has(key) || value.length > 70 || value.includes('\n')) ? 'longtext' : 'text';
    }
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return 'lines';
    return 'json';
  }

  const TYPE_CHOICES = [['text', 'Text'], ['longtext', 'Long text'], ['number', 'Number'], ['bool', 'Yes / no'], ['lines', 'List of lines'], ['json', 'JSON (object / list)']];

  // default upload folder + file name for an image field
  function uploadTarget(key, currentPath, id) {
    let dir = 'cards';
    let name = `${id}.png`;
    if (key === 'iconImage') { dir = 'icons'; name = `${kind === 'mobs' ? 'mob' : 'item'}-${id}.png`; }
    else if (key === 'portrait') { dir = 'images'; name = `${id}-portrait.png`; }
    else if (kind === 'mobs') { dir = 'mobs'; }
    else if (kind === 'items') { name = `item-${id}.png`; }
    // overwrite the existing file if it already lives in the right folder
    const m = /^assets\/([a-z]+)\/([^/]+\.png)$/i.exec(currentPath || '');
    if (m && m[1] === dir) name = m[2];
    return { dir, name };
  }

  function addFieldRow(key, value, opts) {
    const type = (opts && opts.type) || fieldKind(key, value);
    const row = document.createElement('div');
    row.className = `admin-field admin-field-${type}`;
    const label = document.createElement('label');
    label.className = 'admin-label';
    label.textContent = key;
    row.appendChild(label);

    const desc = { key, type, row, input: null, locked: !!(opts && opts.locked) };
    let input;
    if (type === 'bool') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!value;
    } else if (type === 'longtext' || type === 'lines' || type === 'json') {
      input = document.createElement('textarea');
      input.rows = type === 'longtext' ? 4 : type === 'lines' ? 5 : 4;
      if (type === 'lines') input.value = (value || []).join('\n');
      else if (type === 'json') {
        let shown = value === undefined ? {} : value;
        if (typeof shown === 'string') { try { shown = JSON.parse(shown); } catch (e) { /* show as-is */ } }
        input.value = JSON.stringify(shown, null, 2);
      }
      else input.value = value == null ? '' : String(value);
      input.spellcheck = type === 'longtext' || type === 'lines';
    } else {
      input = document.createElement('input');
      input.type = type === 'number' ? 'number' : 'text';
      if (type === 'number') input.step = 'any';
      input.value = value == null ? '' : String(value);
    }
    input.className = type === 'bool' ? 'admin-check' : 'admin-input';
    if (desc.locked) { input.readOnly = true; input.title = 'The id of a saved entry can’t change (saves and shops refer to it).'; }
    input.addEventListener('input', () => { dirty = true; if (type === 'image') updatePreview(); });
    input.addEventListener('change', () => { dirty = true; });
    desc.input = input;

    if (type === 'image') {
      const wrap = document.createElement('div');
      wrap.className = 'admin-image-row';
      const prev = document.createElement('img');
      prev.className = 'admin-preview';
      prev.alt = '';
      const side = document.createElement('div');
      side.className = 'admin-image-side';
      const file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/png';
      file.hidden = true;
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'admin-btn';
      up.textContent = 'UPLOAD / REPLACE PNG';
      up.addEventListener('click', () => file.click());
      file.addEventListener('change', () => uploadImage(desc, file));
      side.append(input, up, file);
      if (desc.key === 'image' || desc.key === 'iconImage') side.appendChild(buildGeneratePanel(desc));
      wrap.append(prev, side);
      row.appendChild(wrap);
      desc.preview = prev;
      desc.updatePreview = updatePreview;
      function updatePreview() {
        const p = input.value.trim();
        prev.style.visibility = p ? 'visible' : 'hidden';
        prev.src = p ? `${p}${p.includes('?') ? '&' : '?'}t=${desc.bust || 0}` : '';
      }
      updatePreview();
    } else {
      row.appendChild(input);
      if (TEXT_GEN_KEYS.has(key) && (type === 'text' || type === 'longtext')) {
        row.appendChild(buildTextGenPanel(desc));
      }
    }

    if (!(opts && opts.core)) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'admin-field-remove';
      rm.title = `Remove "${key}"`;
      rm.textContent = '✕';
      rm.addEventListener('click', () => {
        fields = fields.filter((f) => f !== desc);
        row.remove();
        dirty = true;
      });
      row.appendChild(rm);
    }
    fields.push(desc);
    return row;
  }

  async function uploadImage(desc, fileInput) {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    await putImage(desc, await file.arrayBuffer());
  }

  // save PNG bytes into assets/ for an image field and point the field at it
  async function putImage(desc, buf) {
    const idField = fields.find((f) => f.key === 'id');
    const id = (idField && idField.input.value.trim()) || 'new';
    // a clone still points at the original's art: never overwrite that file
    const current = desc.input.value.trim();
    const { dir, name } = uploadTarget(desc.key, borrowedPaths.has(current) ? '' : current, id);
    setStatus(`Uploading ${name}…`, true);
    try {
      const data = await api('POST', `/api/admin/upload?dir=${encodeURIComponent(dir)}&name=${encodeURIComponent(name)}`, buf, true);
      desc.input.value = data.path;
      desc.bust = Date.now();
      dirty = true;
      touchedFiles = true;
      desc.updatePreview();
      setStatus(`Saved ${data.path}. Remember to SAVE the entry.`, true);
      return true;
    } catch (e) {
      setStatus(e.message);
      return false;
    }
  }

  // ---- AI text generation for Description / Tooltip fields ----
  // A chat model writes it from the entry's name + known facts, in the Dungeon
  // Crawler Carl voice. The proposal lands in an editable box; ACCEPT copies
  // it into the field (nothing is saved to disk until the entry is saved).
  function buildTextGenPanel(desc) {
    const panel = document.createElement('div');
    panel.className = 'admin-gen';
    panel.innerHTML = '<input class="admin-input admin-gen-notes" placeholder="Optional extra direction (e.g. make it grosser, mention Donut)" autocomplete="off">'
      + '<div class="admin-row admin-gen-actions">'
      + '<button type="button" class="admin-btn admin-btn-primary admin-gen-go">GENERATE WITH AI</button>'
      + '</div>'
      + '<p class="admin-gen-msg"></p>'
      + '<div class="admin-gen-result" hidden>'
      + '<textarea class="admin-input admin-gen-text" rows="4"></textarea>'
      + '<div class="admin-row"><button type="button" class="admin-btn admin-btn-primary admin-gen-accept">ACCEPT</button>'
      + '<button type="button" class="admin-btn admin-gen-redo">REGENERATE</button>'
      + '<button type="button" class="admin-btn admin-gen-discard">DISCARD</button></div>'
      + '</div>';
    const q = (sel) => panel.querySelector(sel);
    const msg = q('.admin-gen-msg');
    const result = q('.admin-gen-result');
    let busy = false;

    const run = async () => {
      if (busy) return;
      const nameField = fields.find((f) => f.key === 'name');
      if (!nameField || !nameField.input.value.trim()) { msg.classList.add('err'); msg.textContent = 'Give the entry a name first.'; return; }
      // build the entry loosely: a half-edited form shouldn't block text generation
      const entry = {};
      fields.forEach((f) => {
        if (f.key === 'floor') return;
        if (f.type === 'bool') entry[f.key] = f.input.checked;
        else if (f.type === 'number') { if (f.input.value.trim() !== '') entry[f.key] = Number(f.input.value); }
        else if (f.type === 'lines') entry[f.key] = f.input.value.split('\n').map((s) => s.trim()).filter(Boolean);
        else if (f.type === 'json') { try { entry[f.key] = JSON.parse(f.input.value); } catch (e) { /* skip */ } }
        else entry[f.key] = f.input.value;
      });
      busy = true;
      q('.admin-gen-go').disabled = true;
      q('.admin-gen-redo').disabled = true;
      msg.classList.remove('err');
      msg.textContent = 'Writing…';
      try {
        const data = await api('POST', '/api/admin/generate-text', {
          kind, target: desc.key, entry, notes: q('.admin-gen-notes').value,
        });
        q('.admin-gen-text').value = data.text;
        result.hidden = false;
        msg.textContent = 'Proposed text - edit it if you like, then Accept.';
      } catch (e) {
        msg.classList.add('err');
        msg.textContent = e.message;
      } finally {
        busy = false;
        q('.admin-gen-go').disabled = false;
        q('.admin-gen-redo').disabled = false;
      }
    };
    q('.admin-gen-go').addEventListener('click', run);
    q('.admin-gen-redo').addEventListener('click', run);
    q('.admin-gen-discard').addEventListener('click', () => { result.hidden = true; msg.textContent = ''; });
    q('.admin-gen-accept').addEventListener('click', () => {
      desc.input.value = q('.admin-gen-text').value.trim();
      dirty = true;
      result.hidden = true;
      msg.classList.remove('err');
      msg.textContent = 'Applied. Remember to SAVE the entry.';
    });
    return panel;
  }

  // ---- AI image generation (OpenAI, via the server) ----
  // Builds a small panel under an image field: notes box, GENERATE, then a
  // proposed image to ACCEPT (saves it into assets/), REGENERATE or DISCARD.
  function buildGeneratePanel(desc) {
    const panel = document.createElement('div');
    panel.className = 'admin-gen';
    panel.innerHTML = '<input class="admin-input admin-gen-notes" placeholder="Optional extra direction (e.g. glowing green, cracked)" autocomplete="off">'
      + '<div class="admin-row admin-gen-actions">'
      + '<button type="button" class="admin-btn admin-btn-primary admin-gen-go">GENERATE WITH AI</button>'
      + '</div>'
      + '<p class="admin-gen-msg"></p>'
      + '<div class="admin-gen-result" hidden>'
      + '<img class="admin-gen-img" alt="Proposed image">'
      + '<div class="admin-row"><button type="button" class="admin-btn admin-btn-primary admin-gen-accept">ACCEPT</button>'
      + '<button type="button" class="admin-btn admin-gen-redo">REGENERATE</button>'
      + '<button type="button" class="admin-btn admin-gen-discard">DISCARD</button></div>'
      + '</div>';
    const q = (sel) => panel.querySelector(sel);
    const msg = q('.admin-gen-msg');
    const result = q('.admin-gen-result');
    let b64 = '';
    let busy = false;

    const run = async () => {
      if (busy) return;
      let entry;
      try { entry = collectEntry().entry; } catch (e) { msg.textContent = e.message; return; }
      busy = true;
      q('.admin-gen-go').disabled = true;
      q('.admin-gen-redo').disabled = true;
      msg.classList.remove('err');
      msg.textContent = 'Generating - this can take a minute or two…';
      try {
        const data = await api('POST', '/api/admin/generate', {
          kind, target: desc.key, entry, notes: q('.admin-gen-notes').value,
        });
        b64 = data.b64;
        q('.admin-gen-img').src = `data:image/png;base64,${b64}`;
        result.hidden = false;
        msg.textContent = `Proposed image (${(data.references || []).length} style reference(s) used). Accept to save it, or regenerate.`;
      } catch (e) {
        msg.classList.add('err');
        msg.textContent = e.message;
      } finally {
        busy = false;
        q('.admin-gen-go').disabled = false;
        q('.admin-gen-redo').disabled = false;
      }
    };
    q('.admin-gen-go').addEventListener('click', run);
    q('.admin-gen-redo').addEventListener('click', run);
    q('.admin-gen-discard').addEventListener('click', () => { result.hidden = true; b64 = ''; msg.textContent = ''; });
    q('.admin-gen-accept').addEventListener('click', async () => {
      if (!b64) return;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      if (await putImage(desc, bytes.buffer)) { result.hidden = true; b64 = ''; msg.textContent = ''; }
    });
    return panel;
  }

  function renderForm() {
    formEl.innerHTML = '';
    fields = [];
    if (!selected) return;
    const entry = selected.entry;
    $('admin-form-title').textContent = isNew ? `New ${KIND_LABEL[kind].slice(0, -1).toLowerCase()}` : (entry.name || entry.id);
    saveBtn.hidden = false;
    deleteBtn.hidden = isNew;
    cloneBtn.hidden = deleteBtn.hidden; // clone is offered whenever a saved entry is selected
    setStatus('');

    if (kind === 'mobs') {
      formEl.appendChild(addFieldRow('floor', Number(selected.level), { type: 'number', core: true }));
    }
    // every item / mob always offers its card + icon image fields, even
    // when empty, so art can be added to entries that only have an emoji
    if (kind === 'items' || kind === 'mobs') {
      ['image', 'iconImage'].forEach((k) => { if (!(k in entry)) entry[k] = ''; });
    }
    Object.keys(entry).forEach((key) => {
      const core = key === 'id' || key === 'name';
      formEl.appendChild(addFieldRow(key, entry[key], { core, locked: key === 'id' && !isNew }));
    });

    // add-a-field row
    const add = document.createElement('div');
    add.className = 'admin-addfield';
    add.innerHTML = '<input class="admin-input" id="admin-newkey" placeholder="new field name" autocomplete="off">'
      + `<select class="admin-input" id="admin-newtype">${TYPE_CHOICES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`
      + '<button type="button" class="admin-btn" id="admin-addfield-btn">+ ADD FIELD</button>';
    formEl.appendChild(add);
    add.querySelector('#admin-addfield-btn').addEventListener('click', () => {
      const k = add.querySelector('#admin-newkey').value.trim();
      const t = add.querySelector('#admin-newtype').value;
      if (!k || fields.some((f) => f.key === k)) { setStatus(k ? `"${k}" already exists.` : 'Name the field first.'); return; }
      // structured fields must be JSON, whatever type was picked, or the game can't read them
      const useType = JSON_KEYS.has(k) ? 'json' : t;
      const blank = { text: '', longtext: '', number: 0, bool: false, lines: [], json: {} }[useType];
      const row = addFieldRow(k, blank, { type: useType });
      formEl.insertBefore(row, add);
      add.querySelector('#admin-newkey').value = '';
      dirty = true;
      setStatus('');
    });
  }

  // build the entry object from the form; throws a readable Error on bad input
  function collectEntry() {
    const out = {};
    let floor = null;
    for (const f of fields) {
      const raw = f.input;
      let v;
      if (f.type === 'bool') v = raw.checked;
      else if (f.type === 'number') {
        if (raw.value.trim() === '' || !Number.isFinite(Number(raw.value))) throw new Error(`"${f.key}" must be a number.`);
        v = Number(raw.value);
      } else if (f.type === 'lines') {
        v = raw.value.split('\n').map((s) => s.trim()).filter(Boolean);
      } else if (f.type === 'json') {
        try { v = JSON.parse(raw.value); } catch (e) { throw new Error(`"${f.key}" isn't valid JSON: ${e.message}`); }
      } else {
        v = raw.value;
        // a text field named like a structured one (typed in by hand) is parsed, not stored as a string
        if (JSON_KEYS.has(f.key)) {
          try { v = JSON.parse(v); } catch (e) { throw new Error(`"${f.key}" must be valid JSON, e.g. {"defense": 5}.`); }
        }
      }
      if (f.key === 'floor' && kind === 'mobs') { floor = v; continue; }
      out[f.key] = v;
    }
    if (typeof out.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(out.id.trim())) {
      throw new Error('The id needs lowercase letters, digits and dashes only (e.g. "rusty-sword").');
    }
    out.id = out.id.trim();
    if (!String(out.name || '').trim()) throw new Error('The name can’t be empty.');
    return { entry: out, floor };
  }

  // ---------- save / delete / new ----------
  async function saveCurrent() {
    if (!selected) return;
    let built;
    try { built = collectEntry(); } catch (e) { setStatus(e.message); return; }

    // work on a copy of the file so a failed save leaves memory untouched
    const draft = JSON.parse(JSON.stringify(fileData));
    const locate = (data) => {
      if (kind === 'mobs') return data.levels[selected.level];
      return kind === 'items' ? data.items : data.npcs;
    };
    const oldList = locate(draft);
    // the entry's slot in its list (a brand-new entry is only a template there)
    const idx = listFor(selected).indexOf(selected.entry);
    if (isNew && idx >= 0) oldList.splice(idx, 1);
    const keepSlot = !isNew && idx >= 0;

    if (kind === 'mobs') {
      const targetLevel = String(Math.round(built.floor));
      if (!(targetLevel in draft.levels)) draft.levels[targetLevel] = [];
      if (keepSlot) oldList.splice(idx, 1);
      // keep a mob in its slot when the floor didn't change
      const dest = draft.levels[targetLevel];
      if (keepSlot && targetLevel === selected.level) dest.splice(idx, 0, built.entry);
      else dest.push(built.entry);
    } else if (keepSlot) {
      oldList[idx] = built.entry;
    } else {
      oldList.push(built.entry);
    }

    setStatus('Saving…', true);
    try {
      await api('PUT', `/api/admin/data/${kind}`, draft);
    } catch (e) {
      setStatus(e.message);
      return;
    }
    // the server accepted it: adopt the draft and re-select the saved entry
    fileData = draft;
    dirty = false;
    isNew = false;
    borrowedPaths = new Set();
    touchedFiles = true;
    selected = rows().find((r) => r.entry.id === built.entry.id) || null;
    renderList();
    renderForm();
    setStatus('Saved.', true);
  }

  async function deleteCurrent() {
    if (!selected || isNew) return;
    const name = selected.entry.name || selected.entry.id;
    if (!window.confirm(`Delete "${name}" for good? This rewrites the data file.`)) return;
    const draft = JSON.parse(JSON.stringify(fileData));
    const list = kind === 'mobs' ? draft.levels[selected.level] : (kind === 'items' ? draft.items : draft.npcs);
    const i = list.findIndex((e) => e.id === selected.entry.id);
    if (i >= 0) list.splice(i, 1);
    setStatus('Deleting…', true);
    try {
      await api('PUT', `/api/admin/data/${kind}`, draft);
    } catch (e) {
      setStatus(e.message);
      return;
    }
    fileData = draft;
    selected = null;
    dirty = false;
    touchedFiles = true;
    renderList();
    formEl.innerHTML = '';
    $('admin-form-title').textContent = 'Nothing selected';
    saveBtn.hidden = true;
    deleteBtn.hidden = true;
    cloneBtn.hidden = deleteBtn.hidden; // clone is offered whenever a saved entry is selected
    setStatus(`Deleted ${name}.`, true);
  }

  function newRow() {
    if (!fileData) return;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    if (isNew) discardNewEntry();
    const entry = newEntryTemplate();
    let row;
    if (kind === 'mobs') {
      const levels = Object.keys(fileData.levels).sort((a, b) => Number(a) - Number(b));
      const level = (selected && selected.level) || levels[levels.length - 1] || '1';
      if (!fileData.levels[level]) fileData.levels[level] = [];
      fileData.levels[level].push(entry);
      row = { entry, level };
    } else {
      (kind === 'items' ? fileData.items : fileData.npcs).push(entry);
      row = { entry };
    }
    selected = row;
    isNew = true;
    renderList();
    renderForm();
    dirty = true;
    const nameInput = fields.find((f) => f.key === 'name');
    if (nameInput) nameInput.input.focus();
  }

  // copy the selected (saved) entry into a new unsaved one with a fresh id,
  // so a similar item / mob / NPC can be made with different values
  function cloneRow() {
    if (!selected || isNew || !fileData) return;
    if (dirty && !window.confirm('Discard your unsaved changes to the original and clone it?')) return;
    const src = selected;
    const entry = JSON.parse(JSON.stringify(src.entry));
    const taken = new Set(rows().map((r) => r.entry.id));
    let id = `${entry.id}-copy`;
    for (let n = 2; taken.has(id); n += 1) id = `${entry.id}-copy-${n}`;
    entry.id = id;
    entry.name = `${entry.name} (Copy)`;

    // art paths still belong to the original until a new image is uploaded
    borrowedPaths = new Set(['image', 'iconImage', 'portrait'].map((k) => entry[k]).filter(Boolean));

    const list = listFor(src);
    list.splice(list.indexOf(src.entry) + 1, 0, entry);
    selected = kind === 'mobs' ? { entry, level: src.level } : { entry };
    isNew = true;
    renderList();
    renderForm();
    dirty = true;
    setStatus('Cloned. Change the id and values, then SAVE. Uploading new art won’t touch the original’s images.', true);
    const nameField = fields.find((f) => f.key === 'name');
    if (nameField) nameField.input.focus();
  }

  // ---------- wiring ----------
  secretE.addEventListener('click', openEditor);
  $('admin-login-submit').addEventListener('click', submitLogin);
  $('admin-login-cancel').addEventListener('click', () => overlay.classList.remove('active'));
  $('admin-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitLogin(); });
  $('admin-exit-btn').addEventListener('click', closeEditor);
  document.querySelectorAll('.admin-menu-btn[data-kind]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.kind === 'levels') openLevels();
      else if (b.dataset.kind === 'bug' || b.dataset.kind === 'feature') openReports(b.dataset.kind);
      else loadKind(b.dataset.kind);
    });
  });
  newBtn.addEventListener('click', newRow);
  cloneBtn.addEventListener('click', cloneRow);
  saveBtn.addEventListener('click', saveCurrent);
  deleteBtn.addEventListener('click', deleteCurrent);
  searchEl.addEventListener('input', () => { if (viewMode) renderReportList(); else renderList(); });

  // keep keystrokes in the editor from reaching the game's hotkeys, and let
  // Esc leave the login box / editor
  overlay.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      if (!shell.hidden) closeEditor();
      else overlay.classList.remove('active');
    }
  });
}());
