/* app.js — Lightweight VLOOK replacement
 * Features: chapter nav, TOC sidebar, sidebar toggle, auto-numbering, SPA navigation
 */

(function () {
  "use strict";

  // ── Math rendering ───────────────────────────────────────────
  // Called on initial load and after each SPA content swap.

  function renderMath(root) {
    root = root || document;
    // querySelectorAll returns a static list — safe to iterate while KaTeX mutates spans
    var mathElements = root.querySelectorAll("span.math");
    var macros = [];
    for (var i = 0; i < mathElements.length; i++) {
      var el = mathElements[i];
      var texText = el.firstChild;
      // nodeType 3 = Text node; skip spans already rendered by KaTeX
      if (!texText || texText.nodeType !== 3) continue;
      try {
        katex.render(texText.data, el, {
          displayMode: el.classList.contains("display"),
          throwOnError: false,
          strict: false,
          macros: macros,
          fleqn: false
        });
      } catch (e) {}
    }
  }

  // ── SPA Navigation ───────────────────────────────────────────
  // Fetch a chapter page and swap content without a full reload.
  // Keeps CSS, KaTeX, and app.js loaded — only content changes.

  var tocHighlightObserver = null;

  function navigate(url) {
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("fetch failed");
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");

        // Swap main content
        var newContent = doc.getElementById("content");
        var contentEl  = document.getElementById("content");
        if (newContent && contentEl) contentEl.innerHTML = newContent.innerHTML;

        // Update page title and topbar
        document.title = doc.title;
        var newTopbar = doc.getElementById("topbar-title");
        var topbar    = document.getElementById("topbar-title");
        if (newTopbar && topbar) topbar.textContent = newTopbar.textContent;

        // Extract per-chapter variables from the fetched page's inline script
        var newVideoUrl   = "";
        var newChpAutonum = "";
        doc.querySelectorAll("script:not([src])").forEach(function (s) {
          var m;
          m = s.textContent.match(/window\.videoUrl\s*=\s*"([^"]*)"/);
          if (m) newVideoUrl = m[1];
          m = s.textContent.match(/window\.chpAutonum\s*=\s*"([^"]*)"/);
          if (m) newChpAutonum = m[1];
        });
        window.videoUrl   = newVideoUrl;
        window.chpAutonum = newChpAutonum;

        // Reset video panel
        var panel = document.getElementById("video-panel");
        if (panel) panel.style.display = "none";
        var frame = document.getElementById("video-frame");
        if (frame) { frame.src = ""; }
        // Move panel back inside #content (detach from wherever it ended up)
        if (panel && contentEl) contentEl.appendChild(panel);

        // Update URL and scroll to top
        history.pushState({ url: url }, "", url);
        var mainEl = document.getElementById("main");
        if (mainEl) mainEl.scrollTo(0, 0);

        // Update sidebar: clear current state, set new current chapter
        var currentFile = url.split("?")[0].split("/").pop();
        var oldToc = document.querySelector("ul.chapter-toc");
        if (oldToc) oldToc.remove();

        document.querySelectorAll("#doc-nav-list li.nav-chapter").forEach(function (li) {
          var a = li.querySelector("a");
          li.classList.remove("nav-chapter-current", "open");
          a.classList.remove("current");

          var itemFile = a.getAttribute("href").split("?")[0].split("/").pop();
          if (itemFile !== currentFile) return;

          a.classList.add("current");
          li.classList.add("nav-chapter-current", "open");

          // Inline the new chapter's TOC
          var newTocUl = doc.querySelector("#toc-nav ul");
          if (newTocUl) {
            var tocUl = newTocUl.cloneNode(true);
            tocUl.className = "chapter-toc";
            li.appendChild(tocUl);
          }

          setTimeout(function () { a.scrollIntoView({ block: "nearest" }); }, 0);
        });

        // Re-execute scripts from new content (innerHTML does not run scripts).
        // Skip data-lazy-module scripts — three-lazy.js re-observes them itself.
        Array.from(newContent.querySelectorAll("script")).forEach(function (s) {
          if ((s.getAttribute("type") || "") === "importmap") return;
          if (s.hasAttribute("data-lazy-module")) return;
          var el = document.createElement("script");
          Array.from(s.attributes).forEach(function (a) { el.setAttribute(a.name, a.value); });
          if (!s.getAttribute("src")) el.textContent = s.textContent;
          document.body.appendChild(el);
        });

        // Disconnect previous scroll observer before creating a new one
        if (tocHighlightObserver) {
          tocHighlightObserver.disconnect();
          tocHighlightObserver = null;
        }

        // Re-run per-page init
        applyAutonum();
        initTocAccordion();
        tocHighlightObserver = initTocHighlight();
        buildFigureCaptions();
        initVideo();
        renderMath(contentEl);
        if (typeof window.threeLazyReinit === "function") window.threeLazyReinit();
      })
      .catch(function () {
        // Fall back to normal navigation on any error
        window.location.href = url;
      });
  }

  // Handle browser back / forward.
  // Only act on history entries we created via pushState({ url: ... }).
  // Hash-link navigations have e.state === null — ignore them to prevent
  // TOC section clicks from re-navigating and collapsing the accordion.
  window.addEventListener("popstate", function (e) {
    if (!e.state || !e.state.url) return;
    navigate(e.state.url);
  });

  // ── Chapter navigation ───────────────────────────────────────

  function buildDocNav() {
    var list = document.getElementById("doc-nav-list");
    if (!list || !window.docLib || !window.docLib.length) return;

    var currentFile = location.pathname.split("/").pop() || "index.html";

    window.docLib.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "nav-chapter";
      var a = document.createElement("a");

      a.href = item.url;
      a.textContent = item.title;
      a.title = item.title;

      var itemFile = item.url.split("?")[0].split("/").pop();
      var isCurrent = (itemFile === currentFile);

      if (isCurrent) {
        a.className = "current";
        li.classList.add("nav-chapter-current", "open");

        // Move the page TOC into this list item as an inline sub-list
        var tocNav = document.getElementById("toc-nav");
        if (tocNav) {
          var tocUl = tocNav.querySelector("ul");
          if (tocUl) {
            tocUl.className = "chapter-toc";
            li.appendChild(tocUl);
          }
          tocNav.style.display = "none";
          var divider = document.querySelector(".nav-divider");
          if (divider) divider.style.display = "none";
        }

        setTimeout(function () {
          a.scrollIntoView({ block: "nearest" });
        }, 0);
      }

      li.insertBefore(a, li.firstChild);
      list.appendChild(li);
    });

    // Delegated click handler: decide navigate vs. toggle based on current
    // state, not on a stale onclick set when the chapter was last current.
    list.addEventListener("click", function (e) {
      var a = e.target.closest("li.nav-chapter > a");
      if (!a || !list.contains(a)) return;
      e.preventDefault();
      var li = a.parentElement;
      if (li.classList.contains("nav-chapter-current")) {
        li.classList.toggle("open");
      } else {
        navigate(a.getAttribute("href"));
      }
    });
  }

  // ── Auto chapter numbering ───────────────────────────────────

  function applyAutonum() {
    document.body.classList.remove("chp-autonum");
    if (!window.chpAutonum || window.chpAutonum === "") return;
    if (window.chpAutonum.indexOf("off") !== -1 &&
        window.chpAutonum.indexOf("h1") !== -1) {
      document.body.classList.add("chp-autonum");
    }
  }

  // ── Sidebar toggle ───────────────────────────────────────────

  function toggleSidebar() {
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("overlay");
    sidebar.classList.toggle("open");
    overlay.classList.toggle("visible");
  }

  function closeSidebar() {
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("overlay");
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
  }

  window.toggleSidebar = toggleSidebar;
  window.closeSidebar  = closeSidebar;

  // ── TOC active section highlighting ─────────────────────────

  function initTocHighlight() {
    var tocLinks = document.querySelectorAll("#doc-nav-list a[href^='#']");
    if (!tocLinks.length) return null;

    var headings = Array.from(
      document.querySelectorAll("#content h1, #content h2, #content h3, #content h4")
    );
    if (!headings.length) return null;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id;
          if (!id) return;
          tocLinks.forEach(function (a) {
            a.classList.toggle("toc-active", a.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 }
    );

    headings.forEach(function (h) { if (h.id) observer.observe(h); });
    return observer;
  }

  // ── Image captions ───────────────────────────────────────────

  function buildFigureCaptions() {
    var imgs = document.querySelectorAll("#content img");
    imgs.forEach(function (img) {
      var alt = img.getAttribute("alt");
      if (!alt || alt.match(/^https?:\/\//)) return;
      if (img.parentElement && img.parentElement.tagName === "FIGURE") return;

      var figure = document.createElement("figure");
      figure.className = "img-figure";
      img.parentNode.insertBefore(figure, img);
      figure.appendChild(img);

      var caption = document.createElement("figcaption");
      caption.textContent = alt;
      figure.appendChild(caption);
    });
  }

  // ── TOC accordion ────────────────────────────────────────────

  function initTocAccordion() {
    var chapterToc = document.querySelector("ul.chapter-toc");
    if (!chapterToc) return;
    var mainEl = document.getElementById("main");

    chapterToc.querySelectorAll("li").forEach(function (li) {
      var link = null;
      var childUl = null;
      for (var i = 0; i < li.children.length; i++) {
        if (li.children[i].tagName === "A")  link   = li.children[i];
        if (li.children[i].tagName === "UL") childUl = li.children[i];
      }
      if (!link) return;

      if (childUl) {
        // Section with sub-items: toggle open/close
        li.classList.add("has-children");
        link.addEventListener("click", function (e) {
          e.preventDefault();
          li.classList.toggle("open");
        });
      } else {
        // Leaf section: scroll #main to the target heading
        link.addEventListener("click", function (e) {
          e.preventDefault();
          var id = (link.getAttribute("href") || "").replace(/^#/, "");
          if (!id) return;
          var target = document.getElementById(id);
          if (!target || !mainEl) return;
          var offset = target.getBoundingClientRect().top + mainEl.scrollTop - 56;
          mainEl.scrollTo({ top: offset, behavior: "smooth" });
        });
      }
    });
  }

  // ── Video panel ──────────────────────────────────────────────

  var activeVideoOwner = null;

  function closeVideoPanel() {
    var panel = document.getElementById("video-panel");
    if (panel) panel.style.display = "none";
    if (activeVideoOwner) activeVideoOwner.classList.remove("is-active");
    activeVideoOwner = null;
  }

  function openVideoPanelFor(btn) {
    var panel = document.getElementById("video-panel");
    var frame = document.getElementById("video-frame");
    var mainEl = document.getElementById("main");
    if (!panel || !frame) return;

    var url = btn.getAttribute("data-video-url") || "";
    if (!url) return;

    var callout = btn.closest(".callout");
    var header = callout ? callout.querySelector(".callout-header") : null;
    if (!header) return;

    header.insertAdjacentElement("afterend", panel);
    frame.src = url;
    panel.style.display = "block";
    frame.style.height = Math.round(panel.offsetWidth * 9 / 16) + "px";

    if (activeVideoOwner && activeVideoOwner !== btn) {
      activeVideoOwner.classList.remove("is-active");
    }
    activeVideoOwner = btn;
    btn.classList.add("is-active");

    if (mainEl) {
      var top = header.getBoundingClientRect().top + mainEl.scrollTop - 56;
      mainEl.scrollTo({ top: top, behavior: "smooth" });
    }
  }

  function initVideo() {
    // Reset panel on page load / after SPA swap — previous owner is gone.
    var panel = document.getElementById("video-panel");
    var frame = document.getElementById("video-frame");
    if (panel) panel.style.display = "none";
    if (frame) frame.src = "";
    activeVideoOwner = null;

    var closeBtn = document.getElementById("video-close-btn");
    if (closeBtn) closeBtn.onclick = closeVideoPanel;
    var closeBottom = document.getElementById("video-close-bottom");
    if (closeBottom) closeBottom.onclick = closeVideoPanel;
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".callout-video-btn");
    if (!btn) return;
    e.preventDefault();
    if (activeVideoOwner === btn) {
      closeVideoPanel();
    } else {
      openVideoPanelFor(btn);
    }
  });

  // ── Fold toggle inside callouts ─────────────────────────────
  // Author writes ::: {.fold label="证明"} ⟨body⟩ :::
  // Filter renders a button + a hidden body. Click toggles.

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".callout-fold-btn");
    if (!btn) return;
    e.preventDefault();

    var wrap = btn.closest(".callout-fold");
    if (!wrap) return;
    var body = wrap.querySelector(".callout-fold-body");
    if (!body) return;

    var nowOpen = body.hasAttribute("hidden");
    if (nowOpen) {
      body.removeAttribute("hidden");
      btn.setAttribute("aria-expanded", "true");
    } else {
      body.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", "false");
    }

    // Swap the leading arrow glyph (▶ ↔ ▼) without disturbing the label.
    var label = wrap.getAttribute("data-label") || "展开";
    btn.innerHTML = (nowOpen ? "&#9660; " : "&#9654; ") + label;

    // KaTeX may need to render any math that just became visible.
    if (nowOpen && typeof renderMathInElement === "function") {
      renderMathInElement(body, {
        delimiters: [
          { left: "$$", right: "$$", display: true  },
          { left: "$",  right: "$",  display: false }
        ]
      });
    }
  });

  // ── Init ─────────────────────────────────────────────────────

  function init() {
    buildDocNav();
    applyAutonum();
    initTocAccordion();
    tocHighlightObserver = initTocHighlight();
    buildFigureCaptions();
    initVideo();
    renderMath(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── Exercise interactions ────────────────────────────────────
  // .ex-action-btn  — reveals content in the exercise's shared frame
  // .ex-sol-toggle  — toggles the extra buttons for solution 2+

  document.addEventListener("click", function (e) {
    // Action buttons (提示 / 答案): show content in the shared frame
    var actionBtn = e.target.closest(".ex-action-btn");
    if (actionBtn) {
      var frameId  = actionBtn.getAttribute("data-frame");
      var panelId  = actionBtn.getAttribute("data-panel");
      if (!frameId || !panelId) return;
      var frame = document.getElementById(frameId);
      if (!frame) return;

      var target = document.getElementById(panelId);
      if (!target) return;

      // Capture toggle state before we change anything
      var isSameBtn = !frame.hasAttribute("hidden") && actionBtn.classList.contains("active");

      // Hide all panels in this frame
      var allPanels = frame.querySelectorAll(".ex-panel");
      allPanels.forEach(function (p) { p.setAttribute("hidden", ""); });

      // Deactivate all action buttons in the same exercise block
      var block = frame.closest(".exercise-block");
      if (block) {
        block.querySelectorAll(".ex-action-btn").forEach(function (b) {
          b.classList.remove("active");
        });
      }

      // Toggle: same button clicked again → collapse
      if (isSameBtn) {
        frame.setAttribute("hidden", "");
        return;
      }

      // Show the target panel and frame
      target.removeAttribute("hidden");
      frame.removeAttribute("hidden");
      actionBtn.classList.add("active");
      renderMath(target);
      return;
    }

    // Solution toggles (解法二 ▼): show/hide extra buttons inline
    var solToggle = e.target.closest(".ex-sol-toggle");
    if (solToggle) {
      var extraId = solToggle.getAttribute("data-target");
      if (!extraId) return;
      var extra = document.getElementById(extraId);
      if (!extra) return;
      if (extra.hasAttribute("hidden")) {
        extra.removeAttribute("hidden");
        solToggle.textContent = solToggle.textContent.replace("▼", "▲");
      } else {
        extra.setAttribute("hidden", "");
        solToggle.textContent = solToggle.textContent.replace("▲", "▼");
      }
    }
  });
})();
