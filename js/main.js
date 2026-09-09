// =======================================================
// Dungeon Crawler - Screen flow & Title screen logic
// =======================================================

function showScreen(screenClass) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.classList.contains(screenClass));
  });
}

const startBtn = document.getElementById('start-btn');

// Start drops straight into the menu (over the title screen). The
// 5-scene prologue only plays when NEW GAME is chosen.
startBtn.addEventListener('click', () => {
  openMenu();
});

// =======================================================
// Death screen — shown when Carl's HP hits 0. One button: Main Menu.
// The save on disk is left alone (load it to try again).
// =======================================================

const DEATH_QUIPS = [
  'Carl has been eliminated. The System thanks you for your contribution to the entertainment budget.',
  "That's a wrap on Carl. Merchandise featuring his final moments is available in the lobby now.",
  'Cause of death: the dungeon. Contributing factor: hubris. Sponsors: several.',
  "Carl's crawl has ended. 4.7 billion viewers have already changed the channel.",
  'The System has processed your death. A representative will not be with you shortly.',
  'Carl is dead. His endorsement deals, tragically, are not.',
  'Loading condolences… condolences unavailable. Please try dying again later.',
  "Carl's contract has been terminated, along with Carl.",
  "Ratings for this death: two stars. 'Predictable,' says a leading critic.",
  'Death confirmed. The crowd is already chanting somebody else’s name.',
];

const deathBlurbEl = document.getElementById('death-blurb');
const deathMenuBtn = document.getElementById('death-menu-btn');

function showDeathScreen() {
  if (deathBlurbEl) {
    deathBlurbEl.textContent = DEATH_QUIPS[Math.floor(Math.random() * DEATH_QUIPS.length)];
  }
  showScreen('death-screen');
}

if (deathMenuBtn) {
  deathMenuBtn.addEventListener('click', () => {
    currentSlide = 0;
    showScreen('title-screen');
    openMenu();
  });
}

// =======================================================
// Backstory - 5 slide click-through comic prologue
// =======================================================

const slides = [
  {
    scene: 'SCENE 1 OF 5',
    image: 'assets/images/backstory-1.png',
    alt: 'Carl on his couch with Princess Donut, an ordinary night',
    caption:
      '"Carl wasn\u2019t expecting much from tonight \u2014 just a quiet apartment, a bag of stale chips, and his ex\u2019s insufferable show cat, Princess Donut, judging his every move."',
  },
  {
    scene: 'SCENE 2 OF 5',
    image: 'assets/images/backstory-2.png',
    alt: 'Carl fleeing his apartment in only his boots as the sky splits open',
    caption:
      '"Then the sirens started. The sky cracked open in impossible colors, and a voice far too calm for the end of the world announced that Earth now belonged to someone else."',
  },
  {
    scene: 'SCENE 3 OF 5',
    image: 'assets/images/backstory-3.png',
    alt: 'The city unraveling into dungeon architecture around Carl and Donut',
    caption:
      '"Buildings folded in on themselves like paper. Streets rearranged into corridors of black stone. The world Carl knew was being redrawn into something else entirely \u2014 and nobody had asked permission."',
  },
  {
    scene: 'SCENE 4 OF 5',
    image: 'assets/images/backstory-4.png',
    alt: 'A massive glowing dungeon archway rising from the ruins, survivors funneled toward it',
    caption:
      '"A colossal stone archway rose from the wreckage, dripping with alien runes, as a booming, cheerful voice welcomed the survivors as \u2018contestants\u2019 in a game none of them remembered signing up for."',
  },
  {
    scene: 'SCENE 5 OF 5',
    image: 'assets/images/backstory-5.png',
    alt: 'Carl and Princess Donut stepping through the dungeon doorway into Level 1',
    caption:
      '"Carl looked down at Donut, down at his own bare legs and boots, and up at the black doorway swallowing the line ahead of him. There was no going back now \u2014 only down, into Level One."',
  },
];

let currentSlide = 0;

const sceneTagEl = document.getElementById('scene-tag');
const comicPanelEl = document.getElementById('comic-panel');
const comicImgEl = document.getElementById('comic-img');
const comicMissingLabelEl = document.getElementById('comic-missing-label');
const comicMissingPathEl = document.getElementById('comic-missing-path');
const comicCaptionEl = document.getElementById('comic-caption');
const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');
const dotsContainer = document.getElementById('progress-dots');
const skipBtn = document.getElementById('skip-btn');

function renderDots() {
  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dot' + (i === currentSlide ? ' active' : '');
    dot.setAttribute('aria-label', `Go to scene ${i + 1}`);
    dot.addEventListener('click', () => {
      currentSlide = i;
      renderSlide();
    });
    dotsContainer.appendChild(dot);
  });
}

function renderSlide() {
  const slide = slides[currentSlide];

  sceneTagEl.textContent = slide.scene;
  comicCaptionEl.textContent = slide.caption;

  comicPanelEl.classList.remove('img-missing');
  comicImgEl.style.display = '';
  comicImgEl.src = slide.image;
  comicImgEl.alt = slide.alt;
  comicMissingLabelEl.textContent = 'COMIC PANEL GOES HERE';
  comicMissingPathEl.textContent = `drop file at ${slide.image}`;

  backBtn.disabled = false;
  backBtn.querySelector('.btn-text').textContent = currentSlide === 0 ? 'TITLE' : 'BACK';
  nextBtn.querySelector('.btn-text').textContent =
    currentSlide === slides.length - 1 ? 'ENTER LEVEL 1' : 'NEXT';

  renderDots();
}

comicImgEl.addEventListener('error', () => {
  comicImgEl.style.display = 'none';
  comicPanelEl.classList.add('img-missing');
});

backBtn.addEventListener('click', () => {
  if (currentSlide === 0) {
    showScreen('title-screen');
    return;
  }
  currentSlide -= 1;
  renderSlide();
});

nextBtn.addEventListener('click', () => {
  if (currentSlide === slides.length - 1) {
    openStatAllocation();
    return;
  }
  currentSlide += 1;
  renderSlide();
});

skipBtn.addEventListener('click', () => {
  openStatAllocation();
});

// =======================================================
// Character setup - stat allocation (first step of a new game)
// =======================================================

const STAT_MIN = 5;
const STAT_MAX = 20;
const STAT_POINTS_TOTAL = 40;

const statallocOverlay = document.getElementById('statalloc-overlay');
const statallocPointsEl = document.getElementById('statalloc-points');
const statallocRemainingEl = document.getElementById('statalloc-remaining');
const statallocConfirmBtn = document.getElementById('statalloc-confirm-btn');
const statallocPreviewHp = document.getElementById('statalloc-preview-hp');
const statallocPreviewSp = document.getElementById('statalloc-preview-sp');
const statallocPreviewXp = document.getElementById('statalloc-preview-xp');

const statallocSliders = {
  str: document.getElementById('statalloc-str'),
  dex: document.getElementById('statalloc-dex'),
  con: document.getElementById('statalloc-con'),
  luck: document.getElementById('statalloc-luck'),
};
const statallocValues = {
  str: document.getElementById('statalloc-str-value'),
  dex: document.getElementById('statalloc-dex-value'),
  con: document.getElementById('statalloc-con-value'),
  luck: document.getElementById('statalloc-luck-value'),
};

function statAllocSum() {
  return Object.values(statallocSliders).reduce((sum, el) => sum + Number(el.value), 0);
}

// derive Carl's starting resources from his chosen attributes:
// CON -> Max HP, DEX -> Max SP, LUCK -> bonus XP rate. STR governs
// melee power / carry weight (see the Guide Book's Stats tab).
function deriveCarlResources(stats) {
  return {
    maxHp: 50 + stats.con * 5,
    maxSp: 20 + stats.dex * 4,
    xpBonus: stats.luck,
  };
}

function renderStatAlloc() {
  const stats = {
    str: Number(statallocSliders.str.value),
    dex: Number(statallocSliders.dex.value),
    con: Number(statallocSliders.con.value),
    luck: Number(statallocSliders.luck.value),
  };

  Object.keys(stats).forEach((key) => {
    statallocValues[key].textContent = stats[key];
  });

  const remaining = STAT_POINTS_TOTAL - statAllocSum();
  statallocRemainingEl.textContent = remaining;
  statallocPointsEl.classList.toggle('satisfied', remaining === 0);
  statallocConfirmBtn.disabled = remaining !== 0;

  const derived = deriveCarlResources(stats);
  statallocPreviewHp.textContent = derived.maxHp;
  statallocPreviewSp.textContent = derived.maxSp;
  statallocPreviewXp.textContent = `+${derived.xpBonus}%`;

  return { stats, remaining, derived };
}

// keep the total spent within the point pool by clamping the
// slider that was just moved back down if it pushes us over budget
function clampStatSlider(key) {
  const overflow = statAllocSum() - STAT_POINTS_TOTAL;
  if (overflow > 0) {
    const el = statallocSliders[key];
    el.value = Math.max(STAT_MIN, Number(el.value) - overflow);
  }
}

Object.keys(statallocSliders).forEach((key) => {
  statallocSliders[key].addEventListener('input', () => {
    clampStatSlider(key);
    renderStatAlloc();
  });
});

function openStatAllocation() {
  Object.values(statallocSliders).forEach((el) => { el.value = 10; });
  renderStatAlloc();
  statallocOverlay.classList.add('active');
}

statallocConfirmBtn.addEventListener('click', () => {
  const { remaining, stats, derived } = renderStatAlloc();
  if (remaining !== 0) return;
  applyCarlStats(stats, derived);
  statallocOverlay.classList.remove('active');
  showScreen('game-screen');
  ensureLevelMap(1);
  promptSaveIfNeeded('Your crawler is ready! Choose a slot to save your progress.');
});

// =======================================================
// Main game HUD
// =======================================================

function setStatBar(kind, current, max) {
  const valueEl = document.getElementById(`${kind}-bar-value`);
  const fillEl = document.getElementById(`${kind}-bar-fill`);
  valueEl.textContent = `${current} / ${max}`;
  fillEl.style.width = `${max > 0 ? Math.round((current / max) * 100) : 0}%`;
}

const hudStatValues = {
  str: document.getElementById('hud-str-value'),
  dex: document.getElementById('hud-dex-value'),
  con: document.getElementById('hud-con-value'),
  luck: document.getElementById('hud-luck-value'),
};

// =======================================================
// Leveling
// XP is tracked as a running total; the XP bar shows progress inside
// the current level. Crossing a threshold levels Carl up: HP & SP
// fully restore, he banks 3 stat points (spent in the Safe Room
// later), gets 50 x new-level gold, and one Loot Box. LUCK is not a
// factor here — it already boosts the XP earned per kill.
// =======================================================

const LEVEL_STAT_POINTS = 3;
const LEVEL_GOLD_PER_LEVEL = 50;

// cumulative XP required to REACH a level: 0, 100, 300, 600, 1000, 1500…
function xpToReachLevel(level) {
  return 50 * level * (level - 1);
}

let carlLevel = 1;
let carlXpTotal = 0;
let carlStatPoints = 0;

const statPointsBox = document.getElementById('statpoints-box');
const statPointsValueEl = document.getElementById('statpoints-value');
const unitTitleEl = document.querySelector('.hud-left .unit-title');
const carlPortraitImg = document.querySelector('#carl-portrait .portrait-img');

function renderStatPoints() {
  if (statPointsValueEl) statPointsValueEl.textContent = String(carlStatPoints);
  if (statPointsBox) statPointsBox.classList.toggle('has-points', carlStatPoints > 0);
}

// portrait + title track Carl's level. Level 2+ looks for
// assets/images/carl-portrait-level-<n>.png and falls back to the base
// portrait (then the placeholder icon) if that art isn't in yet.
function renderCarlIdentity() {
  if (unitTitleEl) unitTitleEl.textContent = `Level ${carlLevel} Crawler`;
  if (!carlPortraitImg) return;
  const base = 'assets/images/carl-portrait.png';
  const want = carlLevel >= 2 ? `assets/images/carl-portrait-level-${carlLevel}.png` : base;
  if (carlPortraitImg.dataset.want === want) return;
  carlPortraitImg.dataset.want = want;
  carlPortraitImg.onerror = () => {
    if (!/carl-portrait\.png$/.test(carlPortraitImg.getAttribute('src') || '')) {
      carlPortraitImg.src = base; // level art missing — use the base portrait
    } else {
      carlPortraitImg.style.display = 'none';
      carlPortraitImg.parentElement.classList.add('img-missing');
    }
  };
  carlPortraitImg.style.display = '';
  carlPortraitImg.parentElement.classList.remove('img-missing');
  carlPortraitImg.src = want;
}

// XP bar = progress within the current level
function renderXpBar() {
  const floor = xpToReachLevel(carlLevel);
  const next = xpToReachLevel(carlLevel + 1);
  setStatBar('xp', carlXpTotal - floor, next - floor);
}

// add XP and resolve every level-up it triggers. Returns levels gained.
function gainXp(amount) {
  amount = Math.max(0, Math.round(amount || 0));
  carlXpTotal += amount;
  let gained = 0;
  while (carlXpTotal >= xpToReachLevel(carlLevel + 1)) {
    carlLevel += 1;
    gained += 1;
    applyLevelUp(carlLevel);
  }
  renderXpBar();
  return gained;
}

function applyLevelUp(newLevel) {
  const hp = readStatBar('hp');
  setStatBar('hp', hp.max, hp.max);
  const sp = readStatBar('sp');
  setStatBar('sp', sp.max, sp.max);

  carlStatPoints += LEVEL_STAT_POINTS;
  renderStatPoints();

  const gold = LEVEL_GOLD_PER_LEVEL * newLevel;
  addGold(gold);

  let boxNote = '';
  const box = typeof itemCatalog !== 'undefined' && itemCatalog && itemCatalog['loot-box'];
  if (box) {
    boxNote = addToInventory(box)
      ? ' A Loot Box drops into the bag.'
      : ' A Loot Box drops — the bag is full, so the System keeps it.';
  }

  renderCarlIdentity();

  appendSystemLog(
    `✦ LEVEL UP — Carl is now a Level ${newLevel} Crawler. HP & SP fully restored. +${LEVEL_STAT_POINTS} stat points, +${gold} gold.${boxNote}`,
    'level',
  );
}

// wipe leveling progress for a brand-new crawl
function resetLeveling() {
  carlLevel = 1;
  carlXpTotal = 0;
  carlStatPoints = 0;
  renderStatPoints();
  renderCarlIdentity();
  renderXpBar();
}

// applies the attributes chosen during character setup: updates the
// STR/DEX/CON/LUCK readout and fills HP/SP to their new max (fresh
// crawl, full resources), resetting XP progress for the new run
function applyCarlStats(stats, derived) {
  hudStatValues.str.textContent = stats.str;
  hudStatValues.dex.textContent = stats.dex;
  hudStatValues.con.textContent = stats.con;
  hudStatValues.luck.textContent = stats.luck;

  setStatBar('hp', derived.maxHp, derived.maxHp);
  setStatBar('sp', derived.maxSp, derived.maxSp);
  resetLeveling();

  // brand new crawler — nothing collected or logged yet
  closeBattle(); // in case a fight was somehow still up
  inSafeRoom = false; safeRoomReturn = null; stashItems = [];
  closeStash();
  renderInventory([]);
  renderSystemLog([]);
  renderChatLog([]);
  discoveredItems.length = 0;
  renderItems();
}

// =======================================================
// Inventory / Chat / System Log
// All three are driven entirely by the save data: empty on a fresh
// character, restored from the JSON file on load, and captured back
// into the save file whenever the game is saved.
// =======================================================

const inventoryGridEl = document.getElementById('inventory-grid');
const chatLogEl = document.getElementById('chat-log');
const systemLogEl = document.getElementById('system-log');

// the inventory slot currently pinned into the Encounters panel, or null
let selectedInvSlot = null;

function deselectInvItem() {
  if (selectedInvSlot) selectedInvSlot.classList.remove('selected');
  selectedInvSlot = null;
}

// hover tooltip for an inventory slot — toggle items get a different
// line for their on / off state.
function invTooltip(def, active) {
  if (!def) return '';
  if (def.toggle) return (active ? def.tooltipOn : def.tooltipOff) || def.name || '';
  return def.tooltip || def.description || def.name || '';
}

function renderInventory(items) {
  deselectInvItem(); // slot contents are changing — drop any selection
  const slots = inventoryGridEl.querySelectorAll('.inv-slot');
  slots.forEach((slot, i) => {
    const item = items && items[i];
    if (!item) {
      slot.innerHTML = '';
      slot.removeAttribute('title');
      slot.classList.remove('active-item');
      delete slot.dataset.filled;
      delete slot.dataset.itemId;
      delete slot.dataset.itemName;
      delete slot.dataset.icon;
      delete slot.dataset.active;
      return;
    }
    const def = (itemCatalog && item.id) ? itemCatalog[item.id] : null;
    const active = !!item.active;

    slot.dataset.filled = '1';
    slot.dataset.icon = item.icon || '';         // emoji fallback, also persisted
    slot.dataset.itemName = item.name || '';
    if (item.id) slot.dataset.itemId = item.id;
    else delete slot.dataset.itemId;
    if (active) slot.dataset.active = '1';
    else delete slot.dataset.active;
    slot.title = invTooltip(def, active) || item.name || '';
    slot.classList.toggle('active-item', active);

    if (def && def.iconImage) {
      slot.innerHTML = `<img class="inv-slot-img" src="${escapeHtml(def.iconImage)}" alt=""`
        + ` onerror="const p=this.parentElement; this.remove(); p.textContent=p.dataset.icon||'';">`;
    } else {
      slot.textContent = item.icon || '';
    }
  });
}

function readInventory() {
  return Array.from(inventoryGridEl.querySelectorAll('.inv-slot'))
    .filter((slot) => slot.dataset.filled)
    .map((slot) => {
      const entry = {
        icon: slot.dataset.icon || slot.textContent || '',
        name: slot.dataset.itemName || '',
      };
      if (slot.dataset.itemId) entry.id = slot.dataset.itemId;
      if (slot.dataset.active === '1') entry.active = true;
      return entry;
    });
}

// wipe one slot and re-lay the inventory (compacts, clears selection)
function removeInvSlot(slot) {
  slot.innerHTML = '';
  slot.removeAttribute('title');
  slot.classList.remove('active-item');
  delete slot.dataset.filled;
  delete slot.dataset.itemId;
  delete slot.dataset.itemName;
  delete slot.dataset.icon;
  delete slot.dataset.active;
  renderInventory(readInventory());
  updateEncounter();
}

// add an item (catalog def) to the first free inventory slot. Returns
// false if every slot is full — the item is then lost for good.
function addToInventory(itemDef) {
  if (!itemDef) return false;
  const slotCount = inventoryGridEl.querySelectorAll('.inv-slot').length;
  const items = readInventory();
  if (items.length >= slotCount) return false;
  items.push({ id: itemDef.id, icon: itemDef.icon, name: itemDef.name });
  renderInventory(items);
  recordItemDiscovered(itemDef); // any item Carl holds shows in the Guide
  return true;
}

// Click an inventory item to pin its card into the Encounters panel and
// mark the slot selected. Click it again to deselect — the panel then
// goes back to whatever tile Carl is standing on. Selecting another item
// switches to it.
inventoryGridEl.addEventListener('click', (event) => {
  const slot = event.target.closest('.inv-slot');
  if (!slot || !slot.dataset.filled) return;

  if (slot === selectedInvSlot) {
    deselectInvItem();
    updateEncounter();
    return;
  }

  deselectInvItem();
  selectedInvSlot = slot;
  slot.classList.add('selected');

  const def = (itemCatalog && slot.dataset.itemId) ? itemCatalog[slot.dataset.itemId] : null;
  renderEncounter({
    name: (def && def.name) || slot.dataset.itemName || 'Item',
    badge: (def && def.type) || 'item',
    image: (def && def.image) || '',
    icon: (def && def.icon) || slot.dataset.icon || '📦',
  });
});

function renderChatLog(entries) {
  chatLogEl.innerHTML = '';
  (entries || []).forEach((entry) => {
    const p = document.createElement('p');
    p.className = `chat-line chat-${entry.type || 'system'}`;
    p.textContent = entry.text || '';
    chatLogEl.appendChild(p);
  });
}

function readChatLog() {
  return Array.from(chatLogEl.querySelectorAll('.chat-line')).map((el) => ({
    type: el.className.replace('chat-line', '').replace('chat-', '').trim(),
    text: el.textContent,
  }));
}

function renderSystemLog(entries) {
  systemLogEl.innerHTML = '';
  (entries || []).forEach((entry) => {
    const p = document.createElement('p');
    p.className = `log-line log-${entry.type || 'system'}`;
    p.textContent = entry.text || '';
    systemLogEl.appendChild(p);
  });
  // jump to the newest entry so the last thing that happened is visible.
  // deferred: on load this runs before the game screen is shown, so the
  // element has no scrollable height until the next frame.
  requestAnimationFrame(() => { systemLogEl.scrollTop = systemLogEl.scrollHeight; });
}

function readSystemLog() {
  return Array.from(systemLogEl.querySelectorAll('.log-line')).map((el) => ({
    type: el.className.replace('log-line', '').replace('log-', '').trim(),
    text: el.textContent,
  }));
}

// =======================================================
// Active save slot tracking
// which slot/save name the current playthrough belongs to.
// Persisted in localStorage so it survives a page refresh.
// null means "not yet saved anywhere" — the save popup will
// be triggered to ask the player to pick/name a slot.
// =======================================================

const ACTIVE_SAVE_STORAGE_KEY = 'dungeon-crawler-active-save';
const footerSaveText = document.getElementById('footer-save-text');
const quickSaveBtn = document.getElementById('quick-save-btn');
const saveToastEl = document.getElementById('save-toast');
let saveToastTimer = null;

function loadActiveSaveFromStorage() {
  try {
    const raw = localStorage.getItem(ACTIVE_SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.slot === 'number' && typeof parsed.name === 'string') {
      return parsed;
    }
  } catch (err) {
    // corrupt/blocked storage — just treat it as "no active save"
  }
  return null;
}

let activeSave = loadActiveSaveFromStorage();

function renderFooterSave() {
  if (activeSave) {
    const when = formatSavedAt(activeSave.savedAt);
    footerSaveText.textContent =
      `Slot ${activeSave.slot} \u2014 ${activeSave.name}` + (when ? ` \u00b7 saved ${when}` : '');
    footerSaveText.classList.remove('unsaved');
  } else {
    footerSaveText.textContent = "No active save \u2014 progress isn't saved yet";
    footerSaveText.classList.add('unsaved');
  }
  // quick save only makes sense once a slot is being tracked
  if (quickSaveBtn) quickSaveBtn.hidden = !activeSave;
}

function setActiveSave(save) {
  activeSave = save;
  if (save) {
    localStorage.setItem(ACTIVE_SAVE_STORAGE_KEY, JSON.stringify(save));
  } else {
    localStorage.removeItem(ACTIVE_SAVE_STORAGE_KEY);
  }
  renderFooterSave();
}

function showSaveToast(message) {
  saveToastEl.textContent = message;
  saveToastEl.classList.add('visible');
  clearTimeout(saveToastTimer);
  saveToastTimer = setTimeout(() => {
    saveToastEl.classList.remove('visible');
  }, 2400);
}

// opens the Save Game popup automatically when there's no active
// slot to save to yet (e.g. right after a brand-new character is
// created). No-op if a slot is already being tracked.
function promptSaveIfNeeded(message) {
  if (activeSave) return;
  openSaveLoad('save').then(() => {
    if (message) saveloadStatus.textContent = message;
  });
}

renderFooterSave();
refreshActiveSaveMeta();

const menuBtn = document.getElementById('menu-btn');
const guideQuickBtn = document.getElementById('guide-quick-btn');

menuBtn.addEventListener('click', () => {
  openMenu();
});

guideQuickBtn.addEventListener('click', () => {
  openGuide();
});

if (quickSaveBtn) {
  quickSaveBtn.addEventListener('click', () => {
    quickSave();
  });
}

// Ctrl+S (Cmd+S on macOS) — quick save, or open the Save dialog if no
// slot has been chosen yet. Swallows the browser's "save page" prompt.
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  const game = document.querySelector('.game-screen');
  if (!game || !game.classList.contains('active')) return;
  event.preventDefault();
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (activeSave) quickSave();
  else openSaveLoad('save');
});

// Ctrl+G / Ctrl+M / Ctrl+L — quick keys for the Guide Book, the Menu,
// and the Load screen. Guide and Menu toggle; each swallows the browser
// default for that combo.
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  const key = event.key.toLowerCase();
  if (key !== 'g' && key !== 'm' && key !== 'l') return;
  const game = document.querySelector('.game-screen');
  if (!game || !game.classList.contains('active')) return;
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  event.preventDefault();

  if (key === 'g') {
    if (guideOverlay.classList.contains('active')) closeGuide();
    else openGuide();
  } else if (key === 'm') {
    if (menuOverlay.classList.contains('active')) closeMenu();
    else openMenu();
  } else {
    if (saveloadOverlay.classList.contains('active')) closeSaveLoad();
    else openSaveLoad('load');
  }
});

// On a fresh page load activeSave comes from localStorage without a
// timestamp — ask the server for the slot's real savedAt so the footer
// can show it. Silent no-op when the server isn't reachable.
async function refreshActiveSaveMeta() {
  if (!activeSave) return;
  try {
    const res = await fetch('/api/saves');
    if (!res.ok) return;
    const data = await res.json();
    const slot = (data.slots || []).find((s) => s.slot === activeSave.slot);
    if (slot && slot.occupied) {
      setActiveSave({ slot: activeSave.slot, name: slot.name, savedAt: slot.savedAt });
    } else {
      // the tracked slot no longer exists on disk
      setActiveSave(null);
    }
  } catch (err) {
    /* offline / file:// — leave the footer text as-is */
  }
}

// =======================================================
// Popup menu (New Game / Save Game / Load Game / Guide Book)
// =======================================================

const menuOverlay = document.getElementById('menu-overlay');
const menuCloseBtn = document.getElementById('menu-close-btn');
const menuStatus = document.getElementById('menu-status');
const newGameBtn = document.getElementById('new-game-btn');
const saveGameBtn = document.getElementById('save-game-btn');
const loadGameBtn = document.getElementById('load-game-btn');
const guideBtn = document.getElementById('guide-btn');

function openMenu() {
  menuStatus.textContent = '';
  menuOverlay.classList.add('active');
}

function closeMenu() {
  menuOverlay.classList.remove('active');
}

menuCloseBtn.addEventListener('click', closeMenu);

// clicking the dark backdrop (outside the frame) also closes the menu
menuOverlay.addEventListener('click', (event) => {
  if (event.target === menuOverlay) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuOverlay.classList.contains('active')) {
    closeMenu();
  }
});

// NEW GAME always starts a fresh crawl: drop the active save, then play
// the 5-scene prologue -> character setup -> the dungeon.
newGameBtn.addEventListener('click', () => {
  closeMenu();
  setActiveSave(null);
  currentSlide = 0;
  showScreen('backstory-screen');
  renderSlide();
});

saveGameBtn.addEventListener('click', () => {
  closeMenu();
  openSaveLoad('save');
});

loadGameBtn.addEventListener('click', () => {
  closeMenu();
  openSaveLoad('load');
});

guideBtn.addEventListener('click', () => {
  closeMenu();
  openGuide();
});

// =======================================================
// Save / Load game (10 slots, real JSON files under /data
// served by server.js — see /api/saves endpoints)
// =======================================================

const saveloadOverlay = document.getElementById('saveload-overlay');
const saveloadCloseBtn = document.getElementById('saveload-close-btn');
const saveloadHeading = document.getElementById('saveload-heading');
const saveSlotList = document.getElementById('save-slot-list');
const saveloadStatus = document.getElementById('saveload-status');

let saveloadMode = 'save'; // 'save' | 'load'
let saveloadSlots = [];
// per-slot UI state while the overlay is open: 'default' | 'editing' |
// 'confirm-overwrite' | 'confirm-delete'
let slotUiState = {};

function formatSavedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// Captures the game state currently reflected in the HUD, so a save
// actually reflects whatever the player has done so far.
function buildSaveStub() {
  const goldEl = document.getElementById('gold-value');
  return {
    floor: 1,
    gold: goldEl ? Number(goldEl.textContent) || 0 : 0,
    stats: {
      str: Number(hudStatValues.str.textContent) || 0,
      dex: Number(hudStatValues.dex.textContent) || 0,
      con: Number(hudStatValues.con.textContent) || 0,
      luck: Number(hudStatValues.luck.textContent) || 0,
    },
    hp: readStatBar('hp'),
    sp: readStatBar('sp'),
    xp: readStatBar('xp'),
    level: carlLevel,
    xpTotal: carlXpTotal,
    statPoints: carlStatPoints,
    inventory: readInventory(),
    stash: stashItems.map((it) => ({ ...it })),
    itemsDiscovered: discoveredItems.map((d) => d.id),
    systemLog: readSystemLog(),
    chat: readChatLog(),
    mapState: buildMapState(),
  };
}

function readStatBar(kind) {
  const el = document.getElementById(`${kind}-bar-value`);
  if (!el) return { current: 0, max: 0 };
  const [current, max] = el.textContent.split('/').map((part) => Number(part.trim()) || 0);
  return { current, max };
}

async function openSaveLoad(mode) {
  saveloadMode = mode;
  slotUiState = {};
  saveloadStatus.textContent = '';
  saveloadHeading.textContent = mode === 'save' ? 'SAVE GAME' : 'LOAD GAME';
  saveloadOverlay.classList.toggle('mode-load', mode === 'load');
  saveloadOverlay.classList.toggle('mode-save', mode === 'save');
  saveloadOverlay.classList.add('active');
  await refreshSlots();
}

function closeSaveLoad() {
  saveloadOverlay.classList.remove('active');
  slotUiState = {};
}

async function refreshSlots() {
  saveSlotList.innerHTML = '<p class="save-slot-date">Loading save slots…</p>';
  try {
    const res = await fetch('/api/saves');
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();
    saveloadSlots = data.slots;
    renderSlots();
  } catch (err) {
    saveSlotList.innerHTML = '';
    saveloadStatus.textContent =
      '⚠ Could not reach the save server. Run "npm start" and open this page via http://localhost, not as a local file.';
  }
}

function renderSlots() {
  saveSlotList.innerHTML = '';
  saveloadSlots.forEach((slotInfo) => {
    saveSlotList.appendChild(buildSlotRow(slotInfo));
  });
}

function buildSlotRow(slotInfo) {
  const state = slotUiState[slotInfo.slot] || 'default';
  const row = document.createElement('div');
  row.className = 'save-slot';
  row.dataset.slot = String(slotInfo.slot);

  if (state === 'editing') {
    row.classList.add('save-slot-editing');
    row.innerHTML = `
      <span class="save-slot-num">${slotInfo.slot}</span>
      <input type="text" class="save-slot-input" maxlength="40"
             placeholder="Name your save…" value="${slotInfo.occupied ? escapeHtml(slotInfo.name) : ''}">
      <button type="button" class="save-slot-confirm" title="Save">💾</button>
      <button type="button" class="save-slot-cancel" title="Cancel">✕</button>
    `;
    return row;
  }

  if (state === 'confirm-overwrite') {
    row.classList.add('save-slot-confirming');
    row.innerHTML = `
      <span class="save-slot-num">${slotInfo.slot}</span>
      <span class="save-slot-confirm-text">Overwrite "${escapeHtml(slotInfo.name)}"?</span>
      <button type="button" class="save-slot-confirm-yes">YES</button>
      <button type="button" class="save-slot-confirm-no">NO</button>
    `;
    return row;
  }

  if (state === 'confirm-delete') {
    row.classList.add('save-slot-confirming');
    row.innerHTML = `
      <span class="save-slot-num">${slotInfo.slot}</span>
      <span class="save-slot-confirm-text">Delete "${escapeHtml(slotInfo.name)}"?</span>
      <button type="button" class="save-slot-confirm-yes">YES</button>
      <button type="button" class="save-slot-confirm-no">NO</button>
    `;
    return row;
  }

  // default state
  if (!slotInfo.occupied) row.classList.add('empty');
  if (activeSave && activeSave.slot === slotInfo.slot) row.classList.add('active-slot');
  row.innerHTML = `
    <span class="save-slot-num">${slotInfo.slot}</span>
    <div class="save-slot-info">
      <span class="save-slot-name">${slotInfo.occupied ? escapeHtml(slotInfo.name) : 'Empty Slot'}</span>
      <span class="save-slot-date">${slotInfo.occupied ? formatSavedAt(slotInfo.savedAt) : ''}</span>
    </div>
    ${activeSave && activeSave.slot === slotInfo.slot ? '<span class="save-slot-active-tag">ACTIVE</span>' : ''}
    ${slotInfo.occupied ? '<button type="button" class="save-slot-delete" title="Delete save">🗑</button>' : ''}
  `;
  return row;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function findSlotInfo(slotNum) {
  return saveloadSlots.find((s) => s.slot === slotNum);
}

saveSlotList.addEventListener('click', (event) => {
  const row = event.target.closest('.save-slot');
  if (!row) return;
  const slotNum = Number(row.dataset.slot);
  const slotInfo = findSlotInfo(slotNum);
  if (!slotInfo) return;

  if (event.target.closest('.save-slot-delete')) {
    slotUiState = { [slotNum]: 'confirm-delete' };
    renderSlots();
    return;
  }

  if (event.target.closest('.save-slot-confirm-yes')) {
    if (slotUiState[slotNum] === 'confirm-delete') {
      deleteSlot(slotNum);
    } else if (slotUiState[slotNum] === 'confirm-overwrite') {
      slotUiState = { [slotNum]: 'editing' };
      renderSlots();
      focusSlotInput(slotNum);
    }
    return;
  }

  if (event.target.closest('.save-slot-confirm-no')) {
    slotUiState = {};
    renderSlots();
    return;
  }

  if (event.target.closest('.save-slot-confirm')) {
    const input = row.querySelector('.save-slot-input');
    saveToSlot(slotNum, input ? input.value : '');
    return;
  }

  if (event.target.closest('.save-slot-cancel')) {
    slotUiState = {};
    renderSlots();
    return;
  }

  // clicked the row itself (not a button) — behavior depends on mode
  if (slotUiState[slotNum]) return; // already mid-action, ignore row click

  if (saveloadMode === 'save') {
    if (slotInfo.occupied) {
      slotUiState = { [slotNum]: 'confirm-overwrite' };
      renderSlots();
    } else {
      slotUiState = { [slotNum]: 'editing' };
      renderSlots();
      focusSlotInput(slotNum);
    }
  } else if (saveloadMode === 'load' && slotInfo.occupied) {
    loadSlot(slotNum);
  }
});

saveSlotList.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.matches('.save-slot-input')) {
    const row = event.target.closest('.save-slot');
    saveToSlot(Number(row.dataset.slot), event.target.value);
  }
});

function focusSlotInput(slotNum) {
  const row = saveSlotList.querySelector(`.save-slot[data-slot="${slotNum}"]`);
  const input = row && row.querySelector('.save-slot-input');
  if (input) {
    input.focus();
    input.select();
  }
}

// POSTs the current game state to a slot and makes it the active save.
// Shared by the Save Game dialog and the topbar Quick Save button.
async function writeSaveToSlot(slotNum, name) {
  const res = await fetch(`/api/saves/${slotNum}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...buildSaveStub() }),
  });
  if (!res.ok) throw new Error('save failed');
  const result = await res.json();
  setActiveSave({ slot: slotNum, name: result.name, savedAt: result.savedAt || null });
  appendSystemLog(`Progress saved to Slot ${slotNum} — ${result.name}.`);
  return result;
}

async function saveToSlot(slotNum, name) {
  saveloadStatus.textContent = 'Saving…';
  try {
    const result = await writeSaveToSlot(slotNum, name);
    slotUiState = {};
    saveloadStatus.textContent = `Saved to slot ${slotNum}.`;
    showSaveToast(`💾 Saved to Slot ${slotNum} — ${result.name}`);
    closeSaveLoad();
  } catch (err) {
    saveloadStatus.textContent = '⚠ Could not save. Is the local server running?';
  }
}

// Quick Save — write straight to the active slot, no dialog. The button
// is hidden until a slot has been chosen, so activeSave is set here.
async function quickSave() {
  if (!activeSave) return;
  const { slot, name } = activeSave;
  if (quickSaveBtn) quickSaveBtn.disabled = true;
  try {
    const result = await writeSaveToSlot(slot, name);
    showSaveToast(`💾 Quick-saved to Slot ${slot} — ${result.name}`);
  } catch (err) {
    showSaveToast('⚠ Quick save failed — is the server running?');
  } finally {
    if (quickSaveBtn) quickSaveBtn.disabled = false;
  }
}

async function deleteSlot(slotNum) {
  saveloadStatus.textContent = 'Deleting…';
  try {
    const res = await fetch(`/api/saves/${slotNum}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    const wasActive = activeSave && activeSave.slot === slotNum;
    if (wasActive) {
      setActiveSave(null);
    }
    slotUiState = {};
    await refreshSlots();
    saveloadStatus.textContent = `Slot ${slotNum} deleted.`;
    if (wasActive) {
      closeSaveLoad();
      closeMenu();
      currentSlide = 0;
      showScreen('title-screen');
    }
  } catch (err) {
    saveloadStatus.textContent = '⚠ Could not delete that save.';
  }
}

async function loadSlot(slotNum) {
  saveloadStatus.textContent = 'Loading…';
  try {
    const res = await fetch(`/api/saves/${slotNum}`);
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    const goldEl = document.getElementById('gold-value');
    if (goldEl && typeof data.gold === 'number') goldEl.textContent = String(data.gold);
    if (data.stats) {
      hudStatValues.str.textContent = data.stats.str;
      hudStatValues.dex.textContent = data.stats.dex;
      hudStatValues.con.textContent = data.stats.con;
      hudStatValues.luck.textContent = data.stats.luck;
    }
    if (data.hp) setStatBar('hp', data.hp.current, data.hp.max);
    if (data.sp) setStatBar('sp', data.sp.current, data.sp.max);

    carlLevel = Math.max(1, Number(data.level) || 1);
    carlStatPoints = Math.max(0, Number(data.statPoints) || 0);
    if (typeof data.xpTotal === 'number') {
      carlXpTotal = data.xpTotal;
    } else if (data.xp) {
      // legacy save: the XP bar held raw current/max — fold it into the total
      carlXpTotal = xpToReachLevel(carlLevel) + (Number(data.xp.current) || 0);
    } else {
      carlXpTotal = xpToReachLevel(carlLevel);
    }
    renderStatPoints();
    renderCarlIdentity();
    renderXpBar();
    // load the item catalog first so inventory slots can show icon images
    await ensureItemCatalog();
    closeBattle(); // don't carry a fight across a load
    inSafeRoom = false; safeRoomReturn = null; // never resume inside the safe room
    stashItems = Array.isArray(data.stash) ? data.stash.map((it) => ({ ...it })) : [];
    renderInventory(data.inventory || []);
    renderSystemLog(data.systemLog || []);
    renderChatLog(data.chat || []);

    discoveredItems.length = 0;
    (data.itemsDiscovered || []).forEach((id) => {
      if (itemCatalog[id]) discoveredItems.push(itemCatalog[id]);
    });
    // anything currently in the bag counts as discovered too
    (data.inventory || []).forEach((it) => {
      if (it.id && itemCatalog[it.id] && !discoveredItems.some((d) => d.id === it.id)) {
        discoveredItems.push(itemCatalog[it.id]);
      }
    });
    renderItems();

    setActiveSave({ slot: slotNum, name: data.name || `Save ${slotNum}`, savedAt: data.savedAt || null });
    closeSaveLoad();
    showScreen('game-screen');
    ensureLevelMap(Number(data.floor) || 1, data.mapState || null);
  } catch (err) {
    saveloadStatus.textContent = '⚠ Could not load that save.';
  }
}

saveloadCloseBtn.addEventListener('click', closeSaveLoad);

saveloadOverlay.addEventListener('click', (event) => {
  if (event.target === saveloadOverlay) closeSaveLoad();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && saveloadOverlay.classList.contains('active')) {
    closeSaveLoad();
  }
});

// =======================================================
// Guide Book (Mordecai's explainer, bestiary, item log)
// =======================================================

const guideOverlay = document.getElementById('guide-overlay');
const guideCloseBtn = document.getElementById('guide-close-btn');
const guideNav = document.getElementById('guide-nav');
const bestiaryList = document.getElementById('bestiary-list');
const itemsList = document.getElementById('items-list');

// Monsters Carl has discovered on the map. Entries are the full mob
// definitions from data/mobs.json (name, icon, hp/attack/defense/xp,
// description). Rebuilt from the save on load; see renderDungeonMap.
const bestiary = [];

// Items Carl has received at least once. Entries are the full item
// definitions from data/items.json. Persisted as ids in the save
// (itemsDiscovered) and rebuilt on load.
const discoveredItems = [];

// full item catalog from data/items.json, keyed by id
let itemCatalog = null;
async function ensureItemCatalog() {
  if (itemCatalog) return itemCatalog;
  itemCatalog = {};
  try {
    const res = await fetch('data/items.json');
    if (!res.ok) throw new Error('no items.json');
    const data = await res.json();
    (data.items || []).forEach((it) => { itemCatalog[it.id] = it; });
  } catch (err) {
    /* item catalog unavailable */
  }
  return itemCatalog;
}

// note that Carl now knows an item — shows it in the Guide's Items tab
function recordItemDiscovered(def) {
  if (!def || discoveredItems.some((d) => d.id === def.id)) return;
  discoveredItems.push(def);
  if (guideOverlay.classList.contains('active')) renderItems();
}

function renderEntryList(container, entries, emptyMessage) {
  container.innerHTML = '';

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="guide-empty">
        <span class="placeholder-icon">❔</span>
        <span>${emptyMessage}</span>
      </div>
    `;
    return;
  }

  entries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'guide-entry';
    row.innerHTML = `
      <span class="guide-entry-icon">${entry.icon}</span>
      <div>
        <p class="guide-entry-name">${escapeHtml(entry.name)}</p>
        <p class="guide-entry-desc">${escapeHtml(entry.desc)}</p>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderBestiary() {
  if (!bestiaryList) return;
  if (bestiary.length === 0) {
    bestiaryList.innerHTML = `
      <div class="guide-empty">
        <span class="placeholder-icon">❔</span>
        <span>No monsters discovered yet. Survive your first encounter to begin filling these pages.</span>
      </div>
    `;
    return;
  }
  bestiaryList.innerHTML = '';
  bestiary
    .slice()
    .sort((a, b) => (a.xp || 0) - (b.xp || 0))
    .forEach((m) => {
      const hasStats = [m.hp, m.attack, m.defense, m.xp].every((v) => v != null);
      const iconHtml = m.iconImage
        ? `<span class="guide-entry-icon guide-icon-box">
             <img class="guide-icon-img" src="${escapeHtml(m.iconImage)}" alt=""
                  onerror="this.style.display='none'; this.parentElement.classList.add('img-missing');">
             <span class="guide-icon-fallback">${m.icon || '❔'}</span>
           </span>`
        : `<span class="guide-entry-icon">${m.icon || '❔'}</span>`;
      const row = document.createElement('div');
      row.className = 'guide-entry guide-entry-mob' + (m.boss ? ' guide-entry-is-boss' : '');
      row.innerHTML = `
        ${iconHtml}
        <div>
          <p class="guide-entry-name">${escapeHtml(m.name || m.id || 'Unknown')}${
            m.boss ? ' <span class="guide-entry-key guide-entry-boss">BOSS</span>' : ''
          }</p>
          ${hasStats
            ? `<p class="guide-entry-stats">HP ${m.hp}&nbsp;&nbsp;·&nbsp;&nbsp;ATK ${m.attack}&nbsp;&nbsp;·&nbsp;&nbsp;DEF ${m.defense}&nbsp;&nbsp;·&nbsp;&nbsp;XP ${m.xp}</p>`
            : ''}
          <p class="guide-entry-desc">${escapeHtml(m.description || '')}</p>
        </div>
      `;
      bestiaryList.appendChild(row);
    });
}

// add a discovered mob (its full definition) to the Guide bestiary
function addToBestiary(def) {
  if (!def || bestiary.some((b) => b.id === def.id)) return;
  bestiary.push(def);
  if (guideOverlay.classList.contains('active')) renderBestiary();
}

// rebuild the bestiary from the "x,y" keys of mobs Carl has discovered
function syncBestiaryFromDiscovered() {
  bestiary.length = 0;
  discoveredMobs.forEach((key) => {
    const ref = mobByCell.get(key);
    const def = ref && mobCatalog && mobCatalog[ref.id];
    if (def && !bestiary.some((b) => b.id === def.id)) bestiary.push(def);
  });
}

function renderItems() {
  if (!itemsList) return;
  if (discoveredItems.length === 0) {
    itemsList.innerHTML = `
      <div class="guide-empty">
        <span class="placeholder-icon">❔</span>
        <span>No items catalogued yet. Loot will appear here as you find it.</span>
      </div>
    `;
    return;
  }
  const KIND_LABEL = {
    permanent: 'PERMANENT',
    consumable: 'CONSUMABLE',
    container: 'CONTAINER',
  };
  itemsList.innerHTML = '';
  discoveredItems.forEach((it) => {
    const iconHtml = it.iconImage
      ? `<span class="guide-entry-icon guide-icon-box">
           <img class="guide-icon-img" src="${escapeHtml(it.iconImage)}" alt=""
                onerror="this.style.display='none'; this.parentElement.classList.add('img-missing');">
           <span class="guide-icon-fallback">${it.icon || '❔'}</span>
         </span>`
      : `<span class="guide-entry-icon">${it.icon || '❔'}</span>`;
    const kind = KIND_LABEL[it.type] || (it.type ? String(it.type).toUpperCase() : '');
    const kindHtml = kind
      ? ` <span class="guide-entry-tag tag-${escapeHtml(it.type)}">${kind}</span>`
      : '';
    const row = document.createElement('div');
    row.className = 'guide-entry';
    row.innerHTML = `
      ${iconHtml}
      <div>
        <p class="guide-entry-name">${escapeHtml(it.name || it.id || 'Item')}${kindHtml}</p>
        <p class="guide-entry-desc">${escapeHtml(it.description || '')}</p>
      </div>
    `;
    itemsList.appendChild(row);
  });
}

function setGuideTab(tab) {
  guideNav.querySelectorAll('.guide-nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.guide-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tab);
  });
}

guideNav.addEventListener('click', (event) => {
  const btn = event.target.closest('.guide-nav-btn');
  if (btn) setGuideTab(btn.dataset.tab);
});

function openGuide() {
  renderBestiary();
  renderItems();
  setGuideTab('gameplay');
  guideOverlay.classList.add('active');
}

function closeGuide() {
  guideOverlay.classList.remove('active');
}

guideCloseBtn.addEventListener('click', closeGuide);

guideOverlay.addEventListener('click', (event) => {
  if (event.target === guideOverlay) closeGuide();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && guideOverlay.classList.contains('active')) {
    closeGuide();
  }
});

// The O action: on a Safe Room tile it opens the Safe Room; otherwise
// it forces open a door in an adjacent tile. (Same for the hotbar slot.)
function activateOpenDoorAction() {
  if (inSafeRoom) {
    if (mapTileAt(carlPos.x, carlPos.y) === 'X') { exitSafeRoom(); return; }
    appendSystemLog('The doors in here are already open.');
    return;
  }
  if (currentLevelMap && carlPos && mapTileAt(carlPos.x, carlPos.y) === 'S') {
    enterSafeRoom();
    return;
  }
  openAdjacentDoors();
}

const hotbarOpenDoorBtn = document.getElementById('hotbar-open-door');
if (hotbarOpenDoorBtn) {
  hotbarOpenDoorBtn.addEventListener('click', activateOpenDoorAction);
  hotbarOpenDoorBtn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateOpenDoorAction();
    }
  });
}

// =======================================================
// Dungeon map — each floor has its own grid map saved under
// data/map-level<N>.json (walls / floors / doors / boss room).
// The file is authored as rows of single-char tiles; see the
// map's own "legend" for what each character means.
// =======================================================

const mapViewport = document.getElementById('map-viewport');
const mapTitleEl = document.getElementById('map-title');
const mapLegendEl = document.getElementById('map-legend');

// --- Encounters box (right sidebar) ------------------------------
const encounterCardEl = document.querySelector('.encounter-card');

// Encounter cards for the tile Carl currently stands on. Every card
// image is a self-contained card, so the box drops its own frame/labels
// (.encounter-full) and the art fills it. Pass null only when there's no
// map yet — that shows the "Unknown Encounter" placeholder.
const TILE_ENCOUNTERS = {
  entrance: { name: 'Dungeon Entrance', badge: 'threshold', image: 'assets/cards/dungeon-entrance.png', icon: '🚪' },
  door: { name: 'Open Doorway', badge: 'threshold', image: 'assets/cards/open-doorway.png', icon: '🚪' },
  closedDoor: { name: 'Closed Door', badge: 'threshold', image: 'assets/cards/closed-doorway.png', icon: '🚪' },
  saferoom: { name: 'Safe Room', badge: 'sanctuary', image: 'assets/cards/safe-room.png', icon: '🏠' },
  empty: { name: 'Empty Passage', badge: 'terrain', image: 'assets/cards/empty-passage.png', icon: '·' },
};

function renderEncounter(enc) {
  if (!encounterCardEl) return;
  const badge = encounterCardEl.querySelector('.card-type-badge');
  const art = encounterCardEl.querySelector('.card-art');
  const name = encounterCardEl.querySelector('.card-name');
  const lines = encounterCardEl.querySelector('.card-text-lines');

  if (!enc) {
    encounterCardEl.classList.remove('encounter-full');
    if (badge) badge.textContent = '???';
    if (art) art.innerHTML = '<span class="placeholder-icon">❔</span>';
    if (name) name.textContent = 'Unknown Encounter';
    if (lines) lines.innerHTML = '<span></span><span></span><span></span>';
    return;
  }

  encounterCardEl.classList.add('encounter-full');
  if (badge) badge.textContent = String(enc.badge || '').toUpperCase();
  if (name) name.textContent = enc.name || '';
  if (art) {
    art.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'card-art-img';
    img.src = enc.image || '';
    img.alt = enc.name || '';
    img.onerror = () => {
      art.innerHTML = `<span class="placeholder-icon">${enc.icon || '❔'}</span>`;
    };
    art.appendChild(img);
  }
  if (lines) lines.innerHTML = '';
}

// is Carl orthogonally adjacent to a door he hasn't opened yet?
function facingClosedDoor() {
  if (!carlPos) return false;
  return [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
    const x = carlPos.x + dx;
    const y = carlPos.y + dy;
    return isDoorTile(mapTileAt(x, y)) && !openedDoors.has(`${x},${y}`);
  });
}

// pick the right card for Carl's current position
function encounterForCarl() {
  if (!currentLevelMap || !carlPos) return null;
  const mob = mobDefAt(carlPos.x, carlPos.y);
  if (mob) {
    return { name: mob.name, badge: mob.role || 'mob', image: mob.image, icon: mob.icon };
  }
  const ch = mapTileAt(carlPos.x, carlPos.y);
  if (ch === 'E') return TILE_ENCOUNTERS.entrance;
  if (ch === 'S') return TILE_ENCOUNTERS.saferoom;
  if (isDoorTile(ch)) return TILE_ENCOUNTERS.door;
  if (facingClosedDoor()) return TILE_ENCOUNTERS.closedDoor;
  return TILE_ENCOUNTERS.empty;
}

function updateEncounter() {
  if (selectedInvSlot) return; // a selected inventory item is pinned in the panel
  renderEncounter(inSafeRoom ? safeRoomEncounterForCarl() : encounterForCarl());
}

const TILE_CLASS = {
  ' ': 't-void',
  '#': 't-wall',
  '.': 't-floor',
  '+': 't-door',
  E: 't-entrance',
  B: 't-boss',
  D: 't-bossdoor',
  S: 't-saferoom',
};

const MAP_LEGEND = [
  { cls: 't-carl', label: 'Carl' },
  { cls: 't-mob', label: 'Mob' },
  { cls: 't-bossmob', label: 'Boss' },
  { cls: 't-floor', label: 'Floor' },
  { cls: 't-wall', label: 'Wall' },
  { cls: 't-door', label: 'Door' },
  { cls: 't-entrance', label: 'Entrance' },
  { cls: 't-saferoom', label: 'Safe Room' },
  { cls: 't-bossdoor', label: 'Boss door' },
  { cls: 't-boss', label: 'Boss room' },
  { cls: 't-fog', label: 'Unexplored' },
];

let currentLevelMap = null;

// --- Carl on the map ------------------------------------------------
// carlPos is a {x, y} cell coordinate; openedDoors holds "x,y" keys for
// door tiles the player has forced open (walkable from then on). cellEls
// is a flat lookup of the rendered cell <div>s so we can restyle a door
// the moment it opens. All of this is captured into the save file.
let carlPos = null;
let openedDoors = new Set();
let cellEls = [];
let carlEl = null;
let bossRoomEntered = false;

// fog of war: cells Carl has seen at least once stay dimly lit; the
// rest are pitch black. Vision is a square (Chebyshev) radius around
// Carl — 1 tile bare, 2 tiles with a lit Torch in the inventory.
const BASE_VISION_RADIUS = 1;
let exploredCells = new Set();

function currentVisionRadius() {
  const torchLit = Array.from(inventoryGridEl.querySelectorAll('.inv-slot'))
    .some((s) => s.dataset.itemId === 'torch' && s.dataset.active === '1');
  return BASE_VISION_RADIUS + (torchLit ? 1 : 0);
}

// mobs: positions come baked into the map file (map.mobs). mobByCell maps
// "x,y" -> { id, x, y }; discoveredMobs holds the "x,y" keys Carl has
// seen (icon shows on the map only once discovered). mobCatalog is the
// full bestiary from data/mobs.json, keyed by id.
let mobByCell = new Map();
let discoveredMobs = new Set();
let killedMobs = new Set();   // "x,y" keys of mobs Carl has beaten — shown as X, never fight again
let mobCatalog = null;

async function ensureMobCatalog() {
  if (mobCatalog) return mobCatalog;
  mobCatalog = {};
  try {
    const res = await fetch('data/mobs.json');
    if (!res.ok) throw new Error('no mobs.json');
    const data = await res.json();
    Object.values(data.levels || {}).forEach((list) => {
      (list || []).forEach((m) => { mobCatalog[m.id] = m; });
    });
  } catch (err) {
    /* bestiary unavailable — markers fall back to a generic dot */
  }
  return mobCatalog;
}

// the LIVE mob on a tile (null if none, or if Carl already killed it)
function mobDefAt(x, y) {
  const key = `${x},${y}`;
  if (killedMobs.has(key)) return null;
  const ref = mobByCell.get(key);
  if (!ref) return null;
  return (mobCatalog && mobCatalog[ref.id]) || { id: ref.id, name: ref.id };
}

function mapTileAt(x, y) {
  const map = currentLevelMap;
  if (!map) return ' ';
  if (y < 0 || x < 0 || y >= map.grid.rows || x >= map.grid.cols) return ' ';
  const row = map.tiles[y] || '';
  return row[x] || ' ';
}

function isDoorTile(ch) {
  return ch === '+' || ch === 'D';
}

function isWalkable(x, y) {
  const ch = mapTileAt(x, y);
  if (ch === '.' || ch === 'E' || ch === 'B' || ch === 'S') return true;
  // in the safe room, feature tiles (X, 1-9) are floor you can stand on
  if (inSafeRoom && (ch === 'X' || (ch >= '1' && ch <= '9'))) return true;
  if (isDoorTile(ch)) return openedDoors.has(`${x},${y}`);
  return false;
}

function cellElAt(x, y) {
  if (!currentLevelMap) return null;
  return cellEls[y * currentLevelMap.grid.cols + x] || null;
}

function placeCarl() {
  if (!carlEl || !carlPos) return;
  const cell = cellElAt(carlPos.x, carlPos.y);
  if (cell) cell.appendChild(carlEl);
}

// re-paint the fog: cells inside the vision radius are fully lit (and
// get marked explored), previously-seen cells outside it are dimmed,
// everything else is blacked out.
function applyFog() {
  if (!currentLevelMap || !carlPos) return;
  const { cols, rows } = currentLevelMap.grid;
  const radius = currentVisionRadius();
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const el = cellEls[y * cols + x];
      if (!el) continue;
      const key = `${x},${y}`;
      const dist = Math.max(Math.abs(x - carlPos.x), Math.abs(y - carlPos.y));
      if (dist <= radius) {
        exploredCells.add(key);
        if (mobByCell.has(key) && !discoveredMobs.has(key) && !killedMobs.has(key)) {
          discoveredMobs.add(key);
          onMobDiscovered(mobByCell.get(key));
        }
        el.classList.remove('fog-hidden', 'fog-explored');
      } else if (exploredCells.has(key)) {
        el.classList.remove('fog-hidden');
        el.classList.add('fog-explored');
      } else {
        el.classList.remove('fog-explored');
        el.classList.add('fog-hidden');
      }
      if (mobByCell.has(key)) {
        const marker = el.querySelector('.map-mob');
        if (marker) marker.hidden = !(killedMobs.has(key) || discoveredMobs.has(key));
      }
    }
  }
}

// first time a mob comes into view: note it in the System Log and add
// it to the Guide Book's bestiary.
function onMobDiscovered(mobRef) {
  const def = mobCatalog && mobCatalog[mobRef.id];
  if (!def) return;
  if (def.boss) {
    appendSystemLog(`${def.name} is here. This is the one.`, 'danger');
  } else {
    appendSystemLog(`Spotted: ${def.name}.`);
  }
  addToBestiary(def);
}

function renderDungeonMap(map, restore) {
  currentLevelMap = map;
  const cols = map.grid.cols;
  const rows = map.grid.rows;

  const restored = restore && restore.level === map.level ? restore : null;
  openedDoors = new Set(restored && Array.isArray(restored.doors) ? restored.doors : []);
  carlPos = restored && restored.carl
    ? { x: restored.carl.x, y: restored.carl.y }
    : { x: map.start.x, y: map.start.y };
  bossRoomEntered = restored ? Boolean(restored.bossRoomEntered) : false;
  exploredCells = new Set(restored && Array.isArray(restored.explored) ? restored.explored : []);

  mobByCell = new Map();
  (map.mobs || []).forEach((m) => { mobByCell.set(`${m.x},${m.y}`, m); });
  discoveredMobs = new Set(restored && Array.isArray(restored.mobsDiscovered) ? restored.mobsDiscovered : []);
  killedMobs = new Set(restored && Array.isArray(restored.killedMobs) ? restored.killedMobs : []);
  syncBestiaryFromDiscovered();
  if (guideOverlay.classList.contains('active')) renderBestiary();

  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.setProperty('--map-cols', cols);
  grid.style.setProperty('--map-rows', rows);
  grid.style.setProperty('--map-aspect', (cols / rows).toFixed(4));
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  cellEls = new Array(cols * rows);
  const frag = document.createDocumentFragment();
  map.tiles.forEach((line, y) => {
    const padded = line.padEnd(cols, ' ');
    for (let x = 0; x < cols; x += 1) {
      const ch = padded[x];
      const cell = document.createElement('div');
      // start every cell blacked out; applyFog() lifts the veil where it should
      cell.className = `map-cell ${TILE_CLASS[ch] || 't-void'} fog-hidden`;
      if (isDoorTile(ch) && openedDoors.has(`${x},${y}`)) {
        cell.classList.add('t-door-open');
      }
      const mobRef = mobByCell.get(`${x},${y}`);
      if (mobRef) {
        const mkey = `${x},${y}`;
        const def = (mobCatalog && mobCatalog[mobRef.id]) || null;
        const isBoss = mobRef.boss || (def && def.boss);
        const dead = killedMobs.has(mkey);
        const marker = document.createElement('span');
        marker.className = dead ? 'map-mob is-dead' : (isBoss ? 'map-mob is-boss' : 'map-mob');
        marker.title = (def && def.name) || mobRef.id;
        marker.hidden = !(dead || discoveredMobs.has(mkey));
        cell.appendChild(marker);
      }
      cellEls[y * cols + x] = cell;
      frag.appendChild(cell);
    }
  });
  grid.appendChild(frag);

  carlEl = document.createElement('div');
  carlEl.className = 'map-carl';
  carlEl.title = 'Carl';

  const tag = map.subtitle || `Floor ${map.level}`;
  mapTitleEl.textContent = `${tag.toUpperCase()} — ${String(map.name).toUpperCase()}`;

  mapLegendEl.innerHTML = MAP_LEGEND
    .map(({ cls, label }) => `<span><i class="map-cell ${cls}"></i>${label}</span>`)
    .join('');

  mapViewport.innerHTML = '';
  mapViewport.appendChild(grid);
  placeCarl();
  applyFog();
  updateEncounter();
}

async function ensureLevelMap(level = 1, restore = null) {
  if (!mapViewport) return;
  let map = currentLevelMap && currentLevelMap.level === level ? currentLevelMap : null;
  if (!map) {
    try {
      const res = await fetch(`data/map-level${level}.json`);
      if (!res.ok) throw new Error('map not found');
      map = await res.json();
    } catch (err) {
      currentLevelMap = null;
      mapTitleEl.textContent = 'DUNGEON MAP';
      mapLegendEl.innerHTML = '';
      mapViewport.innerHTML =
        `<p class="map-label">No map found for floor ${level}.</p>`;
      return;
    }
  }
  await ensureMobCatalog();
  await ensureItemCatalog();
  renderDungeonMap(map, restore);
}

// --- movement + door opening -------------------------------------
const MOVE_KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

function appendSystemLog(text, type = 'system') {
  const p = document.createElement('p');
  p.className = `log-line log-${type}`;
  p.textContent = text;
  systemLogEl.appendChild(p);
  systemLogEl.scrollTop = systemLogEl.scrollHeight;
}

// only drive Carl when the dungeon is actually on screen and no popup
// (menu / guide / save-load / character setup) is stealing the keys, and
// no fight is holding the map panel — combat has its own key handling
function dungeonInputActive() {
  const game = document.querySelector('.game-screen');
  if (!game || !game.classList.contains('active')) return false;
  if (battle) return false;
  if (document.querySelector(
    '.menu-overlay.active, .saveload-overlay.active, .guide-overlay.active, .statalloc-overlay.active, .stash-overlay.active',
  )) return false;
  return true;
}

function openAdjacentDoors() {
  if (!currentLevelMap || !carlPos) return;
  const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  let opened = 0;
  let alreadyOpen = 0;
  dirs.forEach(([dx, dy]) => {
    const x = carlPos.x + dx;
    const y = carlPos.y + dy;
    const ch = mapTileAt(x, y);
    if (!isDoorTile(ch)) return;
    const key = `${x},${y}`;
    if (openedDoors.has(key)) {
      alreadyOpen += 1;
      return;
    }
    openedDoors.add(key);
    const el = cellElAt(x, y);
    if (el) el.classList.add('t-door-open');
    appendSystemLog(ch === 'D'
      ? 'The sealed door grinds open. The Warden is close.'
      : 'Carl forces the door open.');
    opened += 1;
  });
  if (!opened) {
    appendSystemLog(alreadyOpen
      ? (alreadyOpen > 1 ? 'Those doors are already open.' : 'That door is already open.')
      : 'No door within reach to open.');
  } else {
    updateEncounter(); // the "Closed Door" card may no longer apply
  }
}

function tryMoveCarl(dx, dy) {
  if (inSafeRoom) { trySafeRoomMove(dx, dy); return; }
  if (!currentLevelMap || !carlPos) return;
  const nx = carlPos.x + dx;
  const ny = carlPos.y + dy;
  const ch = mapTileAt(nx, ny);
  if (isDoorTile(ch) && !openedDoors.has(`${nx},${ny}`)) {
    appendSystemLog('The door is shut. Press O to open it.');
    return;
  }
  if (!isWalkable(nx, ny)) { roamBark('blocked'); return; }
  carlPos = { x: nx, y: ny };
  placeCarl();
  applyFog();
  if (ch === 'B' && !bossRoomEntered) {
    bossRoomEntered = true;
    const bossName = (currentLevelMap.bossRoom && currentLevelMap.bossRoom.name) || 'the boss room';
    appendSystemLog(`Carl steps into ${bossName}.`, 'danger');
  }
  updateEncounter();
  const mob = mobDefAt(carlPos.x, carlPos.y);
  if (mob) {
    const vowel = /^[aeiou]/i.test(mob.name || '');
    appendSystemLog(`Carl runs into ${vowel ? 'an' : 'a'} ${mob.name}.`, 'danger');
  } else {
    roamBark(ch === 'S' ? 'saferoom' : 'move');
  }
}

document.addEventListener('keydown', (event) => {
  if (!dungeonInputActive() || !carlPos) return;
  // let modifier combos through (Ctrl+S, Ctrl+G, …) — S/G/etc. are also
  // movement/action keys, and we don't want them doing both
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (event.code === 'KeyO') {
    event.preventDefault();
    activateOpenDoorAction();
    return;
  }
  if (event.code === 'KeyF') {
    event.preventDefault();
    // stop this same F keypress from also reaching the battle-modal
    // handler, which would instantly commit the fight
    event.stopImmediatePropagation();
    activateFightAction();
    return;
  }
  if (event.code === 'KeyU') {
    event.preventDefault();
    activateUseAction();
    return;
  }
  const delta = MOVE_KEYS[event.code];
  if (!delta) return;
  event.preventDefault();
  tryMoveCarl(delta[0], delta[1]);
});

// snapshot of the player's position / opened doors for the save file.
// While Carl is in the safe room, currentLevelMap is the safe-room map —
// persist the dungeon state we stashed on entry instead, so a save/reload
// puts him back on the dungeon's Safe Room tile.
function buildMapState() {
  if (inSafeRoom && safeRoomReturn) return safeRoomReturn.restore;
  if (!currentLevelMap || !carlPos) return null;
  return {
    level: currentLevelMap.level,
    carl: { x: carlPos.x, y: carlPos.y },
    doors: Array.from(openedDoors),
    explored: Array.from(exploredCells),
    mobsDiscovered: Array.from(discoveredMobs),
    killedMobs: Array.from(killedMobs),
    bossRoomEntered,
  };
}

// =======================================================
// Turn-based combat — rendered in place of the dungeon map.
// Carl (STR/DEX/CON/LUCK from the HUD) vs. the mob (hp/attack/defense/xp
// from mobs.json). Each attack: d20 + stat vs Dodge, then damage dice
// − flat DEF. It is a fight to the death — there is no running once it
// starts. Every turn Carl either FIGHTs, DEFENDs, or uses an inventory
// item (select it in the sidebar, press U) — an item costs him the turn.
// Dice rolls and outcomes are written to the SYSTEM LOG; the mob's card
// stays in the ENCOUNTERS panel. Win → XP + the mob is marked dead (X on
// the map). Lose → game over, back to the title (disk save untouched).
// SP is displayed but does nothing yet (spells arrive on floor 2).
// =======================================================

const mapCombatEl = document.getElementById('map-combat');
const combatRoundEl = document.getElementById('combat-round');
const combatTurnEl = document.getElementById('combat-turn');
const combatFastBtn = document.getElementById('combat-fast-btn');
const combatArenaEl = document.getElementById('combat-arena');
const combatVsEl = document.getElementById('combat-vs');
const combatDieEl = document.getElementById('combat-die');
const combatDieFaceEl = document.getElementById('combat-die-face');
const combatStampEl = document.getElementById('combat-stamp');
const combatCalloutEl = document.getElementById('combat-callout');
const combatNoteEl = document.getElementById('combat-note');
const combatResultEl = document.getElementById('combat-result');
const combatButtonsEl = document.getElementById('combat-buttons');
const combatMobNameEl = document.getElementById('combat-mob-name');
const combatCarlImg = document.getElementById('combat-carl-img');
const combatMobImg = document.getElementById('combat-mob-img');
const combatCarlPortraitEl = document.getElementById('combat-carl-portrait');
const combatMobPortraitEl = document.getElementById('combat-mob-portrait');
const combatCarlFloatEl = document.getElementById('combat-carl-float');
const combatMobFloatEl = document.getElementById('combat-mob-float');
const combatCarlHpFill = document.getElementById('combat-carl-hp-fill');
const combatCarlHpGhost = document.getElementById('combat-carl-hp-ghost');
const combatCarlHpVal = document.getElementById('combat-carl-hp-val');
const combatCarlSpFill = document.getElementById('combat-carl-sp-fill');
const combatCarlSpVal = document.getElementById('combat-carl-sp-val');
const combatMobHpFill = document.getElementById('combat-mob-hp-fill');
const combatMobHpGhost = document.getElementById('combat-mob-hp-ghost');
const combatMobHpVal = document.getElementById('combat-mob-hp-val');

// a DEFEND turn also recovers this fraction of Max SP ("catch your breath")
const DEFEND_SP_REGAIN_PCT = 0.25;

// --- animation pacing -------------------------------------------
const COMBAT_FAST_KEY = 'dungeon-crawler-combat-fast';
let combatFast = false;
try { combatFast = localStorage.getItem(COMBAT_FAST_KEY) === '1'; } catch (e) { /* private mode */ }
function combatAnimShort() {
  return combatFast
    || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
const wait = (ms) => new Promise((res) => { setTimeout(res, ms); });
// scaled pause: near-instant when the player has chosen FAST / reduced motion
const beat = (ms) => wait(combatAnimShort() ? Math.min(ms, 110) : ms);
if (combatFastBtn) {
  const syncFastBtn = () => combatFastBtn.classList.toggle('on', combatFast);
  syncFastBtn();
  combatFastBtn.addEventListener('click', () => {
    combatFast = !combatFast;
    try { localStorage.setItem(COMBAT_FAST_KEY, combatFast ? '1' : '0'); } catch (e) { /* ignore */ }
    syncFastBtn();
  });
}

let battle = null; // active battle state, or null

// --- dice ---------------------------------------------------------
function rollDie(sides) { return 1 + Math.floor(Math.random() * sides); }
function rollDice(n, sides) {
  const rolls = [];
  let total = 0;
  for (let i = 0; i < n; i += 1) { const r = rollDie(sides); rolls.push(r); total += r; }
  return { rolls, total };
}
const sgn = (n) => (n >= 0 ? `+${n}` : `${n}`);

// --- combatant sheets -------------------------------------------
function carlSheet() {
  const hp = readStatBar('hp');
  const sp = readStatBar('sp');
  const str = Number(hudStatValues.str.textContent) || 10;
  const dex = Number(hudStatValues.dex.textContent) || 10;
  const luck = Number(hudStatValues.luck.textContent) || 10;
  return {
    name: 'Carl',
    hp: hp.current, maxHp: hp.max,
    sp: sp.current, maxSp: sp.max,
    luck,
    toHit: dex,
    dodge: 10 + Math.floor(dex / 2),
    defense: 0,
    dmgDie: 6, dmgDieCount: 1, dmgMod: Math.floor(str / 3),
    critMin: luck >= 15 ? 19 : 20,
  };
}
function mobSheet(def) {
  const atk = Number(def.attack) || 4;
  const hp = Number(def.hp) || 10;
  return {
    name: def.name || 'Mob',
    hp, maxHp: hp,
    toHit: Math.floor(atk / 2),
    dodge: 10,
    defense: Number(def.defense) || 0,
    dmgDie: Math.max(2, atk), dmgDieCount: 1, dmgMod: Math.floor(atk / 3),
    critMin: 20,
  };
}

// --- combat log → SYSTEM LOG -----------------------------------
// combatLog() tags map onto system-log line types (see .log-* in CSS)
const COMBAT_LOG_TYPE = {
  'l-turn': 'turn', 'l-hit': 'hit', 'l-crit': 'crit', 'l-miss': 'miss', 'l-dmg': 'dmg',
};
function combatLog(text, cls) {
  appendSystemLog(text, cls ? (COMBAT_LOG_TYPE[cls] || 'combat') : 'combat');
}

// --- bars (Carl HP/SP + mob HP, in the combat panel) ----------
// the fill snaps to the new value; the "ghost" behind it lags and drains
// down after a beat, so a hit reads as a chunk of health peeling away.
function setCombatBar(fill, val, cur, max, ghost) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const prevPct = parseFloat(fill.style.width);
  fill.style.width = `${pct}%`;
  val.textContent = `${Math.max(0, cur)} / ${max}`;
  if (!ghost) return;
  if (Number.isFinite(prevPct) && pct < prevPct - 0.01) {
    ghost.style.transition = 'none';
    ghost.style.width = `${prevPct}%`;
    void ghost.offsetWidth; // reflow so the drain animates from the old value
    ghost.style.transition = combatAnimShort() ? 'width 140ms linear' : 'width 480ms ease 120ms';
    ghost.style.width = `${pct}%`;
  } else {
    ghost.style.transition = 'width 180ms ease';
    ghost.style.width = `${pct}%`;
  }
}
function renderBattle() {
  if (!battle) return;
  setCombatBar(combatCarlHpFill, combatCarlHpVal, battle.carl.hp, battle.carl.maxHp, combatCarlHpGhost);
  setCombatBar(combatCarlSpFill, combatCarlSpVal, battle.carl.sp, battle.carl.maxSp);
  setCombatBar(combatMobHpFill, combatMobHpVal, battle.mob.hp, battle.mob.maxHp, combatMobHpGhost);
  if (combatNoteEl) {
    combatNoteEl.hidden = !battle.riposte;
    if (battle.riposte) combatNoteEl.textContent = '⟳ Riposte ready — next FIGHT strikes for +50%';
  }
}

// --- turn banner / round / callout ----------------------------
function setCombatTurn(text, tone) {
  if (!combatTurnEl) return;
  combatTurnEl.textContent = text;
  combatTurnEl.className = `combat-turn t-${tone || 'wait'}`;
}
function setCombatRound(n) {
  if (combatRoundEl) combatRoundEl.textContent = `ROUND ${n}`;
}
function setCombatCallout(text) {
  if (!combatCalloutEl) return;
  combatCalloutEl.textContent = text || '';
  if (!text) return;
  combatCalloutEl.classList.remove('pop');
  void combatCalloutEl.offsetWidth;
  combatCalloutEl.classList.add('pop');
}

// --- Princess Donut heckles from the CHAT panel -------------
// Carl's ex's award-winning show cat: vain, imperious, camera-obsessed,
// treats Carl as staff — and secretly does not want him to die.
const DONUT_LINES = {
  intro: [
    "Try not to embarrass me in front of my viewers, Carl.",
    "Ugh, it's filthy. Kill it quickly, I have a fanbase to maintain.",
    "Stand up straight. The cameras are on ME, but still.",
  ],
  carlCrit: [
    "Finally, something worth clipping. You're welcome for the inspiration.",
    "See? THAT is what happens when you listen to me.",
    "Adequate. The crowd is chanting my name, obviously, but adequate.",
  ],
  carlFumble: [
    'CARL. My reputation cannot survive this.',
    "I've seen newborn kittens with better form.",
    "Do that again and I'm telling everyone we're not associated.",
  ],
  mobHitBig: [
    "Must you bleed so loudly? It's very off-brand.",
    'If you die, I am NOT carrying your loot.',
    "That looked like it hurt. Anyway. Focus, Carl.",
  ],
  riposteLand: [
    "A counter! From YOU! I'm almost proud. Almost.",
    "That is the technique I demonstrated. Note that I demonstrated it.",
    "Gorgeous. Do it again while the camera's still on us.",
  ],
  riposteSet: ["It missed. Pathetic. Punish it, Carl.", "Now, Carl. While it's off balance. NOW."],
  defend: [
    'Cowering. Bold choice, with sponsors watching.',
    "Fine, catch your breath. I'll pose.",
    'Turtling is so unflattering. Do hurry.',
  ],
  lowHp: [
    'CARL. A potion. I did not sign up to be a widow.',
    "You're at death's door and my fur is IMMACULATE. Priorities, Carl.",
  ],
  win: [
    "Naturally. They'll be talking about MY performance for weeks.",
    'Another one down. Someone fetch me a treat.',
    'We make it look easy. Well. I do.',
  ],
  lose: [
    '...Well. This is a public relations disaster.',
    'CARL. Get up. CARL. ...Someone edit this out.',
    "I'm going to need a moment. And a new roommate.",
  ],
};
function bark(key) {
  const lines = DONUT_LINES[key];
  if (!lines || !chatLogEl) return;
  if (key === 'defend' && Math.random() > 0.4) return; // don't heckle every brace
  appendChatLine(lines[Math.floor(Math.random() * lines.length)], 'donut');
}

// Princess Donut also mutters while Carl wanders — rarely, and with a
// cooldown, so it stays a garnish rather than a running monologue.
const DONUT_ROAM = {
  move: [
    'Are we there yet? My paws are getting dusty.',
    'This whole floor smells like the inside of a gym bag, Carl.',
    'A grand champion, reduced to walking. Walking.',
    'If you see a cushion, we are stopping.',
    'The lighting down here does nothing for my coat.',
    'Keep moving. The sooner this ends, the sooner someone brushes me.',
    'I could be on a velvet pillow right now. Instead: this.',
    'Do try to look heroic. Someone might be filming.',
    'Another identical hallway. Riveting.',
    'Watch the puddles. I am not licking that off later.',
    'You walk so loudly. Like a dropped bag of cutlery.',
    'Faster, Carl. My public is waiting.',
  ],
  blocked: [
    'That is a wall, Carl. A wall.',
    'Smooth. Very heroic.',
    'Walking into things is not a strategy.',
    'The audience saw that, you know.',
  ],
  saferoom: [
    'A safe room. Press O, Carl. We are going in and I am not asking.',
    'Finally. Civilization. Or the System\'s idea of it. Open it.',
    'The safe room. I get first pick of the warm corner.',
  ],
};
let roamSteps = 0;
let roamBarkStep = -20;
function roamBark(pool) {
  if (battle) return; // combat has its own commentary
  const lines = DONUT_ROAM[pool];
  if (!lines || !chatLogEl) return;
  roamSteps += 1;
  const gap = pool === 'blocked' ? 4 : pool === 'saferoom' ? 0 : 7;
  const chance = pool === 'blocked' ? 0.3 : pool === 'saferoom' ? 0.7 : 0.14;
  if (roamSteps - roamBarkStep < gap) return;
  if (Math.random() > chance) return;
  roamBarkStep = roamSteps;
  appendChatLine(lines[Math.floor(Math.random() * lines.length)], 'donut');
}
function appendChatLine(text, type = 'system') {
  if (!chatLogEl) return;
  const p = document.createElement('p');
  p.className = `chat-line chat-${type}`;
  p.textContent = text;
  chatLogEl.appendChild(p);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

// --- d20 tumble + verdict stamp ------------------------------
async function playDie(roll, verdict) {
  if (!combatDieEl) return;
  combatStampEl.className = 'combat-stamp';
  combatVsEl.classList.add('rolling');
  combatDieEl.hidden = false;

  if (combatAnimShort()) {
    combatDieFaceEl.textContent = String(roll);
    combatDieEl.className = `combat-die thunk${roll === 20 ? ' nat20' : roll === 1 ? ' nat1' : ''}`;
    await wait(80);
  } else {
    combatDieEl.className = 'combat-die rolling';
    const frames = [26, 30, 38, 50, 66, 88, 118, 160];
    for (const f of frames) {
      if (!battle) { combatDieEl.hidden = true; combatVsEl.classList.remove('rolling'); return; }
      combatDieFaceEl.textContent = String(1 + Math.floor(Math.random() * 20));
      await wait(f);
    }
    combatDieFaceEl.textContent = String(roll);
    combatDieEl.className = `combat-die thunk${roll === 20 ? ' nat20' : roll === 1 ? ' nat1' : ''}`;
    await wait(170);
  }

  combatStampEl.textContent = verdict;
  combatStampEl.className = `combat-stamp show v-${verdict.toLowerCase()}`;
  await beat(470);
  combatStampEl.classList.remove('show');
  combatDieEl.hidden = true;
  combatDieEl.className = 'combat-die';
  combatVsEl.classList.remove('rolling');
}

// --- impact feedback: float number + portrait flinch + shake ---
// side: 'carl' | 'mob'; kind: 'hit' | 'crit' | 'miss' | 'heal'
function playImpact(side, amount, kind) {
  const portrait = side === 'carl' ? combatCarlPortraitEl : combatMobPortraitEl;
  const float = side === 'carl' ? combatCarlFloatEl : combatMobFloatEl;
  if (!portrait || !float) return;

  float.textContent = kind === 'miss' ? 'MISS'
    : kind === 'heal' ? `+${amount}`
      : `−${amount}`;
  float.className = 'combatant-float';
  void float.offsetWidth;
  float.className = `combatant-float show f-${kind}`;

  if (kind === 'hit' || kind === 'crit') {
    portrait.classList.remove('hit', 'crit');
    void portrait.offsetWidth;
    portrait.classList.add(kind);
    if (combatArenaEl && !combatAnimShort()) {
      combatArenaEl.classList.remove('shake');
      void combatArenaEl.offsetWidth;
      combatArenaEl.classList.add('shake');
    }
    if (side === 'carl' && mapCombatEl) {
      mapCombatEl.classList.add('dmg-flash');
      setTimeout(() => mapCombatEl.classList.remove('dmg-flash'), 110);
    }
    setTimeout(() => portrait.classList.remove('hit', 'crit'), 460);
    setTimeout(() => { if (combatArenaEl) combatArenaEl.classList.remove('shake'); }, 300);
  } else if (kind === 'heal') {
    portrait.classList.remove('brace');
    void portrait.offsetWidth;
    portrait.classList.add('brace');
    setTimeout(() => portrait.classList.remove('brace'), 520);
  }
  setTimeout(() => { float.className = 'combatant-float'; }, 950);
}

// --- one attack, fully logged ---------------------------------
// dmgMult scales the final damage — used for Carl's riposte (×1.5) after
// the mob whiffs into a Defend.
function resolveAttack(atk, def, defenderDefending, dmgMult = 1) {
  const dodge = def.dodge + (defenderDefending ? 5 : 0);
  const hitRoll = rollDie(20);
  const hitTotal = hitRoll + atk.toHit;
  const fumble = hitRoll === 1;
  const crit = !fumble && hitRoll >= atk.critMin;
  const hit = !fumble && (crit || hitTotal >= dodge);

  const verdict = fumble ? 'FUMBLE' : crit ? 'CRIT' : hit ? 'HIT' : 'MISS';
  combatLog(
    `  to-hit  d20[${hitRoll}] ${sgn(atk.toHit)} = ${hitTotal}  vs Dodge ${dodge}  → ${verdict}`,
    hit ? (crit ? 'l-crit' : 'l-hit') : 'l-miss',
  );

  let dmg = 0;
  if (hit) {
    const dice = rollDice(atk.dmgDieCount * (crit ? 2 : 1), atk.dmgDie);
    const raw = dice.total + atk.dmgMod;
    dmg = Math.max(1, raw - def.defense);
    if (defenderDefending) dmg = Math.max(1, Math.floor(dmg / 2));
    if (dmgMult !== 1) dmg = Math.max(1, Math.round(dmg * dmgMult));
    combatLog(
      `  damage  d${atk.dmgDie}[${dice.rolls.join(',')}] ${sgn(atk.dmgMod)}`
      + `${def.defense ? ` −${def.defense} DEF` : ''}${defenderDefending ? ' ÷2 defend' : ''}`
      + `${dmgMult !== 1 ? ` ×${dmgMult} riposte` : ''} = ${dmg}`,
      'l-dmg',
    );
  }
  return { hit, crit, dmg, roll: hitRoll, verdict };
}

// --- buttons -------------------------------------------------
const COMBAT_BTN = {
  attack: '<button class="dungeon-button" type="button" data-act="attack"><span class="btn-text">FIGHT</span><span class="btn-key">F</span></button>',
  defend: '<button class="dungeon-button" type="button" data-act="defend"><span class="btn-text">DEFEND</span><span class="btn-key">D</span></button>',
  continue: '<button class="dungeon-button" type="button" data-act="continue"><span class="btn-text">CONTINUE</span></button>',
};
function setCombatButtons(...keys) {
  combatButtonsEl.innerHTML = keys.map((k) => COMBAT_BTN[k]).join('');
}

// --- lifecycle ---------------------------------------------
// The fight takes over the map panel as a lit arena: Carl vs. the mob,
// portraits facing off, the d20 tumbling between them. The mob's full
// card still sits in the ENCOUNTERS panel; the precise dice math still
// scrolls in the SYSTEM LOG; Princess Donut heckles from CHAT.
function openBattle(mobDef) {
  if (!mapCombatEl || !carlPos) return;
  deselectInvItem();  // let the mob's card sit in the ENCOUNTERS panel
  updateEncounter();  // (Carl shares its tile) until Carl picks an item
  battle = {
    mobDef,
    cx: carlPos.x,
    cy: carlPos.y,
    carl: carlSheet(),
    mob: mobSheet(mobDef),
    phase: 'carl',
    round: 1,
    carlDefending: false, // brace is live for the mob's next swing only
    riposte: false,       // mob whiffed into a Defend → next FIGHT hits +50%
    lowHpBarked: false,
    over: false,
  };

  combatResultEl.hidden = true;
  combatResultEl.className = 'combat-result';
  combatMobNameEl.textContent = (mobDef.name || 'Mob').toUpperCase();

  // portraits
  const carlSrc = document.querySelector('#carl-portrait .portrait-img');
  if (combatCarlImg) {
    combatCarlImg.style.display = '';
    combatCarlImg.src = (carlSrc && carlSrc.getAttribute('src')) || 'assets/images/carl-portrait.png';
    combatCarlPortraitEl.classList.remove('img-missing', 'hit', 'crit', 'brace', 'down');
  }
  if (combatMobImg) {
    combatMobImg.style.display = '';
    combatMobImg.src = mobDef.image || '';
    combatMobImg.alt = mobDef.name || '';
    combatMobPortraitEl.classList.remove('img-missing', 'hit', 'crit', 'brace', 'down');
    if (!mobDef.image) combatMobPortraitEl.classList.add('img-missing');
  }
  if (combatDieEl) { combatDieEl.hidden = true; combatDieEl.className = 'combat-die'; }
  if (combatStampEl) combatStampEl.className = 'combat-stamp';
  if (combatVsEl) combatVsEl.classList.remove('rolling');
  setCombatCallout('');
  setCombatRound(1);

  renderBattle();
  mapCombatEl.classList.add('active');

  const vowel = /^[aeiou]/i.test(mobDef.name || '');
  combatLog(`Carl squares off against ${vowel ? 'an' : 'a'} ${mobDef.name}. No way out but through.`, 'l-turn');
  bark('intro');
  carlTurnUI();
}

function closeBattle() {
  if (mapCombatEl) mapCombatEl.classList.remove('active');
  battle = null;
}

function carlTurnUI() {
  battle.phase = 'carl';
  battle.carlDefending = false; // a Defend only covers the mob's next swing
  setCombatRound(battle.round);
  setCombatTurn(battle.riposte ? 'YOUR MOVE — RIPOSTE' : 'YOUR MOVE', 'you');
  setCombatButtons('attack', 'defend');
  renderBattle();
}

async function carlAct(kind) {
  if (!battle || battle.phase !== 'carl' || battle.over) return;
  battle.phase = 'resolving';
  setCombatButtons(); // lock the bar while the turn resolves

  if (kind === 'defend') {
    setCombatTurn('CARL BRACES', 'wait');
    battle.carlDefending = true;
    combatLog('▶ CARL braces for the next blow.  (Dodge +5, damage halved)', 'l-turn');
    // catch your breath — a Defend turn is also a chance to recover SP
    const sp = readStatBar('sp');
    const regain = Math.round(sp.max * DEFEND_SP_REGAIN_PCT);
    const after = Math.min(sp.max, sp.current + regain);
    if (after > sp.current) {
      setStatBar('sp', after, sp.max);
      battle.carl.sp = after;
      battle.carl.maxSp = sp.max;
      combatLog(`  Carl catches his breath. +${after - sp.current} SP.`, 'l-hit');
      setCombatCallout(`CARL BRACES  ·  +${after - sp.current} SP`);
      playImpact('carl', after - sp.current, 'heal');
    } else {
      combatLog('  Carl catches his breath — SP already full.');
      setCombatCallout('CARL BRACES');
    }
    bark('defend');
    renderBattle();
    await beat(560);
  } else {
    const riposting = battle.riposte;
    battle.riposte = false;
    setCombatTurn(riposting ? 'CARL RIPOSTES' : 'CARL ATTACKS', 'you');
    combatLog(
      riposting ? `▶ CARL ripostes the ${battle.mob.name}!` : `▶ CARL attacks the ${battle.mob.name}`,
      'l-turn',
    );
    const r = resolveAttack(battle.carl, battle.mob, false, riposting ? 1.5 : 1);
    await playDie(r.roll, r.verdict);
    if (!battle) return;
    if (r.hit) {
      const before = battle.mob.hp;
      battle.mob.hp -= r.dmg;
      combatLog(`  ${battle.mob.name}: ${Math.max(0, before)} → ${Math.max(0, battle.mob.hp)} HP`);
      playImpact('mob', r.dmg, r.crit ? 'crit' : 'hit');
      setCombatCallout(`CARL ${riposting ? 'RIPOSTES' : r.crit ? 'CRITS' : 'HITS'}  —  ${r.dmg}`);
      if (r.crit) bark('carlCrit');
      else if (riposting) bark('riposteLand');
    } else {
      playImpact('mob', 0, 'miss');
      setCombatCallout(r.verdict === 'FUMBLE' ? 'CARL FUMBLES' : 'CARL MISSES');
      if (r.verdict === 'FUMBLE') bark('carlFumble');
    }
    renderBattle();
    await beat(560);
    if (!battle) return;
    if (battle.mob.hp <= 0) { endFight('win'); return; }
  }

  if (!battle || battle.over) return;
  mobTurn();
}

// Carl spends his turn on an inventory item (select it in the sidebar,
// then press U or the Use action). It resolves through the normal
// useItem() path; then the mob gets its swing — an item is never free in
// a fight. Returns a (truthy) promise when it took over the Use action.
async function carlUseItemInBattle() {
  if (!battle || battle.over) return true;
  if (battle.phase !== 'carl') {
    appendSystemLog("It's not Carl's turn.");
    return true;
  }
  if (!selectedInvSlot || !selectedInvSlot.dataset.filled) {
    appendSystemLog('Select an item first, then Use.');
    return true;
  }
  const slot = selectedInvSlot;
  const id = slot.dataset.itemId;
  const def = (itemCatalog && id) ? itemCatalog[id] : null;
  const name = (def && def.name) || slot.dataset.itemName || 'the item';

  battle.phase = 'resolving';
  setCombatButtons(); // lock the bar while the turn resolves
  setCombatTurn('CARL USES AN ITEM', 'wait');
  combatLog(`▶ CARL uses ${name}`, 'l-turn');

  const hpBefore = readStatBar('hp').current;
  useItem(def, slot);

  // useItem may have healed Carl or changed the bag — re-sync the snapshot
  const hp = readStatBar('hp');
  const sp = readStatBar('sp');
  battle.carl.hp = hp.current;
  battle.carl.maxHp = hp.max;
  battle.carl.sp = sp.current;
  battle.carl.maxSp = sp.max;
  const healed = hp.current - hpBefore;
  setCombatCallout(healed > 0 ? `CARL USES ${name.toUpperCase()}  —  +${healed}` : `CARL USES ${name.toUpperCase()}`);
  if (healed > 0) playImpact('carl', healed, 'heal');
  renderBattle();

  await beat(560);
  if (!battle || battle.over) return true;
  mobTurn();
  return true;
}

async function mobTurn() {
  if (!battle || battle.over) return;
  battle.phase = 'mob';
  setCombatTurn(`${battle.mob.name.toUpperCase()} ACTS`, 'enemy');
  combatLog(`◀ ${battle.mob.name.toUpperCase()} strikes back`, 'l-turn');
  const braced = battle.carlDefending;
  const r = resolveAttack(battle.mob, battle.carl, braced);
  await playDie(r.roll, r.verdict);
  if (!battle) return;

  if (r.hit) {
    const before = battle.carl.hp;
    battle.carl.hp -= r.dmg;
    combatLog(`  Carl: ${Math.max(0, before)} → ${Math.max(0, battle.carl.hp)} HP`);
    playImpact('carl', r.dmg, r.crit ? 'crit' : 'hit');
    setCombatCallout(`${battle.mob.name.toUpperCase()} ${r.crit ? 'CRITS' : 'HITS'}  —  ${r.dmg}`);
    if (r.crit || r.dmg >= Math.ceil(battle.carl.maxHp * 0.15)) bark('mobHitBig');
  } else {
    playImpact('carl', 0, 'miss');
    setCombatCallout(`${battle.mob.name.toUpperCase()} ${r.verdict === 'FUMBLE' ? 'FUMBLES' : 'MISSES'}`);
    if (braced) {
      // whiffed into Carl's guard — he gets a coiled counter next turn
      battle.riposte = true;
      combatLog('  Carl rides the miss — his next strike bites deeper.  (+50% damage)', 'l-hit');
      bark('riposteSet');
    }
  }
  battle.carlDefending = false;
  setStatBar('hp', Math.max(0, battle.carl.hp), battle.carl.maxHp);
  renderBattle();
  await beat(560);
  if (!battle) return;

  if (battle.carl.hp <= 0) { endFight('lose'); return; }
  if (!battle.lowHpBarked && battle.carl.hp / battle.carl.maxHp <= 0.25) {
    battle.lowHpBarked = true;
    bark('lowHp');
  }
  battle.round += 1;
  carlTurnUI();
}

function endFight(outcome) {
  battle.over = true;
  battle.phase = 'over';
  setCombatButtons('continue');

  if (outcome === 'win') {
    setCombatTurn('VICTORY', 'win');
    setCombatCallout(`${battle.mob.name.toUpperCase()} DOWN`);
    if (combatMobPortraitEl) combatMobPortraitEl.classList.add('down');
    bark('win');
    const gained = Math.round((battle.mobDef.xp || 0) * (1 + (battle.carl.luck || 0) / 100));
    setStatBar('hp', Math.max(0, battle.carl.hp), battle.carl.maxHp);
    markMobKilled(battle.cx, battle.cy);
    combatResultEl.textContent = 'VICTORY';
    combatResultEl.className = 'combat-result win';
    combatResultEl.hidden = false;
    appendSystemLog(`Carl kills the ${battle.mob.name}. +${gained} XP.`);
    awardLootBox();

    // XP last, so any level-up (full HP/SP, stat points, gold, Loot Box)
    // lands after the kill's own Loot Box and on top of Carl's final HP
    const levelsGained = gainXp(gained);
    combatLog(`✦ ${battle.mob.name} is dead. Carl gains ${gained} XP.`, 'l-turn');
    if (levelsGained > 0) {
      combatLog(
        `✦ LEVEL UP! Carl reaches Level ${carlLevel}. HP & SP restored, +${LEVEL_STAT_POINTS * levelsGained} stat points, Loot Box awarded.`,
        'l-hit',
      );
    }
  } else {
    setCombatTurn('DEFEATED', 'lose');
    setCombatCallout('CARL IS DOWN');
    if (combatCarlPortraitEl) combatCarlPortraitEl.classList.add('down');
    bark('lose');
    setStatBar('hp', 0, battle.carl.maxHp);
    combatLog('✖ Carl goes down, and does not get back up.', 'l-turn');
    combatResultEl.textContent = 'YOU DIED';
    combatResultEl.className = 'combat-result lose';
    combatResultEl.hidden = false;
    appendSystemLog(`The ${battle.mob.name} kills Carl. The crawl is over.`, 'danger');
  }
}

function battleContinue() {
  const wasLoss = combatResultEl.classList.contains('lose');
  closeBattle();
  if (wasLoss) {
    showDeathScreen(); // game over — the save on disk is untouched
  } else {
    updateEncounter(); // Carl now stands on a dead-mob tile
  }
}

// every kill drops a Loot Box straight into the bag (opening comes
// later). If the inventory is full it's gone for good.
function awardLootBox() {
  const box = itemCatalog && itemCatalog['loot-box'];
  if (!box) return;
  if (addToInventory(box)) {
    combatLog('  + Loot Box  →  inventory', 'l-hit');
    appendSystemLog('A loot box drops. Carl crams it into the bag.');
  } else {
    combatLog('  Loot box left behind — the bag is full.', 'l-miss');
    appendSystemLog('Inventory full — the loot box is lost for good.', 'danger');
  }
}

// mark the mob at (x,y) beaten: swap its map marker to an X, and it
// will never trigger an encounter or a fight again.
function markMobKilled(x, y) {
  const key = `${x},${y}`;
  killedMobs.add(key);
  discoveredMobs.add(key);
  const cell = cellElAt(x, y);
  const marker = cell && cell.querySelector('.map-mob');
  if (marker) {
    marker.className = 'map-mob is-dead';
    marker.hidden = false;
  }
}

// Fight action (F key / hotbar slot): only meaningful while Carl shares
// a tile with a live mob.
function activateFightAction() {
  if (battle) return; // a fight is already open
  if (!currentLevelMap || !carlPos) return;
  const mob = mobDefAt(carlPos.x, carlPos.y);
  if (!mob) {
    appendSystemLog('Nothing here to fight.');
    return;
  }
  openBattle(mob);
}

if (combatButtonsEl) {
  combatButtonsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-act]');
    if (!btn || btn.disabled || !battle) return;
    const act = btn.dataset.act;
    if (act === 'attack') carlAct('attack');
    else if (act === 'defend') carlAct('defend');
    else if (act === 'continue' && battle.over) battleContinue();
  });
}

// Combat keyboard shortcuts (only while a fight holds the map panel):
//   Carl's turn     — F fight (attack), D defend, U use the selected item
//   after the fight — F / Enter / Esc continue
// Mid-resolve and the mob's turn ignore all keys (you're committed).
document.addEventListener('keydown', (event) => {
  if (!battle) return;
  if (event.repeat) return; // holding a key must not machine-gun turns
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const k = event.key.toLowerCase();

  if (battle.over) {
    if (k === 'f' || event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      battleContinue();
    }
    return;
  }
  if (battle.phase === 'carl') {
    if (k === 'f') { event.preventDefault(); carlAct('attack'); }
    else if (k === 'd') { event.preventDefault(); carlAct('defend'); }
    else if (k === 'u') { event.preventDefault(); carlUseItemInBattle(); }
  }
});

const hotbarFightBtn = document.getElementById('hotbar-fight');
if (hotbarFightBtn) {
  hotbarFightBtn.addEventListener('click', activateFightAction);
  hotbarFightBtn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateFightAction();
    }
  });
}

// =======================================================
// Use action (U key / hotbar slot) — activates the selected inventory
// item. Each item's effect is dispatched by id in ITEM_USE_HANDLERS;
// anything without a handler gets a placeholder.
// =======================================================

function addGold(amount) {
  const el = document.getElementById('gold-value');
  if (!el) return;
  el.textContent = String((Number(el.textContent) || 0) + amount);
}

const ITEM_USE_HANDLERS = {
  // Loot Box — open it. Always some gold (2d20+10, scaled by LUCK), plus
  // a ~35% + LUCK% chance at one random item. Consumed on open. Rarity
  // and floor-scaling come later.
  'loot-box'(def, slot) {
    const luck = Number(hudStatValues.luck.textContent) || 10;

    const gold = Math.round((rollDie(20) + rollDie(20) + 10) * (1 + luck / 100));
    addGold(gold);

    const itemChance = Math.max(0, Math.min(1, 0.35 + luck / 100));
    let rolled = null;
    if (Math.random() < itemChance && itemCatalog) {
      const pool = Object.values(itemCatalog)
        .filter((it) => it.id !== 'loot-box' && it.lootable !== false);
      if (pool.length) rolled = pool[Math.floor(Math.random() * pool.length)];
    }

    removeInvSlot(slot); // consume the box (frees its slot for the item)

    if (rolled) {
      const an = /^[aeiou]/i.test(rolled.name || '') ? 'an' : 'a';
      const got = addToInventory(rolled);
      appendSystemLog(got
        ? `Carl cracks the loot box: ${gold} gold and ${an} ${rolled.name}.`
        : `Carl cracks the loot box: ${gold} gold. ${an === 'an' ? 'An' : 'A'} ${rolled.name} was in there too, but the bag's full — lost.`,
        'loot');
    } else {
      appendSystemLog(`Carl cracks the loot box open: ${gold} gold. Nothing else this time.`, 'loot');
    }
  },

  // Torch — toggle on/off. On = fog-of-war radius 2, off = 1. Reusable.
  torch(def, slot) {
    const nowOn = slot.dataset.active !== '1';
    if (nowOn) slot.dataset.active = '1';
    else delete slot.dataset.active;
    slot.classList.toggle('active-item', nowOn);
    slot.title = invTooltip(def, nowOn);
    applyFog(); // radius changed — repaint what Carl can see
    appendSystemLog(nowOn
      ? 'Carl lights the torch. The dark gives up a tile.'
      : 'Carl snuffs the torch. The walls close back in.');
  },

  // Small Health Potion — heal a % of Max HP, then it's gone. Used at
  // full HP it's just wasted (the player's call).
  'small-health-potion': function useHealthPotion(def, slot) {
    const pct = (def.effect && def.effect.healPct) || 0;
    const hp = readStatBar('hp');
    const heal = Math.round((hp.max * pct) / 100);
    const before = hp.current;
    const after = Math.min(hp.max, hp.current + heal);
    setStatBar('hp', after, hp.max);
    appendSystemLog(after > before
      ? `Carl downs the ${def.name}. +${after - before} HP.`
      : `Carl downs the ${def.name} at full health. Wasted.`);
    removeInvSlot(slot); // consumable
  },
};

function useItem(def, slot) {
  const id = def && def.id;
  const handler = id ? ITEM_USE_HANDLERS[id] : null;
  if (handler) {
    handler(def, slot);
    return;
  }
  const name = (def && def.name) || (slot && slot.dataset.itemName) || 'that';
  appendSystemLog(`Nothing happens — Carl can't work out what to do with the ${name} yet.`);
}

function activateUseAction() {
  if (battle) { carlUseItemInBattle(); return; } // in combat, Use spends the turn
  if (inSafeRoom && safeRoomUse()) return; // U on a safe-room feature tile
  if (!selectedInvSlot || !selectedInvSlot.dataset.filled) {
    appendSystemLog('Select an item first, then Use.');
    return;
  }
  const id = selectedInvSlot.dataset.itemId;
  const def = (itemCatalog && id) ? itemCatalog[id] : null;
  useItem(def, selectedInvSlot);
}

const hotbarUseBtn = document.getElementById('hotbar-use');
if (hotbarUseBtn) {
  hotbarUseBtn.addEventListener('click', activateUseAction);
  hotbarUseBtn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activateUseAction();
    }
  });
}

// =======================================================
// Safe Room — its own small map, rendered in the map panel in place of
// the dungeon. Fully lit, no mobs, doors pre-opened. Six rooms hang off
// a central hall, each with one feature tile Carl activates with U:
//   1 Shop (Bautista)   2 Spell Master (Tiatha)   3 Guild Master (Hekla)
//   4 Princess Donut    5 Mordecai → Guide Book   6 Bunk (paid rest)
//   7 Footlocker (stash)  9 Chris the Bopca (keeper)  X Exit → dungeon
// Entered with O on the dungeon's Safe Room (S) tile; left via the X
// tile, which drops Carl back on that same S tile.
// =======================================================

const REST_COST_PER_FLOOR = 60; // "Premium Rest Services" — full HP/SP for gold
const STASH_SLOTS = 16;

let inSafeRoom = false;
let safeRoomReturn = null; // { level, restore, dungeonMap, donutFavorUsed } — how to rebuild the dungeon on exit
let safeRoomMapCache = null;
let stashItems = []; // footlocker contents, persisted in the save
let safeRoomGreeted = new Set(); // NPC tiles that have spoken on step-on this visit

const safeRoomHintEl = document.getElementById('saferoom-hint');

const SAFE_TILE_CLASS = {
  '#': 't-wall', '.': 't-floor', '+': 't-door t-door-open',
  E: 't-entrance', X: 't-sr-exit',
  1: 't-sr-npc t-sr-shop', 2: 't-sr-npc t-sr-spell', 3: 't-sr-npc t-sr-guild',
  4: 't-sr-npc t-sr-donut', 5: 't-sr-npc t-sr-mordecai',
  6: 't-sr-rest', 7: 't-sr-stash', 9: 't-sr-npc t-sr-keeper',
};
const SAFE_FEATURES = {
  1: { label: "Shop — Bautista's counter" },
  2: { label: 'Spell Master — Mistress Tiatha' },
  3: { label: 'Guild Master — Hekla' },
  4: { label: "Princess Donut's Green Room" },
  5: { label: 'Mordecai — press U for the Guide Book' },
  6: { label: "Carl's bunk — press U to rest" },
  7: { label: "Carl's footlocker — press U for the stash" },
  9: { label: 'Chris the Bopca, keeper of this room' },
  X: { label: 'Exit — press O to head back into the dungeon' },
};
const SAFE_ROOM_LEGEND = [
  { cls: 't-carl', label: 'Carl' },
  { cls: 't-entrance', label: 'Entrance' },
  { cls: 't-sr-exit', label: 'Exit' },
  { cls: 't-sr-shop', label: 'Shop' },
  { cls: 't-sr-spell', label: 'Spell Master' },
  { cls: 't-sr-guild', label: 'Guild Master' },
  { cls: 't-sr-donut', label: 'Princess Donut' },
  { cls: 't-sr-mordecai', label: 'Mordecai' },
  { cls: 't-sr-rest', label: 'Bunk' },
  { cls: 't-sr-stash', label: 'Footlocker' },
  { cls: 't-sr-keeper', label: 'Keeper' },
  { cls: 't-wall', label: 'Wall' },
];
// Encounters-panel card for the safe-room tile Carl is standing on
const SAFE_ENCOUNTERS = {
  '.': { name: 'Safe-Room Passage', badge: 'sanctuary', image: 'assets/cards/empty-passage-saferoom.png', icon: '·' },
  '+': { name: 'Open Doorway', badge: 'threshold', image: 'assets/cards/open-doorway-safe-room.png', icon: '🚪' },
  E: { name: 'Safe-Room Entrance', badge: 'sanctuary', image: 'assets/cards/safe-room-entrance.png', icon: '🚪' },
  X: { name: 'The Way Back Down', badge: 'threshold', image: 'assets/cards/safe-room-exit.png', icon: '🚪' },
  1: { name: 'Bautista', badge: 'shopkeeper', image: 'assets/cards/shop-keeper.png', icon: '🛒' },
  2: { name: 'Mistress Tiatha', badge: 'spell master', image: 'assets/cards/spell-master.png', icon: '✨' },
  3: { name: 'Hekla', badge: 'guild master', image: 'assets/cards/guild-master.png', icon: '⚔' },
  4: { name: 'Princess Donut', badge: "crawler's cat", image: 'assets/cards/princess-donut.png', icon: '👑' },
  5: { name: 'Mordecai', badge: 'system guide', image: 'assets/cards/system-guide.png', icon: '📖' },
  6: { name: "Carl's Bunk", badge: 'comfort', image: 'assets/cards/bunk.png', icon: '🛏' },
  7: { name: "Carl's Footlocker", badge: 'storage', image: 'assets/cards/footlocker.png', icon: '🧰' },
  9: { name: 'Chris the Bopca', badge: 'keeper', image: 'assets/cards/bopca-keeper.png', icon: '🗝' },
};
function safeRoomEncounterForCarl() {
  if (!carlPos) return null;
  const ch = mapTileAt(carlPos.x, carlPos.y);
  return SAFE_ENCOUNTERS[ch] || SAFE_ENCOUNTERS['.'];
}

async function loadSafeRoomMap() {
  if (safeRoomMapCache) return safeRoomMapCache;
  try {
    const res = await fetch('data/saferoom.json');
    if (!res.ok) throw new Error('no saferoom map');
    safeRoomMapCache = await res.json();
  } catch (err) {
    safeRoomMapCache = null;
  }
  return safeRoomMapCache;
}

async function enterSafeRoom() {
  if (inSafeRoom || battle || !currentLevelMap || !carlPos) return;
  const map = await loadSafeRoomMap();
  if (!map) { appendSystemLog('The safe-room door will not open. Odd.', 'danger'); return; }
  safeRoomReturn = {
    level: currentLevelMap.level,
    restore: buildMapState(),   // captured BEFORE inSafeRoom flips
    dungeonMap: currentLevelMap,
    donutFavorUsed: false,
  };
  inSafeRoom = true;
  safeRoomGreeted = new Set();
  deselectInvItem(); // let the room's cards show in the ENCOUNTERS panel
  renderSafeRoom(map);
  appendSystemLog('Carl steps into the safe room. The dungeon shuts its teeth behind him.');
}

async function exitSafeRoom() {
  if (!inSafeRoom || !safeRoomReturn) return;
  const ret = safeRoomReturn;
  inSafeRoom = false;
  safeRoomReturn = null;
  if (safeRoomHintEl) safeRoomHintEl.hidden = true;
  currentLevelMap = null; // force ensureLevelMap to re-render the dungeon
  appendSystemLog('Carl heads back out into the dungeon.');
  await ensureLevelMap(ret.level, ret.restore);
}

function renderSafeRoom(map) {
  currentLevelMap = map;
  const { cols, rows } = map.grid;
  openedDoors = new Set();
  carlPos = { x: map.start.x, y: map.start.y };
  exploredCells = new Set();
  mobByCell = new Map();
  discoveredMobs = new Set();
  killedMobs = new Set();

  const grid = document.createElement('div');
  grid.className = 'map-grid saferoom-grid';
  grid.style.setProperty('--map-cols', cols);
  grid.style.setProperty('--map-rows', rows);
  grid.style.setProperty('--map-aspect', (cols / rows).toFixed(4));
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  cellEls = new Array(cols * rows);
  const frag = document.createDocumentFragment();
  map.tiles.forEach((line, y) => {
    const padded = line.padEnd(cols, ' ');
    for (let x = 0; x < cols; x += 1) {
      const ch = padded[x];
      const cell = document.createElement('div');
      cell.className = `map-cell ${SAFE_TILE_CLASS[ch] || 't-void'}`;
      if (ch === '+') openedDoors.add(`${x},${y}`);
      const feat = SAFE_FEATURES[ch];
      if (feat) {
        cell.title = feat.label;
        const marker = document.createElement('span');
        marker.className = 'sr-marker';
        cell.appendChild(marker);
      }
      cellEls[y * cols + x] = cell;
      frag.appendChild(cell);
    }
  });
  grid.appendChild(frag);

  carlEl = document.createElement('div');
  carlEl.className = 'map-carl';
  carlEl.title = 'Carl';

  mapTitleEl.textContent = `${(map.subtitle || 'SANCTUARY').toUpperCase()} — ${String(map.name).toUpperCase()}`;
  mapLegendEl.innerHTML = SAFE_ROOM_LEGEND
    .map(({ cls, label }) => `<span><i class="map-cell ${cls}"></i>${label}</span>`)
    .join('');

  mapViewport.innerHTML = '';
  mapViewport.appendChild(grid);
  placeCarl();
  updateSafeRoomHint();
  updateEncounter();
}

function updateSafeRoomHint() {
  if (!safeRoomHintEl) return;
  const ch = mapTileAt(carlPos.x, carlPos.y);
  const feat = SAFE_FEATURES[ch];
  safeRoomHintEl.hidden = !feat;
  if (feat) safeRoomHintEl.textContent = `▸ ${feat.label}`;
}

function trySafeRoomMove(dx, dy) {
  if (!currentLevelMap || !carlPos) return;
  const nx = carlPos.x + dx;
  const ny = carlPos.y + dy;
  if (!isWalkable(nx, ny)) return;
  carlPos = { x: nx, y: ny };
  placeCarl();
  updateSafeRoomHint();
  updateEncounter();
  // NPCs greet Carl the first time he steps onto their tile each visit
  const ch = mapTileAt(nx, ny);
  if ((ch === '4' || SAFE_NPC_LINES[ch]) && !safeRoomGreeted.has(ch)) {
    safeRoomGreeted.add(ch);
    safeRoomNpcSpeak(ch);
  }
}

// an NPC speaks a line into the CHAT panel (see also safeRoomUse for U).
function safeRoomNpcSpeak(ch) {
  if (ch === '4') { donutGreenRoom(); return; }
  const npc = SAFE_NPC_LINES[ch];
  if (!npc) return;
  appendChatLine(npc.lines[Math.floor(Math.random() * npc.lines.length)], npc.chat);
}

// spoken lines for the not-yet-open NPCs — these go to the CHAT panel,
// each in the NPC's own colour (see .chat-<name> in style.css)
const SAFE_NPC_LINES = {
  1: {
    chat: 'bautista',
    lines: [
      "Shop's not stocked yet, pal. Come back down the line.",
      'I sell things. Currently: nothing. Enthralling, I know.',
      "No credit, no browsing, no shop. Not yet, anyway.",
    ],
  },
  5: {
    chat: 'mordecai',
    lines: [
      "You again. Press U and I'll walk you through whatever you've forgotten.",
      "Guide Book's open whenever you are — press U. Try to retain it this time.",
      "Everything you need to survive is one button away. It's U. It's always U.",
    ],
  },
  2: {
    chat: 'tiatha',
    lines: [
      'The spell trade is not open. Do not make me repeat myself.',
      'You are not ready for what I would sell you. Neither is my inventory.',
      "Come back when the words on these pages won't kill you.",
    ],
  },
  3: {
    chat: 'hekla',
    lines: [
      'Nothing to train yet. Come back when I can make you hurt properly.',
      'Bring me your stat points and your soft little bones. Later.',
      "You want stronger? So do I. The System hasn't signed the paperwork.",
    ],
  },
  9: {
    chat: 'chris',
    lines: [
      "Rest, restock, whatever. Just don't track dungeon in on my floor.",
      "This is a safe room. Keep it that way and we'll get along.",
      "Bunk's there, locker's there, stairs down are there. Don't dawdle.",
    ],
  },
};

// U while standing on a feature tile. Returns true if it handled the
// press (so activateUseAction knows not to also fire a normal item Use).
// NPCs greet Carl automatically when he steps onto their tile (see
// trySafeRoomMove); pressing U on them just makes them talk again.
function safeRoomUse() {
  const ch = mapTileAt(carlPos.x, carlPos.y);
  switch (ch) {
    case 'X': appendSystemLog('The way out is a door — press O.'); return true;
    case '5': openGuide(); return true;
    case '6': restAtBunk(); return true;
    case '7': openStash(); return true;
    case '1': case '2': case '3': case '4': case '9':
      safeRoomNpcSpeak(ch);
      return true;
    default:
      return false;
  }
}

function restAtBunk() {
  const hp = readStatBar('hp');
  const sp = readStatBar('sp');
  if (hp.current >= hp.max && sp.current >= sp.max) {
    appendSystemLog('Carl is already fully rested. He eyes the bunk and keeps moving.');
    return;
  }
  const floor = (safeRoomReturn && safeRoomReturn.level) || 1;
  const cost = REST_COST_PER_FLOOR * floor;
  const goldEl = document.getElementById('gold-value');
  const gold = Number(goldEl && goldEl.textContent) || 0;
  if (gold < cost) {
    appendSystemLog(`The System bills ${cost} gold for "Premium Rest Services." Carl has ${gold} — he sleeps on the floor instead. No effect.`, 'danger');
    return;
  }
  goldEl.textContent = String(gold - cost);
  setStatBar('hp', hp.max, hp.max);
  setStatBar('sp', sp.max, sp.max);
  appendSystemLog(`The System charges ${cost} gold for the bunk. Carl sleeps like the dead — HP and SP fully restored.`, 'loot');
}

function donutGreenRoom() {
  const greet = [
    '"Oh good, you found it. Sit. Not on the cushions."',
    '"The camera adds ten pounds, Carl, and you cannot afford it."',
    '"I have a fitting in twenty minutes. Make this quick."',
  ];
  appendChatLine(greet[Math.floor(Math.random() * greet.length)], 'donut');
  if (safeRoomReturn && !safeRoomReturn.donutFavorUsed) {
    safeRoomReturn.donutFavorUsed = true;
    const dm = safeRoomReturn.dungeonMap;
    const bossRoomName = (dm && dm.bossRoom && dm.bossRoom.name) || 'the boss room';
    const bossRef = dm && (dm.mobs || []).find((m) => m.boss);
    const bossName = (bossRef && mobCatalog && mobCatalog[bossRef.id] && mobCatalog[bossRef.id].name) || 'a brute';
    appendChatLine(`"Word from my stylist: the thing running this floor is ${bossName}, holed up in ${bossRoomName}. It photographs terribly. Exploit that."`, 'donut');
  } else {
    appendChatLine('"I already told you everything I heard. Go be useful."', 'donut');
  }
}

// --- footlocker stash ---------------------------------------
const stashOverlay = document.getElementById('stash-overlay');
const stashBagGrid = document.getElementById('stash-bag-grid');
const stashBoxGrid = document.getElementById('stash-box-grid');
const stashCloseBtn = document.getElementById('stash-close-btn');

function renderItemGrid(gridEl, items, which, slots) {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  for (let i = 0; i < slots; i += 1) {
    const it = items[i];
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    if (it) {
      slot.dataset.filled = '1';
      slot.dataset.idx = String(i);
      slot.dataset.which = which;
      const def = (itemCatalog && it.id) ? itemCatalog[it.id] : null;
      slot.title = (def && (def.tooltip || def.description)) || it.name || '';
      if (def && def.iconImage) {
        slot.innerHTML = `<img class="inv-slot-img" src="${escapeHtml(def.iconImage)}" alt=""`
          + ` onerror="const p=this.parentElement; this.remove(); p.textContent=${JSON.stringify(it.icon || '')};">`;
      } else {
        slot.textContent = it.icon || '';
      }
    }
    gridEl.appendChild(slot);
  }
}
function renderStashGrids() {
  renderItemGrid(stashBagGrid, readInventory(), 'bag', 8);
  renderItemGrid(stashBoxGrid, stashItems, 'box', STASH_SLOTS);
}
function openStash() {
  if (!stashOverlay) return;
  renderStashGrids();
  stashOverlay.classList.add('active');
}
function closeStash() {
  if (stashOverlay) stashOverlay.classList.remove('active');
}
function stashMove(which, idx) {
  if (which === 'bag') {
    const bag = readInventory();
    const it = bag[idx];
    if (!it) return;
    if (stashItems.length >= STASH_SLOTS) { appendSystemLog('The footlocker is full.'); return; }
    bag.splice(idx, 1);
    stashItems.push(it);
    renderInventory(bag);
  } else {
    const it = stashItems[idx];
    if (!it) return;
    const bag = readInventory();
    if (bag.length >= 8) { appendSystemLog("Carl's bag is full — make room first."); return; }
    stashItems.splice(idx, 1);
    bag.push(it);
    renderInventory(bag);
  }
  renderStashGrids();
}
if (stashOverlay) {
  [stashBagGrid, stashBoxGrid].forEach((gridEl) => {
    if (!gridEl) return;
    gridEl.addEventListener('click', (event) => {
      const slot = event.target.closest('.inv-slot');
      if (!slot || !slot.dataset.filled) return;
      stashMove(slot.dataset.which, Number(slot.dataset.idx));
    });
  });
  if (stashCloseBtn) stashCloseBtn.addEventListener('click', closeStash);
  stashOverlay.addEventListener('click', (event) => {
    if (event.target === stashOverlay) closeStash();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && stashOverlay.classList.contains('active')) closeStash();
  });
}
