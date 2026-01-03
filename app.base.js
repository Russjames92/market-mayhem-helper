/* Market Mayhem Helper
   - Pit board prices
   - Player cash/holdings
   - Market mover: industries + dice => auto price movement
*/

const STORAGE_KEY = "mm_helper_session_v1";
const LEADERBOARD_KEY = "mm_helper_leaderboard_v1";

const CANON_INDUSTRIES = [
  "Consumer","Defense","Energy","Finance",
  "Healthcare","Manufacturing","Technology","Transportation"
];

const BASE_OPENING_BELLS = 4;
const VOL_OPENING_BELLS  = 7;
const VOL_LOT_SIZE = 100;          // match your UI lots
const VOL_SHARES_PER_TICK = 2000;  // every 2,000 shares moves $1 (tune this)
const VOL_MAX_PCT_PER_TRADE = 0.25; // cap impact per trade at 25%

// Crypto slippage (Volatility Mode only) — smaller impact than stock slippage
const CRYPTO_LOT_SIZE = 1000;           // units per lot for execution simulation
const CRYPTO_UNITS_PER_TICK = 20000;    // every N units contributes one "tick" of impact
const CRYPTO_TICK_PCT = 0.002;          // each tick moves price by 0.2%
const CRYPTO_MAX_PCT_PER_TRADE = 0.08;  // cap impact per trade at 8%

function getMaxOpeningBells() {
  return state?.volatilityMode ? VOL_OPENING_BELLS : BASE_OPENING_BELLS;
}

const AVATAR_PRESETS = Array.from({ length: 12 }, (_, i) => {
  const num = String(i + 1).padStart(3, "0");
  return {
    id: `avatar-${num}`,
    src: `./avatars/${num}.png`
  };
});

// Stock definitions (start price, dividend, dice move table)
const BASE_STOCKS = [
  { symbol:"EE",   name:"Evanston Electric",   industries:["Manufacturing","Energy"], start:95,  dividend:5,  moves:{low:12, mid:10, high:8} },
  { symbol:"ABE",  name:"Alberta Energy",      industries:["Energy"], start:125, dividend:10, moves:{low:16, mid:12, high:10} },
  { symbol:"SLR",  name:"Stuart Solar",        industries:["Energy"], start:90,  dividend:6,  moves:{low:12, mid:10, high:8} },
  { symbol:"IRV",  name:"Irving Power",        industries:["Energy"], start:30,  dividend:2,  moves:{low:4,  mid:3,  high:2} },
  { symbol:"SHB",  name:"Shetland Bank",       industries:["Finance"], start:45, dividend:3,  moves:{low:6,  mid:5,  high:4} },
  { symbol:"SHS",  name:"Sherman Steel",       industries:["Manufacturing"], start:35, dividend:2, moves:{low:4, mid:3, high:2} },
  { symbol:"BEV",  name:"Brown Beverage",      industries:["Consumer"], start:50, dividend:3,  moves:{low:6,  mid:5,  high:4} },
  { symbol:"GDN",  name:"Garden Health",       industries:["Consumer","Healthcare"], start:65, dividend:3, moves:{low:6, mid:5, high:4} },
  { symbol:"FP",   name:"Founders Pharma",     industries:["Healthcare"], start:40, dividend:3, moves:{low:6, mid:5, high:4} },
  { symbol:"RUD",  name:"Rudy Insurance",      industries:["Finance"], start:90, dividend:7,  moves:{low:12, mid:10, high:8} },
  { symbol:"MM",   name:"McGinnis Motors",     industries:["Manufacturing"], start:25, dividend:2, moves:{low:4, mid:3, high:2} },
  { symbol:"DA",   name:"Darkside Digital",    industries:["Technology","Consumer"], start:100, dividend:4, moves:{low:12, mid:10, high:8} },
  { symbol:"LA",   name:"Lawnview Tek",        industries:["Technology","Consumer"], start:65, dividend:3, moves:{low:6, mid:5, high:4} },
  { symbol:"ALP",  name:"Alpha Solutions",     industries:["Consumer","Healthcare","Technology"], start:75, dividend:3, moves:{low:6, mid:5, high:4} },
  { symbol:"JUNO", name:"Juno Services",       industries:["Technology","Transportation"], start:45, dividend:2, moves:{low:6, mid:5, high:4} },
  { symbol:"NEW",  name:"Newmoon Aero",        industries:["Manufacturing","Defense"], start:120, dividend:6, moves:{low:16, mid:12, high:10} },
  { symbol:"ARM",  name:"Armada Defense",      industries:["Defense"], start:60, dividend:3,  moves:{low:6, mid:5, high:4} },
  { symbol:"FLY",  name:"Flyer Infinity",      industries:["Transportation","Defense"], start:120, dividend:6, moves:{low:16, mid:12, high:10} },
  { symbol:"BAIR", name:"Bird Air",            industries:["Transportation"], start:35, dividend:2, moves:{low:4, mid:3, high:2} },
  { symbol:"LB",   name:"Liberty Logistix",    industries:["Transportation"], start:90, dividend:5, moves:{low:12, mid:10, high:8} },
];

const VOLATILITY_STOCKS = [
  { symbol:"NOVA",  name:"NovaDyne Systems",        industries:["Technology", "Defense"], start:18, dividend:0.05, moves:{low:10, mid:8, high:6} },
  { symbol:"VOLT",  name:"VoltEdge Energy",        industries:["Energy"], start:22, dividend:0.10, moves:{low:10, mid:8, high:6} },
  { symbol:"CRSH",  name:"CrashLoop Logistics",    industries:["Transportation"], start:16, dividend:0.02, moves:{low:10, mid:8, high:6} },
  { symbol:"PULSE", name:"PulseWave Biotech",      industries:["Healthcare", "Defense", "Technology", "Manufacturing", "Energy"], start:6, dividend:0.01, moves:{low:10, mid:8, high:6} },
  { symbol:"STACK", name:"StackHammer Construction",industries:["Manufacturing"], start:20, dividend:0.10, moves:{low:10, mid:8, high:6} },
  { symbol:"FLUX",  name:"Flux Materials",         industries:["Manufacturing"], start:19, dividend:0.07, moves:{low:10, mid:8, high:6} },
  { symbol:"SPRK",  name:"SparkRoute Media",       industries:["Technology"], start:17, dividend:0.05, moves:{low:10, mid:8, high:6} },
  { symbol:"DRIFT", name:"DriftNet Retail",        industries:["Consumer"], start:21, dividend:0.10, moves:{low:10, mid:8, high:6} },
  { symbol:"FORGE", name:"IronForge Industrial",   industries:["Manufacturing"], start:26, dividend:0.20, moves:{low:10, mid:8, high:6} },
  { symbol:"SKY",   name:"SkyPierce Aerospace",    industries:["Transportation","Technology"], start:28, dividend:0.02, moves:{low:10, mid:8, high:6} }
];



// ---------- Crypto Market (Volatility Mode only) ----------
const CRYPTO_ASSET_CLASS = [
  { symbol:"AUR",   name:"Aurum",          start: 180 },
  { symbol:"NEX",   name:"NexChain",       start: 42 },
  { symbol:"VPR",   name:"ViperX",         start: 9 },
  { symbol:"HEX",   name:"HexaCoin",       start: 65 },
  { symbol:"MTR",   name:"MetroByte",      start: 14 },
  { symbol:"GLD",   name:"GoldWire",       start: 210 },
  { symbol:"SPN",   name:"Spindle",        start: 7 },
  { symbol:"KRB",   name:"KrakenBit",      start: 33 },
  { symbol:"ION",   name:"IonPulse",       start: 58 },
  { symbol:"FROST", name:"FrostLedger",    start: 11 },
  { symbol:"RZR",   name:"RazorNet",       start: 26 },
  { symbol:"PRSM",  name:"Prism",          start: 95 },
  { symbol:"DUST",  name:"DustCoin",       start: 3 },
  { symbol:"ORBIT", name:"Orbit",          start: 120 },
  { symbol:"BOLT",  name:"BoltMint",       start: 17 },
  { symbol:"EMBER", name:"Ember",          start: 22 },
  { symbol:"CROWN", name:"CrownHash",      start: 155 },
  { symbol:"TIDE",  name:"TidePool",       start: 8 },
  { symbol:"QUARK", name:"Quark",          start: 49 },
  { symbol:"VOID",  name:"Void",           start: 27 }
];

function getActiveCryptos(){
  return state?.volatilityMode ? CRYPTO_ASSET_CLASS : [];
}
function getCrypto(sym){
  return CRYPTO_ASSET_CLASS.find(c => c.symbol === sym);
}
const ALL_STOCKS = [...BASE_STOCKS, ...VOLATILITY_STOCKS];

// ---------- State ----------
let state = {
  started: false,
  createdAt: null,
  players: [],
  prices: {},
  dissolved: {},
  monopolyMode: false,
  volatilityMode: false, // ✅ NEW
  // Volatility Mode expansions
  cryptoPrices: {},
  cryptoSeed: 0,
  cryptoLastMove: {},
  housingPrice: 325000,
  housingSeed: 0,
  housingTrend: 0, // -1 / +1 (biased), 0 = unset
  housingLastMovePct: 0,
  log: [],
  openingBells: 0,
};


// ---------- Pit Board View State ----------
let pitFilterIndustry = "ALL"; // "ALL" or industry name
let pitSortMode = "off";       // "off" | "asc" | "desc"
let pitSelected = new Set();   // selected symbols for bulk ops

// ---------- DOM ----------
const elSessionStatus = document.getElementById("sessionStatus");

const elBtnReset = document.getElementById("btnReset");
const elLogTicker = document.getElementById("logTicker");
const elLogTickerText = document.getElementById("logTickerText");

let logTickerQueue = [];
let logTickerRunning = false;
let logTickerTimer = null;

// ---------- Live Session (Firebase) ----------
const elLiveRolePill = document.getElementById("liveRolePill");
const elBtnLiveCreate = document.getElementById("btnLiveCreate");
const elLiveJoinCode = document.getElementById("liveJoinCode");
const elBtnLiveJoin = document.getElementById("btnLiveJoin");
const elLiveShareLink = document.getElementById("liveShareLink");
const elBtnCopyLiveLink = document.getElementById("btnCopyLiveLink");
const elBtnLiveLeave = document.getElementById("btnLiveLeave");
const elLiveHint = document.getElementById("liveHint");

let fb = {
  app: null,
  auth: null,
  db: null,
  ready: false,
  uid: null,
};

let live = {
  enabled: false,
  sid: null,
  isHost: false,
   pendingHost: false,
  expectedHostUid: null,
  unsub: null,
  pushing: false,
  pushTimer: null,
  applyingRemote: false,
};

const elLiveViewersPill = document.getElementById("liveViewersPill");
const elBtnToggleSetup = document.getElementById("btnToggleSetup");
const elSessionSetupBody = document.getElementById("sessionSetupBody");

let presence = {
  timer: null,
  unsub: null,
  lastCount: null
};

const elPlayerCount = document.getElementById("playerCount");
const elStartingCash = document.getElementById("startingCash");
const elPlayerInputs = document.getElementById("playerInputs");
const elBtnStart = document.getElementById("btnStart");

const elIndustryList = document.getElementById("industryList");
const elDiceTotal = document.getElementById("diceTotal");
const elBtnApplyMarketMover = document.getElementById("btnApplyMarketMover");
const elMarketMoverHint = document.getElementById("marketMoverHint");

const elPitTableBody = document.querySelector("#pitTable tbody");
const elPitCards = document.getElementById("pitCards");

const elPlayersArea = document.getElementById("playersArea");
const elPlayerTabs = document.getElementById("playerTabs");

let activePlayerId = null;
function setActivePlayer(id) {
  activePlayerId = id;
}

const elLog = document.getElementById("log");

const elBtnPayDividends = document.getElementById("btnPayDividends");
const elBtnShortMove = document.getElementById("btnShortMove");
const elShortMoveSymbol = document.getElementById("shortMoveSymbol");
const elShortMoveDir = document.getElementById("shortMoveDir");

const elBtnPrintLog = document.getElementById("btnPrintLog");

const elBtnEndSession = document.getElementById("btnEndSession");
const elLeaderboard = document.getElementById("leaderboard");
const elBtnClearLeaderboard = document.getElementById("btnClearLeaderboard");

const elBtnLeaderboardViewSummary = document.getElementById("btnLeaderboardViewSummary");
const elBtnLeaderboardViewGames = document.getElementById("btnLeaderboardViewGames");

// Pit toggle (mobile only)
const pitBoardSection = document.getElementById("pitBoardSection");

// Pit board controls
const elPitIndustryFilter = document.getElementById("pitIndustryFilter");
const elPitSortCur = document.getElementById("pitSortCur");
const elPitCurHeader = document.getElementById("pitCurHeader");
const elPitSelectAll = document.getElementById("pitSelectAll");
const elPitSelectedCount = document.getElementById("pitSelectedCount");
const elPitBulkAmt = document.getElementById("pitBulkAmt");
const elPitBulkMinus = document.getElementById("pitBulkMinus");
const elPitBulkPlus = document.getElementById("pitBulkPlus");
const elPitClearSelected = document.getElementById("pitClearSelected");

// Crypto Market (Volatility Mode)
const elBtnCryptoMarket = document.getElementById("btnCryptoMarket");
const elCryptoModal = document.getElementById("cryptoModal");
const elCryptoTableBody = document.querySelector("#cryptoTable tbody");
const elCryptoCards = document.getElementById("cryptoCards");

// Housing Market (Volatility Mode)
const elBtnHousingMarket = document.getElementById("btnHousingMarket");
const elHousingModal = document.getElementById("housingModal");
const elHousingCurPrice = document.getElementById("housingCurPrice");
const elHousingLastMove = document.getElementById("housingLastMove");
const elHousingPlayer = document.getElementById("housingPlayer");
const elHousingUnits = document.getElementById("housingUnits");
const elHousingPreview = document.getElementById("housingPreview");
const elHousingMinus1 = document.getElementById("housingMinus1");
const elHousingPlus1  = document.getElementById("housingPlus1");
const elHousingMax    = document.getElementById("housingMax");
const elHousingBuy    = document.getElementById("housingBuy");
const elHousingSell   = document.getElementById("housingSell");
const elHousingSellAll= document.getElementById("housingSellAll");


const AVATAR_KEY = "mm_player_avatars_v1";

/** local avatars map: { [playerId]: dataUrl } */
function loadAvatarMap(){
  try { return JSON.parse(localStorage.getItem(AVATAR_KEY) || "{}"); }
  catch { return {}; }
}
function saveAvatarMap(map){
  localStorage.setItem(AVATAR_KEY, JSON.stringify(map || {}));
}
let avatarMap = loadAvatarMap();

function setPlayerAvatarLocal(playerId, dataUrl){
  avatarMap[playerId] = dataUrl;
  saveAvatarMap(avatarMap);
}

function getPlayerAvatarLocal(playerId){
  return avatarMap[playerId] || "";
}

// simple built-in avatar set (SVG data URIs)
function svgAvatar(label, hue){
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 80% 55%)"/>
      <stop offset="1" stop-color="hsl(${(hue+40)%360} 80% 45%)"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <circle cx="64" cy="56" r="26" fill="rgba(0,0,0,.18)"/>
  <rect x="26" y="82" width="76" height="30" rx="15" fill="rgba(0,0,0,.18)"/>
  <text x="64" y="70" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-weight="900" font-size="34" fill="rgba(255,255,255,.92)">${label}</text>
</svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function defaultAvatarForPlayer(p){
  // deterministic-ish default based on id
  const idx = (Number(p.id) || 1) % AVATAR_PRESETS.length;
  return AVATAR_PRESETS[idx].src;
}

function getTakenAvatarIds(exceptPlayerId = null) {
  const taken = new Set();
  for (const pl of (state.players || [])) {
    if (!pl) continue;
    if (exceptPlayerId && pl.id === exceptPlayerId) continue;

    const a = pl.avatarId || pl.avatar || ""; // support either field name
    if (a) taken.add(a);
  }
  return taken;
}

// -----------------------------
// Sound effects
// -----------------------------
const sounds = {
  openingBell: new Audio("./opening-bell.mp3"),
  uiClick: new Audio("./ui-click.mp3"), // 👈 your "chkah" sound
  cash: new Audio("./cash.mp3")         // 👈 ADD THIS (use your real filename)
};


// Ensure it can replay immediately
sounds.openingBell.preload = "auto";
sounds.uiClick.preload = "auto";
sounds.cash.preload = "auto";

sounds.uiClick.volume = 0.35; // subtle, satisfying, not annoying
sounds.cash.volume = 0.45;    // tweak to taste

function playSound(name) {
  if (audioSettings.sfxMuted) return;

  const snd = sounds[name];
  if (!snd) return;

  // Reset so it plays even if triggered twice quickly
  snd.currentTime = 0;

  // Apply global SFX volume (keep per-sound volumes too)
  // If you already set snd.volume elsewhere, this scales it.
  const base = snd._baseVol ?? snd.volume ?? 1;
  snd._baseVol = base; // cache once
  snd.volume = Math.max(0, Math.min(1, base * (audioSettings.sfxVolume / 100)));

  snd.play().catch(err => {
    console.warn("Sound play failed:", err);
  });
}

function playCashSfx() {
  // Host-only during live sessions (so 10 viewers don't play it on their phones)
  if (live?.enabled && !live?.isHost) return;
  playSound("cash");
}

let audioUnlocked = false;
document.addEventListener("click", () => {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // iOS Safari sometimes needs a first user gesture to allow sound
  try {
    sounds.openingBell.volume = sounds.openingBell.volume; // touch it
  } catch {}
}, { once: true });

// -----------------------------
// Fast UI click sound via WebAudio (mobile-friendly)
// -----------------------------
let uiAudioCtx = null;
let uiClickBuffer = null;
let uiAudioUnlocked = false;

async function initUIClickAudio() {
  if (uiClickBuffer) return true;

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;

  if (!uiAudioCtx) uiAudioCtx = new AC();

  // Fetch + decode once
  const resp = await fetch("./ui-click.mp3", { cache: "force-cache" });
  const arr = await resp.arrayBuffer();
  uiClickBuffer = await uiAudioCtx.decodeAudioData(arr);

  return true;
}

function unlockUIClickAudioOnce() {
  if (uiAudioUnlocked) return;
  uiAudioUnlocked = true;

  // Create/resume context and pre-decode the buffer
  initUIClickAudio().then(() => {
    if (!uiAudioCtx) return;
    if (uiAudioCtx.state === "suspended") uiAudioCtx.resume().catch(() => {});
  });
}

// Plays instantly and reliably even when spammed
function playUIClickFast() {
  if (!uiClickBuffer || !uiAudioCtx) return;

  // On some mobiles the context can suspend; resume if needed
  if (uiAudioCtx.state === "suspended") {
    uiAudioCtx.resume().catch(() => {});
  }

  const src = uiAudioCtx.createBufferSource();
  src.buffer = uiClickBuffer;

  const gain = uiAudioCtx.createGain();
  gain.gain.value = 0.35 * (audioSettings.sfxMuted ? 0 : (audioSettings.sfxVolume / 100));

  src.connect(gain);
  gain.connect(uiAudioCtx.destination);
  src.start(0);
}

// -----------------------------
// Background music (loop)
// -----------------------------
let bgm = null;
let bgmWanted = true; // later you can wire this to a toggle/localStorage
let bgmStarted = false;

function initBGM() {
  if (bgm) return;

  bgm = new Audio("./lobby-music.mp3");
  bgm.loop = true;
  bgm.preload = "auto";
  bgm.volume = 0.12; // keep it subtle
}

function startBGM() {
  if (!bgmWanted) return;
  initBGM();

  // If already started, just ensure it's playing
  if (bgmStarted && !bgm.paused) return;

  // Try to play (will fail on iOS until user gesture)
  const p = bgm.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      bgmStarted = true;
    }).catch((err) => {
      // Autoplay blocked — we'll start on first user interaction
      // Keep this quiet to avoid annoying logs
      // console.warn("BGM autoplay blocked:", err);
    });
  } else {
    // Older browsers
    bgmStarted = true;
  }
}

function stopBGM() {
  if (!bgm) return;
  bgm.pause();
}

function setBGMVolume(v) {
  initBGM();
  bgm.volume = Math.max(0, Math.min(1, v));
}

function applyMusicSettings() {
  bgmWanted = !audioSettings.musicMuted;
  initBGM();
  setBGMVolume((audioSettings.musicVolume / 100) * 1.0); // 0..1
  if (bgmWanted) startBGM();
  else stopBGM();
}


// -----------------------------
// Audio settings (persisted)
// -----------------------------
const AUDIO_SETTINGS_KEY = "mm_audio_settings_v1";

const audioSettings = {
  musicMuted: false,
  musicVolume: 12, // 0-100
  sfxMuted: false,
  sfxVolume: 45    // 0-100
};

function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (typeof obj.musicMuted === "boolean") audioSettings.musicMuted = obj.musicMuted;
    if (typeof obj.musicVolume === "number") audioSettings.musicVolume = obj.musicVolume;
    if (typeof obj.sfxMuted === "boolean") audioSettings.sfxMuted = obj.sfxMuted;
    if (typeof obj.sfxVolume === "number") audioSettings.sfxVolume = obj.sfxVolume;
  } catch {}
}

function saveAudioSettings() {
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(audioSettings));
  } catch {}
}

// =====================
// UNDO (host-only)
// =====================
const UNDO_STACK_KEY = "mm_undo_stack_v1";
const UNDO_LIMIT = 30;
let undoStack = [];

function loadUndoStack() {
  try {
    const raw = localStorage.getItem(UNDO_STACK_KEY);
    undoStack = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(undoStack)) undoStack = [];
  } catch {
    undoStack = [];
  }
}

function saveUndoStack() {
  try {
    localStorage.setItem(UNDO_STACK_KEY, JSON.stringify(undoStack.slice(-UNDO_LIMIT)));
  } catch {}
}

function snapshotStateForUndo() {
  // deep clone (state contains plain objects)
  return JSON.parse(JSON.stringify(state));
}

function pushUndo(label) {
  // viewers can never undo
  if (!assertHostAction()) return;

  undoStack.push({
    t: Date.now(),
    label: label || "Action",
    snap: snapshotStateForUndo()
  });

  // cap
  if (undoStack.length > UNDO_LIMIT) undoStack = undoStack.slice(-UNDO_LIMIT);

  saveUndoStack();
  updateUndoButton();
}

function clearUndoStack() {
  undoStack = [];
  saveUndoStack();
  updateUndoButton();
}

function updateUndoButton() {
  const btn = document.getElementById("btnUndo");
  if (!btn) return;

  // only host can use undo
  const canUndo = !!(live?.enabled ? live.isHost : true) && undoStack.length > 0;
  btn.disabled = !canUndo;
}

function undoLastAction() {
  if (!assertHostAction()) return;
  if (!undoStack.length) return;

  const last = undoStack.pop();
  saveUndoStack();

  // restore
  state = last.snap;

  addLog(`↩️ Undo: ${last.label || "Last action"}`);

  renderAll();
  saveState(); // IMPORTANT: pushes to cloud in live mode

  updateUndoButton();
}

// ---------- Helpers ----------

function updateLiveAnnouncement() {
  const bar = document.getElementById("liveAnnouncement");
  if (!bar) return;

  // Show for BOTH host + viewers when connected to a live session
  const show = !!(live.enabled && live.sid);

  bar.hidden = !show;
  document.body.classList.toggle("hasLiveAnnouncement", show);
}

// =========================
// Delayed hover tooltip system
// Usage: add data-tooltip="..." to any element
// =========================
(function initTooltips() {
  const DELAY_MS = 1000;

  let timer = null;
  let tipEl = null;
  let targetEl = null;

  function removeTip() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (targetEl) targetEl.classList.remove("mmTooltipTarget");
    targetEl = null;

    if (tipEl) {
      tipEl.remove();
      tipEl = null;
    }
  }

  function showTip(el) {
    removeTip();

    const text = el.getAttribute("data-tooltip");
    if (!text) return;

    targetEl = el;
    targetEl.classList.add("mmTooltipTarget");

    tipEl = document.createElement("div");
    tipEl.className = "mmTooltip";
    tipEl.textContent = text;
    document.body.appendChild(tipEl);

    const r = el.getBoundingClientRect();

    // anchor above the element, centered
    let x = r.left + r.width / 2;
    let y = r.top;

    // position it
    tipEl.style.left = `${x}px`;
    tipEl.style.top = `${y}px`;

    // keep inside viewport horizontally
    const tr = tipEl.getBoundingClientRect();
    const pad = 8;
    if (tr.left < pad) tipEl.style.left = `${pad + tr.width / 2}px`;
    if (tr.right > window.innerWidth - pad) tipEl.style.left = `${window.innerWidth - pad - tr.width / 2}px`;

    requestAnimationFrame(() => tipEl && tipEl.classList.add("isShown"));
  }

  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tooltip]");
    if (!el) return;

    // if moving within the same element, ignore
    if (el === targetEl) return;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => showTip(el), DELAY_MS);
  });

  document.addEventListener("mouseout", () => {
    removeTip();
  });

  // safety: remove on scroll / resize (prevents “floating wrong place”)
  window.addEventListener("scroll", removeTip, true);
  window.addEventListener("resize", removeTip);
})();


function recomputeBodyModalLock(){
  // Clean up any trade backdrops that are marked open while hidden (prevents stuck scroll lock)
  document.querySelectorAll(".mmModalBack.open").forEach((back) => {
    if (back.hidden) back.classList.remove("open");
  });

  // Any open backdrop-based modal (trade), OR any top-level modal element (setup/crypto/housing)
  // NOTE: We intentionally only check TOP-LEVEL .mmModal elements (direct children of <body>)
  // so the Trade modal's inner .mmModal (nested inside .mmModalBack) does NOT lock scroll forever.
  const anyModalOpen =
    !!document.querySelector(".mmModalBack.open") ||
    !!document.querySelector("body > .mmModal:not([hidden])");

  document.body.classList.toggle("modalOpen", anyModalOpen);
}
function closeModalById(id) {
  const el = document.getElementById(id);
  if (!el) return;

  // If focus is inside this modal, blur it before hiding (prevents focus/scroll issues)
  try { if (el.contains(document.activeElement)) document.activeElement.blur(); } catch(e) {}

  el.hidden = true;
  el.setAttribute("aria-hidden", "true");

  // unlock body scrolling only if NO modals/backdrops are open
  recomputeBodyModalLock();
}

function openModalById(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = false;
  el.setAttribute("aria-hidden", "false");
  recomputeBodyModalLock();
}

function getActiveStocks() {
  return state?.volatilityMode ? ALL_STOCKS : BASE_STOCKS;
}

function getStock(sym) {
  return ALL_STOCKS.find(s => s.symbol === sym);
}
function nowTs() {
  return new Date().toLocaleString();
}
function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtMoney2(n) {
  return Number(n || 0).toFixed(2);
}
function stripHtmlToText(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = String(html || "");
  return (tmp.textContent || tmp.innerText || "").trim();
}

function enqueueLogTicker(messageHtml) {
  if (!elLogTicker || !elLogTickerText) return;

  const txt = stripHtmlToText(messageHtml);
  if (!txt) return;

  // keep it short
  const shortTxt = txt.length > 140 ? (txt.slice(0, 137) + "…") : txt;

  // enqueue
  logTickerQueue.push(shortTxt);

  // start runner if not already running
  if (!logTickerRunning) runLogTickerQueue();
}

function updateVolatilityPill() {
  const pill = document.getElementById("volatilityPill");
  if (!pill) return;

  const show = !!(state && state.started && state.volatilityMode);

  // Use BOTH for maximum browser consistency
  pill.hidden = !show;
  pill.style.display = show ? "inline-block" : "none";
}

function runLogTickerQueue() {
  if (!elLogTicker || !elLogTickerText) return;

  if (!logTickerQueue.length) {
    logTickerRunning = false;
    return;
  }

  logTickerRunning = true;

  const msg = logTickerQueue.shift();
  elLogTickerText.textContent = msg;

  // show
  elLogTicker.classList.add("show");

  // clear previous timer
  if (logTickerTimer) clearTimeout(logTickerTimer);

  // display time + gap time
  const SHOW_MS = 3200;
  const GAP_MS  = 220;

  logTickerTimer = setTimeout(() => {
    // hide
    elLogTicker.classList.remove("show");

    // wait a beat, then show next
    logTickerTimer = setTimeout(() => {
      runLogTickerQueue();
    }, GAP_MS);
  }, SHOW_MS);
}

function addLog(text) {
  // store the log entry
  state.log.unshift({ ts: nowTs(), text });

  // keep log from growing forever
  if (state.log.length > 400) state.log.length = 400;

  // update UI
  renderLog();

  // persist
  saveState?.();

  // live sync (host only)
  if (live?.enabled && live?.isHost) {
    pushStateToCloud?.();
  }

  // ticker should NEVER be allowed to break logging
  try {
    enqueueLogTicker?.(text); // ✅ use the correct variable: text
  } catch (e) {
    // ignore ticker errors
  }
}
function clampPrice(n) {
  return Math.max(0, Math.round(n));
}
function clampCryptoPrice(n){
  // crypto can have cents; keep it readable with 2 decimals and a floor
  const x = Number(n);
  if (!Number.isFinite(x)) return 0.01;
  return Math.max(0.01, Math.round(x * 100) / 100);
}


function clampHousingPrice(n){
  // keep housing prices readable in $1k steps with a reasonable floor
  const x = Number(n);
  if (!Number.isFinite(x)) return 10000;
  return Math.max(10000, Math.round(x / 1000) * 1000);
}
function fmtMoneyK(n){
  const x = Math.round(Number(n) || 0);
  if (x >= 1000000) return (x/1000000).toFixed(2).replace(/\.00$/,"") + "M";
  if (x >= 1000) return Math.round(x/1000) + "k";
  return String(x);
}
// deterministic RNG (for live sessions / viewers)
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function applyCryptoOpeningBellMove() {
  if (!state.volatilityMode) return;
  ensureCryptoPrices();

  if (!state.cryptoLastMove) state.cryptoLastMove = {}; // {SYM: pct}

  // advance seed each bell so the move changes every time
  state.cryptoSeed = (Number(state.cryptoSeed) || 1) + 1;
  const rand = mulberry32(state.cryptoSeed);

  const assets = getActiveCryptos();
  if (!assets.length) return;

  // Each Opening Bell: guarantee ONE "rocket" (+800% to +1000%)
  const rocket = assets[Math.floor(rand() * assets.length)]?.symbol;

  // Optional: pick a separate "crash" candidate that can take a huge hit (down to -96%)
  let crash = assets[Math.floor(rand() * assets.length)]?.symbol;
  if (crash === rocket && assets.length > 1) {
    const i = (assets.findIndex(a => a.symbol === crash) + 1) % assets.length;
    crash = assets[i].symbol;
  }

  const movers = [];

  for (const c of assets) {
    const before = Number(state.cryptoPrices[c.symbol] ?? c.start);

    let pct;

    if (c.symbol === rocket) {
      // +800% to +1000% (multiplier 9x to 11x)
      pct = 8 + (rand() * 2);
    } else {
      // base wild swing: -50% to +70%
      pct = (rand() * 1.20) - 0.50;

      // decent chance of extreme move: -96% to +250%
      if (rand() < 0.18) {
        pct = (rand() * 3.46) - 0.96;
      }

      // make sure at most one "max crash" candidate tends toward big red candles
      // (not guaranteed every bell, but allows deep drawdowns up to -96%)
      if (c.symbol === crash && rand() < 0.45) {
        pct = -0.60 - (rand() * 0.36); // -60% to -96%
      }

      // hard clamp to your requested maximum drawdown
      if (pct < -0.96) pct = -0.96;
    }

    const after = clampCryptoPrice(before * (1 + pct));
    state.cryptoPrices[c.symbol] = after;
    state.cryptoLastMove[c.symbol] = pct;

    movers.push({ sym: c.symbol, before, after, pct });
  }

  // log a short "headline" with biggest movers
  movers.sort((a,b) => Math.abs(b.pct) - Math.abs(a.pct));
  const top = movers.slice(0, 5).map(m =>
    `${m.sym} ${m.pct >= 0 ? "+" : ""}${Math.round(m.pct*100)}% → $${fmtMoney2(m.after)}`
  );

  addLog(`Crypto Opening Bell: market goes berserk.<br><span class="mini muted">${top.join(" • ")}</span>`);
}

function isDissolved(sym) {
  return !!state.dissolved?.[sym];
}

function dissolveCompany(sym, reason = "Price hit $0") {
  if (!state.dissolved) state.dissolved = {};
  if (state.dissolved[sym]) return false; // already dissolved

  // mark dissolved
  state.dissolved[sym] = { ts: nowTs(), reason };

  // force price to 0
  state.prices[sym] = 0;

  // remove from selection set if selected
  pitSelected.delete(sym);

  // wipe all player holdings
  const losers = [];
  for (const p of state.players) {
    ensureHoldings(p);
    const lost = Number(p.holdings?.[sym] || 0);
    if (lost > 0) {
      p.holdings[sym] = 0;
      losers.push(`${p.name} lost ${lost} shares`);
    }
  }

  const stock = getStock(sym);
  addLog(
    `💥 <strong>${sym}</strong> (${stock?.name || "Company"}) dissolved — price hit <strong>$0</strong>.<br>` +
    `<span class="mini muted">${reason}${losers.length ? " • " + losers.join(" • ") : ""}</span>`
  );

  // if host is live, push to viewers
  if (live?.enabled && live?.isHost) pushStateToCloud?.();

   buildShortMoveUI();
  return true;
}


function ensureCryptoPrices(){
  if (!state.cryptoPrices) state.cryptoPrices = {};
  if (!state.cryptoSeed) state.cryptoSeed = 0;

  for (const c of getActiveCryptos()) {
    const v = Number(state.cryptoPrices[c.symbol]);
    if (!Number.isFinite(v)) state.cryptoPrices[c.symbol] = Number(c.start) || 0;
  }
}

function ensureHousingMarket(){
  if (!state.volatilityMode) return;
  if (!Number.isFinite(Number(state.housingPrice))) state.housingPrice = 325000;
  state.housingPrice = clampHousingPrice(state.housingPrice);

  if (!Number.isFinite(Number(state.housingSeed))) state.housingSeed = 0;
  if (!Number.isFinite(Number(state.housingTrend))) state.housingTrend = 0;
  if (!Number.isFinite(Number(state.housingLastMovePct))) state.housingLastMovePct = 0;
}

function housingMoveText(pct){
  if (!Number.isFinite(pct) || pct === 0) return { cls:"flat", txt:"—" };
  const up = pct > 0;
  const arrow = up ? "▲" : "▼";
  const pctTxt = `${up ? "+" : ""}${(pct*100).toFixed(1)}%`;
  return { cls: up ? "up" : "down", txt: `${arrow} ${pctTxt}` };
}

function applyHousingOpeningBellMove(){
  if (!state.volatilityMode) return;
  ensureHousingMarket();

  // advance seed per bell for deterministic live sync
  state.housingSeed = (Number(state.housingSeed) || 1) + 1;
  const rand = mulberry32(state.housingSeed);

  // keep a trend, but allow occasional flips
  if (!state.housingTrend) state.housingTrend = (rand() < 0.5 ? -1 : 1);
  if (rand() < 0.15) state.housingTrend *= -1; // sometimes reverse

  const before = Number(state.housingPrice || 325000);

  // gentler than crypto: typically ~1%–5% plus a touch of noise
  let pct = (0.01 + rand()*0.04) * state.housingTrend;
  pct += (rand()*0.01 - 0.005); // +/- 0.5% noise
  pct = Math.max(-0.08, Math.min(0.08, pct)); // cap at +/-8%

  const after = clampHousingPrice(before * (1 + pct));
  state.housingPrice = after;
  state.housingLastMovePct = pct;

  const mt = housingMoveText(pct);
  addLog(`🏠 Housing Market moved: $${fmtMoney(before)} → $${fmtMoney(after)} (${mt.txt}).`);
}
function ensurePricesForActiveStocks() {
  if (!state.prices) state.prices = {};

  for (const s of getActiveStocks()) {
    // if price missing (or not a number), restore to start price
    const v = Number(state.prices[s.symbol]);
    if (!Number.isFinite(v)) {
      state.prices[s.symbol] = Number(s.start) || 0;
    }
  }

  // also ensure dissolved map exists
  if (!state.dissolved) state.dissolved = {};
}

function diceBand(total) {
  if (total >= 2 && total <= 5) return "low";
  if (total >= 6 && total <= 8) return "mid";
  return "high";
}
function getAllIndustries() {
  const set = new Set();
  for (const s of getActiveStocks()) s.industries.forEach(i => set.add(i));
  return [...set].sort();
}
function ensureHoldings(player) {
  if (!player.holdings) player.holdings = {};
  for (const s of getActiveStocks()) {
    if (player.holdings[s.symbol] == null) player.holdings[s.symbol] = 0;
  }

  // crypto holdings (only relevant in volatility mode)
  if (!player.cryptoHoldings) player.cryptoHoldings = {};
  for (const c of getActiveCryptos()) {
    if (player.cryptoHoldings[c.symbol] == null) player.cryptoHoldings[c.symbol] = 0;
  }

  // housing holdings (volatility mode expansion)
  if (player.housingUnits == null) player.housingUnits = 0;
}
function computePlayerNetWorth(player) {
  let stockValue = 0;
  for (const [sym, shares] of Object.entries(player.holdings || {})) {
    const stock = getStock(sym);
    if (!stock) continue;
    const price = state.prices[sym] ?? stock.start;
    stockValue += (Number(shares) || 0) * price;
  }

  let cryptoValue = 0;
  for (const [sym, units] of Object.entries(player.cryptoHoldings || {})) {
    const c = getCrypto(sym);
    if (!c) continue;
    const price = state.cryptoPrices?.[sym] ?? c.start;
    cryptoValue += (Number(units) || 0) * price;
  }

  let housingValue = 0;
  if (state.volatilityMode) {
    const units = Number(player.housingUnits) || 0;
    const price = Number(state.housingPrice) || 0;
    housingValue = units * price;
  }

  return (player.cash || 0) + stockValue + cryptoValue + housingValue;
}
function computePlayerDividendDue(player) {
  ensureHoldings(player);
  let total = 0;
  const perStock = {};

  for (const s of getActiveStocks()) {
    const shares = player.holdings[s.symbol] || 0;
    const due = shares > 0 ? (shares * s.dividend) : 0;
    if (due > 0) perStock[s.symbol] = due;
    total += due;
  }

  return { total, perStock };
}
function computePlayerIndustries(player) {
  ensureHoldings(player);

  const set = new Set();

  for (const s of getActiveStocks()) {
    const shares = player.holdings[s.symbol] || 0;
    if (shares > 0) {
      s.industries.forEach(ind => set.add(ind));
    }
  }

  return [...set];
}
function clearMarketMoverSelections() {
  // Clear industry checks
  for (const box of elIndustryList.querySelectorAll(".industry-box")) {
    const chk = box.querySelector(".indCheck");
    if (chk) chk.checked = false;
  }

  // Optional (recommended): reset dice dropdown to the placeholder
  // If you want it to KEEP the selected dice value, delete these 2 lines.
  if (elDiceTotal) elDiceTotal.value = "";

  updateMarketMoverButton();
}
// ---- Slippage cost estimator (NO state mutation) ----
// Returns the total execution cost to BUY `shares` at `startPrice` under volatility slippage rules.
function estimateSlippageCost(symbol, shares, startPrice) {
  const stock = getStock(symbol);
  if (!stock) return shares * startPrice;

  let price = Number.isFinite(startPrice) ? startPrice : (state.prices[symbol] ?? stock.start);
  if (!Number.isFinite(price)) price = Number(stock.start) || 0;

  // If not in volatility mode, it's just flat cost
  if (!state.volatilityMode) return shares * price;

  const totalShares = Math.abs(shares);
  if (totalShares <= 0) return 0;

  // How many $1 ticks the order would cause (based on 100-share increments)
  const ticksTotal = Math.floor(totalShares / VOL_SHARES_PER_TICK);
  if (ticksTotal <= 0) return totalShares * price;

  // Cap how much a single order can move the price (keeps things playable)
    const capTicks = Math.max(1, Math.round(price * VOL_MAX_PCT_PER_TRADE));
  const ticksApplied = Math.min(ticksTotal, capTicks);

  // Distribute ticks evenly across lots
  const lots = Math.ceil(totalShares / VOL_LOT_SIZE);
  const ticksPerLot = ticksApplied / lots;

  let remaining = totalShares;
  let execTotal = 0;
  let current = price;

  for (let i = 0; i < lots; i++) {
    const lotShares = Math.min(VOL_LOT_SIZE, remaining);
    remaining -= lotShares;

    execTotal += lotShares * current;

    // BUY-side estimator: price rises through the fill
    current = current + ticksPerLot;
    if (current <= 0) break;
  }

  return execTotal;
}

// ---- Crypto slippage estimators (NO state mutation) ----
function estimateCryptoSlippageCost(symbol, units, startPrice) {
  const c = getCrypto(symbol);
  if (!c) return units * startPrice;

  let price = Number.isFinite(startPrice) ? startPrice : (state.cryptoPrices?.[symbol] ?? c.start);
  if (!Number.isFinite(price)) price = Number(c.start) || 0;

  // Crypto market exists only in Volatility Mode, but keep this safe:
  if (!state.volatilityMode) return units * price;

  const totalUnits = Math.abs(units);
  if (totalUnits <= 0) return 0;

  const ticksTotal = Math.floor(totalUnits / CRYPTO_UNITS_PER_TICK);
  if (ticksTotal <= 0) return totalUnits * price;

  const capTicks = Math.max(1, Math.round(CRYPTO_MAX_PCT_PER_TRADE / CRYPTO_TICK_PCT));
  const ticksApplied = Math.min(ticksTotal, capTicks);

  const lots = Math.ceil(totalUnits / CRYPTO_LOT_SIZE);
  const ticksPerLot = ticksApplied / lots;

  let remaining = totalUnits;
  let execTotal = 0;
  let current = price;

  for (let i = 0; i < lots; i++) {
    const lotUnits = Math.min(CRYPTO_LOT_SIZE, remaining);
    remaining -= lotUnits;

    execTotal += lotUnits * current;

    // buy-side estimator: price rises through the fill
    current = current * (1 + (ticksPerLot * CRYPTO_TICK_PCT));
    current = clampCryptoPrice(current);
    if (current <= 0) break;
  }

  return execTotal;
}

function simulateCryptoSlippage(symbol, signedUnits) {
  const c = getCrypto(symbol);
  if (!c) {
    return { execTotal: 0, avgPrice: 0, finalPrice: 0, ticksApplied: 0 };
  }

  let price = state.cryptoPrices?.[symbol];
  if (!Number.isFinite(price)) price = Number(c.start) || 0;

  // Only apply in Volatility Mode
  if (!state.volatilityMode) {
    return { execTotal: Math.abs(signedUnits) * price, avgPrice: price, finalPrice: price, ticksApplied: 0 };
  }

  const totalUnits = Math.abs(signedUnits);
  if (totalUnits <= 0) {
    return { execTotal: 0, avgPrice: price, finalPrice: price, ticksApplied: 0 };
  }

  const dir = signedUnits >= 0 ? +1 : -1;

  const ticksTotal = Math.floor(totalUnits / CRYPTO_UNITS_PER_TICK);
  if (ticksTotal <= 0) {
    const finalPrice = clampCryptoPrice(price);
    return { execTotal: totalUnits * price, avgPrice: price, finalPrice, ticksApplied: 0 };
  }

  const capTicks = Math.max(1, Math.round(CRYPTO_MAX_PCT_PER_TRADE / CRYPTO_TICK_PCT));
  const ticksApplied = Math.min(ticksTotal, capTicks);

  const lots = Math.ceil(totalUnits / CRYPTO_LOT_SIZE);
  const ticksPerLot = ticksApplied / lots;

  let remaining = totalUnits;
  let execTotal = 0;
  let current = price;

  for (let i = 0; i < lots; i++) {
    const lotUnits = Math.min(CRYPTO_LOT_SIZE, remaining);
    remaining -= lotUnits;

    execTotal += lotUnits * current;

    // Apply impact through fill (smaller than stocks): multiplicative percent ticks
    const pct = dir * (ticksPerLot * CRYPTO_TICK_PCT);
    current = current * (1 + pct);
    current = clampCryptoPrice(current);
    if (current <= 0) break;
  }

  const finalPrice = clampCryptoPrice(current);
  const avgPrice = execTotal / totalUnits;
  return { execTotal, avgPrice, finalPrice, ticksApplied };
}

function computeMaxCryptoUnits(playerId, symbol) {
  const p = state.players.find(x => x.id === playerId);
  const c = getCrypto(symbol);
  if (!p || !c) return 100;

  const startPrice = state.cryptoPrices?.[symbol] ?? c.start;
  const CASH = p.cash || 0;

  const costForUnits = (units) => {
    if (!state.volatilityMode) return units * startPrice;
    return estimateCryptoSlippageCost(symbol, units, startPrice);
  };

  let lo = 0;
  let hi = Math.max(1, Math.floor(CASH / (startPrice * 100))); // in 100-unit blocks

  while (costForUnits(hi * 100) <= CASH) hi *= 2;

  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (costForUnits(mid * 100) <= CASH) lo = mid;
    else hi = mid;
  }

  return Math.max(100, lo * 100);
}


function computeMaxSharesWithSlippage(playerId, symbol) {
  const p = state.players.find(x => x.id === playerId);
  const stock = getStock(symbol);
  if (!p || !stock) return 100;

  const startPrice = state.prices[symbol] ?? stock.start;
  const CASH = p.cash;

  const costForShares = (shares) => {
    if (!state.volatilityMode) return shares * startPrice;
    return estimateSlippageCost(symbol, shares, startPrice);
  };

  let lo = 0;
  let hi = Math.max(1, Math.floor(CASH / (startPrice * 100)));

  while (costForShares(hi * 100) <= CASH) hi *= 2;

  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (costForShares(mid * 100) <= CASH) lo = mid;
    else hi = mid;
  }

  return Math.max(100, lo * 100);
}

function openPriceEditor(symbol) {
   if (!assertHostAction()) return;
   if (!state.started) {
    alert("Start a session first to manually set prices.");
    return;
  }

  const stock = getStock(symbol);
  if (!stock) return;

  tradeModalState.market = "stock";

  const before = state.prices[symbol] ?? stock.start;

  const raw = prompt(
    `${symbol} — ${stock.name}\nCurrent: $${fmtMoney(before)}\n\nEnter NEW price:`,
    String(before)
  );
  if (raw == null) return;

  const next = Number(String(raw).trim());
  if (!Number.isFinite(next) || next < 0) {
    alert("Enter a valid price (0 or higher).");
    return;
  }

  const after = clampPrice(next);
  state.prices[symbol] = after;

  addLog(`Manual Price Set: ${symbol} $${fmtMoney(before)} → $${fmtMoney(after)}`);
  renderAll();
  saveState();
}

function renderOpeningBellCounter() {
  if (!elBtnPayDividends) return;

  const n = Number(state.openingBells || 0);
  const label = `Pay Dividends (Opening Bell) — ${n}/${getMaxOpeningBells()}`;
  elBtnPayDividends.textContent = label;
}

function wireVolatilityModeEnhancers() {
  const elVol  = document.getElementById("volatilityMode");
  const elMono = document.getElementById("monopolyMode");
  const elCash = document.getElementById("startingCash");
  if (!elVol || !elCash) return;

  const enforceExclusive = (changed) => {
    if (state.started) return;

    // Volatility and Monopoly modes cannot both be enabled.
    if (changed === "vol" && elVol.checked && elMono) elMono.checked = false;
    if (changed === "mono" && elMono?.checked) elVol.checked = false;

    // Apply quick defaults for volatility mode
    if (elVol.checked) {
      elCash.value = "1000000";
    } else if (!elMono?.checked) {
      // Only revert to base default when neither special mode is on
      if (!elCash.value || Number(elCash.value) === 1000000) elCash.value = "50000";
    }

    // Monopoly mode changes the player input layout (adds cash boxes)
    buildSetupInputs();
    renderOpeningBellCounter?.();
  };

  elVol.addEventListener("change", () => enforceExclusive("vol"));
  elMono?.addEventListener("change", () => enforceExclusive("mono"));

  // init once
  enforceExclusive(elVol.checked ? "vol" : (elMono?.checked ? "mono" : "vol"));
}



let leaderboard = []; // [{ ts, placements:[{place,name,assets}], winner }]
let leaderboardView = "summary"; // "summary" | "games"

function saveLeaderboard() {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
}

function loadLeaderboard() {
  const raw = localStorage.getItem(LEADERBOARD_KEY);
  if (!raw) return;
  try { leaderboard = JSON.parse(raw) || []; } catch { leaderboard = []; }
}

function rankLabel(idx){
  if (idx === 0) return "🥇";
  if (idx === 1) return "🥈";
  if (idx === 2) return "🥉";
  return `#${idx + 1}`;
}

function renderLeaderboard() {
  if (!elLeaderboard) return;

  // ✅ Source of truth:
  // - Live viewer: show shared leaderboard from the live room
  // - Host / offline: show local leaderboard (device)
  const list = (live?.enabled && !live?.isHost && Array.isArray(live.leaderboard))
    ? live.leaderboard
    : leaderboard;

  if (!list.length) {
    elLeaderboard.innerHTML = `<div class="muted">No completed games yet.</div>`;
    return;
  }

  // Toggle button styles
  if (elBtnLeaderboardViewSummary && elBtnLeaderboardViewGames) {
    elBtnLeaderboardViewSummary.classList.toggle("primary", leaderboardView === "summary");
    elBtnLeaderboardViewGames.classList.toggle("primary", leaderboardView === "games");
  }

  const canDelete = !(live?.enabled && !live?.isHost); // viewers can't delete shared leaderboard entries

  // -------------------------
  // RECENT GAMES VIEW
  // -------------------------
  if (leaderboardView === "games") {
    elLeaderboard.innerHTML = list
      .slice()
      .reverse()
      .map(game => {
        const rows = (game.placements || [])
          .map(p => `<div class="mini"><strong>#${p.place}</strong> ${p.name} — <strong>$${fmtMoney(p.assets)}</strong></div>`)
          .join("");

        return `
          <div style="position:relative; padding:10px; border:1px solid var(--border2); border-radius:12px; background:var(--panel2); margin-bottom:10px;">
            ${
              canDelete
                ? `
                  <button
                    type="button"
                    class="lbDel"
                    data-lb-del="${game.id}"
                    title="Delete this game"
                    style="
                      position:absolute;
                      top:10px;
                      right:10px;
                      width:34px;
                      height:34px;
                      border-radius:10px;
                      border:1px solid var(--border2);
                      background:rgba(0,0,0,.25);
                      color:var(--text);
                      font-weight:900;
                      cursor:pointer;
                      line-height:1;
                    "
                  >✕</button>
                `
                : ``
            }

            <div class="mini muted">${game.ts}</div>
            <div style="margin-top:6px; font-size:13px; font-weight:900;">
              Winner: ${game.winner}
            </div>
            <div style="margin-top:8px;">${rows}</div>
          </div>
        `;
      })
      .join("");

    return; // IMPORTANT: stop here so summary doesn't run
  }

  // -------------------------
  // SUMMARY VIEW (ALL-TIME)
  // -------------------------
  // build stats from whichever list we're rendering
  const { totalGames, rows } = buildLeaderboardStatsFrom(list);
  const isMobileLb = window.matchMedia("(max-width: 700px)").matches;

  if (isMobileLb) {
    elLeaderboard.innerHTML = `
      <div class="mini muted" style="margin-bottom:10px;">
        Total completed games: <strong>${totalGames}</strong>
      </div>

      <div style="display:grid; gap:10px;">
        ${rows.map((r, idx) => `
          <div style="padding:10px; border:1px solid var(--border2); border-radius:12px; background:var(--panel2);">
            <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
              <div style="font-weight:900; font-size:14px;">
                <span style="margin-right:8px;">${rankLabel(idx)}</span>${r.name}
              </div>
              <div style="font-weight:900; font-size:14px; white-space:nowrap;">
                ${r.wins}W
              </div>
            </div>

            <div class="mini muted" style="margin-top:6px; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
              <span>Games: <strong>${r.games}</strong></span>
              <span>Total Assets: <strong>$${fmtMoney(r.totalAssets)}</strong></span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    return;
  }

  const tableRows = rows
    .map((r, idx) => `
      <tr>
        <td><strong>${rankLabel(idx)}</strong></td>
        <td><strong>${r.name}</strong></td>
        <td>${r.games}</td>
        <td><strong>${r.wins}</strong></td>
        <td>$${fmtMoney(r.totalAssets)}</td>
      </tr>
    `)
    .join("");

  elLeaderboard.innerHTML = `
     <div class="mini muted" style="margin-bottom:10px;">
       Total completed games: <strong>${totalGames}</strong>
     </div>
   
     <div class="tableWrap">
       <table>
         <thead>
           <tr>
             <th>Rank</th>
             <th>Player</th>
             <th>Games</th>
             <th>Wins</th>
             <th>Total Assets</th>
           </tr>
         </thead>
         <tbody>
           ${tableRows}
         </tbody>
       </table>
     </div>
   `;
}

function deleteLeaderboardGameById(gameId) {
  const idx = leaderboard.findIndex(g => g && g.id === gameId);
  if (idx === -1) return;

  const g = leaderboard[idx];
  const ok = confirm(
    `Delete this recorded game?\n\n${g?.ts || ""}\nWinner: ${g?.winner || "—"}`
  );
  if (!ok) return;

  leaderboard.splice(idx, 1);
  saveLeaderboard();
  renderLeaderboard();
}

function updatePitSelectedUI() {
  if (!elPitSelectedCount) return;
  elPitSelectedCount.textContent = `Selected: ${pitSelected.size}`;
}

function stockCurrentPrice(sym) {
  const s = getStock(sym);
  return state.prices[sym] ?? s.start;
}

function getVisibleStocks() {
  let list = getActiveStocks().filter(s => !isDissolved(s.symbol));

  if (pitFilterIndustry !== "ALL") {
    list = list.filter(s => s.industries.includes(pitFilterIndustry));
  }

  if (pitSortMode !== "off") {
    list.sort((a, b) => {
      const pa = stockCurrentPrice(a.symbol);
      const pb = stockCurrentPrice(b.symbol);
      return pitSortMode === "asc" ? (pa - pb) : (pb - pa);
    });
  }

  return list;
}

function applyBulkToSelected(delta) {
  if (!state.started) {
    alert("Start a session first.");
    return;
  }
  if (!pitSelected.size) {
    alert("Select at least one stock first.");
    return;
  }

  const amt = Number(elPitBulkAmt?.value ?? 0);
  if (!Number.isFinite(amt) || amt <= 0) {
    alert("Enter a valid bulk amount (greater than 0).");
    return;
  }

  const signed = delta > 0 ? amt : -amt;
   const directionLabel = delta > 0 ? "INCREASE" : "DECREASE";
   const signedAmt = delta > 0 ? amt : -amt;
   
   const preview = [...pitSelected]
     .map(sym => {
       const before = state.prices[sym] ?? getStock(sym).start;
       const after = clampPrice(before + signedAmt);
       return `${sym}: $${fmtMoney(before)} → $${fmtMoney(after)}`;
     })
     .join("\n");
   
   const ok = confirm(
     `Confirm Bulk ${directionLabel}\n\n` +
     `Amount: ${signedAmt > 0 ? "+" : ""}${signedAmt}\n` +
     `Stocks affected: ${pitSelected.size}\n\n` +
     preview
   );
   
   if (!ok) return;


  const touched = [];
  for (const sym of pitSelected) {
    const s = getStock(sym);
    if (!s) continue;

    const before = state.prices[sym] ?? s.start;
    const after = clampPrice(before + signed);
      state.prices[sym] = after;
      if (after === 0) dissolveCompany(sym, `Bulk adjust ${signed >= 0 ? "+" : ""}${signed} moved it to $0`);

    touched.push(`${sym} ${signed >= 0 ? "+" : ""}${signed} → $${fmtMoney(after)}`);
  }

  addLog(
    `Bulk Adjust (${signed >= 0 ? "+" : ""}${signed}) on ${pitSelected.size} stock(s)<br>` +
    `<span class="mini muted">${touched.join(" • ")}</span>`
  );

   // ✅ CASH SOUND on market move
  playCashSfx();

  renderAll();
  saveState();
}

function normName(name) {
  return String(name || "").trim().toLowerCase();
}

function buildLeaderboardStats() {
  // Aggregate across all recorded games
  const stats = new Map(); // key: normalized name -> record
  let totalGames = 0;

  for (const game of leaderboard) {
    if (!game?.placements?.length) continue;
    totalGames += 1;

    for (const p of game.placements) {
      const key = normName(p.name);
      if (!key) continue;

      if (!stats.has(key)) {
        stats.set(key, {
          name: p.name.trim(),
          games: 0,
          wins: 0,
          podiums: 0,      // top 3 finishes
          totalFinish: 0,  // sum of finishing positions
          bestFinish: 999,
          totalAssets: 0,  // sum of end assets across games
          lastSeenTs: game.ts || ""
        });
      }

      const rec = stats.get(key);
      rec.name = rec.name || p.name.trim();
      rec.games += 1;
      rec.totalFinish += Number(p.place || 0);
      rec.bestFinish = Math.min(rec.bestFinish, Number(p.place || 999));
      rec.totalAssets += Number(p.assets || 0);
      rec.lastSeenTs = game.ts || rec.lastSeenTs;

      if (p.place === 1) rec.wins += 1;
      if (p.place <= 3) rec.podiums += 1;
    }
  }

  const rows = [...stats.values()].map(r => ({
    ...r,
    avgFinish: r.games ? (r.totalFinish / r.games) : 0
  }));

  // Rank: wins desc, then avgFinish asc, then games desc, then totalAssets desc
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.avgFinish !== b.avgFinish) return a.avgFinish - b.avgFinish;
    if (b.games !== a.games) return b.games - a.games;
    return b.totalAssets - a.totalAssets;
  });

  return { totalGames, rows };
}

function buildLeaderboardStatsFrom(list) {
  const games = Array.isArray(list) ? list : [];
  const stats = new Map();

  for (const g of games) {
    const winner = g?.winner;
    const placements = Array.isArray(g?.placements) ? g.placements : [];

    for (const p of placements) {
      const name = p?.name || "Unknown";
      const assets = Number(p?.assets || 0);

      if (!stats.has(name)) {
        stats.set(name, { name, games: 0, wins: 0, totalAssets: 0 });
      }

      const row = stats.get(name);
      row.games += 1;
      row.totalAssets += assets;
      if (winner && winner === name) row.wins += 1;
    }
  }

  const rows = Array.from(stats.values())
    .sort((a, b) => (b.wins - a.wins) || (b.totalAssets - a.totalAssets));

  return { totalGames: games.length, rows };
}

function fmt1(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

function openPitBuy(symbol) {
  if (!state.started) {
    alert("Start a session first.");
    return;
  }

  const stock = getStock(symbol);
  if (!stock) return;

  tradeModalState.market = "stock";

  // Pick player
  const playersList = state.players
    .map((p, i) => `${i + 1}) ${p.name}`)
    .join("\n");

  const pick = prompt(
    `Buy ${symbol} — ${stock.name}\n\nChoose player:\n${playersList}\n\nEnter number (1-${state.players.length}):`,
    "1"
  );
  if (pick == null) return;

  const idx = Number(pick);
  if (!Number.isFinite(idx) || idx < 1 || idx > state.players.length) {
    alert("Invalid player selection.");
    return;
  }

  const player = state.players[idx - 1];

  // Shares
  const sharesRaw = prompt(`Buy how many shares of ${symbol} for ${player.name}?\n(Must be 100, 200, 300...)`, "100");
  if (sharesRaw == null) return;

  const shares = Number(sharesRaw);
  if (!Number.isFinite(shares) || shares <= 0 || shares % 100 !== 0) {
    alert("Shares must be 100, 200, 300...");
    return;
  }

  const price = state.prices[symbol] ?? stock.start;
  const cost = shares * price;

  const ok = confirm(
    `Confirm BUY?\n\nPlayer: ${player.name}\nStock: ${symbol} — ${stock.name}\nShares: ${shares}\nPrice: $${fmtMoney(price)}\nTotal: $${fmtMoney(cost)}`
  );
  if (!ok) return;

  doTrade(player.id, "BUY", symbol, shares);
}

// ---------- Trade Modal ----------
let tradeModalEl = null;

function ensureTradeModal() {
  if (tradeModalEl) return;

  const back = document.createElement("div");
  back.className = "mmModalBack";
  back.id = "mmTradeModalBack";


  // keep it out of the modal-open detector until opened
  back.hidden = true;
  back.setAttribute("aria-hidden","true");

  back.innerHTML = `
    <div class="mmModal" role="dialog" aria-modal="true" aria-label="Trade Stock">
      <div class="mmModalHeader">
        <div class="mmModalTitle" id="mmTradeModalTitle">Trade</div>
        <button type="button" class="mmModalClose" id="mmTradeModalClose">✕</button>
      </div>
      <div class="mmModalBody">
        <div class="mmTradeRow">
          <div class="field">
            <div class="mini muted" style="min-width:52px;">Player</div>
            <select id="mmTradePlayer"></select>
          </div>

          <div class="field">
            <div class="mini muted" style="min-width:52px;">Asset</div>
            <div style="font-weight:900;" id="mmTradeStockLabel">—</div>
          </div>

          <div class="mmTradeShares">
            <button type="button" id="mmTradeDown">-100</button>
            <div class="mini" style="min-width:140px; text-align:center;">
              <strong id="mmTradeShares">100</strong>
            </div>
            <button type="button" id="mmTradeUp">+100</button>
            <button type="button" id="mmTradeUpBig">+1000</button>
            <button type="button" class="maxBtn" id="modalSharesMax">MAX</button>
          </div>
        </div>

        <div class="mmTradePreview mini muted" id="mmTradePreview"></div>

        <div class="mmTradeBtns">
          <button type="button" class="primary" id="mmTradeBuy">Buy</button>
          <button type="button" id="mmTradeSell">Sell</button>
          <button type="button" class="danger" id="mmTradeSellAll">Sell All</button>
        </div>
      </div>
    </div>
  `;

  // click outside closes
  back.addEventListener("click", (e) => {
    if (e.target === back) closeTradeModal();
  });

  document.body.appendChild(back);
  tradeModalEl = back;

  document.getElementById("mmTradeModalClose").addEventListener("click", closeTradeModal);

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && tradeModalEl?.classList.contains("open")) closeTradeModal();
  });
}

let tradeModalState = {
  market: "stock", // "stock" | "crypto"
  symbol: null,
  shares: 100,
  playerId: null
};

function openTradeModalForStock(symbol) {
   if (isDissolved(symbol)) {
     alert(`${symbol} has dissolved (price hit $0). It cannot be traded.`);
     return;
   }
  if (!state.started) {
    alert("Start a session first.");
    return;
  }

  ensureTradeModal();

  const stock = getStock(symbol);
  if (!stock) return;

  tradeModalState.market = "stock";

  tradeModalState.symbol = symbol;
  tradeModalState.shares = 100;

  // build player dropdown
  const sel = document.getElementById("mmTradePlayer");
  sel.innerHTML = state.players
    .map(p => `<option value="${p.id}">${p.name}</option>`)
    .join("");

  // default to first player
  tradeModalState.playerId = state.players[0]?.id || null;
  sel.value = tradeModalState.playerId;

  sel.onchange = () => {
     tradeModalState.playerId = sel.value;
     renderTradeModalPreview();
   };


  // set labels
  document.getElementById("mmTradeModalTitle").textContent = `Trade — ${symbol}`;
  document.getElementById("mmTradeStockLabel").textContent = `${symbol} — ${stock.name}`;

  // share buttons
  document.getElementById("mmTradeDown").onclick = () => {
    tradeModalState.shares = Math.max(100, tradeModalState.shares - 100);
    renderTradeModalPreview();
  };
  document.getElementById("mmTradeUp").onclick = () => {
    tradeModalState.shares += 100;
    renderTradeModalPreview();
  };
  document.getElementById("mmTradeUpBig").onclick = () => {
    tradeModalState.shares += 1000;
    renderTradeModalPreview();
  };
  document.getElementById("mmTradeUpBig").onclick = () => {
    tradeModalState.shares += 1000;
    renderTradeModalPreview();
  };
   // modal MAX button — market-aware
   const elMax = document.getElementById("modalSharesMax");
   elMax.onclick = () => {
     const pid = tradeModalState.playerId;
     if (!pid) return;

     if (tradeModalState.market === "crypto") {
       tradeModalState.shares = computeMaxCryptoUnits(pid, tradeModalState.symbol);
     } else {
       tradeModalState.shares = computeMaxSharesWithSlippage(pid, tradeModalState.symbol);
     }
     renderTradeModalPreview();
   };


  // actions
  document.getElementById("mmTradeBuy").onclick = () => {
     const pid = tradeModalState.playerId;
     if (!pid) return;
   
     const ok = doTrade(pid, "BUY", tradeModalState.symbol, tradeModalState.shares);
     if (ok) closeTradeModal();
     else renderTradeModalPreview();
   };
   
   document.getElementById("mmTradeSell").onclick = () => {
     const pid = tradeModalState.playerId;
     if (!pid) return;
   
     const ok = doTrade(pid, "SELL", tradeModalState.symbol, tradeModalState.shares);
     if (ok) closeTradeModal();
     else renderTradeModalPreview();
   };
   
   document.getElementById("mmTradeSellAll").onclick = () => {
     const pid = tradeModalState.playerId;
     if (!pid) return;
   
     const p = state.players.find(x => x.id === pid);
     if (!p) return;
     ensureHoldings(p);
   
     const owned = p.holdings[tradeModalState.symbol] || 0;
     if (owned <= 0) return;
   
     const ok = doTrade(pid, "SELL", tradeModalState.symbol, owned);
     if (ok) closeTradeModal();
     else renderTradeModalPreview();
   };

  renderTradeModalPreview();
  tradeModalEl.hidden = false;
  tradeModalEl.setAttribute("aria-hidden","false");
  tradeModalEl.classList.add("open");
  recomputeBodyModalLock();
}

function openTradeModalForCrypto(symbol) {
  if (!state.started) {
    alert("Start a session first.");
    return;
  }
  if (!state.volatilityMode) {
    alert("Crypto Market is only available in Volatility Mode.");
    return;
  }

  ensureTradeModal();

  const c = getCrypto(symbol);
  if (!c) {
    alert("Unknown crypto symbol.");
    return;
  }

  tradeModalState.market = "crypto";
  tradeModalState.symbol = symbol;
  tradeModalState.shares = 100;

  // build player dropdown
  const sel = document.getElementById("mmTradePlayer");
  sel.innerHTML = state.players
    .map(p => `<option value="${p.id}">${p.name}</option>`)
    .join("");

  tradeModalState.playerId = state.players[0]?.id || null;
  sel.value = tradeModalState.playerId;

  sel.onchange = () => {
    tradeModalState.playerId = sel.value;
    renderTradeModalPreview();
  };

  document.getElementById("mmTradeModalTitle").textContent = `Trade — ${symbol}`;
  document.getElementById("mmTradeStockLabel").textContent = `${symbol} — ${c.name}`;

  document.getElementById("mmTradeDown").onclick = () => {
    tradeModalState.shares = Math.max(100, tradeModalState.shares - 100);
    renderTradeModalPreview();
  };
  document.getElementById("mmTradeUp").onclick = () => {
    tradeModalState.shares += 100;
    renderTradeModalPreview();
  };

  // +1000 button (same control as stocks)
  const elUpBig = document.getElementById("mmTradeUpBig");
  if (elUpBig) {
    elUpBig.onclick = () => {
      tradeModalState.shares += 1000;
      renderTradeModalPreview();
    };
  }

  // MAX button — market-aware (stocks: slippage-aware shares, crypto: slippage-aware units)
  const elMax = document.getElementById("modalSharesMax");
  if (elMax) {
    elMax.onclick = () => {
      const pid = tradeModalState.playerId;
      if (!pid) return;
      tradeModalState.shares = computeMaxCryptoUnits(pid, tradeModalState.symbol);
      renderTradeModalPreview();
    };
  }

  document.getElementById("mmTradeBuy").onclick = () => {
    const pid = tradeModalState.playerId;
    if (!pid) return;

    const ok = doCryptoTrade(pid, "BUY", tradeModalState.symbol, tradeModalState.shares);
    if (ok) closeTradeModal();
    else renderTradeModalPreview();
  };

  document.getElementById("mmTradeSell").onclick = () => {
    const pid = tradeModalState.playerId;
    if (!pid) return;

    const ok = doCryptoTrade(pid, "SELL", tradeModalState.symbol, tradeModalState.shares);
    if (ok) closeTradeModal();
    else renderTradeModalPreview();
  };

  document.getElementById("mmTradeSellAll").onclick = () => {
    const pid = tradeModalState.playerId;
    if (!pid) return;

    const p = state.players.find(x => x.id === pid);
    if (!p) return;
    ensureHoldings(p);

    const owned = p.cryptoHoldings?.[tradeModalState.symbol] || 0;
    if (owned <= 0) return;

    const ok = doCryptoTrade(pid, "SELL", tradeModalState.symbol, owned);
    if (ok) closeTradeModal();
    else renderTradeModalPreview();
  };

  renderTradeModalPreview();
  tradeModalEl.hidden = false;
  tradeModalEl.setAttribute("aria-hidden","false");
  tradeModalEl.classList.add("open");
  recomputeBodyModalLock();
}


function closeTradeModal() {
  if (!tradeModalEl) return;
  tradeModalEl.classList.remove("open");
  tradeModalEl.hidden = true;
  tradeModalEl.setAttribute("aria-hidden","true");
  recomputeBodyModalLock();
}

function renderTradeModalPreview() {
  const sym = tradeModalState.symbol;
  if (!sym) return;

  document.getElementById("mmTradeShares").textContent = String(tradeModalState.shares);

  const p = state.players.find(x => x.id === tradeModalState.playerId);
  if (!p) return;
  ensureHoldings(p);

  const sellAllBtn = document.getElementById("mmTradeSellAll");

  if (tradeModalState.market === "crypto") {
    const c = getCrypto(sym);
    if (!c) return;

    const price = state.cryptoPrices?.[sym] ?? c.start;
    const flatTotal = tradeModalState.shares * price;
    const total = state.volatilityMode ? estimateCryptoSlippageCost(sym, tradeModalState.shares, price) : flatTotal;
    const owned = p.cryptoHoldings?.[sym] || 0;

    if (sellAllBtn) sellAllBtn.disabled = owned <= 0;

    document.getElementById("mmTradePreview").innerHTML =
      `Price: <strong>$${fmtMoney(price)}</strong> • ` +
      `Est Total: <strong>$${fmtMoney(total)}</strong> • ` +
      `Owned: <strong>${owned} units</strong> • ` +
      `Cash: <strong>$${fmtMoney(p.cash)}</strong>`;
    return;
  }

  // stock preview
  const stock = getStock(sym);
  if (!stock) return;

  const price = state.prices[sym] ?? stock.start;
  const total = tradeModalState.shares * price;
  const owned = p.holdings[sym] || 0;

  if (sellAllBtn) sellAllBtn.disabled = owned <= 0;

  document.getElementById("mmTradePreview").innerHTML =
    `Price: <strong>$${fmtMoney(price)}</strong> • ` +
    `Total: <strong>$${fmtMoney(total)}</strong> • ` +
    `Owned: <strong>${owned} sh</strong> • ` +
    `Cash: <strong>$${fmtMoney(p.cash)}</strong>`;
}

// ---------- Setup Modals ----------
function initSetupModals() {
  const liveModal = document.getElementById("liveModal");
  const newGameModal = document.getElementById("newGameModal");
  const btnOpenLive = document.getElementById("btnOpenLiveModal");
  const btnOpenNewGame = document.getElementById("btnOpenNewGameModal");

  function openModal(el) {
    if (!el) return;
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
    // Use centralized modal lock logic so other modals (crypto/housing/trade) don't leave scroll locked.
    recomputeBodyModalLock();
  }

  function closeModal(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    // Use centralized modal lock logic so closing ANY modal restores scroll correctly.
    recomputeBodyModalLock();
  }

  btnOpenLive?.addEventListener("click", () => openModal(liveModal));
  btnOpenNewGame?.addEventListener("click", () => openModal(newGameModal));

  // Close buttons + overlay click
  document.addEventListener("click", (e) => {
    const closeId = e.target?.getAttribute?.("data-close-modal");
    if (!closeId) return;

    const el = document.getElementById(closeId);
    closeModal(el);
  });

  // ESC closes whichever is open
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (liveModal && !liveModal.hidden) closeModal(liveModal);
    if (newGameModal && !newGameModal.hidden) closeModal(newGameModal);
  });

  // If the Setup section is collapsed while a modal is open, close them
  const btnToggleSetup = document.getElementById("btnToggleSetup");
  btnToggleSetup?.addEventListener("click", () => {
    closeModal(liveModal);
    closeModal(newGameModal);
  });
}

// ---------- Save/Load ----------
function saveState(opts = {}) {
  const { silent = true } = opts;

  // Always keep local backup (host + viewer)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (!silent) {
    addLog("Saved session.");
  }

  // If host is live, also push to cloud (debounced)
  if (live.enabled && live.isHost) {
    schedulePushToCloud();
  }

  renderStatus();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try { state = JSON.parse(raw); } catch { return; }

  // defaults / migrations (AFTER parse)
  if (state.started == null) state.started = false;
  if (state.volatilityMode == null) state.volatilityMode = false;
  if (state.monopolyMode == null) state.monopolyMode = false;
  if (state.openingBells == null) state.openingBells = 0;
  if (!state.prices) state.prices = {};
  if (!state.cryptoPrices) state.cryptoPrices = {};
  if (state.cryptoSeed == null) state.cryptoSeed = 0;
  if (!state.players) state.players = [];
  for (const p of state.players) {
    if (!p.holdings) p.holdings = {};
    if (!p.cryptoHoldings) p.cryptoHoldings = {};
  }
  if (!state.dissolved) state.dissolved = {};
  if (!state.log) state.log = [];
}

function resetState() {
  if (!confirm("Reset session? This clears players, prices, and log.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = { started:false, createdAt:null, players:[], prices:{}, cryptoPrices:{}, cryptoSeed:0, cryptoLastMove:{}, housingPrice:325000, housingSeed:0, housingTrend:0, housingLastMovePct:0, dissolved:{}, monopolyMode:false, volatilityMode:false, log:[], openingBells:0 };
  buildSetupInputs();
  buildIndustryUI();
  buildShortMoveUI();
   updateVolatilityPill();
  renderAll();
}

function syncVolatilityUIFromState() {
  const elVol = document.getElementById("volatilityMode");
  if (elVol) elVol.checked = !!state.volatilityMode;
  const elMono = document.getElementById("monopolyMode");
  if (elMono) elMono.checked = !!state.monopolyMode;
}

function syncMonopolyUIFromState() {
  const elMono = document.getElementById("monopolyMode");
  if (elMono) elMono.checked = !!state.monopolyMode;
}

// ---------- UI Builders ----------
function buildSetupInputs() {
  const n = Number(elPlayerCount.value);
  const elMono = document.getElementById("monopolyMode");
  const monopolyOn = !!elMono?.checked;

  elPlayerInputs.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const wrap = document.createElement("div");

    // In Monopoly Mode, allow per-player starting cash (carryover from Monopoly).
    // Otherwise, keep setup compact: names only.
    wrap.innerHTML = monopolyOn
      ? `
        <label>Player ${i+1}</label>
        <div class="row" style="gap:10px;">
          <input type="text" id="pname_${i}" value="Player ${i+1}" />
          <input type="number" id="pcash_${i}" min="0" step="1000" value="${Number(elStartingCash?.value || 0) || 0}" title="Starting cash for Player ${i+1}" />
        </div>
        <div class="mini muted">Name • Starting cash</div>
      `
      : `
        <label>Player ${i+1} name</label>
        <input type="text" id="pname_${i}" value="Player ${i+1}" />
      `;

    elPlayerInputs.appendChild(wrap);
  }
}

function buildIndustryUI() {
  elIndustryList.innerHTML = "";

  for (const ind of CANON_INDUSTRIES) {
    const box = document.createElement("div");
    box.className = "industry-box";
    box.dataset.industry = ind;

    box.innerHTML = `
      <div class="top">
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="checkbox" class="indCheck" />
          <strong>${ind}</strong>
        </div>
        <select class="indDir">
           <option value="up">⬆️</option>
           <option value="down">⬇️</option>
         </select>
      </div>
      <div class="mini muted" style="margin-top:8px;">
        Affects: <span class="affects"></span>
      </div>
    `;

    const syms = getActiveStocks().filter(s => s.industries.includes(ind)).map(s => s.symbol).join(", ");
    box.querySelector(".affects").textContent = syms || "—";

    elIndustryList.appendChild(box);
  }

  elIndustryList.addEventListener("change", updateMarketMoverButton);
}

function buildShortMoveUI() {
  elShortMoveSymbol.innerHTML = "";
  for (const s of getActiveStocks()) {
   if (isDissolved(s.symbol)) continue;
    const opt = document.createElement("option");
    opt.value = s.symbol;
    opt.textContent = `${s.symbol} — ${s.name}`;
    elShortMoveSymbol.appendChild(opt);
  }
}

function buildPitControlsUI() {
  if (!elPitIndustryFilter) return;

  // build filter dropdown once
  elPitIndustryFilter.innerHTML = `<option value="ALL">All Industries</option>`;
  for (const ind of getAllIndustries()) {
    const opt = document.createElement("option");
    opt.value = ind;
    opt.textContent = ind;
    elPitIndustryFilter.appendChild(opt);
  }

  elPitIndustryFilter.value = pitFilterIndustry;

  // set initial sort button label
  if (elPitSortCur) {
    elPitSortCur.textContent =
      pitSortMode === "off" ? "Sort Current: Off" :
      pitSortMode === "asc" ? "Sort Current: Low → High" :
      "Sort Current: High → Low";
  }

  updatePitSelectedUI();
}

// ---------- Render ----------
function renderStatus() {
  if (!state.started) {
    elSessionStatus.textContent = "No session loaded";
    return;
  }
  const n = state.players.length;
  elSessionStatus.textContent = `Session: ${n} player${n===1?"":"s"} • ${state.createdAt || ""}`;
}

function renderPitBoard() {
  // desktop table
   if (!state.started) {
    elPitTableBody.innerHTML = "";
    if (elPitCards) elPitCards.innerHTML = "";
    return;
  }
  elPitTableBody.innerHTML = "";

  // mobile cards
  if (elPitCards) elPitCards.innerHTML = "";

  const list = getVisibleStocks();

  // keep select-all checkbox in sync (only for visible rows)
  if (elPitSelectAll) {
    const visibleSyms = list.map(s => s.symbol);
    const allVisibleSelected = visibleSyms.length > 0 && visibleSyms.every(sym => pitSelected.has(sym));
    elPitSelectAll.checked = allVisibleSelected;
  }

  for (const s of list) {
    const cur = state.prices[s.symbol] ?? s.start;

    // table row
    const tr = document.createElement("tr");
    const industries = s.industries.map(x => `<span class="tag">${x}</span>`).join("");

    const checked = pitSelected.has(s.symbol) ? "checked" : "";

    const curCell = `
      <td>
        <button
          type="button"
          class="pitPriceBtn"
          data-action="editPrice"
          data-symbol="${s.symbol}"
          title="Click to manually set price"
        >
          $${fmtMoney(cur)}
        </button>
      </td>
    `;

    tr.innerHTML = `
      <td class="selectCol">
        <input class="pitSelect" type="checkbox" data-symbol="${s.symbol}" ${checked} />
      </td>
      <td>
        <button type="button" class="pitLink" data-action="tradeStock" data-symbol="${s.symbol}">
          <strong>${s.symbol}</strong>
        </button>
      </td>
      <td>
        <button type="button" class="pitLink" data-action="tradeStock" data-symbol="${s.symbol}">
          ${s.name}
        </button>
      </td>
      <td>${industries}</td>
      <td>$${fmtMoney2(s.dividend)}</td>
      <td>$${fmtMoney(s.start)}</td>
      ${curCell}
    `;

    // --- Robust click binding (some browsers / live-session states can miss delegated handlers) ---
    // Bind directly on the freshly-created row buttons so clicking Symbol/Company always opens the trade modal.
    for (const btn of tr.querySelectorAll('[data-action="tradeStock"]')) {
      btn.onclick = (ev) => {
        ev.preventDefault();
        // Don't let other click handlers (or accidental label/row interactions) interfere
        ev.stopPropagation();
        openTradeModalForStock(btn.dataset.symbol);
      };
    }
    elPitTableBody.appendChild(tr);

    // card (mobile)
    if (elPitCards) {
      const card = document.createElement("div");
      card.className = "pitCard";

      const cChecked = pitSelected.has(s.symbol) ? "checked" : "";

      card.innerHTML = `
        <div class="pitRow1">
          <div class="pitLeft">
            <div class="pitSymLine" data-action="tradeStock" data-symbol="${s.symbol}" style="cursor:pointer;">
               <span class="pitSym">${s.symbol}</span>
               <span class="pitName">${s.name}</span>
            </div>
          </div>

          <input class="pitSelect pitSelectCard" type="checkbox" data-symbol="${s.symbol}" ${cChecked} />
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:8px;">
          <button
            type="button"
            class="pitPriceBtn pitCur"
            data-action="editPrice"
            data-symbol="${s.symbol}"
            title="Tap to manually set price"
          >
            $${fmtMoney(cur)}
          </button>
          <div class="mini muted" style="white-space:nowrap;">
            Start: <strong>$${fmtMoney(s.start)}</strong>
          </div>
        </div>

        <div class="pitRow2">
          ${s.industries.map(ind => `<span class="tag">${ind}</span>`).join("")}
        </div>

        <div class="pitRow3">
          <div><b>Div</b>$${fmtMoney2(s.dividend)}</div>
          <div><b>Move</b>${s.moves.low}/${s.moves.mid}/${s.moves.high}</div>
          <div><b>Now</b>$${fmtMoney(cur)}</div>
        </div>
      `;

      // Same robust binding for the mobile card header line
      const symLine = card.querySelector('.pitSymLine[data-action="tradeStock"]');
      if (symLine) {
        symLine.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          openTradeModalForStock(symLine.dataset.symbol);
        };
      }
      elPitCards.appendChild(card);
    }
  }

  updatePitSelectedUI();
}



function cryptoMoveMarkup(sym, cur){
  const pct = Number(state.cryptoLastMove?.[sym]);
  if (!Number.isFinite(pct) || pct === 0) {
    return `<div class="cryptoPriceWrap flat"><div class="cryptoPrice">$${fmtMoney2(cur)}</div><div class="cryptoMove">—</div></div>`;
  }
  const up = pct > 0;
  const cls = up ? "up" : "down";
  const arrow = up ? "▲" : "▼";
  const pctTxt = `${up ? "+" : ""}${(pct*100).toFixed(1)}%`;
  return `<div class="cryptoPriceWrap ${cls}"><div class="cryptoPrice">$${fmtMoney2(cur)}</div><div class="cryptoMove">${arrow} ${pctTxt}</div></div>`;
}

function renderCryptoMarket() {
  if (!elCryptoTableBody || !elCryptoCards) return;

  // button visibility
  if (elBtnCryptoMarket) {
    elBtnCryptoMarket.hidden = !(state.started && state.volatilityMode);
  }

  // if modal isn't open, we still keep the button updated and exit
  const modalOpen = !!elCryptoModal && !elCryptoModal.hidden;
  if (!modalOpen) return;

  ensureCryptoPrices();

  const rows = getActiveCryptos().map(c => {
    const cur = state.cryptoPrices?.[c.symbol] ?? c.start;
    return `
      <tr>
        <td><strong>${c.symbol}</strong></td>
        <td>${c.name}</td>
        <td class="cryptoPriceCell">${cryptoMoveMarkup(c.symbol, cur)}</td>
        <td><button type="button" class="primary" data-action="tradeCrypto" data-symbol="${c.symbol}">Trade</button></td>
      </tr>
    `;
  }).join("");

  elCryptoTableBody.innerHTML = rows || `<tr><td colspan="4" class="muted">Crypto market unavailable.</td></tr>`;

  // mobile cards
  elCryptoCards.innerHTML = getActiveCryptos().map(c => {
    const cur = state.cryptoPrices?.[c.symbol] ?? c.start;
    return `
      <div class="pitCard">
        <div class="pitCardTop">
          <div>
            <div class="pitSym">${c.symbol}</div>
            <div class="mini muted">${c.name}</div>
          </div>
          <div class="pitPrice cryptoPriceCell">${cryptoMoveMarkup(c.symbol, cur)}</div>
        </div>
        <div style="margin-top:10px;">
          <button type="button" class="primary" data-action="tradeCrypto" data-symbol="${c.symbol}">Trade</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderHousingMarket(){
  // button visibility + label
  if (elBtnHousingMarket) {
    elBtnHousingMarket.hidden = !(state.started && state.volatilityMode);
    if (!elBtnHousingMarket.hidden) {
      ensureHousingMarket();
      elBtnHousingMarket.textContent = `House Market`;
    }
  }

  // if modal isn't open, nothing else to render
  const modalOpen = !!elHousingModal && !elHousingModal.hidden;
  if (!modalOpen) return;

  ensureHousingMarket();

  if (elHousingCurPrice) elHousingCurPrice.textContent = `$${fmtMoneyK(state.housingPrice)}`;
  if (elHousingLastMove) {
    const mt = housingMoveText(state.housingLastMovePct);
    elHousingLastMove.className = `housingMovePill ${mt.cls}`;
    elHousingLastMove.textContent = mt.txt;
  }

  // players dropdown
  if (elHousingPlayer) {
    elHousingPlayer.innerHTML = state.players.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
    if (!elHousingPlayer.value && state.activePlayerId) elHousingPlayer.value = state.activePlayerId;
  }

  updateHousingPreview();
}

function openHousingModal(){
  if (!(state.started && state.volatilityMode)) return;

  ensureHousingMarket();
  if (elHousingUnits) elHousingUnits.textContent = String(state.housingTradeUnits || 1);

  // open
  openModalById("housingModal");

  renderHousingMarket();
}

function setHousingUnits(n){
  const v = Math.max(1, Math.floor(Number(n) || 1));
  state.housingTradeUnits = v;
  if (elHousingUnits) elHousingUnits.textContent = String(v);
  updateHousingPreview();
}

function getHousingMaxUnits(player){
  const price = Number(state.housingPrice || 0);
  if (price <= 0) return 0;
  return Math.max(0, Math.floor((Number(player?.cash) || 0) / price));
}

function updateHousingPreview(){
  if (!elHousingPreview || !state.started) return;
  ensureHousingMarket();

  const pid = elHousingPlayer?.value || state.activePlayerId;
  const p = state.players.find(x => x.id === pid) || state.players[0];
  if (!p) { elHousingPreview.textContent = ""; return; }
  ensureHoldings(p);

  const units = Math.max(1, Math.floor(Number(state.housingTradeUnits) || 1));
  const price = Number(state.housingPrice || 0);
  const cost = units * price;
  const canMax = getHousingMaxUnits(p);

  elHousingPreview.innerHTML =
    `Avg price: <strong>$${fmtMoney(price)}</strong> • ` +
    `Units: <strong>${units}</strong> • ` +
    `Total: <strong>$${fmtMoney(cost)}</strong><br>` +
    `<span class="muted">Cash: $${fmtMoney(p.cash)} • You own: ${p.housingUnits || 0} house(s) • Max you can buy: ${canMax}</span>`;
}

function doHousingTrade(act){
  if (!assertHostAction()) return false;
  if (!state.started) return false;
  ensureHousingMarket();

  const pid = elHousingPlayer?.value || state.activePlayerId;
  const p = state.players.find(x => x.id === pid);
  if (!p) return false;
  ensureHoldings(p);

  const units = Math.max(1, Math.floor(Number(state.housingTradeUnits) || 1));
  const price = Number(state.housingPrice || 0);
  const total = units * price;

  if (act === "buy") {
    const max = getHousingMaxUnits(p);
    if (max <= 0) { alert("Not enough cash to buy a house."); return false; }
    const u = Math.min(units, max);
    const t = u * price;

    pushUndo(`Housing BUY ${u} ( ${p.name} )`);
    p.cash -= t;
    p.housingUnits = (Number(p.housingUnits) || 0) + u;

    addLog(`🏠 ${p.name} bought ${u} house(s) @ $${fmtMoney(price)} = $${fmtMoney(t)}.`);
  } else if (act === "sell") {
    const owned = Number(p.housingUnits) || 0;
    if (owned <= 0) { alert("No houses to sell."); return false; }
    const u = Math.min(units, owned);
    const t = u * price;

    pushUndo(`Housing SELL ${u} ( ${p.name} )`);
    p.cash += t;
    p.housingUnits = owned - u;

    addLog(`🏠 ${p.name} sold ${u} house(s) @ $${fmtMoney(price)} = $${fmtMoney(t)}.`);
  } else if (act === "sellAll") {
    const owned = Number(p.housingUnits) || 0;
    if (owned <= 0) { alert("No houses to sell."); return false; }
    const t = owned * price;

    pushUndo(`Housing SELL ALL ${owned} ( ${p.name} )`);
    p.cash += t;
    p.housingUnits = 0;

    addLog(`🏠 ${p.name} sold ALL houses (${owned}) @ $${fmtMoney(price)} = $${fmtMoney(t)}.`);
  }

  renderAll();
  saveState();
  if (live.enabled && live.isHost) pushStateToCloud();

  // Close the Housing modal after a successful trade (better flow)
  closeModalById("housingModal");
   playCashSfx();
  return true;
}

function openCryptoModal() {
  if (!state.started) {
    alert("Start a session first.");
    return;
  }
  if (!state.volatilityMode) {
    alert("Crypto Market is only available in Volatility Mode.");
    return;
  }
  openModalById("cryptoModal");
  renderCryptoMarket();
}
function renderPlayers() {
  if (!elPlayersArea) return;

  elPlayersArea.innerHTML = "";
  if (typeof elPlayerTabs !== "undefined" && elPlayerTabs) elPlayerTabs.innerHTML = "";

  if (!state.started) {
    elPlayersArea.innerHTML = `<div class="muted">Start a session to track players.</div>`;
    return;
  }

  // Ensure active player id is valid
  if (!activePlayerId || !state.players.some(p => p.id === activePlayerId)) {
    activePlayerId = state.players[0]?.id || null;
  }

  // ---- Tabs ----
  if (typeof elPlayerTabs !== "undefined" && elPlayerTabs) {
    for (const pl of state.players) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "playerTab" + (pl.id === activePlayerId ? " isActive" : "");
      b.textContent = pl.name;
      b.addEventListener("click", () => {
        activePlayerId = pl.id;
        renderPlayers();
      });
      elPlayerTabs.appendChild(b);
    }
  }

  const p = state.players.find(x => x.id === activePlayerId);
  if (!p) return;

  ensureHoldings(p);

  // ---- Avatar locking helpers ----
  function getTakenAvatarIds(exceptPlayerId) {
    const taken = new Set();
    for (const pl of (state.players || [])) {
      if (!pl) continue;
      if (pl.id === exceptPlayerId) continue;
      if (pl.avatar) taken.add(pl.avatar); // e.g. "avatar-003"
    }
    return taken;
  }

  const taken = getTakenAvatarIds(p.id);
  const currentAvatarId = p.avatar || "";
  const avatarObj =
    AVATAR_PRESETS.find(a => a.id === currentAvatarId) ||
    AVATAR_PRESETS[0] ||
    { id: "", src: "" };

  const avatarSrc = avatarObj.src;

  // ---- Stats / holdings ----
  const { total: divTotal } = computePlayerDividendDue(p);
  const investedIndustries = computePlayerIndustries(p);
  const totalAssets = computePlayerNetWorth(p);

  const industryLine = investedIndustries.length
    ? `
      <div class="mini muted" style="margin-top:6px;">
        Industries:
        ${investedIndustries.map(ind => `<span class="tag">${ind}</span>`).join("")}
      </div>
    `
    : `
      <div class="mini muted" style="margin-top:6px;">
        Industries: <span class="muted">None</span>
      </div>
    `;

  const holdingLines = getActiveStocks()
    .map(s => {
      const shares = p.holdings[s.symbol] || 0;
      if (shares === 0) return null;

      const price = state.prices[s.symbol] ?? s.start;
      const val = shares * price;
      const divDue = shares * s.dividend;

      return `
        <div class="mini">
          <strong>${s.symbol}</strong>:
          ${shares} sh @ $${fmtMoney(price)} = $${fmtMoney(val)}
          <span class="muted"> • Div Due: $${fmtMoney(divDue)}</span>
        </div>
      `;
    })
    .filter(Boolean)
    .join("") || `<div class="mini muted">No holdings yet.</div>`;


  const cryptoLines = (state.volatilityMode ? getActiveCryptos() : [])
    .map(c => {
      const units = (p.cryptoHoldings?.[c.symbol] || 0);
      if (units === 0) return null;

      const price = state.cryptoPrices?.[c.symbol] ?? c.start;
      const val = units * price;

      return `
        <div class="mini">
          <strong>${c.symbol}</strong>:
          ${units} units @ $${fmtMoney(price)} = $${fmtMoney(val)}
          <span class="muted"> • Crypto (no dividends)</span>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  const housingLines = (state.volatilityMode && Number(p.housingUnits) > 0)
    ? `
        <div class="mini">
          <strong>HOU</strong>:
          ${Number(p.housingUnits) || 0} house(s) @ $${fmtMoney(state.housingPrice || 0)} = $${fmtMoney((Number(p.housingUnits)||0) * (Number(state.housingPrice)||0))}
          <span class="muted"> • Housing (no dividends)</span>
        </div>
      `
    : "";


  const holdingsCombined = (holdingLines ? holdingLines : "") +
    (cryptoLines ? `<div class="divider" style="margin:10px 0;"></div><div class="mini muted" style="margin-bottom:6px;">Crypto Holdings</div>${cryptoLines}` : "") +
    (housingLines ? `<div class="divider" style="margin:10px 0;"></div><div class="mini muted" style="margin-bottom:6px;">Housing Holdings</div>${housingLines}` : "");


  const dividendSummary = `
    <div class="mini muted" style="margin-top:8px;">
      Total Dividends Due: <strong>$${fmtMoney(divTotal || 0)}</strong>
    </div>
  `;

  // ---- Build card ----
  const wrap = document.createElement("div");
  wrap.className = "card playerCardAnim";

  wrap.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">

      <!-- LEFT -->
      <div style="flex:1; min-width:260px;">
        <div class="playerIdentity">
          <div class="playerAvatar" style="background-image:url('${avatarSrc}')"></div>

          <div style="min-width:0;">
            <div style="font-size:14px; font-weight:800;">${p.name}</div>
            <div class="mini muted">
              Cash: <strong>$${fmtMoney(p.cash)}</strong> •
              Total Assets: <strong>$${fmtMoney(totalAssets)}</strong>
            </div>
            ${industryLine}
          </div>

          <button type="button" class="avatarBtn" data-action="toggleAvatar">Change Persona</button>
        </div>

        <div class="avatarPicker" hidden>
          <div class="mini muted" style="margin-bottom:8px;">
            Select a unique avatar (one per player).
          </div>

          <div class="avatarGrid">
            ${AVATAR_PRESETS.map(a => {
              const isTaken = taken.has(a.id);
              const isMine = currentAvatarId === a.id;
              const disabled = isTaken && !isMine;

              return `
                <button
                  type="button"
                  class="avatarOption ${disabled ? "isTaken" : ""} ${isMine ? "isSelected" : ""}"
                  data-avatar="${a.id}"
                  style="background-image:url('${a.src}')"
                  ${disabled ? "disabled" : ""}
                  title="${disabled ? "Taken" : "Select"}"
                ></button>
              `;
            }).join("")}
          </div>
        </div>
      </div>

      <!-- RIGHT (trade controls) -->
      <div style="display:flex; gap:10px; min-width:320px; flex:1; justify-content:flex-end; flex-wrap:wrap; align-items:center;">
        <label class="mini muted" style="display:flex; align-items:center; gap:6px;">
          Stock
          <select data-role="tradeSymbol" data-player="${p.id}">
            ${getActiveStocks().map(s => `<option value="${s.symbol}">${s.symbol} — ${s.name}</option>`).join("")}
          </select>
        </label>

        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" data-role="sharesDown" data-player="${p.id}">-100</button>

          <div class="mini" style="min-width:120px; text-align:center;">
            Shares: <strong><span data-role="tradeShares" data-player="${p.id}">100</span></strong>
          </div>

          <button type="button" data-role="sharesUp" data-player="${p.id}">+100</button>
          <button type="button" data-role="sharesMax" data-player="${p.id}">MAX</button>
        </div>

        <button type="button" class="primary" data-role="buy" data-player="${p.id}">Buy</button>
        <button type="button" data-role="sell" data-player="${p.id}">Sell</button>
        <button type="button" class="danger" data-role="sellAll" data-player="${p.id}">Sell All</button>

        <button type="button" data-action="adjustCash" data-player="${p.id}">+/- Cash</button>

        <div class="mini muted" style="width:100%; text-align:right;">
          <span data-role="tradePreview" data-player="${p.id}"></span>
        </div>
      </div>
    </div>

    <div class="divider"></div>
    <div>
      ${holdingsCombined}
      ${dividendSummary}
    </div>
  `;

  elPlayersArea.appendChild(wrap);

  // ---- Cash dialog ----
  wrap.querySelector('[data-action="adjustCash"]').addEventListener("click", () => openCashDialog(p.id));

  // ---- Avatar picker interactions ----
  const btnAvatar = wrap.querySelector('[data-action="toggleAvatar"]');
  const picker = wrap.querySelector(".avatarPicker");

  btnAvatar.addEventListener("click", () => {
    picker.hidden = !picker.hidden;
  });

  wrap.querySelectorAll(".avatarOption").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;

      const id = btn.getAttribute("data-avatar");
      if (!id) return;

      // prevent race/stale DOM
      const takenNow = getTakenAvatarIds(p.id);
      if (takenNow.has(id) && p.avatar !== id) return;

      p.avatar = id;

      if (typeof saveState === "function") saveState();
      if (typeof renderAll === "function") renderAll();
      else renderPlayers();
    });
  });

  // ---- Trade preview + controls ----
  const elSymbol = wrap.querySelector(`[data-role="tradeSymbol"][data-player="${p.id}"]`);
  const elShares = wrap.querySelector(`[data-role="tradeShares"][data-player="${p.id}"]`);
  const elPreview = wrap.querySelector(`[data-role="tradePreview"][data-player="${p.id}"]`);
  const elSellAll = wrap.querySelector(`[data-role="sellAll"][data-player="${p.id}"]`);

  let tradeShares = 100;

  function updatePreview() {
    const symbol = elSymbol.value;
    const stock = getStock(symbol);
    const price = state.prices[symbol] ?? stock.start;
    const cost = tradeShares * price;
    const owned = p.holdings[symbol] || 0;

    elSellAll.disabled = owned <= 0;

    elShares.textContent = String(tradeShares);
    elPreview.textContent =
      `${symbol} @ $${fmtMoney(price)} • Total: $${fmtMoney(cost)} • You own: ${owned} sh`;
  }

  wrap.querySelector(`[data-role="sharesDown"][data-player="${p.id}"]`).addEventListener("click", () => {
    tradeShares = Math.max(100, tradeShares - 100);
    updatePreview();
  });

  wrap.querySelector(`[data-role="sharesUp"][data-player="${p.id}"]`).addEventListener("click", () => {
    tradeShares += 100;
    updatePreview();
  });

  elSymbol.addEventListener("change", updatePreview);

  wrap.querySelector(`[data-role="buy"][data-player="${p.id}"]`).addEventListener("click", () => {
    doTrade(p.id, "BUY", elSymbol.value, tradeShares);
  });

  wrap.querySelector(`[data-role="sell"][data-player="${p.id}"]`).addEventListener("click", () => {
    doTrade(p.id, "SELL", elSymbol.value, tradeShares);
  });

  wrap.querySelector(`[data-role="sharesMax"][data-player="${p.id}"]`).addEventListener("click", () => {
     const symbol = elSymbol.value;
     const stock = getStock(symbol);
     if (!stock) return;
   
     // Helper: total cost for buying X shares (handles volatility slippage)
     const costForShares = (sh) => {
       const startPrice = state.prices[symbol] ?? stock.start;
   
       if (!state.volatilityMode) return sh * startPrice;
   
       // simulate slippage WITHOUT mutating market price
       const isBuy = true;
       const totalShares = Math.abs(sh);
   
       const LOT_SIZE = VOL_LOT_SIZE;
       const SHARES_PER_TICK = VOL_SHARES_PER_TICK;
       const MAX_PCT_PER_TRADE = VOL_MAX_PCT_PER_TRADE;
   
       let price = startPrice;
   
       const ticksTotal = Math.floor(totalShares / SHARES_PER_TICK);
       if (ticksTotal <= 0) return totalShares * price;
   
       const capTicks = Math.max(1, Math.round(price * MAX_PCT_PER_TRADE));
       const ticksApplied = Math.min(ticksTotal, capTicks);
   
       const lots = Math.ceil(totalShares / LOT_SIZE);
       const ticksPerLot = ticksApplied / lots;
   
       let remaining = totalShares;
       let execTotal = 0;
       let current = price;
   
       for (let i = 0; i < lots; i++) {
         const lotShares = Math.min(LOT_SIZE, remaining);
         remaining -= lotShares;
   
         execTotal += lotShares * current;
   
         current = current + (isBuy ? +ticksPerLot : -ticksPerLot);
         if (current <= 0) break;
       }
   
       return execTotal;
     };
   
     // Binary search the maximum affordable shares in 100-share increments
     const CASH = p.cash;
   
     // First guess: ignore slippage to establish an upper bound
     const startPrice = state.prices[symbol] ?? stock.start;
     if (!Number.isFinite(startPrice) || startPrice <= 0) return;
   
     let hiLots = Math.max(1, Math.floor(CASH / (startPrice * 100))); // lots of 100
     let loLots = 0;
   
     // Expand upper bound until it is NOT affordable (slippage-aware)
     while (hiLots > 0 && costForShares(hiLots * 100) <= CASH) {
       hiLots *= 2;
       if (hiLots > 200000) break; // safety cap (20M shares)
     }
   
     // Now binary search between loLots and hiLots
     let left = loLots;
     let right = hiLots;
   
     while (left + 1 < right) {
       const mid = Math.floor((left + right) / 2);
       const midShares = mid * 100;
       const c = costForShares(midShares);
   
       if (c <= CASH) left = mid;
       else right = mid;
     }
   
     const maxShares = Math.max(100, left * 100);
     tradeShares = maxShares;
     updatePreview();
   });

  elSellAll.addEventListener("click", () => {
    const symbol = elSymbol.value;
    const owned = p.holdings[symbol] || 0;
    if (owned <= 0) return;
    doTrade(p.id, "SELL", symbol, owned);
  });

  updatePreview();
}

function renderLog() {
  elLog.innerHTML = "";
     if (live.enabled) {
       const banner = document.createElement("div");
       banner.className = "item";
       const label = live.isHost ? "HOST" : "VIEWER";
       banner.innerHTML = `
         <div class="mini muted">LIVE</div>
         <div><strong>🔴 LIVE SESSION</strong> — ${label} • Code: <strong>${live.sid}</strong></div>
       `;
       elLog.appendChild(banner);
     }

  for (const item of state.log.slice(0, 200)) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div class="mini muted">${item.ts}</div><div>${item.text}</div>`;
    elLog.appendChild(div);
  }
}

function updateMarketMoverButton() {
  const anyChecked = [...elIndustryList.querySelectorAll(".indCheck")].some(chk => chk.checked);
  const started = !!state.started;
  const diceOk = Number(elDiceTotal.value) >= 2 && Number(elDiceTotal.value) <= 12;

  elBtnApplyMarketMover.disabled = !(started && anyChecked && diceOk);

  elMarketMoverHint.textContent = !started
    ? "Start a session first."
    : (!diceOk ? "Select a dice total (2–12)." : (!anyChecked ? "Select at least one industry." : "Ready."));
}

function renderAll() {
  ensurePricesForActiveStocks();
  ensureCryptoPrices();
  renderStatus();
  renderPitBoard();
  renderPlayers();
  renderLog();
  renderCryptoMarket();
  ensureHousingMarket();
  renderHousingMarket();

  const started = !!state.started;
  elBtnPayDividends.disabled = !started;
  elBtnShortMove.disabled = !started;

  elBtnEndSession.disabled = !started;

  renderOpeningBellCounter();
  updateMarketMoverButton();
}

function clearLeaderboard() {
  if (!confirm("Clear leaderboard? This cannot be undone.")) return;
  leaderboard = [];
  localStorage.removeItem(LEADERBOARD_KEY);
  renderLeaderboard();
}
function executeTradeWithSlippage(symbol, signedShares) {
  // Returns { execTotal, avgPrice, finalPrice, ticksApplied }
  if (!state.volatilityMode) return null;

  const stock = getStock(symbol);
  if (!stock) return null;
  if (isDissolved(symbol)) return null;

  let startPrice = state.prices[symbol] ?? stock.start;
  if (!Number.isFinite(startPrice)) startPrice = stock.start;

  const isBuy = signedShares > 0;
  const totalShares = Math.abs(signedShares);

  // how many $1 ticks should happen over the whole order
  const ticksTotal = Math.floor(totalShares / VOL_SHARES_PER_TICK);
  if (ticksTotal <= 0) {
    return {
      execTotal: totalShares * startPrice,
      avgPrice: startPrice,
      finalPrice: clampPrice(startPrice),
      ticksApplied: 0
    };
  }

  // cap total move per trade (prevents insane nukes)
  const capTicks = Math.max(1, Math.round(startPrice * VOL_MAX_PCT_PER_TRADE));
  const ticksApplied = Math.min(ticksTotal, capTicks);

  // distribute ticks across lots evenly
  const lots = Math.ceil(totalShares / VOL_LOT_SIZE);
  const ticksPerLot = ticksApplied / lots; // fractional ticks allowed

  let remaining = totalShares;
  let execTotal = 0;
  let current = startPrice; // keep float during fill

  for (let i = 0; i < lots; i++) {
    const lotShares = Math.min(VOL_LOT_SIZE, remaining);
    remaining -= lotShares;

    // execute this lot at current price
    execTotal += lotShares * current;

    // move price for next lot (NO rounding here)
    current = current + (isBuy ? +ticksPerLot : -ticksPerLot);
    if (current <= 0) {
      current = 0;
      break;
    }
  }

  // round once at end
  const finalPrice = clampPrice(current);
  state.prices[symbol] = finalPrice;

  if (finalPrice === 0) {
    dissolveCompany(symbol, "Order flow impact pushed it to $0");
  }

  const avgPrice = execTotal / totalShares;
  return { execTotal, avgPrice, finalPrice, ticksApplied };
}

// ---------- Actions ----------
function startSession() {
  const n = Number(elPlayerCount.value);

  const elVol  = document.getElementById("volatilityMode");
  const elMono = document.getElementById("monopolyMode");

  // ✅ set mode flags FIRST (so downstream logic can rely on them)
  state.volatilityMode = !!elVol?.checked;
  state.monopolyMode   = !!elMono?.checked;

  // Modes are mutually exclusive; in case something weird slipped through:
  if (state.volatilityMode && state.monopolyMode) state.monopolyMode = false;

  let defaultStartingCash = Number(elStartingCash.value || 0);

  // If volatility mode is enabled and starting cash is blank or still the base default,
  // force the enhanced default.
  if (state.volatilityMode && (!elStartingCash.value || defaultStartingCash === 50000)) {
    defaultStartingCash = 1000000;
    elStartingCash.value = "1000000";
  }

  const players = [];
  for (let i = 0; i < n; i++) {
    const name = (document.getElementById(`pname_${i}`)?.value || `Player ${i+1}`).trim();

    // Monopoly Mode: each player can start with a different cash amount (carryover)
    const perCashRaw = state.monopolyMode
      ? document.getElementById(`pcash_${i}`)?.value
      : null;

    const cash = state.monopolyMode
      ? Number(perCashRaw || defaultStartingCash || 0)
      : Number(defaultStartingCash || 0);

    players.push({
      id: `p${i+1}`,
      name,
      cash,
      holdings: {},
      cryptoHoldings: {},
      housingUnits: 0
    });
  }

  const prices = {};
  for (const s of getActiveStocks()) {
    prices[s.symbol] = s.start;
  }

  // Crypto market (Volatility Mode only)
  const cryptoPrices = {};
  if (state.volatilityMode) {
    for (const c of getActiveCryptos()) cryptoPrices[c.symbol] = c.start;
  }

  state.started = true;
  state.createdAt = nowTs();
  state.players = players;
  setActivePlayer(players[0]?.id || null);
  state.prices = prices;
  state.cryptoPrices = cryptoPrices;
  state.cryptoSeed = Math.floor(Date.now() % 2147483647);
  state.cryptoLastMove = {};

  // Housing market (Volatility Mode only)
  state.housingPrice = 325000;
  state.housingSeed = Math.floor((Date.now() + 1337) % 2147483647);
  state.housingTrend = 0;
  state.housingLastMovePct = 0;

  state.dissolved = {};
  state.log = [];
  state.openingBells = 0;

  pitFilterIndustry = "ALL";
  pitSortMode = "off";
  pitSelected.clear();

  updateVolatilityPill();
  buildPitControlsUI();

  buildIndustryUI();
  buildShortMoveUI();

  const modeTxt = state.volatilityMode ? "Volatility Mode" : (state.monopolyMode ? "Monopoly Mode" : "Standard Mode");
  const cashTxt = state.monopolyMode
    ? players.map(p => `${p.name}: $${fmtMoney(p.cash)}`).join(" • ")
    : `$${fmtMoney(defaultStartingCash)} each`;

  addLog(`Session started (${modeTxt}) with ${n} player(s). Starting cash: ${cashTxt}.`);
  renderAll();
  saveState();
  closeModalById("newGameModal");
}

function applyMarketMover() {
  const total = Number(elDiceTotal.value);
  if (!Number.isFinite(total) || total < 2 || total > 12) {
    alert("Dice total must be between 2 and 12.");
    return;
  }

  const band = diceBand(total);

  const selections = [];
  for (const box of [...elIndustryList.querySelectorAll(".industry-box")]) {
    const chk = box.querySelector(".indCheck");
    if (!chk.checked) continue;
    const ind = box.dataset.industry;
    const dir = box.querySelector(".indDir").value;
    selections.push({ industry: ind, dir });
  }

  if (selections.length === 0) {
    alert("Select at least one industry.");
    return;
  }

  const deltas = [];

     pushUndo(`Market Mover (${selections.map(s => s.industry).join(", ")})`);

  for (const sel of selections) {
    const affected = getActiveStocks().filter(s => s.industries.includes(sel.industry));
    for (const stock of affected) {
      const move = stock.moves[band];
      const signed = sel.dir === "up" ? move : -move;

      const before = state.prices[stock.symbol] ?? stock.start;
      const after = clampPrice(before + signed);
      state.prices[stock.symbol] = after;
      if (after === 0) dissolveCompany(stock.symbol, `Market mover (${sel.industry} ${sel.dir === "up" ? "↑" : "↓"}) moved it to $0`);

      deltas.push(`${stock.symbol} ${signed >= 0 ? "+" : ""}${signed} → $${fmtMoney(after)}`);
    }
  }

  addLog(
    `Market Mover: dice ${total} (${band}) • ` +
    selections.map(s => `${s.industry} ${s.dir === "up" ? "↑" : "↓"}`).join(", ") +
    `<br><span class="mini muted">${deltas.join(" • ")}</span>`
  );
   
   // ✅ CASH SOUND on market move
  playCashSfx();

   clearMarketMoverSelections();

  renderAll();
  saveState();
}

function payDividends() {
  if (!state.started) return;

  const nextBell = Number(state.openingBells || 0) + 1;

  const maxBells = getMaxOpeningBells();
   if (!confirm(`Confirm Opening Bell #${nextBell} of ${maxBells}?\n\nThis will pay dividends to all players.`)) {
    return;
  }

     pushUndo(`Opening Bell #${nextBell}`);
   
   // 🔔 Bell sound (host only when live)
   if (!live.enabled || live.isHost) {
     playSound("openingBell");
   }

  // ₿ Crypto + Housing market swings (Volatility Mode only)
  if (state.volatilityMode) {
    applyCryptoOpeningBellMove();
    applyHousingOpeningBellMove();
  }

  let totalPaid = 0;

  for (const p of state.players) {
    ensureHoldings(p);
    let paid = 0;
    for (const s of getActiveStocks()) {
     if (isDissolved(s.symbol)) continue;
      const shares = p.holdings[s.symbol] || 0;
      if (shares <= 0) continue;
      paid += shares * s.dividend;
    }
    p.cash += paid;
    totalPaid += paid;
    addLog(`${p.name} collected dividends: $${fmtMoney(paid)}.`);
  }

  state.openingBells = nextBell;

  addLog(`Opening Bell #${state.openingBells} dividends paid (total: $${fmtMoney(totalPaid)}).`);

  renderAll();
  saveState();

  if (state.openingBells >= maxBells) {
     addLog(`⏱️ Year ${maxBells} reached — ending game.`);
     endGame(true); // force end + record winner (does NOT leave live)
   }

}

function shortMove() {
  if (!state.started) return;

  const sym = elShortMoveSymbol.value;
  const dir = elShortMoveDir.value;
  const signed = dir === "up" ? 8 : -8;
  const label = dir === "up" ? "Short Squeeze (+8)" : "Short Sell (-8)";

  const before = state.prices[sym] ?? getStock(sym).start;
  const after = clampPrice(before + signed);

  const ok = confirm(
    `Confirm ${label}\n\n` +
    `${sym}: $${fmtMoney(before)} → $${fmtMoney(after)}`
  );
  if (!ok) return;

     pushUndo(`${label}: ${sym} ${signed >= 0 ? "+" : ""}${signed}`);

  // ✅ THIS was missing:
  state.prices[sym] = after;
   if (after === 0) dissolveCompany(sym, `Short move (${signed >= 0 ? "+" : ""}${signed}) moved it to $0`);

  addLog(`Short Move: ${sym} ${signed >= 0 ? "+" : ""}${signed} → $${fmtMoney(after)}`);

   // ✅ CASH SOUND on market move
  playCashSfx();

  renderAll();
  saveState();
}


function openCashDialog(playerId) {
  if (!assertHostAction()) return;

  const p = state.players.find(x => x.id === playerId);
  if (!p) return;

  const raw = prompt(
    `${p.name}\n\nCurrent cash: $${fmtMoney(p.cash)}\n\nEnter amount to ADD/SUBTRACT (ex: 5000 or -5000):`,
    "0"
  );
  if (raw === null) return;

  const delta = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(delta)) {
    alert("Please enter a valid number (ex: 5000 or -5000).");
    return;
  }

  const old = Number(p.cash || 0);
    // Allow negative cash (fees can push cash below $0; player can recover by selling assets)
  const next = Math.round(old + delta);

  pushUndo(`Cash adjust ${delta >= 0 ? "+" : ""}${fmtMoney(delta)} (${p.name})`);

  p.cash = next;

  addLog(
    `${p.name} cash adjusted: $${fmtMoney(old)} → $${fmtMoney(p.cash)} ` +
    `(${delta >= 0 ? "+" : ""}$${fmtMoney(delta)}).`
  );

  playCashSfx();
  renderAll();
  saveState();
}


function doCryptoTrade(playerId, act, symbol, units) {
  if (!assertHostAction()) return false;

  if (!state.volatilityMode) {
    alert("Crypto Market is only available in Volatility Mode.");
    return false;
  }

  const p = state.players.find(x => x.id === playerId);
  if (!p) return false;
  ensureHoldings(p);

  const c = getCrypto(symbol);
  if (!c) {
    alert("Unknown crypto symbol.");
    return false;
  }

  if (!Number.isFinite(units) || units <= 0 || units % 100 !== 0) {
    alert("Units must be 100, 200, 300...");
    return false;
  }

  const isBuy = act === "BUY";
  const isSell = act === "SELL";
  if (!isBuy && !isSell) {
    alert("Invalid trade action.");
    return false;
  }

  const startPrice = state.cryptoPrices?.[symbol] ?? c.start;

  // ---- Crypto slippage pricing (smaller than stock slippage) ----
  const exec = simulateCryptoSlippage(symbol, isBuy ? +units : -units);
  if (!exec) {
    alert("Unable to price this crypto trade.");
    return false;
  }

  const total = exec.execTotal;   // BUY = cost, SELL = proceeds
  const avgPrice = exec.avgPrice;
  const endPrice = exec.finalPrice;

  const verb = isBuy ? "BUY" : "SELL";
  const confirmMsg =
    `${p.name}\n\n` +
    `${verb} ${units} units of ${symbol}\n` +
    `Avg Price: $${fmtMoney(avgPrice)} per unit\n` +
    `Start: $${fmtMoney(startPrice)}  →  End: $${fmtMoney(endPrice)}\n\n` +
    `${isBuy ? "Total Cost" : "Total Proceeds"}: $${fmtMoney(total)}\n\n` +
    `Confirm this trade?`;

  if (!confirm(confirmMsg)) return false;

  // ---- Validation based on FINAL slippage total ----
  if (isBuy) {
    if ((p.cash || 0) < total) {
      alert(`${p.name} doesn’t have enough cash. Needs $${fmtMoney(total)}, has $${fmtMoney(p.cash)}.`);
      return false;
    }
  } else {
    const owned = p.cryptoHoldings?.[symbol] || 0;
    if (owned < units) {
      alert(`${p.name} doesn’t have enough units to sell. Has ${owned}.`);
      return false;
    }
  }

  pushUndo(`${act} ${units} ${symbol} (CRYPTO) (${p.name})`);

  // ---- Apply trade ----
  if (isBuy) {
    p.cash -= total;
    p.cryptoHoldings[symbol] = (p.cryptoHoldings[symbol] || 0) + units;
  } else {
    p.cryptoHoldings[symbol] = (p.cryptoHoldings[symbol] || 0) - units;
    p.cash += total;
  }

  // ---- Apply crypto price impact AFTER fill ----
  state.cryptoPrices[symbol] = endPrice;

  addLog(
    `${p.name} ${verb} ${units} ${symbol} avg $${fmtMoney(avgPrice)} = $${fmtMoney(total)} ` +
    `(start $${fmtMoney(startPrice)} → end $${fmtMoney(endPrice)}) (crypto).`
  );

  playCashSfx();

  renderAll();
  saveState();
  return true;
}

function doTrade(playerId, act, symbol, shares) {
  if (!assertHostAction()) return false;

  const p = state.players.find(x => x.id === playerId);
  if (!p) return false;
  ensureHoldings(p);

  const stock = getStock(symbol);
  if (!stock) {
    alert("Unknown symbol.");
    return false;
  }

  if (!Number.isFinite(shares) || shares <= 0 || shares % 100 !== 0) {
    alert("Shares must be 100, 200, 300...");
    return false;
  }

  const isBuy = act === "BUY";
  const isSell = act === "SELL";
  if (!isBuy && !isSell) {
    alert("Invalid trade action.");
    return false;
  }

  // ---- Slippage simulator (does NOT mutate state) ----
  function simulateSlippage(symbol, signedShares) {
    const s = getStock(symbol);
    if (!s) return null;

    let start = state.prices[symbol] ?? s.start;
    if (!Number.isFinite(start)) start = s.start;

    const totalShares = Math.abs(signedShares);
    const buy = signedShares > 0;

    // Tune knobs (you can tweak these)
    const LOT_SIZE = 100;               // matches your UI
    const SHARES_PER_TICK = 2000;       // every 2,000 shares => $1 move
    const MAX_PCT_PER_TRADE = 0.25;     // cap total move per trade (25%)

    const ticksTotal = Math.floor(totalShares / SHARES_PER_TICK);
    if (ticksTotal <= 0) {
      const execTotal = totalShares * start;
      return { execTotal, avgPrice: start, finalPrice: start, ticksApplied: 0 };
    }

    const capTicks = Math.max(1, Math.round(start * MAX_PCT_PER_TRADE));
    const ticksApplied = Math.min(ticksTotal, capTicks);

    const lots = Math.ceil(totalShares / LOT_SIZE);
    const ticksPerLot = ticksApplied / lots; // fractional tick distribution

    let remaining = totalShares;
    let execTotal = 0;
    let current = start;

    for (let i = 0; i < lots; i++) {
      const lotShares = Math.min(LOT_SIZE, remaining);
      remaining -= lotShares;

      execTotal += lotShares * current;

      current = current + (buy ? +ticksPerLot : -ticksPerLot);
         if (current <= 0) {
           current = 0;
           break;
         }
      if (current <= 0) {
        current = 0;
        break;
      }
    }

    const finalPrice = clampPrice(current);
    const avgPrice = execTotal / totalShares;
    return { execTotal, avgPrice, finalPrice, ticksApplied };
  }

  // ---- Compute pricing (volatility mode = slippage; normal = flat price) ----
  const startPrice = state.prices[symbol] ?? stock.start;
  let exec = null;

  if (state.volatilityMode) {
    exec = simulateSlippage(symbol, isBuy ? +shares : -shares);
    if (!exec) {
      alert("Unable to price this trade.");
      return false;
    }
  }

  const flatTotal = shares * startPrice;
  const total = exec ? exec.execTotal : flatTotal;
  const avgPrice = exec ? exec.avgPrice : startPrice;
  const endPrice = exec ? exec.finalPrice : startPrice;

  // ---- Confirm message (shows slippage details when enabled) ----
  const verb = isBuy ? "BUY" : "SELL";
  const confirmMsg =
    `${p.name}\n\n` +
    `${verb} ${shares} shares of ${symbol}\n` +
    `Avg Price: $${fmtMoney(avgPrice)} per share\n` +
    (state.volatilityMode
      ? `Start: $${fmtMoney(startPrice)}  →  End: $${fmtMoney(endPrice)}\n`
      : `@ $${fmtMoney(startPrice)} per share\n`) +
    `\nTotal: $${fmtMoney(total)}\n\n` +
    `Confirm this trade?`;

  if (!confirm(confirmMsg)) return false;

  // ---- Validation (cash/owned) based on FINAL slippage total ----
  if (isBuy) {
    if (p.cash < total) {
      alert(`${p.name} doesn’t have enough cash. Needs $${fmtMoney(total)}, has $${fmtMoney(p.cash)}.`);
      return false;
    }
  } else {
    const owned = p.holdings[symbol] || 0;
    if (owned < shares) {
      alert(`${p.name} doesn’t have enough shares to sell. Has ${owned}.`);
      return false;
    }
  }

   pushUndo(`${act} ${shares} ${symbol} (${p.name})`);

  // ---- Apply trade ----
  if (isBuy) {
    p.cash -= total;
    p.holdings[symbol] = (p.holdings[symbol] || 0) + shares;
  } else {
    p.holdings[symbol] = (p.holdings[symbol] || 0) - shares;
    p.cash += total;
  }

  // ---- Apply market price impact AFTER fill (vol mode only) ----
  if (state.volatilityMode && exec) {
    state.prices[symbol] = endPrice;

    if (endPrice === 0) {
      dissolveCompany(symbol, "Order flow impact pushed it to $0");
    }
  }

  // ---- Log ----
  if (state.volatilityMode && exec) {
    addLog(
      `${p.name} ${verb} ${shares} ${symbol} avg $${fmtMoney(avgPrice)} = $${fmtMoney(total)} ` +
      `(start $${fmtMoney(startPrice)} → end $${fmtMoney(endPrice)}).`
    );
  } else {
    addLog(`${p.name} ${verb} ${shares} ${symbol} @ $${fmtMoney(startPrice)} = $${fmtMoney(total)}.`);
  }

     // ---- Log ----
  if (state.volatilityMode && exec) {
    addLog(
      `${p.name} ${verb} ${shares} ${symbol} avg $${fmtMoney(avgPrice)} = $${fmtMoney(total)} ` +
      `(start $${fmtMoney(startPrice)} → end $${fmtMoney(endPrice)}).`
    );
  } else {
    addLog(`${p.name} ${verb} ${shares} ${symbol} @ $${fmtMoney(startPrice)} = $${fmtMoney(total)}.`);
  }

  // ✅ CASH SOUND on successful trade
  playCashSfx();

  renderAll();
  saveState();
  return true;
}

function printGameLog() {
  const title = "Market Mayhem Helper — Game Log";
  const sessionLine = state.started
    ? `Session created: ${state.createdAt || ""} • Players: ${state.players.length}`
    : "No session loaded";

  const rows = state.log
    .slice()               // copy
    .reverse()             // print oldest -> newest
    .map(item => `
      <div class="row">
        <div class="ts">${item.ts}</div>
        <div class="txt">${item.text}</div>
      </div>
    `)
    .join("");

  const win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up blocked. Allow pop-ups to print/export the log.");
    return;
  }

  win.document.open();
  win.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>${title}</title>
      <style>
        :root{ font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
        body{ margin:24px; color:#000; }
        h1{ margin:0 0 6px; font-size:18px; }
        .sub{ margin:0 0 18px; color:#333; font-size:12px; }
        .row{ padding:10px 0; border-bottom:1px solid #ddd; }
        .ts{ font-size:11px; color:#444; margin-bottom:4px; }
        .txt{ font-size:12px; }
        .txt .mini{ color:#444; font-size:11px; }
        @media print{ body{ margin:0.5in; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="sub">${sessionLine}</div>
      ${rows || `<div class="sub">No log entries yet.</div>`}
      <script>
        window.onload = () => window.print();
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

function endGame(force = false) {
  if (!state.started) return;

  if (!force) {
    if (!confirm("End game and record results to the leaderboard?")) return;
  }

  // compute standings
  const standings = state.players.map(p => ({
    id: p.id,
    name: p.name,
    assets: computePlayerNetWorth(p)
  }));

  standings.sort((a, b) => b.assets - a.assets);

  const winner = standings[0]?.name || "Unknown";
  const placements = standings.map((s, i) => ({
    place: i + 1,
    name: s.name,
    assets: s.assets
  }));

  // leaderboard entry
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `g_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ts: nowTs(),
    winner,
    placements
  };

  // ✅ Always store locally (host device)
  leaderboard.push(entry);
  saveLeaderboard();

  // ✅ ALSO store to the live room (shared) if host is live
  if (live.enabled && live.isHost && fb.ready && live.sid) {
    pushLeaderboardEntryToCloud(entry);
  }

  renderLeaderboard();

  addLog(
    `🏁 Game Ended — Winner: <strong>${winner}</strong><br>` +
    `<span class="mini muted">` +
    placements.map(p => `#${p.place} ${p.name} ($${fmtMoney(p.assets)})`).join(" • ") +
    `</span>`
  );

  // end THIS GAME, but keep the live room
  state.started = false;
   updateVolatilityPill();
  renderAll();
  saveState();

  // Push final state to viewers (so they see game ended + can view leaderboard)
  if (live.enabled && live.isHost) pushStateToCloud();
}


function payDividendsConfirmed() {
  if (!state.started) return;

  const ok = confirm(
    "Pay Opening Bell dividends to ALL players?\n\nThis will add dividends to each player's cash based on current holdings."
  );
  if (!ok) return;

  payDividends();
}

// ---------- Events ----------
elPlayerCount.addEventListener("change", buildSetupInputs);
elBtnStart.addEventListener("click", () => {
  if (state.started) {
    const ok = confirm(
      "⚠️ Rebuild Session?\n\n" +
      "This will END the current game and RESET:\n" +
      "• All player cash & holdings\n" +
      "• All stock prices\n" +
      "• The game log\n\n" +
      "This action cannot be undone."
    );
    if (!ok) return;
  }

  startSession();
});


elBtnApplyMarketMover.addEventListener("click", applyMarketMover);
elBtnPayDividends.addEventListener("click", payDividendsConfirmed);
elBtnShortMove.addEventListener("click", shortMove);
if (elBtnCryptoMarket) elBtnCryptoMarket.addEventListener("click", openCryptoModal);
if (elBtnHousingMarket) elBtnHousingMarket.addEventListener("click", openHousingModal);

// Housing modal controls
if (elHousingMinus1) elHousingMinus1.addEventListener("click", () => setHousingUnits((Number(state.housingTradeUnits)||1) - 1));
if (elHousingPlus1)  elHousingPlus1.addEventListener("click", () => setHousingUnits((Number(state.housingTradeUnits)||1) + 1));
if (elHousingMax)    elHousingMax.addEventListener("click", () => {
  const pid = elHousingPlayer?.value || state.activePlayerId;
  const p = state.players.find(x => x.id === pid) || state.players[0];
  if (!p) return;
  setHousingUnits(getHousingMaxUnits(p) || 1);
});
if (elHousingPlayer) elHousingPlayer.addEventListener("change", () => updateHousingPreview());
if (elHousingBuy)    elHousingBuy.addEventListener("click", () => doHousingTrade("buy"));
if (elHousingSell)   elHousingSell.addEventListener("click", () => doHousingTrade("sell"));
if (elHousingSellAll)elHousingSellAll.addEventListener("click", () => doHousingTrade("sellAll"));


document.addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="editPrice"]');
  if (!btn) return;
  openPriceEditor(btn.dataset.symbol);
});


elBtnReset.addEventListener("click", resetState);

elBtnPrintLog.addEventListener("click", printGameLog);

elBtnEndSession.addEventListener("click", () => {
  if (!state.started) return;

  const ok = confirm(
    "🏁 End Session?\n\n" +
    "This will:\n" +
    "• Finalize all player assets\n" +
    "• Record the results to the leaderboard\n" +
    "• Close the current game\n\n" +
    "You cannot resume this session once ended."
  );

  if (!ok) return;

    endGame();
});

elBtnClearLeaderboard.addEventListener("click", clearLeaderboard);


if (elBtnLeaderboardViewSummary) {
  elBtnLeaderboardViewSummary.addEventListener("click", () => {
    leaderboardView = "summary";
    renderLeaderboard();
  });
}
if (elBtnLeaderboardViewGames) {
  elBtnLeaderboardViewGames.addEventListener("click", () => {
    leaderboardView = "games";
    renderLeaderboard();
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-lb-del]");
  if (!btn) return;
  deleteLeaderboardGameById(btn.getAttribute("data-lb-del"));
});

document.addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="pitBuy"]');
  if (!btn) return;
  openPitBuy(btn.dataset.symbol);
});

document.addEventListener("click", (e) => {
  // (capture listener) allow pit-board trade clicks to work even if other handlers stop propagation
  // ignore clicks on checkboxes or edit price button
  if (e.target.closest(".pitSelect")) return;
  if (e.target.closest('[data-action="editPrice"]')) return;

  const trg = e.target.closest('[data-action="tradeStock"]');
  if (!trg) return;

  openTradeModalForStock(trg.dataset.symbol);
}, true);


// Fallback: also bind to pit-board containers directly (some mobile/live browsers can miss document-level delegation)
function pitTradeClickHandler(e){
  // ignore checkboxes and edit buttons
  if (e.target.closest(".pitSelect")) return;
  if (e.target.closest('[data-action="editPrice"]')) return;

  const trg = e.target.closest('[data-action="tradeStock"]');
  if (!trg) return;
  openTradeModalForStock(trg.dataset.symbol);
}
if (elPitTableBody) elPitTableBody.addEventListener("click", pitTradeClickHandler, true);
if (elPitCards) elPitCards.addEventListener("click", pitTradeClickHandler, true);

document.addEventListener("click", (e) => {
  const trg = e.target.closest('[data-action="tradeCrypto"]');
  if (!trg) return;
  openTradeModalForCrypto(trg.dataset.symbol);
});

(function initGlobalClickSound() {
  let lastTs = 0;
  const MIN_INTERVAL = 18; // lower for fast mobile tapping

  // Unlock audio on first user gesture (required for iOS)
  document.addEventListener("pointerdown", unlockUIClickAudioOnce, { once: true });

  document.addEventListener("pointerdown", (e) => {
    const now = Date.now();
    if (now - lastTs < MIN_INTERVAL) return;
    lastTs = now;

    const el = e.target.closest(
      `button,a,[role="button"],[data-action],
       .pitLink,.pitPriceBtn,.avatarBtn,.avatarOption,.maxBtn`
    );
    if (!el) return;

    if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
    if (e.target.closest("input, textarea, select")) return;

    // Host-only during live sessions (keep if you want)
    if (live?.enabled && !live?.isHost) return;

    // Prefer WebAudio click (mobile reliable); fallback to HTMLAudio if not ready
    if (uiClickBuffer && uiAudioCtx) {
      playUIClickFast();
    } else {
      playSound("uiClick");
    }
  }, { passive: true });
})();


// Live Session buttons
if (elBtnLiveCreate) {
  elBtnLiveCreate.addEventListener("click", () => {
    if (!fb.ready) return alert("Firebase not ready. Paste config + refresh.");
    createLiveSession();
  });
}

if (elBtnLiveJoin) {
  elBtnLiveJoin.addEventListener("click", () => {
    if (!fb.ready) return alert("Firebase not ready. Paste config + refresh.");
    joinLiveSession(elLiveJoinCode.value);
  });
}

if (elBtnCopyLiveLink) {
  elBtnCopyLiveLink.addEventListener("click", async () => {
    const txt = (elLiveShareLink && elLiveShareLink.value) ? elLiveShareLink.value : "";
    if (!txt) return alert("No live link yet. Create or join a session first.");
    try {
      await navigator.clipboard.writeText(txt);
      alert("Link copied!");
    } catch {
      // fallback
      prompt("Copy this link:", txt);
    }
  });
}

if (elBtnLiveLeave) {
  elBtnLiveLeave.addEventListener("click", () => {
    if (live.isHost) {
      // Host leaving does not delete the session doc (keeps it simple).
      // If you want host leaving to END the session for everyone, we can do that next.
      if (!confirm("Leave live session? Viewers will stop receiving updates.")) return;
    }
    leaveLiveSession();
  });
}

// ---------- Collapsible Sections ----------
const COLLAPSE_KEY = "mm_collapsed_sections_v1";

const COLLAPSIBLE_SECTIONS = [
  { key: "setup",      btnId: "btnToggleSetup",       bodyId: "sessionSetupBody" },
  { key: "mover",      btnId: "btnToggleMarketMover", bodyId: "marketMoverBody" },
   { key: "tools", btnId: "btnToggleTools", bodyId: "toolsBody" },
  { key: "pit",        btnId: "btnTogglePitBoard",    bodyId: "pitBoardBody" },
  { key: "players",    btnId: "btnTogglePlayers",     bodyId: "playersBody" },
  { key: "log",        btnId: "btnToggleLog",         bodyId: "logBody" },
  { key: "leaderboard",btnId: "btnToggleLeaderboard", bodyId: "leaderboardBody" },
];

function loadCollapsedMap() {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveCollapsedMap(map) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map || {}));
}

function applySectionCollapsed(sectionKey, collapsed) {
  const map = loadCollapsedMap();
  map[sectionKey] = !!collapsed;
  saveCollapsedMap(map);

  const def = COLLAPSIBLE_SECTIONS.find(s => s.key === sectionKey);
  if (!def) return;

  const body = document.getElementById(def.bodyId);
  const btn  = document.getElementById(def.btnId);
  if (!body || !btn) return;

  body.style.display = collapsed ? "none" : "";
  btn.textContent = collapsed ? "Show" : "Collapse";
}

function initCollapsibleSections() {
  const map = loadCollapsedMap();

  for (const def of COLLAPSIBLE_SECTIONS) {
    const btn = document.getElementById(def.btnId);
    const body = document.getElementById(def.bodyId);
    if (!btn || !body) continue;

    // apply saved state (default expanded)
    const collapsed = !!map[def.key];
    body.style.display = collapsed ? "none" : "";
    btn.textContent = collapsed ? "Show" : "Collapse";

    btn.addEventListener("click", () => {
      const isCollapsed = body.style.display === "none";
      applySectionCollapsed(def.key, !isCollapsed);
    });
  }
}


// Pit board: filter
if (elPitIndustryFilter) {
  elPitIndustryFilter.addEventListener("change", () => {
    pitFilterIndustry = elPitIndustryFilter.value || "ALL";

    // 🔥 CLEAR SELECTIONS when filter changes
    pitSelected.clear();
    updatePitSelectedUI();
    if (elPitSelectAll) elPitSelectAll.checked = false;

    renderPitBoard();
  });
}


// Pit board: sort toggle button
function togglePitSort() {
  pitSortMode = pitSortMode === "off" ? "asc" : (pitSortMode === "asc" ? "desc" : "off");
  if (elPitSortCur) {
    elPitSortCur.textContent =
      pitSortMode === "off" ? "Sort Current: Off" :
      pitSortMode === "asc" ? "Sort Current: Low → High" :
      "Sort Current: High → Low";
  }
  renderPitBoard();
}
if (elPitSortCur) elPitSortCur.addEventListener("click", togglePitSort);
if (elPitCurHeader) elPitCurHeader.addEventListener("click", togglePitSort);

// Pit board: select checkboxes (table + mobile)
document.addEventListener("change", (e) => {
  const chk = e.target.closest(".pitSelect");
  if (!chk) return;

  const sym = chk.getAttribute("data-symbol");
  if (!sym) return;

  if (chk.checked) pitSelected.add(sym);
  else pitSelected.delete(sym);

  updatePitSelectedUI();
  renderPitBoard(); // keeps select-all synced + re-renders both table/cards
});

// Pit board: select all visible
if (elPitSelectAll) {
  elPitSelectAll.addEventListener("change", () => {
    const list = getVisibleStocks();
    if (elPitSelectAll.checked) {
      list.forEach(s => pitSelected.add(s.symbol));
    } else {
      list.forEach(s => pitSelected.delete(s.symbol));
    }
    updatePitSelectedUI();
    renderPitBoard();
  });
}

// Pit board: bulk adjust buttons
if (elPitBulkMinus) elPitBulkMinus.addEventListener("click", () => applyBulkToSelected(-1));
if (elPitBulkPlus) elPitBulkPlus.addEventListener("click", () => applyBulkToSelected(+1));

// Pit board: clear selection
if (elPitClearSelected) {
  elPitClearSelected.addEventListener("click", () => {
    pitSelected.clear();
    updatePitSelectedUI();
    renderPitBoard();
  });
}

// -----------------------------
// Settings modal wiring
// -----------------------------
function openSettingsModal() {
  const m = document.getElementById("settingsModal");
  if (!m) return;
  m.hidden = false;
  syncSettingsUI();
}

function closeSettingsModal() {
  const m = document.getElementById("settingsModal");
  if (!m) return;
  m.hidden = true;
}

function syncSettingsUI() {
  const musicMuteBtn = document.getElementById("musicMuteBtn");
  const sfxMuteBtn = document.getElementById("sfxMuteBtn");
  const musicVol = document.getElementById("musicVolume");
  const sfxVol = document.getElementById("sfxVolume");
  const musicVal = document.getElementById("musicVolumeVal");
  const sfxVal = document.getElementById("sfxVolumeVal");

  if (musicVol) musicVol.value = String(audioSettings.musicVolume);
  if (sfxVol) sfxVol.value = String(audioSettings.sfxVolume);

  if (musicVal) musicVal.textContent = `${audioSettings.musicVolume}%`;
  if (sfxVal) sfxVal.textContent = `${audioSettings.sfxVolume}%`;

  if (musicMuteBtn) musicMuteBtn.textContent = audioSettings.musicMuted ? "Unmute" : "Mute";
  if (sfxMuteBtn) sfxMuteBtn.textContent = audioSettings.sfxMuted ? "Unmute" : "Mute";
}

function initSettingsModal() {
  const btn = document.getElementById("btnSettings");
  const modal = document.getElementById("settingsModal");
  const closeBtn = document.getElementById("settingsClose");

  const musicMuteBtn = document.getElementById("musicMuteBtn");
  const sfxMuteBtn = document.getElementById("sfxMuteBtn");
  const musicVol = document.getElementById("musicVolume");
  const sfxVol = document.getElementById("sfxVolume");

  if (btn) btn.addEventListener("click", openSettingsModal);
  if (closeBtn) closeBtn.addEventListener("click", closeSettingsModal);

  // click outside closes
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeSettingsModal();
    });
  }

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettingsModal();
  });

  if (musicMuteBtn) {
    musicMuteBtn.addEventListener("click", () => {
      audioSettings.musicMuted = !audioSettings.musicMuted;
      saveAudioSettings();
      applyMusicSettings();
      syncSettingsUI();
    });
  }

  if (sfxMuteBtn) {
    sfxMuteBtn.addEventListener("click", () => {
      audioSettings.sfxMuted = !audioSettings.sfxMuted;
      saveAudioSettings();
      syncSettingsUI();
    });
  }

  if (musicVol) {
    musicVol.addEventListener("input", () => {
      audioSettings.musicVolume = Number(musicVol.value) || 0;
      saveAudioSettings();
      applyMusicSettings();
      syncSettingsUI();
    });
  }

  if (sfxVol) {
    sfxVol.addEventListener("input", () => {
      audioSettings.sfxVolume = Number(sfxVol.value) || 0;
      saveAudioSettings();
      syncSettingsUI();
    });
  }
}

// ---------- Init ----------
function init() {
  loadState();
  syncVolatilityUIFromState();

  loadLeaderboard();
  renderLeaderboard();

  buildSetupInputs();
   wireVolatilityModeEnhancers();
  buildIndustryUI();
  buildShortMoveUI();
  buildPitControlsUI();

  if (state.started) {
    for (const p of state.players) ensureHoldings(p);
  }

   loadUndoStack();
   updateUndoButton();
   
   document.getElementById("btnUndo")?.addEventListener("click", undoLastAction);

  renderAll();
     updateVolatilityPill();

  // ✅ this now runs, because init() no longer crashes
    initCollapsibleSections();
     initSetupModals();
}

// init is called from app.boot.js
