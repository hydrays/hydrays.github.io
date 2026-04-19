# Exercise System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a plug-and-play exercise library to NewMathAnalysis — each exercise lives in its own Markdown file, is cited inline in chapters via `::: {.exercise id="..."}`, injected as interactive HTML at build time, and indexed to `docs/exercises/index.json` for future AI/search use.

**Architecture:** A new `build/exercise.py` module handles all exercise logic (parsing, HTML generation, index building). `build/build.py` calls into it during the pre-Pandoc step and at the end of the full build. The interactive show/hide behaviour lives in `app.js`; exercise styles live in `app.css`. Nothing in the Lua filter or Pandoc invocation changes.

**Tech Stack:** Python 3 (stdlib + PyYAML, already used), HTML/CSS/JS (no new dependencies)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `build/exercise.py` | Parse exercise `.md` files; generate exercise HTML; build `index.json` |
| Modify | `build/build.py` | Call `inject_exercises()` before Pandoc; call `build_exercise_index()` after all chapters |
| Modify | `build/assets/app.css` | Exercise block visual styles |
| Modify | `build/assets/app.js` | Show/hide toggle logic for solution panels, hints, answers |
| Create | `src/exercises/chpt1-ex-001.md` | Sample exercise (limits, ε-δ) used in tests and as template |
| Create | `src/exercises/chpt1-ex-002.md` | Second sample exercise (limit laws) |

---

## Task 1: Create `build/exercise.py` — parser and HTML generator

**Files:**
- Create: `build/exercise.py`

- [ ] **Step 1: Write the failing test**

Create `build/test_exercise.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from exercise import parse_exercise_file, render_exercise_html

SAMPLE = """\
---
id: chpt1-ex-001
chapter: 1
tags: [极限, epsilon-delta]
difficulty: medium
video:
---

## Problem

Show that $\\lim_{x \\to 2}(3x-1) = 5$.

## Solution 1

### Hint
Work backwards from $|f(x) - L| < \\varepsilon$.

### Answer
Let $\\varepsilon > 0$. Choose $\\delta = \\varepsilon / 3$.
"""

def test_parse_metadata():
    ex = parse_exercise_file(SAMPLE)
    assert ex["id"] == "chpt1-ex-001"
    assert ex["chapter"] == 1
    assert ex["tags"] == ["极限", "epsilon-delta"]
    assert ex["difficulty"] == "medium"
    assert ex["video"] is None

def test_parse_problem():
    ex = parse_exercise_file(SAMPLE)
    assert "3x-1" in ex["problem"]

def test_parse_solutions():
    ex = parse_exercise_file(SAMPLE)
    assert len(ex["solutions"]) == 1
    assert "varepsilon" in ex["solutions"][0]["hint"]
    assert "delta" in ex["solutions"][0]["answer"]

def test_render_contains_key_elements():
    ex = parse_exercise_file(SAMPLE)
    html = render_exercise_html(ex)
    assert 'class="exercise-block"' in html
    assert 'data-difficulty="medium"' in html
    assert "极限" in html
    assert "epsilon-delta" in html
    assert "显示提示" in html
    assert "显示答案" in html
    # no video button when video is None
    assert "视频" not in html

def test_render_video_button_appears():
    import copy
    ex = parse_exercise_file(SAMPLE)
    ex = dict(ex)
    ex["video"] = "https://example.com/video"
    html = render_exercise_html(ex)
    assert "视频" in html
    assert "https://example.com/video" in html

def test_render_multiple_solutions():
    sample2 = SAMPLE + """
## Solution 2

### Hint
Use linearity of limits.

### Answer
$\\lim(3x-1) = 3 \\cdot 2 - 1 = 5$.
"""
    ex = parse_exercise_file(sample2)
    assert len(ex["solutions"]) == 2
    html = render_exercise_html(ex)
    assert "解法一" in html
    assert "解法二" in html
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
python -m pytest build/test_exercise.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'exercise'`

- [ ] **Step 3: Create `build/exercise.py`**

```python
"""
exercise.py — Exercise library parser and HTML renderer for NewMathAnalysis.

Public API:
  parse_exercise_file(text: str) -> dict
  render_exercise_html(ex: dict) -> str
  inject_exercises(content: str, exercises_dir: Path) -> str
  build_exercise_index(exercises_dir: Path, out_path: Path) -> None
"""

import re
import json
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None


# ── Parser ────────────────────────────────────────────────────────────────────

def _split_frontmatter(text: str):
    """Return (meta_dict, body_str)."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    yaml_str = text[3:end]
    body = text[end + 4:]
    if yaml is None:
        raise ImportError("PyYAML is required: pip install pyyaml")
    meta = yaml.safe_load(yaml_str) or {}
    return meta, body


def _parse_sections(body: str) -> dict:
    """
    Split body into:
      problem: str
      solutions: list of {hint: str, answer: str}
    """
    # Split on ## headings
    parts = re.split(r"^## ", body, flags=re.MULTILINE)
    problem = ""
    solutions = []

    for part in parts:
        part = part.strip()
        if not part:
            continue
        first_line, _, rest = part.partition("\n")
        heading = first_line.strip().lower()

        if heading == "problem":
            problem = rest.strip()
        elif re.match(r"solution\s*\d*", heading):
            hint, answer = _parse_solution_body(rest)
            solutions.append({"hint": hint, "answer": answer})

    return {"problem": problem, "solutions": solutions}


def _parse_solution_body(text: str) -> tuple:
    """Return (hint_str, answer_str) from a solution body."""
    hint = ""
    answer = ""
    parts = re.split(r"^### ", text, flags=re.MULTILINE)
    for part in parts:
        part = part.strip()
        if not part:
            continue
        first_line, _, rest = part.partition("\n")
        heading = first_line.strip().lower()
        if heading == "hint":
            hint = rest.strip()
        elif heading == "answer":
            answer = rest.strip()
    return hint, answer


def parse_exercise_file(text: str) -> dict:
    """
    Parse an exercise .md file (as a string) and return a dict:
      id, chapter, tags, difficulty, video, problem, solutions
    """
    meta, body = _split_frontmatter(text)
    sections = _parse_sections(body)

    return {
        "id":         str(meta.get("id", "")),
        "chapter":    meta.get("chapter", 0),
        "tags":       meta.get("tags") or [],
        "difficulty": str(meta.get("difficulty", "medium")),
        "video":      meta.get("video") or None,
        "problem":    sections["problem"],
        "solutions":  sections["solutions"],
    }


# ── HTML renderer ─────────────────────────────────────────────────────────────

_DIFFICULTY_DOT = {
    "easy":   ("difficulty-easy",   "🟢"),
    "medium": ("difficulty-medium", "🟡"),
    "hard":   ("difficulty-hard",   "🔴"),
}

_SOLUTION_LABELS = [
    "解法一", "解法二", "解法三", "解法四", "解法五",
    "解法六", "解法七", "解法八", "解法九", "解法十",
]


def _tag_pill(tag: str) -> str:
    safe = tag.replace('"', "&quot;")
    return f'<span class="ex-tag">{safe}</span>'


def _solution_panel(sol: dict, idx: int, ex_id: str) -> str:
    label = _SOLUTION_LABELS[idx] if idx < len(_SOLUTION_LABELS) else f"解法{idx+1}"
    panel_id  = f"{ex_id}-sol-{idx}"
    hint_id   = f"{ex_id}-hint-{idx}"
    answer_id = f"{ex_id}-ans-{idx}"

    hint_block = ""
    if sol["hint"]:
        hint_block = (
            f'<button class="ex-reveal-btn" data-target="{hint_id}">显示提示</button>\n'
            f'<div class="ex-collapsible" id="{hint_id}" hidden>{sol["hint"]}</div>\n'
        )

    answer_block = (
        f'<button class="ex-reveal-btn" data-target="{answer_id}">显示答案</button>\n'
        f'<div class="ex-collapsible" id="{answer_id}" hidden>{sol["answer"]}</div>\n'
    )

    return (
        f'<button class="ex-solution-toggle" data-target="{panel_id}">{label} ▼</button>\n'
        f'<div class="ex-solution-panel" id="{panel_id}" hidden>\n'
        f'{hint_block}'
        f'{answer_block}'
        f'</div>\n'
    )


def render_exercise_html(ex: dict) -> str:
    ex_id = ex["id"]
    diff_class, diff_dot = _DIFFICULTY_DOT.get(
        ex["difficulty"], ("difficulty-medium", "🟡")
    )

    tags_html = "".join(_tag_pill(t) for t in ex["tags"])

    video_btn = ""
    if ex.get("video"):
        video_btn = (
            f'<a class="ex-video-btn" href="{ex["video"]}" '
            f'target="_blank" rel="noopener">📹 视频</a>\n'
        )

    solutions_html = "".join(
        _solution_panel(sol, i, ex_id)
        for i, sol in enumerate(ex["solutions"])
    )

    return (
        f'<div class="exercise-block" id="{ex_id}" data-difficulty="{ex["difficulty"]}">\n'
        f'  <div class="ex-header">\n'
        f'    <span class="ex-label">练习</span>\n'
        f'    <span class="ex-dot {diff_class}">{diff_dot}</span>\n'
        f'    <span class="ex-tags">{tags_html}</span>\n'
        f'  </div>\n'
        f'  <div class="ex-problem">{ex["problem"]}</div>\n'
        f'  <div class="ex-controls">\n'
        f'{solutions_html}'
        f'{video_btn}'
        f'  </div>\n'
        f'</div>\n'
    )


# ── Build-time injection ──────────────────────────────────────────────────────

_EX_DIV_RE = re.compile(
    r'^:::[ \t]*\{\.exercise[ \t]+id="([^"]+)"[ \t]*\}[ \t]*\n:::[ \t]*$',
    re.MULTILINE,
)


def _load_exercise(ex_id: str, exercises_dir: Path) -> dict:
    """Find and parse the exercise file for ex_id."""
    # Search all chapter subdirectories
    for md_file in exercises_dir.rglob(f"{ex_id}.md"):
        return parse_exercise_file(md_file.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"Exercise '{ex_id}' not found in {exercises_dir}")


def inject_exercises(content: str, exercises_dir: Path) -> str:
    """
    Replace all ::: {.exercise id="..."} ::: blocks in content with
    raw HTML exercise blocks. Missing exercises emit a warning comment.
    """
    def replace(m):
        ex_id = m.group(1)
        try:
            ex = _load_exercise(ex_id, exercises_dir)
            html = render_exercise_html(ex)
            # Wrap in a raw HTML block so Pandoc passes it through untouched
            return f"\n{html}\n"
        except FileNotFoundError as e:
            print(f"  Warning: {e}")
            return f'<!-- exercise not found: {ex_id} -->\n'

    return _EX_DIV_RE.sub(replace, content)


# ── Index builder ─────────────────────────────────────────────────────────────

def build_exercise_index(exercises_dir: Path, out_path: Path) -> None:
    """
    Scan all exercise .md files and write out_path/index.json.
    """
    if not exercises_dir.exists():
        return

    index = []
    for md_file in sorted(exercises_dir.rglob("*.md")):
        try:
            ex = parse_exercise_file(md_file.read_text(encoding="utf-8"))
            index.append({
                "id":         ex["id"],
                "chapter":    ex["chapter"],
                "tags":       ex["tags"],
                "difficulty": ex["difficulty"],
                "video":      ex["video"],
                "source":     str(md_file),
            })
        except Exception as e:
            print(f"  Warning: could not index {md_file.name}: {e}")

    out_path.mkdir(parents=True, exist_ok=True)
    (out_path / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  → docs/exercises/index.json ({len(index)} exercises)")
```

- [ ] **Step 4: Run tests**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
python -m pytest build/test_exercise.py -v
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
git add build/exercise.py build/test_exercise.py
git commit -m "feat: add exercise.py — parser, HTML renderer, injector, index builder"
```

---

## Task 2: Create sample exercise files

**Files:**
- Create: `src/exercises/chpt1-ex-001.md`
- Create: `src/exercises/chpt1-ex-002.md`

- [ ] **Step 1: Create `src/exercises/chpt1-ex-001.md`**

```markdown
---
id: chpt1-ex-001
chapter: 1
tags: [极限, epsilon-delta]
difficulty: medium
video:
---

## Problem

用 $\varepsilon$-$\delta$ 定义证明 $\displaystyle \lim_{x \to 2}(3x-1) = 5$.

## Solution 1

### Hint
从 $|f(x) - L| < \varepsilon$ 反推出 $\delta$ 的取法.

### Answer
设 $\varepsilon > 0$. 注意到 $|(3x-1)-5| = |3x-6| = 3|x-2|$.

取 $\delta = \varepsilon/3$, 则当 $0 < |x-2| < \delta$ 时,

$$|(3x-1)-5| = 3|x-2| < 3\delta = \varepsilon.$$

由极限定义, $\displaystyle\lim_{x\to 2}(3x-1)=5$. $\blacksquare$

## Solution 2

### Hint
直接利用极限的线性性质.

### Answer
由极限的线性性质:

$$\lim_{x\to 2}(3x-1) = 3\lim_{x\to 2}x - \lim_{x\to 2}1 = 3\cdot 2 - 1 = 5. \quad\blacksquare$$
```

- [ ] **Step 2: Create `src/exercises/chpt1-ex-002.md`**

```markdown
---
id: chpt1-ex-002
chapter: 1
tags: [极限, 夹逼定理]
difficulty: easy
video:
---

## Problem

求极限 $\displaystyle\lim_{n\to\infty}\frac{\sin n}{n}$.

## Solution 1

### Hint
$|\sin n| \leq 1$ 对所有整数 $n$ 成立. 用夹逼定理.

### Answer
因为 $|\sin n| \leq 1$, 所以

$$-\frac{1}{n} \leq \frac{\sin n}{n} \leq \frac{1}{n}.$$

由于 $\displaystyle\lim_{n\to\infty}\frac{1}{n} = 0$, 由夹逼定理得

$$\lim_{n\to\infty}\frac{\sin n}{n} = 0. \quad\blacksquare$$
```

- [ ] **Step 3: Verify the parser handles real files**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
python3 -c "
from pathlib import Path
import sys; sys.path.insert(0, 'build')
from exercise import parse_exercise_file, render_exercise_html
for f in sorted(Path('src/exercises').glob('*.md')):
    ex = parse_exercise_file(f.read_text())
    print(f['id'], '—', len(ex['solutions']), 'solution(s)')
    print(render_exercise_html(ex)[:200])
    print('---')
"
```

Expected: prints metadata and first 200 chars of HTML for each exercise, no errors.

- [ ] **Step 4: Commit**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
git add src/exercises/
git commit -m "feat: add sample exercises chpt1-ex-001 and chpt1-ex-002"
```

---

## Task 3: Wire `inject_exercises` into `build.py`

**Files:**
- Modify: `build/build.py` (lines 16–24 imports, line 250 `preprocess` call, end of `main()`)

- [ ] **Step 1: Add import and path constant to `build.py`**

At the top of `build/build.py`, after the existing imports (after line 23), add:

```python
from exercise import inject_exercises, build_exercise_index
```

After the `SRC_DIR` line (line 44), add:

```python
EXERCISES_DIR = SRC_DIR / "exercises"
EXERCISES_OUT  = DOCS_DIR / "exercises"
```

- [ ] **Step 2: Call `inject_exercises` in `build_chapter`**

In `build_chapter`, find the line:

```python
    body = preprocess(body)
```

Replace it with:

```python
    body = preprocess(body)
    body = inject_exercises(body, EXERCISES_DIR)
```

- [ ] **Step 3: Call `build_exercise_index` at end of full build**

In `main()`, after the loop that builds all chapters, before the final `print(f"\nDone...")`, add:

```python
    print("\nBuilding exercise index ...")
    build_exercise_index(EXERCISES_DIR, EXERCISES_OUT)
```

- [ ] **Step 4: Test with a chapter that has no exercise citations**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
python3 build/build.py src/chpt2.md
```

Expected: builds normally, no errors, `docs/chapter2.html` updated, `docs/exercises/index.json` created (may be empty if no exercises in chpt2).

- [ ] **Step 5: Add an exercise citation to chpt1 and test**

Open `src/chpt1.md`. Find the section `### 1.1.3 函数` (around line 142) and add after the first paragraph:

```markdown
::: {.exercise id="chpt1-ex-001"}
:::
```

Then rebuild:

```bash
python3 build/build.py src/chpt1.md
```

Open `docs/chapter1.html` in a browser. Expected: exercise block renders with problem text visible, "解法一 ▼", "解法二 ▼" buttons present, and `docs/exercises/index.json` contains 2 entries.

- [ ] **Step 6: Commit**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
git add build/build.py src/chpt1.md
git commit -m "feat: wire exercise injection and index generation into build pipeline"
```

---

## Task 4: Add exercise styles to `app.css`

**Files:**
- Modify: `build/assets/app.css`

- [ ] **Step 1: Append exercise styles to end of `build/assets/app.css`**

```css
/* ── Exercise blocks ─────────────────────────────────────────── */

.exercise-block {
  border: 1px solid var(--v-bd, #e0e0e0);
  border-left: 4px solid var(--v-ac, #298bcc);
  border-radius: 6px;
  padding: 1rem 1.2rem;
  margin: 1.5rem 0;
  background: var(--v-bg, #fff);
}

.ex-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.ex-label {
  font-weight: 700;
  font-size: 0.95em;
  color: var(--v-ac, #298bcc);
}

.ex-dot {
  font-size: 0.75em;
  line-height: 1;
}

.ex-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.ex-tag {
  font-size: 0.7em;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--v-hover-bg, rgba(28,30,31,0.07));
  color: var(--v-tt-2, #7d868a);
  letter-spacing: 0.02em;
}

.ex-problem {
  margin-bottom: 1rem;
  line-height: 1.7;
}

.ex-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.ex-solution-toggle,
.ex-reveal-btn {
  padding: 4px 12px;
  border: 1px solid var(--v-bd, #e0e0e0);
  border-radius: 4px;
  background: transparent;
  color: var(--v-tt, #1c1e1f);
  font-size: 0.875em;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.ex-solution-toggle:hover,
.ex-reveal-btn:hover {
  background: var(--v-hover-bg, rgba(28,30,31,0.07));
  border-color: var(--v-ac, #298bcc);
}

.ex-video-btn {
  padding: 4px 12px;
  border: 1px solid var(--v-bd, #e0e0e0);
  border-radius: 4px;
  color: var(--v-tt, #1c1e1f);
  font-size: 0.875em;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}

.ex-video-btn:hover {
  background: var(--v-hover-bg, rgba(28,30,31,0.07));
  border-color: var(--v-ac, #298bcc);
}

.ex-solution-panel {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--v-bd, #e0e0e0);
  border-radius: 4px;
  background: var(--v-nav-bg, #f8f8f8);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ex-collapsible {
  padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--v-ac-bg, #ddedf8);
  background: var(--v-bg, #fff);
  border-radius: 0 4px 4px 0;
  line-height: 1.7;
}
```

- [ ] **Step 2: Rebuild chapter1 and verify styles**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
python3 build/build.py src/chpt1.md
```

Open `docs/chapter1.html`. Expected: exercise block has a blue left border, tags are small pills, buttons are styled. No layout breakage elsewhere.

- [ ] **Step 3: Commit**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
git add build/assets/app.css
git commit -m "feat: add exercise block CSS styles"
```

---

## Task 5: Add show/hide toggle logic to `app.js`

**Files:**
- Modify: `build/assets/app.js`

- [ ] **Step 1: Append exercise toggle logic to end of `build/assets/app.js`**

Find the closing `})();` at the very end of `app.js` and insert the following **before** it:

```javascript
  // ── Exercise show/hide ───────────────────────────────────────
  // Handles .ex-solution-toggle and .ex-reveal-btn buttons.
  // Uses event delegation on document so it works after SPA navigation.

  function handleExerciseClick(e) {
    var btn = e.target.closest(".ex-solution-toggle, .ex-reveal-btn");
    if (!btn) return;
    var targetId = btn.getAttribute("data-target");
    if (!targetId) return;
    var panel = document.getElementById(targetId);
    if (!panel) return;
    var hidden = panel.hasAttribute("hidden");
    if (hidden) {
      panel.removeAttribute("hidden");
      // Rotate arrow on solution toggles
      if (btn.classList.contains("ex-solution-toggle")) {
        btn.textContent = btn.textContent.replace("▼", "▲");
      }
      // Re-render any math inside newly revealed content
      if (typeof renderMath === "function") renderMath(panel);
    } else {
      panel.setAttribute("hidden", "");
      if (btn.classList.contains("ex-solution-toggle")) {
        btn.textContent = btn.textContent.replace("▲", "▼");
      }
    }
  }

  document.addEventListener("click", handleExerciseClick);
```

- [ ] **Step 2: Rebuild and test interactivity**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
python3 build/build.py src/chpt1.md
python3 -m http.server 8080 --bind 100.74.177.128
```

Open `http://100.74.177.128:8080/docs/chapter1.html` in a browser.

Check:
- [ ] Exercise block is visible with problem text
- [ ] Clicking "解法一 ▼" reveals the solution panel, arrow changes to ▲
- [ ] Clicking "解法一 ▲" collapses the panel, arrow reverts to ▼
- [ ] Clicking "显示提示" reveals hint text
- [ ] Clicking "显示答案" reveals answer text (with rendered math)
- [ ] "解法二 ▼" works independently of 解法一

- [ ] **Step 3: Commit**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
git add build/assets/app.js
git commit -m "feat: add exercise show/hide toggle logic to app.js"
```

---

## Task 6: Full build and index verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run full build**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
python3 build/build.py
```

Expected: all chapters build without error. Last line of output includes `docs/exercises/index.json (2 exercises)`.

- [ ] **Step 2: Verify index.json**

```bash
cat /home/hydra/Code/books/NewMathAnalysis/docs/exercises/index.json
```

Expected output:

```json
[
  {
    "id": "chpt1-ex-001",
    "chapter": 1,
    "tags": ["极限", "epsilon-delta"],
    "difficulty": "medium",
    "video": null,
    "source": "..."
  },
  {
    "id": "chpt1-ex-002",
    "chapter": 1,
    "tags": ["极限", "夹逼定理"],
    "difficulty": "easy",
    "video": null,
    "source": "..."
  }
]
```

- [ ] **Step 3: Verify no regressions in other chapters**

Open `docs/chapter2.html` and `docs/chapter3.html`. Confirm content, math, callouts, and TOC render correctly.

- [ ] **Step 4: Final commit**

```bash
cd /home/hydra/Code/books/NewMathAnalysis
git add docs/exercises/index.json
git commit -m "feat: complete exercise system — injection, styles, interactivity, index"
```

---

## Self-Review Notes

- **Spec coverage:** all sections covered — file format (Task 2), citation syntax (Task 3), build pipeline (Task 3), UI layout (Tasks 4+5), index (Task 3+6), multiple solutions (Tasks 1+2), difficulty dot (Task 4), tag pills (Task 4), video button (Tasks 1+4+5).
- **Pandoc passthrough:** exercise HTML is injected as a raw string directly into the body before Pandoc runs. Since `build.py` already uses `--from markdown-mark+raw_html`, Pandoc passes raw HTML blocks through untouched — no Lua filter changes needed.
- **Math in revealed panels:** `renderMath(panel)` is called when a panel is first revealed, so KaTeX renders equations inside hidden divs correctly.
- **No placeholders:** all code is complete and runnable.
