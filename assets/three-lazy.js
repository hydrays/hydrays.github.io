// three-lazy.js — defer Three.js scene modules until their container scrolls
// near the viewport. Each <script data-lazy-module="..."> is paired with the
// nearest preceding element that carries an id (walked in DOM order).
//
// Preprocess in build.py rewrites
//   <script type="module" src="threejs/foo.js"></script>
// to
//   <script data-lazy-module="threejs/foo.js"></script>
// so the browser no longer eagerly fetches/evaluates every scene on load.

(function () {
  function findTarget(scriptEl) {
    let el = scriptEl.previousElementSibling;
    while (el) {
      if (el.id) return el;
      const withId = el.querySelector('[id]');
      if (withId) return withId;
      el = el.previousElementSibling;
    }
    return null;
  }

  function load(src) {
    import(src).catch(function (err) {
      console.error('[three-lazy] failed to import', src, err);
    });
  }

  function init() {
    var scripts = document.querySelectorAll('script[data-lazy-module]');
    if (!scripts.length) return;

    var supported = 'IntersectionObserver' in window;

    scripts.forEach(function (s) {
      var src = s.getAttribute('data-lazy-module');
      var target = findTarget(s);

      if (!supported || !target) {
        load(src);
        return;
      }

      var io = new IntersectionObserver(function (entries, obs) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            obs.disconnect();
            load(src);
            break;
          }
        }
      }, { rootMargin: '200px 0px' });

      io.observe(target);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
