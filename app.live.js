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

  if (firebaseConfig.apiKey === "PASTE_ME") {
    if (elLiveHint) elLiveHint.textContent =
      "Firebase not configured yet. Paste firebaseConfig into app.js to enable Live Sessions.";
    return;
  }

  // IMPORTANT: prevent double-initialize if boot code calls initFirebase twice
  if (!fb.app) {
    fb.app = firebase.initializeApp(firebaseConfig);
    fb.auth = firebase.auth();
    fb.db = firebase.firestore();
  }

  // Make auth persist across refresh
  return fb.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => {
      console.warn("Auth persistence failed (continuing anyway):", err);
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        const unsub = fb.auth.onAuthStateChanged(async (user) => {
          try {
            if (!user) {
              const cred = await fb.auth.signInAnonymously();
              user = cred.user;
            }

            fb.uid = user.uid;
            fb.ready = true;

            if (elLiveHint) elLiveHint.textContent =
              "Firebase ready. Host can create a live session, or viewers can join by code/link.";

            // Auto-join if URL has ?sid=
            const sid = new URLSearchParams(location.search).get("sid");
            if (sid) {
              joinLiveSession(String(sid).trim());
            }

            unsub(); // stop listening once we’re ready
            resolve(true);
          } catch (err) {
            console.error(err);
            if (elLiveHint) elLiveHint.textContent = "Firebase auth failed. Check console.";
            reject(err);
          }
        });
      });
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

        // Determine role (avoid incorrectly flipping host -> viewer before UID is ready)
      if (data.hostUid && fb.uid) {
        live.isHost = (data.hostUid === fb.uid);
        live.pendingHost = false;
      } else {
        // If we're the creator and haven't resolved role yet, keep host controls enabled
        if (live.pendingHost && live.expectedHostUid) {
          live.isHost = true;
        }
      }

     updateLiveAnnouncement();

    // Apply remote state
    if (remoteState) {
      live.applyingRemote = true;
      try {
        state = remoteState;
         
         updateVolatilityPill();

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

function makeLiveStateSnapshot() {
  // Deep clone so Firestore never gets UI refs / accidental mutations
  const snap = JSON.parse(JSON.stringify(state));

  // Keep only the most recent log entries for live sync (prevents doc bloat)
  if (Array.isArray(snap.log)) {
    snap.log = snap.log.slice(0, 150); // keep latest 150
  }

  return snap;
}

function createLiveSession() {
  if (!fb.ready) {
    alert("Firebase not ready yet. Paste config + refresh.");
    return;
  }

  const sid = genSid(6);
  const ref = fb.db.collection("sessions").doc(sid);

  live.pendingHost = true;
  live.expectedHostUid = fb.uid;

  // Host becomes authoritative
  return ref.set({
    hostUid: fb.uid,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    state: makeLiveStateSnapshot()
  }).then(() => {
    live.enabled = true;
    live.sid = sid;
    live.isHost = true;
     updateLiveAnnouncement();

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
   updateLiveAnnouncement();


  // Update URL
  const url = new URL(location.href);
  url.searchParams.set("sid", sid);
  history.replaceState({}, "", url.toString());

  subscribeToSession(sid);
  setLiveUI();
}

function leaveLiveSession() {
  // capture current values BEFORE we wipe live
  const wasHost = !!live.isHost;
  const sid = live.sid;

  if (live.unsub) {
    try { live.unsub(); } catch {}
    live.unsub = null;
  }

  stopPresence();

  // If HOST is leaving, end the session in Firestore so it isn't "live" forever
  if (fb.ready && wasHost && sid) {
    fb.db.collection("sessions").doc(sid).delete().catch(err => {
      console.warn("Failed to delete session doc:", err);
    });
  }

  live = {
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

  updateLiveAnnouncement();

  // Remove sid param from URL
  const url = new URL(location.href);
  url.searchParams.delete("sid");
  history.replaceState({}, "", url.toString());

  setLiveUI();
}

function pushStateToCloud() {
  if (!live.enabled || !live.isHost || !fb.ready) return;
  if (!live.sid) return;

  const ref = fb.db.collection("sessions").doc(live.sid);

  live.pushing = true;

  return ref.update({
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    state: makeLiveStateSnapshot()
  }).catch(err => {
    console.error(err);
  
    // Show ONE alert per minute max so the host knows live is broken
    const now = Date.now();
    if (!live.lastPushAlertAt || (now - live.lastPushAlertAt) > 60000) {
      live.lastPushAlertAt = now;
      alert("Live session failed to sync to Firebase. Open console for details (permissions or doc-size).");
    }
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

