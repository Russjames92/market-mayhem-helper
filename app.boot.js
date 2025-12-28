// app.boot.js - runs AFTER app.base.js and app.live.js are loaded
(function boot(){
  // Safety: if base didn't define init, bail.
  if (typeof init === "function") init();

  // Live session boot (firebase + pills)
  if (typeof initFirebase === "function") initFirebase();
  if (typeof setLiveUI === "function") setLiveUI();
  if (typeof updateLiveAnnouncement === "function") updateLiveAnnouncement();
  // Attempt to start background music on load
  loadAudioSettings();
  applyMusicSettings();
  initSettingsModal();
  startBGM();
  
  // If autoplay is blocked (mobile), start on the first user gesture
  document.addEventListener("pointerdown", () => startBGM(), { once: true });
  document.addEventListener("keydown", () => startBGM(), { once: true });
})();
