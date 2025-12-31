// app.boot.js - runs AFTER app.base.js and app.live.js are loaded
(function boot(){
  // Safety: if base didn't define init, bail.
  if (typeof init === "function") init();

  // Live session boot (firebase + pills)
  if (typeof firebase !== "undefined" && typeof initFirebase === "function") initFirebase();
  if (typeof setLiveUI === "function") setLiveUI();
  if (typeof updateLiveAnnouncement === "function") updateLiveAnnouncement();

  // UI shell (tabs + left gallery)
  if (typeof initUIShell === "function") initUIShell();

  // Attempt to start background music on load
  loadAudioSettings();
  applyMusicSettings();
  initSettingsModal();
  startBGM();

  // If autoplay is blocked (mobile), start on the first user gesture
  document.addEventListener("pointerdown", () => startBGM(), { once: true });
  document.addEventListener("keydown", () => startBGM(), { once: true });
})();

/* =========================================================
   UI Shell helpers (layout only; does not change game logic)
   ========================================================= */
function initUIShell(){
  initMainTabs();
  initLeftGallery();
}

function initMainTabs(){
  const btns = Array.from(document.querySelectorAll('.tabBtn'));
  const panels = Array.from(document.querySelectorAll('.tabPanel'));
  if (!btns.length || !panels.length) return;

  const setTab = (key) => {
    btns.forEach(b => {
      const on = b.dataset.tab === key;
      b.classList.toggle('isActive', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => p.classList.toggle('isActive', p.dataset.tab === key));
    try { localStorage.setItem('mm_mainTab', key); } catch(e){}
  };

  // Restore last tab
  let saved = null;
  try { saved = localStorage.getItem('mm_mainTab'); } catch(e){}
  if (saved && btns.some(b => b.dataset.tab === saved)) setTab(saved);

  btns.forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
}

function initLeftGallery(){
  const gallery = document.getElementById('leftGallery');
  const dotsWrap = document.getElementById('leftDots');
  if (!gallery || !dotsWrap) return;

  const slides = Array.from(gallery.querySelectorAll('.gallerySlide'));
  const dots = Array.from(dotsWrap.querySelectorAll('.dot'));
  if (!slides.length || !dots.length) return;

  const slideFor = (key) => slides.find(s => s.dataset.panel === key);

  const setActiveDot = (key) => {
    dots.forEach(d => d.classList.toggle('isActive', d.dataset.goto === key));
  };

  dots.forEach(d => {
    d.addEventListener('click', () => {
      const key = d.dataset.goto;
      const slide = slideFor(key);
      if (!slide) return;
      slide.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveDot(key);
      try { localStorage.setItem('mm_leftPanel', key); } catch(e){}
    });
  });

  // Restore last left panel
  let saved = null;
  try { saved = localStorage.getItem('mm_leftPanel'); } catch(e){}
  if (saved && slideFor(saved)) {
    slideFor(saved).scrollIntoView({ behavior: 'auto', block: 'start' });
    setActiveDot(saved);
  }

  // Keep dots synced with scroll position
  let raf = 0;
  gallery.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const top = gallery.scrollTop;

      // Find closest slide by offsetTop
      let best = slides[0];
      let bestDist = Math.abs(slides[0].offsetTop - top);
      for (const s of slides){
        const dist = Math.abs(s.offsetTop - top);
        if (dist < bestDist){
          best = s; bestDist = dist;
        }
      }
      setActiveDot(best.dataset.panel);
    });
  }, { passive: true });
}
