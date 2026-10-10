(function () {
  'use strict';
  var root = document.documentElement;
  var main = document.getElementById('main');
  var modeButton = document.getElementById('reading-mode');
  function setMode(mode) {
    root.dataset.readingMode = mode;
    modeButton.textContent = mode === 'night' ? '日读' : '夜读';
    modeButton.setAttribute('aria-pressed', String(mode === 'night'));
    modeButton.setAttribute('aria-label', mode === 'night' ? '切换为日间阅读' : '切换为夜间阅读');
  }
  try { setMode(localStorage.getItem('shanhai-reading-mode') || 'day'); } catch (_) { setMode('day'); }
  modeButton.addEventListener('click', function () {
    var mode = root.dataset.readingMode === 'night' ? 'day' : 'night';
    setMode(mode);
    try { localStorage.setItem('shanhai-reading-mode', mode); } catch (_) {}
  });
  function updateProgress() {
    var distance = main.scrollHeight - main.clientHeight;
    var progress = distance > 0 ? Math.min(100, Math.round(main.scrollTop / distance * 100)) : 100;
    document.getElementById('reading-progress').textContent = progress + '%';
    document.getElementById('reading-progress-bar').style.width = progress + '%';
  }
  main.addEventListener('scroll', updateProgress, {passive:true});
  window.addEventListener('resize', updateProgress);
  document.addEventListener('reader:chapter', updateProgress);
  new ResizeObserver(updateProgress).observe(document.getElementById('content'));
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      var wasOpen = document.getElementById('sidebar').classList.contains('open');
      window.closeSidebar();
      if (wasOpen) document.getElementById('sidebar-toggle').focus();
    }
  });
  updateProgress();
})();
