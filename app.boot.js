// app.boot.js - runs AFTER app.base.js and app.live.js are loaded
(function boot(){
  // Safety: if base didn't define init, bail.
  if (typeof init === "function") init();

  // Live session boot (firebase + pills)
  if (typeof initFirebase === "function") initFirebase();
  if (typeof setLiveUI === "function") setLiveUI();
  if (typeof updateLiveAnnouncement === "function") updateLiveAnnouncement();
})();
