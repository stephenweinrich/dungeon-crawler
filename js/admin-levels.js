// =======================================================
// Admin level editor — the LEVELS category of the hidden editor (js/admin.js).
// Paints a floor's tile grid on a canvas, places mobs from the bestiary,
// derives start / safe room / boss room from the tiles, warns about map
// problems, and saves data/map-level<N>.json through /api/admin/map/:n.
// =======================================================
(function adminLevels() {
  const pane = document.getElementById('admin-level-pane');
  if (!pane) return;

  // ---------- constants ----------
  const TILES = [
    { ch: '#', label: 'Wall', color: '#7b6a4c', key: '1' },
    { ch: '.', label: 'Corridor', color: '#2b2722', key: '2' },
    { ch: '+', label: 'Door', color: '#c9942e', key: '3' },
    { ch: 'E', label: 'Entrance (start)', color: '#3fae5a', key: '4' },
    { ch: 'B', label: 'Boss chamber', color: '#7a1e1e', key: '5' },
    { ch: 'D', label: 'Boss door', color: '#d1492f', key: '6' },
    { ch: 'S', label: 'Safe room', color: '#2fa3a3', key: '7' },
    { ch: ' ', label: 'Void', color: '#000000', key: '8' },
  ];
  const TILE_BY_CH = Object.fromEntries(TILES.map((t) => [t.ch, t]));
  const WALKABLE = new Set(['.', '+', 'E', 'B', 'D', 'S']); // doors can be opened, so they count
  const UNIQUE = new Set(['E', 'S']); // one of each per floor
  const DEFAULT_LEGEND = {
    '#': 'wall', '.': 'corridor', '+': 'door', E: 'entrance', B: 'boss chamber', D: 'boss door', S: 'safe room',
  };
  const MAX_UNDO = 100;

  // ---------- state ----------
  let floors = [];          // [{ level, name, ... }] from the server
  let level = null;         // floor number being edited
  let map = null;           // working copy of the floor JSON (tiles/mobs live in `tiles`/`mobs`)
  let tiles = [];           // tiles[y][x] = char
  let mobs = [];            // [{ id, x, y, boss? }]
  let mobCatalog = {};      // id -> mob def (from data/mobs.json)
  let dirty = false;
  let isNewFloor = false;   // exists only in the editor until saved
  let tool = 'brush';       // brush | rect | mob | eraseMob
  let tileCh = '#';
  let mobId = '';
  let zoom = 22;
  let undo = [];
  let redo = [];
  let drag = null;          // { x0, y0, x1, y1, painting }
  let hover = null;
  let canvas = null;
  let ctx = null;
  let built = false;

  const api = (...a) => window.adminApi.api(...a);
  const $ = (id) => pane.querySelector(`#${id}`);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setStatus(text, ok) {
    const el = $('lv-status');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('ok', !!ok);
  }

  // ---------- pane layout (built once) ----------
  function build() {
    if (built) return;
    built = true;
    pane.innerHTML = `
      <div class="admin-pane-head">
        <span>LEVELS</span>
        <span class="admin-row">
          <button type="button" class="admin-btn" id="lv-randomize" title="Generate a random layout (no mobs)">RANDOMIZE</button>
          <button type="button" class="admin-btn" id="lv-newfloor">+ NEW FLOOR</button>
          <button type="button" class="admin-btn" id="lv-clonefloor">CLONE FLOOR</button>
          <button type="button" class="admin-btn admin-btn-primary" id="lv-save">SAVE</button>
        </span>
      </div>
      <p class="admin-status" id="lv-status" role="status"></p>
      <div class="lv-meta">
        <label>FLOOR <select class="admin-input" id="lv-floor"></select></label>
        <label>NAME <input class="admin-input" id="lv-name" autocomplete="off"></label>
        <label>SUBTITLE <input class="admin-input" id="lv-subtitle" autocomplete="off"></label>
        <label>COLS <input class="admin-input lv-num" id="lv-cols" type="number" min="5" max="120"></label>
        <label>ROWS <input class="admin-input lv-num" id="lv-rows" type="number" min="5" max="120"></label>
        <button type="button" class="admin-btn" id="lv-resize">RESIZE</button>
      </div>
      <div class="lv-tools">
        <div class="lv-palette" id="lv-palette"></div>
        <div class="lv-toolrow">
          <button type="button" class="admin-btn lv-tool" data-tool="brush" title="Paint tiles by clicking or dragging">BRUSH</button>
          <button type="button" class="admin-btn lv-tool" data-tool="rect" title="Drag a rectangle to fill it">RECTANGLE</button>
          <button type="button" class="admin-btn lv-tool" data-tool="mob" title="Click to place the chosen mob">PLACE MOB</button>
          <button type="button" class="admin-btn lv-tool" data-tool="eraseMob" title="Click a mob to remove it (or right-click anywhere)">ERASE MOB</button>
          <select class="admin-input lv-mobsel" id="lv-mobsel"></select>
          <button type="button" class="admin-btn" id="lv-undo">UNDO</button>
          <button type="button" class="admin-btn" id="lv-redo">REDO</button>
          <label class="lv-zoom">ZOOM <select class="admin-input" id="lv-zoom"><option>14</option><option>18</option><option selected>22</option><option>28</option><option>36</option></select></label>
        </div>
      </div>
      <div class="lv-body">
        <div class="lv-canvas-wrap"><canvas id="lv-canvas"></canvas></div>
        <div class="lv-side">
          <p class="admin-label">CHECKS</p>
          <ul class="lv-checks" id="lv-checks"></ul>
          <p class="admin-label">UNDER CURSOR</p>
          <p class="lv-hover" id="lv-hover">&mdash;</p>
          <p class="lv-help">Start, safe room and boss room positions are read from the E, S and B tiles when you save. Mobs sit on top of corridor / boss tiles. Right-click removes a mob.</p>
        </div>
      </div>`;

    canvas = $('lv-canvas');
    ctx = canvas.getContext('2d');

    $('lv-palette').innerHTML = TILES.map((t) => `<button type="button" class="lv-tile" data-ch="${esc(t.ch)}" title="${esc(t.label)} (key ${t.key})"><span class="lv-swatch" style="background:${t.color}"></span>${esc(t.label)}</button>`).join('');
    $('lv-palette').addEventListener('click', (e) => {
      const b = e.target.closest('.lv-tile');
      if (!b) return;
      tileCh = b.dataset.ch;
      if (tool === 'mob' || tool === 'eraseMob') tool = 'brush';
      syncToolbar();
    });
    pane.querySelectorAll('.lv-tool').forEach((b) => b.addEventListener('click', () => { tool = b.dataset.tool; syncToolbar(); }));
    $('lv-mobsel').addEventListener('change', () => { mobId = $('lv-mobsel').value; tool = 'mob'; syncToolbar(); });
    $('lv-zoom').addEventListener('change', () => { zoom = Number($('lv-zoom').value); sizeCanvas(); draw(); });
    $('lv-undo').addEventListener('click', doUndo);
    $('lv-redo').addEventListener('click', doRedo);
    $('lv-save').addEventListener('click', save);
    $('lv-randomize').addEventListener('click', randomize);
    $('lv-newfloor').addEventListener('click', () => newFloor(false));
    $('lv-clonefloor').addEventListener('click', () => newFloor(true));
    $('lv-resize').addEventListener('click', resize);
    $('lv-floor').addEventListener('change', () => {
      const target = Number($('lv-floor').value);
      if (!confirmLeave()) { $('lv-floor').value = String(level); return; }
      loadFloor(target);
    });
    ['lv-name', 'lv-subtitle'].forEach((id) => $(id).addEventListener('input', () => { dirty = true; }));

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', () => { hover = null; $('lv-hover').textContent = '—'; });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const c = cellAt(e);
      if (c && removeMobAt(c.x, c.y)) { dirty = true; afterEdit(); }
    });
    pane.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      const t = TILES.find((x) => x.key === e.key);
      if (t) { tileCh = t.ch; if (tool === 'mob' || tool === 'eraseMob') tool = 'brush'; syncToolbar(); }
    });
    pane.tabIndex = 0;
  }

  function syncToolbar() {
    pane.querySelectorAll('.lv-tile').forEach((b) => b.classList.toggle('active', b.dataset.ch === tileCh && tool !== 'mob' && tool !== 'eraseMob'));
    pane.querySelectorAll('.lv-tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
    $('lv-undo').disabled = !undo.length;
    $('lv-redo').disabled = !redo.length;
  }

  // ---------- data in / out ----------
  async function refreshFloors(selectLevel) {
    const data = await api('GET', '/api/admin/maps');
    floors = data.maps || [];
    const sel = $('lv-floor');
    const extra = isNewFloor && level != null && !floors.some((f) => f.level === level) ? [{ level, name: map.name }] : [];
    sel.innerHTML = [...floors, ...extra].map((f) => `<option value="${f.level}">Floor ${f.level} — ${esc(f.name)}</option>`).join('');
    if (selectLevel != null) sel.value = String(selectLevel);
  }

  async function loadMobCatalog() {
    try {
      const data = await api('GET', '/api/admin/data/mobs');
      mobCatalog = {};
      Object.values(data.levels || {}).flat().forEach((m) => { mobCatalog[m.id] = m; });
    } catch (e) { mobCatalog = {}; }
    const ids = Object.keys(mobCatalog);
    $('lv-mobsel').innerHTML = ids.map((id) => `<option value="${esc(id)}">${esc(mobCatalog[id].icon || '')} ${esc(mobCatalog[id].name || id)}${mobCatalog[id].boss ? ' (boss)' : ''}</option>`).join('');
    if (!mobId || !mobCatalog[mobId]) mobId = ids[0] || '';
    $('lv-mobsel').value = mobId;
  }

  function adopt(m, newFloor) {
    map = JSON.parse(JSON.stringify(m));
    level = Number(map.level);
    tiles = map.tiles.map((r) => r.padEnd(map.grid.cols, '#').split(''));
    mobs = (map.mobs || []).map((x) => ({ ...x }));
    isNewFloor = !!newFloor;
    dirty = !!newFloor;
    undo = [];
    redo = [];
    $('lv-name').value = map.name || '';
    $('lv-subtitle').value = map.subtitle || '';
    $('lv-cols').value = String(map.grid.cols);
    $('lv-rows').value = String(map.grid.rows);
    sizeCanvas();
    draw();
    runChecks();
    syncToolbar();
  }

  async function loadFloor(n) {
    setStatus('Loading…', true);
    try {
      const m = await api('GET', `/api/admin/map/${n}`);
      adopt(m, false);
      await refreshFloors(n);
      setStatus('');
    } catch (e) { setStatus(e.message); }
  }

  function blankMap(n) {
    const cols = 37;
    const rows = 25;
    const t = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => (x === 1 && y === 1 ? 'E' : '#')).join(''));
    return {
      level: n, name: `Floor ${n}`, subtitle: `Floor ${n}`,
      grid: { cols, rows, cell: 24 }, legend: { ...DEFAULT_LEGEND }, rooms: [],
      start: { x: 1, y: 1 }, mobs: [], tiles: t,
    };
  }

  async function newFloor(cloneCurrent) {
    if (!confirmLeave()) return;
    const n = Math.max(0, ...floors.map((f) => f.level), level || 0) + 1;
    if (n > 99) { setStatus('Floor limit is 99.'); return; }
    let m;
    if (cloneCurrent && map) {
      m = JSON.parse(JSON.stringify(currentAsMap()));
      m.level = n;
      m.name = `${m.name} (Copy)`;
      m.subtitle = `Floor ${n}`;
    } else {
      m = blankMap(n);
    }
    adopt(m, true);
    await refreshFloors(n);
    setStatus(`Floor ${n} is new and unsaved. SAVE to create data/map-level${n}.json.`, true);
  }

  // ---------- working copy -> file JSON (derives start / safe room / boss room) ----------
  function currentAsMap() {
    const rows = tiles.length;
    const cols = rows ? tiles[0].length : 0;
    const out = JSON.parse(JSON.stringify(map));
    out.level = level;
    out.name = $('lv-name').value.trim() || `Floor ${level}`;
    out.subtitle = $('lv-subtitle').value.trim();
    out.grid = { ...out.grid, cols, rows };
    out.legend = out.legend || { ...DEFAULT_LEGEND };
    out.tiles = tiles.map((r) => r.join(''));
    out.mobs = mobs.map((m) => ({ ...m }));

    const find = (ch) => { const a = []; tiles.forEach((r, y) => r.forEach((c, x) => { if (c === ch) a.push({ x, y }); })); return a; };
    const e = find('E')[0];
    if (e) out.start = e;
    const s = find('S')[0];
    if (s) out.safeRoom = s; else delete out.safeRoom;
    const b = find('B');
    if (b.length) {
      const xs = b.map((p) => p.x);
      const ys = b.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const bossMob = mobs.find((m) => m.boss || (mobCatalog[m.id] && mobCatalog[m.id].boss));
      const prev = out.bossRoom || {};
      out.bossRoom = {
        id: prev.id || (bossMob && bossMob.id) || '',
        name: prev.name || 'the boss room',
        x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1,
        type: prev.type || 'boss',
      };
    } else {
      delete out.bossRoom;
    }
    return out;
  }

  // ---------- validation ----------
  function runChecks() {
    const list = [];
    const rows = tiles.length;
    const cols = rows ? tiles[0].length : 0;
    const at = (x, y) => (x >= 0 && y >= 0 && x < cols && y < rows ? tiles[y][x] : '#');
    const find = (ch) => { const a = []; tiles.forEach((r, y) => r.forEach((c, x) => { if (c === ch) a.push({ x, y }); })); return a; };

    const entrance = find('E');
    const safe = find('S');
    const boss = find('B');
    const bossDoors = find('D');
    if (!entrance.length) list.push('No entrance (E) tile — Carl has nowhere to start.');
    if (!safe.length) list.push('No safe room (S) tile.');
    if (!boss.length) list.push('No boss chamber (B) tiles.');
    else if (!bossDoors.length) list.push('The boss chamber has no boss door (D).');

    // the chamber must be walled in: every side-neighbour of a B tile is another B, a wall, or the
    // boss door (Carl can't move diagonally, so corner touches don't count)
    const leaks = [];
    boss.forEach(({ x, y }) => {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const t = at(x + dx, y + dy);
        if (t !== 'B' && t !== '#' && t !== 'D') leaks.push(`${x + dx},${y + dy}`);
      });
    });
    if (leaks.length) {
      const uniq = [...new Set(leaks)];
      list.push(`The boss chamber isn't fully walled in — open at ${uniq.slice(0, 3).join('; ')}${uniq.length > 3 ? '…' : ''}. Only the boss door (D) should connect it.`);
    }
    if (bossDoors.length > 1) list.push(`The boss chamber has ${bossDoors.length} doors (D) — it should have one.`);

    const bossMobs = mobs.filter((m) => m.boss || (mobCatalog[m.id] && mobCatalog[m.id].boss));
    if (boss.length && !bossMobs.length) list.push('No boss mob placed.');
    bossMobs.forEach((m) => { if (boss.length && at(m.x, m.y) !== 'B') list.push(`Boss ${m.id} at ${m.x},${m.y} is outside the boss chamber.`); });

    const seen = new Set();
    mobs.forEach((m) => {
      const key = `${m.x},${m.y}`;
      if (seen.has(key)) list.push(`Two mobs share cell ${key}.`);
      seen.add(key);
      if (!mobCatalog[m.id]) list.push(`Unknown mob id "${m.id}" at ${key}.`);
      const t = at(m.x, m.y);
      if (!WALKABLE.has(t) || t === '+') list.push(`${m.id} at ${key} is on ${t === '#' ? 'a wall' : t === ' ' ? 'void' : 'a door'}.`);
      if (t === 'E' || t === 'S') list.push(`${m.id} at ${key} blocks the ${t === 'E' ? 'entrance' : 'safe room'}.`);
    });

    // reachability from the entrance
    if (entrance.length) {
      const reach = new Set([`${entrance[0].x},${entrance[0].y}`]);
      const queue = [entrance[0]];
      while (queue.length) {
        const { x, y } = queue.pop();
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          const k = `${nx},${ny}`;
          if (reach.has(k) || !WALKABLE.has(at(nx, ny))) return;
          reach.add(k);
          queue.push({ x: nx, y: ny });
        });
      }
      const miss = (arr, what) => { const bad = arr.filter((p) => !reach.has(`${p.x},${p.y}`)); if (bad.length) list.push(`${what} not reachable from the entrance (${bad.slice(0, 3).map((p) => `${p.x},${p.y}`).join('; ')}${bad.length > 3 ? '…' : ''}).`); };
      miss(safe, 'Safe room');
      miss(bossDoors, 'Boss door');
      miss(boss.slice(0, 1), 'Boss chamber');
      miss(mobs, 'Mob(s)');
      let walkable = 0;
      tiles.forEach((r) => r.forEach((c) => { if (WALKABLE.has(c)) walkable += 1; }));
      if (walkable > reach.size) list.push(`${walkable - reach.size} walkable tile(s) are cut off from the entrance.`);
    }
    renderChecks(list);
    return list;
  }

  function renderChecks(list) {
    $('lv-checks').innerHTML = list.length
      ? list.map((m) => `<li class="warn">⚠ ${esc(m)}</li>`).join('')
      : '<li class="good">✓ No problems found.</li>';
  }

  // ---------- editing ----------
  function snapshot() {
    return JSON.stringify({ t: tiles.map((r) => r.join('')), m: mobs });
  }
  function restore(s) {
    const o = JSON.parse(s);
    tiles = o.t.map((r) => r.split(''));
    mobs = o.m;
    $('lv-cols').value = String(tiles[0].length);
    $('lv-rows').value = String(tiles.length);
    sizeCanvas();
  }
  function pushUndo() {
    undo.push(snapshot());
    if (undo.length > MAX_UNDO) undo.shift();
    redo = [];
  }
  function doUndo() {
    if (!undo.length) return;
    redo.push(snapshot());
    restore(undo.pop());
    dirty = true;
    afterEdit();
  }
  function doRedo() {
    if (!redo.length) return;
    undo.push(snapshot());
    restore(redo.pop());
    dirty = true;
    afterEdit();
  }
  function afterEdit() {
    draw();
    runChecks();
    syncToolbar();
  }

  function removeMobAt(x, y) {
    const i = mobs.findIndex((m) => m.x === x && m.y === y);
    if (i < 0) return false;
    pushUndo();
    mobs.splice(i, 1);
    return true;
  }

  function setTile(x, y, ch) {
    if (y < 0 || x < 0 || y >= tiles.length || x >= tiles[0].length) return;
    if (UNIQUE.has(ch)) {
      tiles.forEach((r, yy) => r.forEach((c, xx) => { if (c === ch) tiles[yy][xx] = '.'; }));
    }
    tiles[y][x] = ch;
    // mobs can't live inside walls / void / doors
    if (ch === '#' || ch === ' ' || ch === '+') mobs = mobs.filter((m) => !(m.x === x && m.y === y));
  }

  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * tiles[0].length);
    const y = Math.floor(((e.clientY - r.top) / r.height) * tiles.length);
    if (x < 0 || y < 0 || x >= tiles[0].length || y >= tiles.length) return null;
    return { x, y };
  }

  function onDown(e) {
    if (e.button !== 0 || !tiles.length) return;
    const c = cellAt(e);
    if (!c) return;
    if (tool === 'mob') {
      const t = tiles[c.y][c.x];
      if (!WALKABLE.has(t) || t === '+') { setStatus('Mobs go on corridor or boss-chamber tiles, not walls or doors.'); return; }
      pushUndo();
      mobs = mobs.filter((m) => !(m.x === c.x && m.y === c.y));
      const def = mobCatalog[mobId];
      mobs.push(def && def.boss ? { id: mobId, x: c.x, y: c.y, boss: true } : { id: mobId, x: c.x, y: c.y });
      dirty = true;
      setStatus('');
      afterEdit();
      return;
    }
    if (tool === 'eraseMob') {
      if (removeMobAt(c.x, c.y)) { dirty = true; afterEdit(); }
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    pushUndo();
    // brush paints as you drag; rectangle (and the one-of-a-kind E / S tiles) apply on release
    const single = tool === 'brush' && !UNIQUE.has(tileCh);
    drag = { x0: c.x, y0: c.y, x1: c.x, y1: c.y, painting: single };
    if (single) setTile(c.x, c.y, tileCh);
    dirty = true;
    draw();
  }

  function onMove(e) {
    const c = cellAt(e);
    if (c) {
      const m = mobs.find((x) => x.x === c.x && x.y === c.y);
      const t = TILE_BY_CH[tiles[c.y][c.x]];
      hover = c;
      $('lv-hover').textContent = `${c.x}, ${c.y} — ${t ? t.label : '?'}${m ? ` — ${(mobCatalog[m.id] && mobCatalog[m.id].name) || m.id}` : ''}`;
    }
    if (!drag || !c) return;
    if (drag.painting) { setTile(c.x, c.y, tileCh); draw(); } else { drag.x1 = c.x; drag.y1 = c.y; draw(); }
  }

  function onUp() {
    if (!drag) return;
    if (!drag.painting) {
      if (UNIQUE.has(tileCh)) {
        setTile(drag.x1, drag.y1, tileCh);
      } else {
        const [xa, xb] = [Math.min(drag.x0, drag.x1), Math.max(drag.x0, drag.x1)];
        const [ya, yb] = [Math.min(drag.y0, drag.y1), Math.max(drag.y0, drag.y1)];
        for (let y = ya; y <= yb; y += 1) for (let x = xa; x <= xb; x += 1) setTile(x, y, tileCh);
      }
    }
    drag = null;
    afterEdit();
  }

  // ---------- drawing ----------
  function sizeCanvas() {
    if (!canvas || !tiles.length) return;
    canvas.width = tiles[0].length * zoom;
    canvas.height = tiles.length * zoom;
  }

  function draw() {
    if (!ctx || !tiles.length) return;
    const cs = zoom;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    tiles.forEach((row, y) => row.forEach((ch, x) => {
      ctx.fillStyle = (TILE_BY_CH[ch] || TILE_BY_CH['#']).color;
      ctx.fillRect(x * cs, y * cs, cs, cs);
    }));
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= tiles[0].length; x += 1) { ctx.moveTo(x * cs + 0.5, 0); ctx.lineTo(x * cs + 0.5, canvas.height); }
    for (let y = 0; y <= tiles.length; y += 1) { ctx.moveTo(0, y * cs + 0.5); ctx.lineTo(canvas.width, y * cs + 0.5); }
    ctx.stroke();

    // letters on the special tiles so colours aren't the only cue
    ctx.font = `bold ${Math.max(9, Math.floor(cs * 0.5))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    tiles.forEach((row, y) => row.forEach((ch, x) => { if ('EDS+'.includes(ch)) ctx.fillText(ch, x * cs + cs / 2, y * cs + cs / 2 + 1); }));

    mobs.forEach((m) => {
      const def = mobCatalog[m.id];
      const cx = m.x * cs + cs / 2;
      const cy = m.y * cs + cs / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cs * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = m.boss || (def && def.boss) ? 'rgba(180,30,30,0.9)' : 'rgba(20,20,20,0.85)';
      ctx.fill();
      ctx.strokeStyle = m.boss || (def && def.boss) ? '#ffce54' : '#c9942e';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `${Math.floor(cs * 0.55)}px sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText((def && def.icon) || '?', cx, cy + 1);
    });

    if (drag && !drag.painting) {
      const [xa, xb] = [Math.min(drag.x0, drag.x1), Math.max(drag.x0, drag.x1)];
      const [ya, yb] = [Math.min(drag.y0, drag.y1), Math.max(drag.y0, drag.y1)];
      ctx.strokeStyle = '#ffce54';
      ctx.lineWidth = 2;
      ctx.strokeRect(xa * cs + 1, ya * cs + 1, (xb - xa + 1) * cs - 2, (yb - ya + 1) * cs - 2);
    }
  }

  // ---------- random layout ----------
  // Generates a maze-style floor like the hand-made one: 1-wide corridors,
  // some loops, doors on straight stretches, the entrance at the top-left,
  // one safe-room tile on a far dead end, and a walled 3x3 boss chamber with
  // a single boss door. It places NO mobs (existing ones are cleared).
  function generateLayout(W, H) {
    const rnd = (n) => Math.floor(Math.random() * n);
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i -= 1) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const grid = Array.from({ length: H }, () => Array(W).fill('#'));
    const maxX = (W - 2) % 2 === 1 ? W - 2 : W - 3; // largest odd cell coordinate
    const maxY = (H - 2) % 2 === 1 ? H - 2 : H - 3;
    const notes = [];

    // boss chamber: a 5x5 block (wall ring + 3x3 interior) reserved before the maze is carved
    let boss = null;
    const spots = [];
    for (let cx = 5; cx <= maxX - 4; cx += 2) for (let cy = 5; cy <= maxY - 4; cy += 2) spots.push({ cx, cy, d: cx + cy });
    if (spots.length) {
      spots.sort((a, b) => a.d - b.d);
      const far = spots.slice(Math.floor(spots.length * 0.6)); // far from the entrance
      boss = far[rnd(far.length)];
    } else {
      notes.push('Grid too small for a boss chamber (needs about 13x13).');
    }
    const reserved = new Set();
    if (boss) for (let dx = -2; dx <= 2; dx += 2) for (let dy = -2; dy <= 2; dy += 2) reserved.add(`${boss.cx + dx},${boss.cy + dy}`);

    // maze: randomized depth-first carve over the odd cells
    const seen = new Set([...reserved, '1,1']);
    grid[1][1] = '.';
    const stack = [[1, 1]];
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const next = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]])
        .map(([dx, dy]) => [x + dx, y + dy, dx, dy])
        .filter(([nx, ny]) => nx >= 1 && ny >= 1 && nx <= maxX && ny <= maxY && !seen.has(`${nx},${ny}`));
      if (!next.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = next[0];
      seen.add(`${nx},${ny}`);
      grid[ny][nx] = '.';
      grid[y + dy / 2][x + dx / 2] = '.';
      stack.push([nx, ny]);
    }

    // boss chamber + its single door, opening onto a corridor cell
    let doorTile = null;
    if (boss) {
      for (let dx = -2; dx <= 2; dx += 1) {
        for (let dy = -2; dy <= 2; dy += 1) grid[boss.cy + dy][boss.cx + dx] = Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? '#' : 'B';
      }
      const [sx, sy] = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])[0];
      grid[boss.cy + 2 * sy][boss.cx + 2 * sx] = 'D';
      grid[boss.cy + 3 * sy][boss.cx + 3 * sx] = '.'; // passage out to the maze cell 4 away
      doorTile = { x: boss.cx + 2 * sx, y: boss.cy + 2 * sy };
    }

    // loops: knock out some walls between two corridor cells
    for (let y = 1; y <= H - 2; y += 1) {
      for (let x = 1; x <= W - 2; x += 1) {
        if ((x % 2) === (y % 2) || grid[y][x] !== '#') continue; // only wall-line tiles between two cells
        const h = x % 2 === 0;
        const a = h ? grid[y][x - 1] : grid[y - 1][x];
        const b = h ? grid[y][x + 1] : grid[y + 1][x];
        if (a === '.' && b === '.' && Math.random() < 0.07) grid[y][x] = '.';
      }
    }

    // entrance + distances for placing the safe room
    grid[1][1] = 'E';
    const dist = new Map([['1,1', 0]]);
    const q = [[1, 1]];
    for (let i = 0; i < q.length; i += 1) {
      const [x, y] = q[i];
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (ny < 0 || nx < 0 || ny >= H || nx >= W || dist.has(`${nx},${ny}`)) return;
        if (grid[ny][nx] !== '.') return;
        dist.set(`${nx},${ny}`, dist.get(`${x},${y}`) + 1);
        q.push([nx, ny]);
      });
    }
    const maxD = Math.max(...dist.values());
    const open = (x, y) => y >= 0 && x >= 0 && y < H && x < W && '.ESBD+'.includes(grid[y][x]);
    const cells = [];
    dist.forEach((d, k) => {
      const [x, y] = k.split(',').map(Number);
      if (x % 2 === 1 && y % 2 === 1 && d >= maxD * 0.3) {
        const exits = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(x + dx, y + dy)).length;
        cells.push({ x, y, deadEnd: exits === 1 });
      }
    });
    const pool = cells.filter((c) => c.deadEnd).length ? cells.filter((c) => c.deadEnd) : cells;
    let safe = null;
    if (pool.length) {
      safe = pool[rnd(pool.length)];
      grid[safe.y][safe.x] = 'S';
    } else {
      notes.push('Could not find a spot for the safe room.');
    }

    // doors on straight corridor stretches, away from the key tiles
    const far = (x, y, p) => !p || Math.abs(x - p.x) + Math.abs(y - p.y) > 3;
    const straight = [];
    for (let y = 1; y <= H - 2; y += 1) {
      for (let x = 1; x <= W - 2; x += 1) {
        if (grid[y][x] !== '.') continue;
        const horiz = grid[y][x - 1] === '.' && grid[y][x + 1] === '.' && grid[y - 1][x] === '#' && grid[y + 1][x] === '#';
        const vert = grid[y - 1][x] === '.' && grid[y + 1][x] === '.' && grid[y][x - 1] === '#' && grid[y][x + 1] === '#';
        if ((horiz || vert) && far(x, y, { x: 1, y: 1 }) && far(x, y, safe) && far(x, y, doorTile)) straight.push({ x, y });
      }
    }
    shuffle(straight);
    const want = Math.max(3, Math.round(((maxX + 1) / 2) * ((maxY + 1) / 2) / 22));
    let placed = 0;
    for (const { x, y } of straight) {
      if (placed >= want) break;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy][x + dx] === '+');
      if (near) continue;
      grid[y][x] = '+';
      placed += 1;
    }
    return { grid, notes };
  }

  function randomize() {
    if (!tiles.length) return;
    const cols = Math.max(15, Math.min(120, Number($('lv-cols').value) || tiles[0].length));
    const rows = Math.max(15, Math.min(120, Number($('lv-rows').value) || tiles.length));
    if (!window.confirm(`Replace this floor's layout with a random ${cols}x${rows} one? Walls, doors, entrance, safe room and boss chamber are redrawn and ALL mobs are cleared (you can Undo).`)) return;
    pushUndo();
    const { grid, notes } = generateLayout(cols, rows);
    tiles = grid;
    mobs = []; // no boss or other mobs: place them yourself afterwards
    $('lv-cols').value = String(cols);
    $('lv-rows').value = String(rows);
    dirty = true;
    sizeCanvas();
    afterEdit();
    setStatus(`Random layout generated. No mobs placed — add the boss and the rest yourself.${notes.length ? ` ${notes.join(' ')}` : ''}`, true);
  }

  // ---------- resize / save ----------
  function resize() {
    const cols = Math.max(5, Math.min(120, Number($('lv-cols').value) || 0));
    const rows = Math.max(5, Math.min(120, Number($('lv-rows').value) || 0));
    const oc = tiles[0].length;
    const orows = tiles.length;
    if ((cols < oc || rows < orows) && !window.confirm('Shrinking crops tiles and mobs outside the new size. Continue?')) return;
    pushUndo();
    const next = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => (y < orows && x < oc ? tiles[y][x] : '#')));
    tiles = next;
    mobs = mobs.filter((m) => m.x < cols && m.y < rows);
    $('lv-cols').value = String(cols);
    $('lv-rows').value = String(rows);
    dirty = true;
    sizeCanvas();
    afterEdit();
  }

  async function save() {
    if (!map) return;
    const warnings = runChecks();
    const out = currentAsMap();
    setStatus('Saving…', true);
    try {
      await api('PUT', `/api/admin/map/${level}`, out);
    } catch (e) { setStatus(e.message); return; }
    map = JSON.parse(JSON.stringify(out));
    dirty = false;
    isNewFloor = false;
    await refreshFloors(level);
    setStatus(warnings.length
      ? `Saved floor ${level} with ${warnings.length} warning(s) — see CHECKS. Reload the game to play it.`
      : `Saved floor ${level}. Reload the game to play it.`, true);
  }

  // ---------- public hooks used by js/admin.js ----------
  function confirmLeave() {
    return !dirty || window.confirm('Discard your unsaved level changes?');
  }

  window.adminLevels = {
    isDirty: () => dirty,
    // called when switching category / closing the editor; false = stay
    leave() {
      if (!dirty) return true;
      if (!window.confirm('Discard your unsaved level changes?')) return false;
      dirty = false;
      map = null; // reload from disk next time this category opens
      return true;
    },
    async open() {
      build();
      if (map) { draw(); return; } // already loaded: keep the working copy
      try {
        await loadMobCatalog();
        await refreshFloors();
        if (floors.length) await loadFloor(floors[0].level);
        else await newFloor(false);
      } catch (e) { setStatus(e.message); }
      syncToolbar();
    },
  };
}());
