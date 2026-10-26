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
  var navigationSequence = 0;
  var chapterTocCache = Object.create(null);
  var tocEventsBound = false;
  var activeChapterKey = location.pathname;

  function chapterKey(url) {
    return new URL(url, location.href).pathname;
  }

  function sectionId(hash) {
    var value = (hash || "").replace(/^#/, "");
    try { return decodeURIComponent(value); } catch (_) { return value; }
  }

  function scrollToSection(hash, smooth) {
    var main = document.getElementById("main");
    if (!main) return;
    var id = sectionId(hash);
    if (!id) { main.scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" }); return; }
    var target = document.getElementById(id);
    if (!target) return;
    var topbar = document.getElementById("topbar");
    var inset = (topbar ? topbar.getBoundingClientRect().height : 56) + 12;
    var offset = target.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - inset;
    main.scrollTo({ top: Math.max(0, offset), behavior: smooth ? "smooth" : "instant" });
  }

  function finishSectionNavigation(hash, sequence) {
    scrollToSection(hash, false);
    var target = document.getElementById(sectionId(hash));
    var main = document.getElementById("main");
    if (!target || !main) return;
    // Images above the destination may acquire their height after the HTML swap.
    // Realign once they settle, unless the reader has started another action.
    var finished = false;
    var timeout = setTimeout(function () { finish(false); }, 5000);
    function finish(cancelled) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      main.removeEventListener("wheel", cancel);
      main.removeEventListener("touchstart", cancel);
      main.removeEventListener("pointerdown", cancel);
      document.removeEventListener("keydown", cancel);
      if (!cancelled && sequence === navigationSequence && target.isConnected) {
        scrollToSection(hash, false);
      }
    }
    function cancel() { finish(true); }
    main.addEventListener("wheel", cancel, { passive: true });
    main.addEventListener("touchstart", cancel, { passive: true });
    main.addEventListener("pointerdown", cancel, { passive: true });
    document.addEventListener("keydown", cancel);
    var ready = Array.from(document.querySelectorAll("#content img")).filter(function (image) {
      return image.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING;
    }).map(function (image) {
      if (image.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        function loaded() {
          image.removeEventListener("load", loaded);
          image.removeEventListener("error", loaded);
          resolve();
        }
        image.addEventListener("load", loaded);
        image.addEventListener("error", loaded);
        if (image.complete) loaded();
      });
    });
    if (document.fonts) ready.push(document.fonts.ready);
    Promise.all(ready).then(function () { requestAnimationFrame(function () { finish(false); }); });
  }

  function directChild(element, tag) {
    for (var i = 0; i < element.children.length; i++) {
      if (element.children[i].tagName === tag) return element.children[i];
    }
    return null;
  }

  function chapterTocTemplate(root, url) {
    if (!root) throw new Error("chapter directory unavailable");
    var toc = root.cloneNode(true);
    // Some pages wrap their sections in a duplicate chapter-title item;
    // others (including chapter 1) already provide a flat section list.
    if (toc.children.length === 1) {
      var sections = directChild(toc.firstElementChild, "UL");
      if (sections) toc = sections;
    }
    toc.className = "chapter-toc";
    toc.removeAttribute("id");
    toc.querySelectorAll("[id]").forEach(function (element) { element.removeAttribute("id"); });
    toc.querySelectorAll("a[href]").forEach(function (link) {
      link.href = new URL(link.getAttribute("href"), new URL(url, location.href)).href;
    });
    toc.querySelectorAll("li").forEach(function (li) {
      var children = directChild(li, "UL");
      var link = directChild(li, "A");
      if (children && link) {
        li.classList.add("has-children");
        link.setAttribute("aria-expanded", "false");
      }
    });
    return toc;
  }

  function attachChapterToc(li, template, replace) {
    var existing = directChild(li, "UL");
    if (existing && !replace) return;
    if (existing) existing.remove();
    var toc = template.cloneNode(true);
    toc.id = li.getAttribute("data-toc-id");
    li.appendChild(toc);
    renderMath(toc);
  }

  function setChapterOpen(li, open) {
    li.classList.toggle("open", open);
    li.firstElementChild.setAttribute("aria-expanded", String(open));
  }

  function loadChapterToc(li) {
    if (directChild(li, "UL")) return;
    var url = li.getAttribute("data-chapter-url");
    var key = chapterKey(url);
    var status = li.querySelector(".nav-toc-status");
    if (!status) {
      status = document.createElement("p");
      status.className = "nav-toc-status";
      status.setAttribute("role", "status");
      li.appendChild(status);
    }
    status.textContent = "目录加载中…";
    li.setAttribute("aria-busy", "true");
    if (!chapterTocCache[key]) {
      chapterTocCache[key] = fetch(url).then(function (response) {
        if (!response.ok) throw new Error("chapter directory fetch failed");
        return response.text();
      }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        return chapterTocTemplate(doc.querySelector("#toc-nav ul"), url);
      });
    }
    chapterTocCache[key].then(function (template) {
      attachChapterToc(li, template, false);
      status.remove();
      li.removeAttribute("aria-busy");
      // A response must not reopen a directory the reader already collapsed.
    }).catch(function () {
      delete chapterTocCache[key];
      status.textContent = "目录加载失败，重新展开本回可重试。";
      li.removeAttribute("aria-busy");
    });
  }

  function navigate(url, fromHistory) {
    var sequence = ++navigationSequence;
    var destination = new URL(url, location.href);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("fetch failed");
        return r.text();
      })
      .then(function (html) {
        if (sequence !== navigationSequence) return;
        var doc = new DOMParser().parseFromString(html, "text/html");

        // Swap main content
        var newContent = doc.getElementById("content");
        var contentEl  = document.getElementById("content");
        if (!newContent || !contentEl) { window.location.href = url; return; }
        contentEl.innerHTML = newContent.innerHTML;
        activeChapterKey = destination.pathname;
        [".reader-banner", ".reader-epigraph", ".reader-pagination"].forEach(function (selector) {
          var oldPart = document.querySelector(selector);
          var newPart = doc.querySelector(selector);
          if (oldPart && newPart) oldPart.replaceWith(newPart.cloneNode(true));
        });

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
        if (!fromHistory) history.pushState({ url: url }, "", url);
        var mainEl = document.getElementById("main");
        if (mainEl) mainEl.scrollTo(0, 0);

        // Keep independently expanded directories when changing the reading page.
        document.querySelectorAll("#doc-nav-list .toc-active").forEach(function (link) {
          link.classList.remove("toc-active");
        });
        document.querySelectorAll("#doc-nav-list li.nav-chapter").forEach(function (li) {
          var button = li.firstElementChild;
          var current = chapterKey(li.getAttribute("data-chapter-url")) === destination.pathname;
          li.classList.toggle("nav-chapter-current", current);
          button.classList.toggle("current", current);
          if (current) button.setAttribute("aria-current", "page");
          else button.removeAttribute("aria-current");
          if (!current) return;
          var tocRoot = doc.querySelector("#toc-nav ul");
          if (tocRoot) {
            var template = chapterTocTemplate(tocRoot, url);
            chapterTocCache[destination.pathname] = Promise.resolve(template);
            attachChapterToc(li, template, true);
          }
          setChapterOpen(li, true);
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
        closeSidebar();
        if (destination.hash) finishSectionNavigation(destination.hash, sequence);
        document.dispatchEvent(new Event("reader:chapter"));
      })
      .catch(function () {
        if (sequence !== navigationSequence) return;
        // Fall back to normal navigation on any error
        window.location.href = url;
      });
  }

  // Handle browser back / forward.
  // Same-page history restores the section without fetching or resetting TOCs.
  window.addEventListener("popstate", function (e) {
    if (!e.state || !e.state.url) return;
    var destination = new URL(e.state.url, location.href);
    if (destination.pathname === activeChapterKey) {
      ++navigationSequence;
      scrollToSection(destination.hash, false);
      closeSidebar();
      return;
    }
    navigate(e.state.url, true);
  });

  // ── Chapter navigation ───────────────────────────────────────

  function buildDocNav() {
    var list = document.getElementById("doc-nav-list");
    if (!list || !window.docLib || !window.docLib.length) return;

    window.docLib.forEach(function (item, index) {
      var li = document.createElement("li");
      li.className = "nav-chapter";
      li.setAttribute("data-chapter-url", item.url);
      li.setAttribute("data-toc-id", "chapter-toc-" + index);
      var button = document.createElement("button");
      button.type = "button";
      button.className = "nav-chapter-toggle";
      button.textContent = item.title;
      button.title = item.title;
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", "chapter-toc-" + index);
      li.appendChild(button);
      var isCurrent = chapterKey(item.url) === location.pathname;

      if (isCurrent) {
        button.classList.add("current");
        button.setAttribute("aria-current", "page");
        li.classList.add("nav-chapter-current");
        setChapterOpen(li, true);

        // Cache the current directory without fetching its page again.
        var tocNav = document.getElementById("toc-nav");
        if (tocNav) {
          var tocUl = tocNav.querySelector("ul");
          if (tocUl) {
            var template = chapterTocTemplate(tocUl, item.url);
            chapterTocCache[chapterKey(item.url)] = Promise.resolve(template);
            attachChapterToc(li, template, false);
          }
          tocNav.style.display = "none";
          var divider = document.querySelector(".nav-divider");
          if (divider) divider.style.display = "none";
        }

        setTimeout(function () {
          button.scrollIntoView({ block: "nearest" });
        }, 0);
      }

      list.appendChild(li);
    });

    // Chapter titles control their own directories; reading navigation belongs
    // to the child section links, even when a different chapter is open.
    list.addEventListener("click", function (e) {
      var button = e.target.closest(".nav-chapter-toggle");
      if (!button || !list.contains(button)) return;
      var li = button.parentElement;
      var open = !li.classList.contains("open");
      setChapterOpen(li, open);
      if (open) loadChapterToc(li);
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
    document.getElementById("sidebar-toggle").setAttribute("aria-expanded", String(sidebar.classList.contains("open")));
  }

  function closeSidebar() {
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("overlay");
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
    document.getElementById("sidebar-toggle").setAttribute("aria-expanded", "false");
  }

  window.toggleSidebar = toggleSidebar;
  window.closeSidebar  = closeSidebar;

  // ── TOC active section highlighting ─────────────────────────

  function initTocHighlight() {
    var tocLinks = document.querySelectorAll("#doc-nav-list .nav-chapter-current ul.chapter-toc a");
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
            a.classList.toggle("toc-active", sectionId(new URL(a.href).hash) === id);
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
      if (img.closest(".polygon-gallery")) return;
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
    var list = document.getElementById("doc-nav-list");
    if (!list || tocEventsBound) return;
    tocEventsBound = true;
    list.addEventListener("click", function (e) {
      var link = e.target.closest("ul.chapter-toc a");
      if (!link || !list.contains(link) || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      var li = link.parentElement;
      if (directChild(li, "UL")) {
        var open = !li.classList.contains("open");
        li.classList.toggle("open", open);
        link.setAttribute("aria-expanded", String(open));
        return;
      }
      var destination = new URL(link.href);
      if (destination.pathname === activeChapterKey) {
        ++navigationSequence;
        var localUrl = destination.pathname + destination.search + destination.hash;
        if (localUrl !== location.pathname + location.search + location.hash) {
          history.pushState({ url: localUrl }, "", localUrl);
        }
        scrollToSection(destination.hash, true);
        closeSidebar();
      } else {
        navigate(destination.pathname + destination.search + destination.hash);
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
    history.replaceState(Object.assign({}, history.state, { url: location.pathname + location.search + location.hash }), "", location.href);
    buildDocNav();
    applyAutonum();
    initTocAccordion();
    tocHighlightObserver = initTocHighlight();
    buildFigureCaptions();
    initVideo();
    renderMath(document);
    var characterScroll = history.state && history.state.characterReturnScroll;
    var restoringCharacter = characterScroll && characterScroll.url === location.href && Number.isFinite(characterScroll.top) && characterScroll.top >= 0;
    if (location.hash && !restoringCharacter) finishSectionNavigation(location.hash, navigationSequence);
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
