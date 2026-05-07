// three-lazy.js — defer Three.js scene modules until their container scrolls
// near the viewport. Each <script data-lazy-module="..."> is paired with the
// nearest preceding element that carries an id (walked in DOM order).
//
// Preprocess in build.py rewrites
//   <script type="module" src="threejs/foo.js"></script>
// to
//   <script data-lazy-module="threejs/foo.js"></script>
// so the browser no longer eagerly fetches/evaluates every scene on load.
//
// SPA navigation re-runs init() after each content swap. Module URLs are
// cache-busted on revisit so each chapter's scene re-executes against the
// fresh DOM (top-level module code that does getElementById).

(function () {
  var navGen = 0;

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
    var url = src;
    if (navGen > 0) {
      url += (src.indexOf('?') >= 0 ? '&' : '?') + '_nav=' + navGen;
    }
    var resolved = new URL(url, document.baseURI).href;
    import(resolved).catch(function (err) {
      console.error('[three-lazy] failed to import', src, err);
    });
  }

  function init() {
    // Only pick up scripts that haven't been observed yet — SPA navigation
    // calls this multiple times and the previous chapter's scripts are gone
    // from #content, but new chapter's scripts are fresh DOM nodes.
    var scripts = document.querySelectorAll(
      'script[data-lazy-module]:not([data-three-lazy-observed])'
    );
    if (!scripts.length) return;

    var supported = 'IntersectionObserver' in window;

    scripts.forEach(function (s) {
      s.setAttribute('data-three-lazy-observed', '1');
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

  // Called by app.js navigate() after each SPA content swap.
  window.threeLazyReinit = function () {
    navGen++;
    init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
