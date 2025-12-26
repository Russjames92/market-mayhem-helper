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
  { symbol:"NOVA",  name:"NovaDyne Systems",        industries:["Technology", "Defense"], start:18, dividend:0.5, moves:{low:10, mid:8, high:6} },
  { symbol:"VOLT",  name:"VoltEdge Energy",        industries:["Energy"], start:22, dividend:1, moves:{low:10, mid:8, high:6} },
  { symbol:"CRSH",  name:"CrashLoop Logistics",    industries:["Transportation"], start:16, dividend:0.25, moves:{low:10, mid:8, high:6} },
  { symbol:"PULSE", name:"PulseWave Biotech",      industries:["Healthcare", "Defense", "Technology", "Manufacturing", "Energy"], start:6, dividend:0, moves:{low:10, mid:8, high:6} },
  { symbol:"STACK", name:"StackHammer Construction",industries:["Manufacturing"], start:20, dividend:1, moves:{low:10, mid:8, high:6} },
  { symbol:"FLUX",  name:"Flux Materials",         industries:["Manufacturing"], start:19, dividend:0.75, moves:{low:10, mid:8, high:6} },
  { symbol:"SPRK",  name:"SparkRoute Media",       industries:["Technology"], start:17, dividend:0.5, moves:{low:10, mid:8, high:6} },
  { symbol:"DRIFT", name:"DriftNet Retail",        industries:["Consumer"], start:21, dividend:1, moves:{low:10, mid:8, high:6} },
  { symbol:"FORGE", name:"IronForge Industrial",   industries:["Manufacturing"], start:26, dividend:2, moves:{low:10, mid:8, high:6} },
  { symbol:"SKY",   name:"SkyPierce Aerospace",    industries:["Transportation","Technology"], start:28, dividend:0.25, moves:{low:10, mid:8, high:6} }
];


const ALL_STOCKS = [...BASE_STOCKS, ...VOLATILITY_STOCKS];

// ---------- State ----------
let state = {
  started: false,
  createdAt: null,
  players: [],
  prices: {},
  dissolved: {},
  volatilityMode: false, // ✅ NEW
  log: [],
  openingBells: 0,
};


// ---------- Pit Board View State ----------
let pitFilterIndustry = "ALL"; // "ALL" or industry name
let pitSortMode = "off";       // "off" | "asc" | "desc"
let pitSelected = new Set();   // selected symbols for bulk ops

// ---------- DOM ----------
const elSessionStatus = document.getElementById("sessionStatus");
const elBtnSave = document.getElementById("btnSave");
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

// ---------- Helpers ----------
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
}
function computePlayerNetWorth(player) {
  let stockValue = 0;
  for (const [sym, shares] of Object.entries(player.holdings)) {
    const stock = getStock(sym);
    const price = state.prices[sym] ?? stock.start;
    stockValue += shares * price;
  }
  return player.cash + stockValue;
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

function openPriceEditor(symbol) {
   if (!assertHostAction()) return;
   if (!state.started) {
    alert("Start a session first to manually set prices.");
    return;
  }

  const stock = getStock(symbol);
  if (!stock) return;

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
  const elVol = document.getElementById("volatilityMode");
  const elCash = document.getElementById("startingCash");
  if (!elVol || !elCash) return;

  const applyDefaults = () => {
    if (state.started) return;
    elCash.value = elVol.checked ? "1000000" : "50000";
    renderOpeningBellCounter();
  };

  elVol.addEventListener("change", applyDefaults);
  applyDefaults();
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
            <div class="mini muted" style="min-width:52px;">Stock</div>
            <div style="font-weight:900;" id="mmTradeStockLabel">—</div>
          </div>

          <div class="mmTradeShares">
            <button type="button" id="mmTradeDown">-100</button>
            <div class="mini" style="min-width:140px; text-align:center;">
              Shares: <strong id="mmTradeShares">100</strong>
            </div>
            <button type="button" id="mmTradeUp">+100</button>
            <button type="button" id="modalSharesMax">MAX</button>
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
   // modal MAX button (use modal state, not player-card vars)
   const elMax = document.getElementById("modalSharesMax");
   elMax.onclick = () => {
     const pid = tradeModalState.playerId;
     const sym = tradeModalState.symbol;
   
     const player = state.players.find(p => p.id === pid);
     const stock = getStock(sym);
     if (!player || !stock) return;
   
     const price = state.prices[sym] ?? stock.start;
     if (!Number.isFinite(price) || price <= 0) {
       alert("Invalid stock price.");
       return;
     }
   
     // max shares affordable, rounded DOWN to nearest 100
     const maxLots = Math.floor(player.cash / (price * 100));
     const maxShares = maxLots * 100;
   
     // if they can't afford 100, keep it at 100 (same behavior as player section)
     tradeModalState.shares = Math.max(100, maxShares);
   
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

  tradeModalEl.classList.add("open");
}

function closeTradeModal() {
  if (!tradeModalEl) return;
  tradeModalEl.classList.remove("open");
}

function renderTradeModalPreview() {
  const sym = tradeModalState.symbol;
  const stock = getStock(sym);
  if (!sym || !stock) return;

  document.getElementById("mmTradeShares").textContent = String(tradeModalState.shares);

  const price = state.prices[sym] ?? stock.start;
  const total = tradeModalState.shares * price;

  const p = state.players.find(x => x.id === tradeModalState.playerId);
  if (!p) return;
  ensureHoldings(p);

  const owned = p.holdings[sym] || 0;

  // enable/disable sell all
  const sellAllBtn = document.getElementById("mmTradeSellAll");
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
    document.body.classList.add("modalOpen");
  }

  function closeModal(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    // if both modals are closed, unlock body
    if ((liveModal?.hidden ?? true) && (newGameModal?.hidden ?? true)) {
      document.body.classList.remove("modalOpen");
    }
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
   if (state.volatilityMode == null) state.volatilityMode = false;
  if (!raw) return;
  try { state = JSON.parse(raw); } catch { /* ignore */ }

   if (state.openingBells == null) state.openingBells = 0;
   if (!state.dissolved) state.dissolved = {};
}
function resetState() {
  if (!confirm("Reset session? This clears players, prices, and log.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = { started:false, createdAt:null, players:[], prices:{}, dissolved:{}, volatilityMode: false, log:[], openingBells:0 };
  buildSetupInputs();
  buildIndustryUI();
  buildShortMoveUI();
  renderAll();
}

function syncVolatilityUIFromState() {
  const elVol = document.getElementById("volatilityMode");
  if (elVol) elVol.checked = !!state.volatilityMode;
}
// ---------- Live Session (Firebase) ----------
function setLiveUI() {
  const role = !live.enabled ? "OFF" : (live.isHost ? `HOST • ${live.sid}` : `VIEWER • ${live.sid}`);
  if (elLiveRolePill) elLiveRolePill.textContent = `Live: ${role}`;

  const share = live.enabled ? `${location.origin}${location.pathname}?sid=${live.sid}` : "";
  if (elLiveShareLink) elLiveShareLink.value = share;

  if (elBtnLiveLeave) elBtnLiveLeave.disabled = !live.enabled;

  // Disable create/join buttons while connected
  if (elBtnLiveCreate) elBtnLiveCreate.disabled = live.enabled;
  if (elBtnLiveJoin) elBtnLiveJoin.disabled = live.enabled;

  // Viewer locks
  applyViewerLocks();
}

function isReadOnlyViewer() {
  return live.enabled && !live.isHost;
}

function applyViewerLocks() {
  const ro = isReadOnlyViewer();

  // Setup / session controls
  if (elBtnStart) elBtnStart.disabled = ro;
  if (elPlayerCount) elPlayerCount.disabled = ro;
  if (elStartingCash) elStartingCash.disabled = ro;
  if (elPlayerInputs) {
    for (const inp of elPlayerInputs.querySelectorAll("input,select,button,textarea")) {
      inp.disabled = ro;
    }
  }

  // Market mover / tools
  if (elDiceTotal) elDiceTotal.disabled = ro;
  if (elIndustryList) {
    for (const inp of elIndustryList.querySelectorAll("input,select,button")) {
      inp.disabled = ro;
    }
  }
  if (elBtnApplyMarketMover) elBtnApplyMarketMover.disabled = ro || !state.started;
  if (elBtnPayDividends) elBtnPayDividends.disabled = ro || !state.started;
  if (elBtnShortMove) elBtnShortMove.disabled = ro || !state.started;
  if (elShortMoveSymbol) elShortMoveSymbol.disabled = ro;
  if (elShortMoveDir) elShortMoveDir.disabled = ro;

  if (elBtnEndSession) elBtnEndSession.disabled = ro || !state.started;

    // Pit board controls
  // Viewers ARE allowed to filter/sort (view-only)
  if (elPitIndustryFilter) elPitIndustryFilter.disabled = false;
  if (elPitSortCur) elPitSortCur.disabled = false;

  // Viewers are NOT allowed to bulk adjust prices
  if (elPitSelectAll) elPitSelectAll.disabled = ro;      // optional (safe either way)
  if (elPitBulkAmt) elPitBulkAmt.disabled = ro;
  if (elPitBulkMinus) elPitBulkMinus.disabled = ro;
  if (elPitBulkPlus) elPitBulkPlus.disabled = ro;
  if (elPitClearSelected) elPitClearSelected.disabled = ro;

  // Header controls (Save/Reset)
  if (elBtnSave) elBtnSave.disabled = ro;   // viewers shouldn’t “save” host state
  if (elBtnReset) elBtnReset.disabled = ro; // viewers shouldn’t reset the session
}

function assertHostAction() {
  if (!isReadOnlyViewer()) return true;
  alert("Viewer mode: only the host can perform actions.");
  return false;
}

function initFirebase() {
  console.log("initFirebase() CALLED");

  const firebaseConfig = {
    apiKey: "AIzaSyC4VOmU6kXwYG-fIh0G2-m2LbJSNfaCCjs",
    authDomain: "market-mayhem-live.firebaseapp.com",
    projectId: "market-mayhem-live",
    storageBucket: "market-mayhem-live.appspot.com",
    messagingSenderId: "1089674731126",
    appId: "1:1089674731126:web:9a2825dac7f28c5be5c957"
  };

  // If user hasn't configured it yet, don't crash the whole app
  if (firebaseConfig.apiKey === "PASTE_ME") {
    if (elLiveHint) elLiveHint.textContent =
      "Firebase not configured yet. Paste firebaseConfig into app.js to enable Live Sessions.";
    return;
  }

  fb.app = firebase.initializeApp(firebaseConfig);
  fb.auth = firebase.auth();
  fb.db = firebase.firestore();

  return fb.auth.signInAnonymously()
    .then(cred => {
      fb.uid = cred.user.uid;
      fb.ready = true;
      if (elLiveHint) elLiveHint.textContent =
        "Firebase ready. Host can create a live session, or viewers can join by code/link.";

      // Auto-join if URL has ?sid=
      const sid = new URLSearchParams(location.search).get("sid");
      if (sid) {
        joinLiveSession(String(sid).trim());
      }
    })
    .catch(err => {
      console.error(err);
      if (elLiveHint) elLiveHint.textContent = "Firebase auth failed. Check console.";
    });
}

function normalizeSid(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function genSid(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function subscribeToSession(sid) {
  if (!fb.ready) {
    alert("Firebase not ready yet. Paste config + refresh.");
    return;
  }

  // Clean up existing subscription
  if (live.unsub) {
    try { live.unsub(); } catch {}
    live.unsub = null;
  }

  live.enabled = true;
  live.sid = sid;

  const ref = fb.db.collection("sessions").doc(sid);

  live.unsub = ref.onSnapshot(snap => {
    if (!snap.exists) {
      // If viewer joined a bad code, bail out
      if (!live.isHost) {
        alert("Session not found. Check the code/link.");
        leaveLiveSession();
      }
      return;
    }

    const data = snap.data() || {};
    const remoteState = data.state;
     live.leaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];
      renderLeaderboard();


    // Determine role
    live.isHost = (data.hostUid && fb.uid && data.hostUid === fb.uid);

    // Apply remote state
    if (remoteState) {
      live.applyingRemote = true;
      try {
        state = remoteState;

        // keep your defaults safe
        if (state.openingBells == null) state.openingBells = 0;

         ensurePricesForActiveStocks();
        renderAll();
        renderStatus();
      } finally {
        live.applyingRemote = false;
      }
    }

    setLiveUI();
      // Start/refresh presence AFTER role is determined
     stopPresence();
     startPresence();

  });

  setLiveUI();
}

function createLiveSession() {
  if (!fb.ready) {
    alert("Firebase not ready yet. Paste config + refresh.");
    return;
  }

  const sid = genSid(6);
  const ref = fb.db.collection("sessions").doc(sid);

  // Host becomes authoritative
  return ref.set({
    hostUid: fb.uid,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    state: state
  }).then(() => {
    live.enabled = true;
    live.sid = sid;
    live.isHost = true;

    // Subscribe (so host UI updates too)
    subscribeToSession(sid);

    // Update URL
    const url = new URL(location.href);
    url.searchParams.set("sid", sid);
    history.replaceState({}, "", url.toString());

    setLiveUI();
  }).catch(err => {
    console.error(err);
    alert("Failed to create session. See console.");
  });
}

function joinLiveSession(code) {
  const sid = normalizeSid(code);
  if (!sid) {
    alert("Enter a valid join code.");
    return;
  }

  live.enabled = true;
  live.sid = sid;
  live.isHost = false;

  // Update URL
  const url = new URL(location.href);
  url.searchParams.set("sid", sid);
  history.replaceState({}, "", url.toString());

  subscribeToSession(sid);
  setLiveUI();
}

function leaveLiveSession() {
  if (live.unsub) {
    try { live.unsub(); } catch {}
  }

   stopPresence();

  live = {
    enabled: false,
    sid: null,
    isHost: false,
    unsub: null,
    pushing: false,
    pushTimer: null,
    applyingRemote: false,
  };

  // Remove sid param from URL
  const url = new URL(location.href);
  url.searchParams.delete("sid");
  history.replaceState({}, "", url.toString());

  setLiveUI();
}

function schedulePushToCloud() {
  if (!live.enabled || !live.isHost || !fb.ready) return;
  if (live.applyingRemote) return;

  clearTimeout(live.pushTimer);
  live.pushTimer = setTimeout(pushStateToCloud, 180);
}

function pushStateToCloud() {
  if (!live.enabled || !live.isHost || !fb.ready) return;
  if (!live.sid) return;

  const ref = fb.db.collection("sessions").doc(live.sid);

  live.pushing = true;

  return ref.update({
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    state: state
  }).catch(err => {
    console.error(err);
    // don’t annoy user with constant alerts; one console error is enough
  }).finally(() => {
    live.pushing = false;
  });
}

function pushLeaderboardEntryToCloud(entry) {
  try {
    const ref = fb.db.collection("sessions").doc(live.sid);

    // Keep a capped array in the room doc (prevents doc bloat)
    // We'll store up to 50 games.
    ref.get().then(snap => {
      const data = snap.exists ? (snap.data() || {}) : {};
      const list = Array.isArray(data.leaderboard) ? data.leaderboard.slice() : [];
      list.push(entry);

      // cap
      const capped = list.slice(-50);

      return ref.set({ leaderboard: capped }, { merge: true });
    }).catch(() => {});
  } catch {}
}


function setViewersPill(n) {
  if (!elLiveViewersPill) return;
  if (!live.enabled) {
    elLiveViewersPill.textContent = "Viewers: —";
    return;
  }
  if (typeof n === "number") {
    elLiveViewersPill.textContent = `Viewers: ${n}`;
  } else {
    elLiveViewersPill.textContent = "Viewers: …";
  }
}

function stopPresence() {
  if (presence.timer) clearInterval(presence.timer);
  presence.timer = null;

  if (presence.unsub) {
    try { presence.unsub(); } catch {}
  }
  presence.unsub = null;

  // Try to remove our presence doc when leaving
  if (fb.ready && live.enabled && live.sid && fb.uid) {
    fb.db.collection("sessions").doc(live.sid)
      .collection("presence").doc(fb.uid)
      .delete()
      .catch(() => {});
  }

  setViewersPill(null);
}

function startPresence() {
  if (!fb.ready || !live.enabled || !live.sid || !fb.uid) return;

  const sid = live.sid;
  const presRef = fb.db.collection("sessions").doc(sid).collection("presence").doc(fb.uid);

  // heartbeat write
  const beat = () => {
    presRef.set({
      uid: fb.uid,
      role: live.isHost ? "host" : "viewer",
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
  };

  beat();
  presence.timer = setInterval(beat, 15000);

  // host listens & counts "recent" devices
  if (live.isHost) {
    const coll = fb.db.collection("sessions").doc(sid).collection("presence");

    // Update count whenever collection changes; filter "recent" in JS
    presence.unsub = coll.onSnapshot(snap => {
      const now = Date.now();
      const cutoffMs = 35000; // treat devices as connected if pinged within last 35s

      let count = 0;
      snap.forEach(doc => {
        const data = doc.data() || {};
        const ts = data.lastSeen?.toDate ? data.lastSeen.toDate().getTime() : 0;
        if (ts && (now - ts) <= cutoffMs) count += 1;
      });

      setViewersPill(count);
    });
  } else {
    // viewer: just show "Connected"
    setViewersPill(1);
  }

  // cleanup on tab close/refresh
  window.addEventListener("beforeunload", stopPresence, { once: true });
}

// ---------- UI Builders ----------
function buildSetupInputs() {
  const n = Number(elPlayerCount.value);
  elPlayerInputs.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
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
      elPitCards.appendChild(card);
    }
  }

  updatePitSelectedUI();
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

          <button type="button" class="avatarBtn" data-action="toggleAvatar">Avatar</button>
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
      ${holdingLines}
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
   renderStatus();
  renderPitBoard();
  renderPlayers();
  renderLog();

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
  const elVol = document.getElementById("volatilityMode");
   state.volatilityMode = !!elVol?.checked;
   
   let startingCash = Number(elStartingCash.value || 0);
   
   // if volatility mode is enabled and starting cash is blank or still the base default,
   // force the enhanced default
   if (state.volatilityMode && (!elStartingCash.value || startingCash === 50000)) {
     startingCash = 1000000;
     elStartingCash.value = "1000000";
   }

  const players = [];
  for (let i = 0; i < n; i++) {
    const name = (document.getElementById(`pname_${i}`)?.value || `Player ${i+1}`).trim();
    players.push({
      id: `p${i+1}`,
      name,
      cash: startingCash,
      holdings: {}
    });
  }
   
   const prices = {};
   for (const s of getActiveStocks()) {
     prices[s.symbol] = s.start;
   }
   
   state.started = true;
   state.createdAt = nowTs();
   state.players = players;
   setActivePlayer(players[0]?.id || null);
   state.prices = prices;
   state.dissolved = {};
   state.log = [];
   state.openingBells = 0;

   pitFilterIndustry = "ALL";
   pitSortMode = "off";
   pitSelected.clear();

   buildPitControlsUI();
   
  addLog(`Session started with ${n} player(s). Starting cash: $${fmtMoney(startingCash)} each.`);
  renderAll();
  saveState();
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

  // ✅ THIS was missing:
  state.prices[sym] = after;
   if (after === 0) dissolveCompany(sym, `Short move (${signed >= 0 ? "+" : ""}${signed}) moved it to $0`);

  addLog(`Short Move: ${sym} ${signed >= 0 ? "+" : ""}${signed} → $${fmtMoney(after)}`);
  renderAll();
  saveState();
}


function openCashDialog(playerId) {
   if (!assertHostAction()) return;
  const p = state.players.find(x => x.id === playerId);
  if (!p) return;

  const raw = prompt(
    `${p.name} cash is $${fmtMoney(p.cash)}.\nEnter cash adjustment (example: -3000 or 5000):`,
    "0"
  );
  if (raw == null) return;

  const delta = Number(raw);
  if (!Number.isFinite(delta)) {
    alert("That wasn’t a number.");
    return;
  }

  p.cash += delta;
  addLog(`${p.name} cash adjusted: ${delta >= 0 ? "+" : ""}${fmtMoney(delta)} → $${fmtMoney(p.cash)}.`);
  renderAll();
  saveState();
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

document.addEventListener("click", (e) => {
  const btn = e.target.closest('[data-action="editPrice"]');
  if (!btn) return;
  openPriceEditor(btn.dataset.symbol);
});

elBtnSave.addEventListener("click", () => saveState({ silent:false }));
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
  // ignore clicks on checkboxes or edit price button
  if (e.target.closest(".pitSelect")) return;
  if (e.target.closest('[data-action="editPrice"]')) return;

  const trg = e.target.closest('[data-action="tradeStock"]');
  if (!trg) return;

  openTradeModalForStock(trg.dataset.symbol);
});

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

// ---------- Init ----------
function init() {
  loadState();

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
   
  renderAll();

  // ✅ this now runs, because init() no longer crashes
    initCollapsibleSections();
     initSetupModals();
}

init();
initFirebase();
setLiveUI();
