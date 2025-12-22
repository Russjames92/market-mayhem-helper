/* Market Mayhem Helper
   - Pit board prices
   - Player cash/holdings
   - Market mover: industries + dice => auto price movement
*/

const STORAGE_KEY = "mm_helper_session_v1";

const CANON_INDUSTRIES = [
  "Consumer","Defense","Energy","Finance",
  "Healthcare","Manufacturing","Technology","Transportation"
];

// Stock definitions (start price, dividend, dice move table)
const STOCKS = [
  { symbol:"EE",   name:"Evanston Electric",   industries:["Energy"], start:95,  dividend:5,  moves:{low:12, mid:10, high:8} },
  { symbol:"ABE",  name:"Alberta Energy",      industries:["Energy"], start:125, dividend:10, moves:{low:16, mid:12, high:10} },
  { symbol:"SLR",  name:"Stuart Solar",        industries:["Energy"], start:90,  dividend:6,  moves:{low:12, mid:10, high:8} },
  { symbol:"IRV",  name:"Irving Power",        industries:["Energy"], start:30,  dividend:2,  moves:{low:4,  mid:3,  high:2} },
  { symbol:"SHB",  name:"Shetland Bank",       industries:["Finance"], start:45, dividend:3,  moves:{low:6,  mid:5,  high:4} },
  { symbol:"SHS",  name:"Sherman Steel",       industries:["Manufacturing"], start:35, dividend:2, moves:{low:4, mid:3, high:2} },
  { symbol:"BEV",  name:"Brown Beverage",      industries:["Consumer"], start:50, dividend:3,  moves:{low:6,  mid:5,  high:4} },
  { symbol:"GDN",  name:"Garden Health",       industries:["Healthcare"], start:65, dividend:3, moves:{low:6, mid:5, high:4} },
  { symbol:"FP",   name:"Founders Pharma",     industries:["Healthcare"], start:40, dividend:3, moves:{low:6, mid:5, high:4} },
  { symbol:"RUD",  name:"Rudy Insurance",      industries:["Finance"], start:90, dividend:7,  moves:{low:12, mid:10, high:8} },
  { symbol:"MM",   name:"McGinnis Motors",     industries:["Manufacturing"], start:25, dividend:2, moves:{low:4, mid:3, high:2} },
  { symbol:"DA",   name:"Darkside Digital",    industries:["Technology","Consumer"], start:100, dividend:4, moves:{low:12, mid:10, high:8} },
  { symbol:"LA",   name:"Lawnview Tek",        industries:["Technology"], start:65, dividend:3, moves:{low:6, mid:5, high:4} },
  { symbol:"ALP",  name:"Alpha Solutions",     industries:["Consumer","Healthcare","Technology"], start:75, dividend:3, moves:{low:6, mid:5, high:4} },
  { symbol:"JUNO", name:"Juno Services",       industries:["Technology","Transportation"], start:45, dividend:2, moves:{low:6, mid:5, high:4} },
  { symbol:"NEW",  name:"Newmoon Aero",        industries:["Manufacturing","Defense"], start:120, dividend:6, moves:{low:16, mid:12, high:10} },
  { symbol:"ARM",  name:"Armada Defense",      industries:["Defense"], start:60, dividend:3,  moves:{low:6, mid:5, high:4} },
  { symbol:"FLY",  name:"Flyer Infinity",      industries:["Transportation","Defense"], start:120, dividend:6, moves:{low:16, mid:12, high:10} },
  { symbol:"BAIR", name:"Bird Air",            industries:["Transportation"], start:35, dividend:2, moves:{low:4, mid:3, high:2} },
  { symbol:"LB",   name:"Liberty Logistix",    industries:["Transportation"], start:90, dividend:5, moves:{low:12, mid:10, high:8} },
];

// ---------- State ----------
let state = {
  started: false,
  createdAt: null,
  players: [],     // { id, name, cash, holdings: {SYM: shares} }
  prices: {},      // { SYM: currentPrice }
  log: [],         // { ts, text }
};

// ---------- DOM ----------
const elSessionStatus = document.getElementById("sessionStatus");
const elBtnSave = document.getElementById("btnSave");
const elBtnReset = document.getElementById("btnReset");

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
const elLog = document.getElementById("log");

const elBtnPayDividends = document.getElementById("btnPayDividends");
const elBtnShortMove = document.getElementById("btnShortMove");
const elShortMoveSymbol = document.getElementById("shortMoveSymbol");
const elShortMoveDir = document.getElementById("shortMoveDir");

// Pit toggle (mobile only)
const pitBoardSection = document.getElementById("pitBoardSection");
const pitToggleBtn = document.getElementById("btnPitToggle");

// ---------- Helpers ----------
function nowTs() {
  return new Date().toLocaleString();
}
function fmtMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function addLog(text) {
  state.log.unshift({ ts: nowTs(), text });
  renderLog();
}
function clampPrice(n) {
  return Math.max(0, Math.round(n));
}
function diceBand(total) {
  if (total >= 2 && total <= 5) return "low";
  if (total >= 6 && total <= 8) return "mid";
  return "high";
}
function getStock(symbol) {
  return STOCKS.find(s => s.symbol === symbol);
}
function ensureHoldings(player) {
  if (!player.holdings) player.holdings = {};
  for (const s of STOCKS) {
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

// ---------- Save/Load ----------
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  addLog("Saved session.");
  renderStatus();
}
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try { state = JSON.parse(raw); } catch { /* ignore */ }
}
function resetState() {
  if (!confirm("Reset session? This clears players, prices, and log.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = { started:false, createdAt:null, players:[], prices:{}, log:[] };
  buildSetupInputs();
  buildIndustryUI();
  buildShortMoveUI();
  renderAll();
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
          <option value="up">Up</option>
          <option value="down">Down</option>
        </select>
      </div>
      <div class="mini muted" style="margin-top:8px;">
        Affects: <span class="affects"></span>
      </div>
    `;

    const syms = STOCKS.filter(s => s.industries.includes(ind)).map(s => s.symbol).join(", ");
    box.querySelector(".affects").textContent = syms || "—";

    elIndustryList.appendChild(box);
  }

  elIndustryList.addEventListener("change", updateMarketMoverButton);
}

function buildShortMoveUI() {
  elShortMoveSymbol.innerHTML = "";
  for (const s of STOCKS) {
    const opt = document.createElement("option");
    opt.value = s.symbol;
    opt.textContent = `${s.symbol} — ${s.name}`;
    elShortMoveSymbol.appendChild(opt);
  }
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
  elPitTableBody.innerHTML = "";

  // mobile cards
  if (elPitCards) elPitCards.innerHTML = "";

  for (const s of STOCKS) {
    const cur = state.prices[s.symbol] ?? s.start;

    // table row
    const tr = document.createElement("tr");
    const industries = s.industries.map(x => `<span class="tag">${x}</span>`).join("");
    tr.innerHTML = `
      <td><strong>${s.symbol}</strong></td>
      <td>${s.name}</td>
      <td>${industries}</td>
      <td>$${fmtMoney(s.dividend)}</td>
      <td>$${fmtMoney(s.start)}</td>
      <td><strong>$${fmtMoney(cur)}</strong></td>
    `;
    elPitTableBody.appendChild(tr);

    // card
    if (elPitCards) {
      const card = document.createElement("div");
      card.className = "pitCard";
      card.innerHTML = `
        <div class="pitRow1">
          <div class="pitLeft">
            <div class="pitSymLine">
              <span class="pitSym">${s.symbol}</span>
              <span class="pitName">${s.name}</span>
            </div>
          </div>
          <div class="pitCur">$${fmtMoney(cur)}</div>
        </div>

        <div class="pitRow2">
          ${s.industries.map(ind => `<span class="tag">${ind}</span>`).join("")}
        </div>

        <div class="pitRow3">
          <div><b>Div</b>$${fmtMoney(s.dividend)}</div>
          <div><b>Start</b>$${fmtMoney(s.start)}</div>
          <div><b>Move</b>${s.moves.low}/${s.moves.mid}/${s.moves.high}</div>
        </div>
      `;
      elPitCards.appendChild(card);
    }
  }
}

function renderPlayers() {
  elPlayersArea.innerHTML = "";
  if (!state.started) {
    elPlayersArea.innerHTML = `<div class="muted">Start a session to track players.</div>`;
    return;
  }

  for (const p of state.players) {
    ensureHoldings(p);

    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.style.marginBottom = "12px";

    const holdingLines = STOCKS
      .map(s => {
        const shares = p.holdings[s.symbol] || 0;
        if (shares === 0) return null;
        const price = state.prices[s.symbol] ?? s.start;
        const val = shares * price;
        return `<div class="mini"><strong>${s.symbol}</strong>: ${shares} sh @ $${fmtMoney(price)} = $${fmtMoney(val)}</div>`;
      })
      .filter(Boolean)
      .join("") || `<div class="mini muted">No holdings yet.</div>`;

    const totalAssets = computePlayerNetWorth(p);

    wrap.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
        <div>
          <div style="font-size:14px; font-weight:800;">${p.name}</div>
          <div class="mini muted">Cash: <strong>$${fmtMoney(p.cash)}</strong> • Total Assets: <strong>$${fmtMoney(totalAssets)}</strong></div>
        </div>

        <div style="display:flex; gap:10px; min-width:320px; flex:1; justify-content:flex-end; flex-wrap:wrap; align-items:center;">
          <label class="mini muted" style="display:flex; align-items:center; gap:6px;">
            Stock
            <select data-role="tradeSymbol" data-player="${p.id}">
              ${STOCKS.map(s => `<option value="${s.symbol}">${s.symbol} — ${s.name}</option>`).join("")}
            </select>
          </label>

          <div style="display:flex; align-items:center; gap:6px;">
            <button type="button" data-role="sharesDown" data-player="${p.id}">-100</button>
            <div class="mini" style="min-width:120px; text-align:center;">
              Shares: <strong><span data-role="tradeShares" data-player="${p.id}">100</span></strong>
            </div>
            <button type="button" data-role="sharesUp" data-player="${p.id}">+100</button>
          </div>

          <button type="button" class="primary" data-role="buy" data-player="${p.id}">Buy</button>
          <button type="button" data-role="sell" data-player="${p.id}">Sell</button>

          <button type="button" data-action="adjustCash" data-player="${p.id}">Adjust Cash</button>

          <div class="mini muted" style="width:100%; text-align:right;">
            <span data-role="tradePreview" data-player="${p.id}"></span>
          </div>
        </div>
      </div>

      <div class="divider"></div>
      <div>${holdingLines}</div>
    `;

    // Adjust cash
    wrap.querySelector('[data-action="adjustCash"]').addEventListener("click", () => openCashDialog(p.id));

    const elSymbol = wrap.querySelector(`[data-role="tradeSymbol"][data-player="${p.id}"]`);
    const elShares = wrap.querySelector(`[data-role="tradeShares"][data-player="${p.id}"]`);
    const elPreview = wrap.querySelector(`[data-role="tradePreview"][data-player="${p.id}"]`);

    let tradeShares = 100;

    function updatePreview() {
      const symbol = elSymbol.value;
      const stock = getStock(symbol);
      const price = state.prices[symbol] ?? stock.start;
      const cost = tradeShares * price;
      const owned = p.holdings[symbol] || 0;

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

    updatePreview();
    elPlayersArea.appendChild(wrap);
  }
}

function renderLog() {
  elLog.innerHTML = "";
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
  elBtnApplyMarketMover.disabled = !(anyChecked && started);
  elMarketMoverHint.textContent = !started
    ? "Start a session first."
    : (!anyChecked ? "Select at least one industry." : "Ready.");
}

function renderAll() {
  renderStatus();
  renderPitBoard();
  renderPlayers();
  renderLog();

  const started = !!state.started;
  elBtnPayDividends.disabled = !started;
  elBtnShortMove.disabled = !started;

  updateMarketMoverButton();
}

// ---------- Actions ----------
function startSession() {
  const n = Number(elPlayerCount.value);
  const startingCash = Number(elStartingCash.value || 0);

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
  for (const s of STOCKS) prices[s.symbol] = s.start;

  state.started = true;
  state.createdAt = nowTs();
  state.players = players;
  state.prices = prices;
  state.log = [];

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
    const affected = STOCKS.filter(s => s.industries.includes(sel.industry));
    for (const stock of affected) {
      const move = stock.moves[band];
      const signed = sel.dir === "up" ? move : -move;

      const before = state.prices[stock.symbol] ?? stock.start;
      const after = clampPrice(before + signed);
      state.prices[stock.symbol] = after;

      deltas.push(`${stock.symbol} ${signed >= 0 ? "+" : ""}${signed} → $${fmtMoney(after)}`);
    }
  }

  addLog(
    `Market Mover: dice ${total} (${band}) • ` +
    selections.map(s => `${s.industry} ${s.dir === "up" ? "↑" : "↓"}`).join(", ") +
    `<br><span class="mini muted">${deltas.join(" • ")}</span>`
  );

  renderAll();
  saveState();
}

function payDividends() {
  let totalPaid = 0;

  for (const p of state.players) {
    ensureHoldings(p);
    let paid = 0;
    for (const s of STOCKS) {
      const shares = p.holdings[s.symbol] || 0;
      if (shares <= 0) continue;
      paid += shares * s.dividend;
    }
    p.cash += paid;
    totalPaid += paid;
    addLog(`${p.name} collected dividends: $${fmtMoney(paid)}.`);
  }

  addLog(`Opening Bell dividends paid (total: $${fmtMoney(totalPaid)}).`);
  renderAll();
  saveState();
}

function shortMove() {
  const sym = elShortMoveSymbol.value;
  const dir = elShortMoveDir.value;
  const before = state.prices[sym] ?? getStock(sym).start;
  const signed = dir === "up" ? 8 : -8;
  const after = clampPrice(before + signed);
  state.prices[sym] = after;

  addLog(`Short Move: ${sym} ${signed >= 0 ? "+" : ""}${signed} → $${fmtMoney(after)}`);
  renderAll();
  saveState();
}

function openCashDialog(playerId) {
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
  const p = state.players.find(x => x.id === playerId);
  if (!p) return;
  ensureHoldings(p);

  const stock = getStock(symbol);
  if (!stock) {
    alert("Unknown symbol.");
    return;
  }
  if (!Number.isFinite(shares) || shares <= 0 || shares % 100 !== 0) {
    alert("Shares must be 100, 200, 300...");
    return;
  }

  const price = state.prices[symbol] ?? stock.start;
  const cost = shares * price;

  if (act === "BUY") {
    if (p.cash < cost) {
      alert(`${p.name} doesn’t have enough cash. Needs $${fmtMoney(cost)}, has $${fmtMoney(p.cash)}.`);
      return;
    }
    p.cash -= cost;
    p.holdings[symbol] = (p.holdings[symbol] || 0) + shares;
    addLog(`${p.name} BUY ${shares} ${symbol} @ $${fmtMoney(price)} = $${fmtMoney(cost)}.`);
  } else if (act === "SELL") {
    const owned = p.holdings[symbol] || 0;
    if (owned < shares) {
      alert(`${p.name} doesn’t have enough shares to sell. Has ${owned}.`);
      return;
    }
    p.holdings[symbol] = owned - shares;
    p.cash += cost;
    addLog(`${p.name} SELL ${shares} ${symbol} @ $${fmtMoney(price)} = $${fmtMoney(cost)}.`);
  } else {
    alert("Invalid trade action.");
    return;
  }

  renderAll();
  saveState();
}

// ---------- Pit toggle logic ----------
function setupPitToggle() {
  if (!pitToggleBtn || !pitBoardSection) return;

  function isMobile() {
    return window.matchMedia("(max-width: 700px)").matches;
  }

  // Default state on load:
  // - mobile: collapsed
  // - desktop: doesn't matter (table is always visible; button hidden)
  if (isMobile()) {
    pitBoardSection.classList.remove("expanded");
    pitToggleBtn.textContent = "Show Pit Board";
  }

  pitToggleBtn.addEventListener("click", () => {
    const nowExpanded = pitBoardSection.classList.toggle("expanded");
    pitToggleBtn.textContent = nowExpanded ? "Hide Pit Board" : "Show Pit Board";
  });
}

// ---------- Events ----------
elPlayerCount.addEventListener("change", buildSetupInputs);
elBtnStart.addEventListener("click", startSession);

elBtnApplyMarketMover.addEventListener("click", applyMarketMover);
elBtnPayDividends.addEventListener("click", payDividends);
elBtnShortMove.addEventListener("click", shortMove);

elBtnSave.addEventListener("click", saveState);
elBtnReset.addEventListener("click", resetState);

// ---------- Init ----------
function init() {
  loadState();

  buildSetupInputs();
  buildIndustryUI();
  buildShortMoveUI();

  if (state.started) {
    for (const p of state.players) ensureHoldings(p);
  }

  setupPitToggle();
  renderAll();
}
init();
