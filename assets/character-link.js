/* Carry the current reader page and section into the shared character page. */
(function () {
  'use strict';
  var selector = 'a.reader-status-link, a.status-link';
  function update(link) {
    var target = new URL('character.html', location.href);
    target.searchParams.set('return', location.href);
    link.href = target.href;
  }
  function rememberPosition() {
    var main = document.getElementById('main');
    var state = Object.assign({}, history.state, {
      characterReturnScroll: {url: location.href, top: main ? main.scrollTop : window.scrollY}
    });
    history.replaceState(state, '', location.href);
  }
  document.querySelectorAll(selector).forEach(update);
  ['click', 'auxclick', 'contextmenu'].forEach(function (type) {
    document.addEventListener(type, function (event) {
      var link = event.target.closest(selector);
      if (link) {
        update(link);
        if (type === 'click' && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) rememberPosition();
      }
    }, true);
  });
  window.addEventListener('pageshow', function () {
    var saved = history.state && history.state.characterReturnScroll;
    if (!saved || saved.url !== location.href || !Number.isFinite(saved.top) || saved.top < 0) return;
    var entryUrl = location.href;
    var cancelled = false;
    var inputEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    function finish() {
      inputEvents.forEach(function (type) { window.removeEventListener(type, cancel, true); });
      if (location.href !== entryUrl) return;
      var state = Object.assign({}, history.state);
      delete state.characterReturnScroll;
      history.replaceState(state, '', location.href);
    }
    function cancel() { cancelled = true; finish(); }
    inputEvents.forEach(function (type) { window.addEventListener(type, cancel, {capture: true, passive: true}); });
    var ready = document.fonts ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      requestAnimationFrame(function () {
        if (cancelled) return;
        if (location.href !== entryUrl) { finish(); return; }
        var main = document.getElementById('main');
        (main || window).scrollTo({top: saved.top, behavior: 'instant'});
        finish();
      });
    });
  });
})();
