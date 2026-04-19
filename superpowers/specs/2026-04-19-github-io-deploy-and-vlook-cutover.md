# GitHub.io 发布 + 切断 VLOOK 依赖

## 目标
1. 从本地构建管线彻底移除对 `../VLOOK/` 同级仓库的依赖。
2. 把教材作为主站发布到 `github.com/hydrays/hydrays.github.io`,
   根目录即新教材,旧内容全部删除,仅保留 `.git/` 与 `.gitignore`。

## 阶段 1 —— 本地切断 VLOOK 依赖(纯文件搬移 + 小改)

### 文件搬移
| 来源 | 目的地 |
|------|--------|
| `../VLOOK/released/themes/vlook-thinking.css` | `build/assets/chapter.css`(改名) |
| `docs/assets/vlook/pages-dev/fs-zen-min.css` | `build/assets/fonts/pages-dev/fs-zen-min.css` |
| `docs/assets/vlook/github-io/fs-zen-min.css` | `build/assets/fonts/github-io/fs-zen-min.css` |
| `build/vlook.lua` | `build/filters.lua`(改名) |

### 代码修改
- `build/assets/chapter.css` 顶部 2 行 `@import`:
  - `vlook/pages-dev/fs-zen-min.css` → `fonts/pages-dev/fs-zen-min.css`
  - `vlook/github-io/fs-zen-min.css` → `fonts/github-io/fs-zen-min.css`
- `build/build.py`:
  - 删除 `VLOOK_CSS_SRC/VLOOK_CSS_DST` 常量及其复制分支
  - `sync_assets()` 改为递归同步 `build/assets/**` → `docs/assets/`
  - `LUA_FILTER` 指向 `build/filters.lua`
- `build/template.html`:`assets/vlook-thinking.css` → `assets/chapter.css`

### docs/ 旧残留清理
- 删除 `docs/assets/vlook-thinking.css`
- 删除 `docs/assets/vlook/` 目录

### 自检
- 把 `../VLOOK/` 重命名为 `../VLOOK.bak`,重跑 `python3 build/build.py`,
  确认构建无警告且 `docs/chapter1.html` 在浏览器里样式完好,再恢复目录名。

## 阶段 2 —— 清理 `hydrays.github.io`

仅保留:`.git/`、`.gitignore`。
删除:`Chapters/`、`index.html`、`media/`、`Support1/`、`V2025.10/`。

## 阶段 3 —— 发布脚本 `build/publish.sh`

职责:构建 → rsync → commit → push。

骨架:
```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${HYDRAYS_IO:-$HOME/Code/books/hydrays.github.io}"
MSG="${1:-publish: update}"

python3 "$ROOT/build/build.py"

rsync -a --delete \
  --exclude='.git' --exclude='.gitignore' \
  "$ROOT/docs/" "$TARGET/"

cd "$TARGET"
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$MSG"
  git push
else
  echo "nothing to publish"
fi
```

`--delete` 保证删除过的文件在线上也会消失。
`--exclude` 保留目标仓库的 `.git` 与 `.gitignore`。

## 阶段 4 —— 验证
- 本地构建成功 + 浏览器核对排版、TOC、Three.js、KaTeX、callout
- 首次 `git push` 前等待用户确认
- 推送后浏览器访问 `hydrays.github.io` 复核

## 排除(已确认)
- 不保留旧版本内容(A)
- 不做 GitHub Action 自动部署
- 不做主题重写(VLOOK CSS 原样接管,不改外观)
