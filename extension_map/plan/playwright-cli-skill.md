# pi-browser 擴充：走 Skills 面，灌 @playwright/cli 官方 SKILL.md

## Context

使用者要 pi 多會「上網」（開頁、點按鈕、填表單、截圖、把頁面內容餵 LLM 推理），指定用 `microsoft/playwright-cli`（npm: `@playwright/cli` v0.1.9, 2026-04-25 — 微軟今年重推的 verb-style stateful 瀏覽器 CLI）。

我原本的設計是寫一個 `pi-browser.ts` extension 把 8 個子命令包成 pi tool。使用者糾正：playwright-cli 自帶 `install --skills`，正確路線是走 pi Customization 五面之一的 **Skills**，把官方維護的 `SKILL.md` 直接灌進 `~/.pi/agent/skills/`，agent 用 pi 內建 bash tool spawn `playwright-cli ...` 即可，不用寫 TS。

事實核對結論支持這條路：
- pi 0.70.5 的 skill loader 認 Claude Code 風格的 frontmatter（含 `allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)`），未知欄位忽略而非 reject
- pi skill 機制是「啟動掃 name+description 進 system prompt → LLM 自主 read 完整 SKILL.md → 必要時讀 references/ 子檔」的漸進揭露，正好對到 playwright-cli 提供的 650 行 SKILL.md + `references/`
- skill 升級只要 `npm install -g @playwright/cli@latest` 後重跑 install 命令同步檔案，由微軟維護

## 設計總覽

不寫任何 TypeScript。三步驟全在 shell：

1. 全域裝 `@playwright/cli` 與 chromium 二進位
2. 用 stage 目錄跑 `playwright-cli install --skills` 拿到官方 skill 包，整包搬到 `~/.pi/agent/skills/playwright-cli/`
3. 在 extension_map 的 Skills 區塊登記

LLM 行為預期：使用者打「幫我截圖 example.com 首頁」→ pi 系統 prompt 早就有 `playwright-cli` skill 的 description → LLM 用 `read` 載入 SKILL.md → 用 bash tool spawn `playwright-cli open ...` + `playwright-cli screenshot ...`。skill frontmatter 的 `allowed-tools: Bash(playwright-cli:*)` 預批准這些命令，agent 不會卡 permission 確認。

## 檔案佈局

```
~/.pi/agent/skills/playwright-cli/
  SKILL.md                 微軟官方，~650 行，Claude Code 風格 frontmatter
  references/              skill 內 reference 子檔（pi 支援子目錄相對讀取）
/home/sihaogu/pi/extension_map/index.md
                            Skills H2 加一條，更新 Last updated
```

不新增任何 `~/.pi/agent/extensions/` 下的檔案；既有的 `permission-gate.ts` / `protected-paths.ts` 與本擴充無衝突（前者攔 `rm -rf / sudo / chmod 777`、後者攔對 `.env / .git/ / node_modules/` 的 write/edit；playwright-cli 不會碰這些）。

## 安裝與初始化步驟

```bash
# 1. 全域裝 CLI
npm install -g @playwright/cli@latest

# 2. 裝瀏覽器二進位（~300MB，第一次較慢）
npx playwright install chromium

# 3. 用 stage 目錄取官方 skill 並搬到 pi 位置
mkdir -p ~/.pi/agent/skills
stage=$(mktemp -d)
( cd "$stage" && playwright-cli install --skills )   # 預設寫到 ./.claude/skills/playwright-cli/
cp -r "$stage/.claude/skills/playwright-cli" ~/.pi/agent/skills/
rm -rf "$stage"

# 4. 驗檔
ls ~/.pi/agent/skills/playwright-cli/
head -10 ~/.pi/agent/skills/playwright-cli/SKILL.md
```

第 5 步：編輯 `/home/sihaogu/pi/extension_map/index.md`：

- 在 `## Skills` 區塊（目前是「*尚無*」）加一條 `playwright-cli/` 的登記
- 把頂部 `Last updated:` 改成 `2026-04-28（新增 playwright-cli skill）`

## 驗證計畫（end-to-end）

開新 pi REPL，依序跑：

1. **skill 被掃到**：`/skills` 或 `/help` 應列出 `playwright-cli`
2. **基本載入 + a11y snapshot**：「用 playwright-cli 開 https://example.com 並告訴我頁面標題、連結數」→ LLM 應自動 read SKILL.md → spawn `playwright-cli open https://example.com` + `playwright-cli snapshot` → 回 "Example Domain" + 1 個 More information link
3. **截圖落盤**：「截圖 https://news.ycombinator.com 首頁存到 /tmp/hn.png」→ `playwright-cli screenshot --path /tmp/hn.png` 成功，檔在
4. **互動串接**：「去 https://duckduckgo.com，搜尋 'pi coding agent'，告訴我第一個結果標題」→ `goto` + `fill` + `press Enter` + `snapshot` 多步串接
5. **權限預批准**：上述任一步 pi 不該跳出 bash 確認框（拜 `allowed-tools` frontmatter 之賜）。如果有跳，代表 frontmatter 沒被 pi 認到，需要往下排查（可能要把 frontmatter 改成 pi 純 spec 形式）

跑完 1+2+5 確認 happy path + permission 通；3+4 確認 LLM 能從 skill 學到串接多命令。

## 升級維護

- 上游 SKILL.md 更新：`npm install -g @playwright/cli@latest` 後重跑「安裝步驟」第 3 步即可同步
- 不需要 watch upstream，使用者覺得 skill 過期再手動更新

## 待釐清的小風險（執行時遇到再處理）

- 如 `playwright-cli install --skills` 在某些環境預設不是寫 `./.claude/skills/playwright-cli/` 而是別的路徑（例如 `~/.claude/skills/`），上面 `cp -r` 路徑要對著調
- 如 pi 對 `allowed-tools` 的解析跟 Claude Code 不完全一致，第 5 步驗證會發現，屆時把 frontmatter 那行刪掉，agent 第一次跑 bash 時手動批准一次也行
