# Exercise System Design

**Date:** 2026-04-13  
**Project:** NewMathAnalysis  
**Scope:** Plug-and-play exercise library with interactive HTML UI

---

## Overview

A structured exercise library where each exercise lives as an independent Markdown file with YAML frontmatter. Exercises are cited inline in chapter source files, injected at build time into the HTML output, and indexed into a machine-readable JSON file for future AI/search use.

---

## Exercise File Format

Each exercise lives at `src/exercises/chptN-ex-NNN.md`.

```markdown
---
id: chpt1-ex-001
chapter: 1
tags: [极限, epsilon-delta]
difficulty: medium        # easy | medium | hard
video:                    # optional URL, leave blank if none
---

## Problem

Show that $\displaystyle \lim_{x \to 2} (3x-1) = 5$ using the $\varepsilon$-$\delta$ definition.

## Solution 1

### Hint
Work backwards from $|f(x) - L| < \varepsilon$.

### Answer
Let $\varepsilon > 0$. Choose $\delta = \varepsilon / 3$...

## Solution 2

### Hint
Use linearity of limits.

### Answer
$\lim(3x-1) = 3\lim x - 1 = 5$.
```

**Rules:**
- One file per exercise
- `id` is unique across all exercises, format: `chptN-ex-NNN`
- Multiple `## Solution N` sections are supported, each with its own `### Hint` and `### Answer`
- Figures use the same `![](../media/img/...)` syntax as chapters
- Code blocks and equations work as standard Markdown

---

## Citing Exercises in Chapters

In any `src/chptN.md` file, cite an exercise using Pandoc div syntax:

```markdown
::: {.exercise id="chpt1-ex-001"}
:::
```

The build script resolves the ID and injects the full exercise HTML before Pandoc processes the file.

---

## Build Pipeline Changes

`build.py` gains two new responsibilities:

### 1. Exercise Resolution (pre-Pandoc)

Before passing a chapter to Pandoc, `build.py`:
1. Scans the chapter source for `::: {.exercise id="..."}` blocks
2. Loads the matching `src/exercises/chptN-ex-NNN.md`
3. Parses its YAML frontmatter and Markdown sections
4. Replaces the block with a raw HTML block (wrapped in `````html ... ````` so Pandoc passes it through untouched via `--from markdown+raw_html`)

The Lua filter (`vlook.lua`) is **not modified** — injection happens entirely in Python.

### 2. Index Generation (post-build)

After all chapters are built, `build.py` writes `docs/exercises/index.json`:

```json
[
  {
    "id": "chpt1-ex-001",
    "chapter": 1,
    "tags": ["极限", "epsilon-delta"],
    "difficulty": "medium",
    "video": null,
    "source": "src/exercises/chpt1-ex-001.md"
  }
]
```

This index is the foundation for future AI and search features.

---

## Rendered HTML UI

Each exercise renders as a self-contained block:

```
┌─────────────────────────────────────────────────────┐
│  练习  ●  ⌈极限⌋ ⌈ε-δ⌋                             │
│                                                      │
│  证明 lim(3x-1) = 5，用 ε-δ 定义。                  │
│                                                      │
│  [ 解法一 ▼ ]  [ 解法二 ▼ ]  [ 📹 视频 ]           │
│                                                      │
│  ┌── 解法一 ──────────────────────────────────┐    │
│  │  [ 显示提示 ]                               │    │
│  │  [ 显示答案 ]                               │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Details:**
- Problem text is always visible
- Difficulty shown as a small colored dot: 🟢 简单 / 🟡 中等 / 🔴 困难
- Tags rendered as small muted pill labels (unobtrusive)
- Each solution is a collapsible panel toggled by its button
- Hint and Answer within each solution are independently revealed
- Video button only appears if the exercise has a `video` URL
- Styled consistently with existing `app.css` and VLOOK Thinking theme

**HTML structure (sketch):**

```html
<div class="exercise-block" data-difficulty="medium">
  <div class="exercise-header">
    <span class="exercise-label">练习</span>
    <span class="difficulty-dot difficulty-medium"></span>
    <span class="exercise-tag">极限</span>
    <span class="exercise-tag">ε-δ</span>
  </div>
  <div class="exercise-problem">
    <!-- problem content rendered from Markdown -->
  </div>
  <div class="exercise-controls">
    <button class="solution-toggle" data-target="sol-1">解法一 ▼</button>
    <button class="solution-toggle" data-target="sol-2">解法二 ▼</button>
    <a class="video-btn" href="...">📹 视频</a>  <!-- only if video URL present -->
  </div>
  <div class="solution-panel" id="sol-1" hidden>
    <button class="reveal-btn" data-target="hint-1">显示提示</button>
    <div class="hint" id="hint-1" hidden><!-- hint --></div>
    <button class="reveal-btn" data-target="answer-1">显示答案</button>
    <div class="answer" id="answer-1" hidden><!-- answer --></div>
  </div>
  <!-- solution-panel for sol-2, etc. -->
</div>
```

Interactive behavior implemented in `build/assets/app.js` (toggle show/hide on button click).

---

## File Structure Changes

```
NewMathAnalysis/
├── src/
│   ├── exercises/          ← NEW: exercise library
│   │   ├── chpt1-ex-001.md
│   │   ├── chpt1-ex-002.md
│   │   └── ...
│   └── chptN.md            ← unchanged, cite exercises with ::: {.exercise}
├── build/
│   ├── build.py            ← modified: exercise injection + index generation
│   └── assets/
│       ├── app.css         ← modified: exercise block styles
│       └── app.js          ← modified: show/hide toggle logic
└── docs/
    ├── exercises/
    │   └── index.json      ← NEW: generated exercise index
    └── chapterN.html       ← unchanged output location
```

---

## Future Extensions

- **AI button:** add `[ 🤖 问AI ]` to the exercise controls — slots in naturally alongside the existing buttons
- **Search/filter:** use `index.json` to build a browsable exercise index page filtered by tag, chapter, or difficulty
- **Video system:** same design pattern — video files cited by ID, injected at build time
