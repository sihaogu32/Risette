# Risette

把本機 `~/.pi/agent/` 的擴充打包，方便在另一台機器透過 `pi install` 重現環境。

## 在新機器上重現環境

```bash
# 0. 先裝 pi 本體（提供 `pi` CLI，下面 `pi install` 才有用）
npm install -g @mariozechner/pi-coding-agent

# 1. extensions（由本 package 提供）
pi install git:github.com/sihaogu32/Risette

# 2. subagents（獨立 npm package，不打包進本 repo）
pi install npm:pi-subagents

# 3. skills（上游有一鍵指令，不在本 package 內）
npm install -g @playwright/cli@latest          # 全域裝 CLI
npx playwright install chromium                # 裝瀏覽器二進位 (~300MB)
(cd $(mktemp -d) && playwright-cli install --skills) \
  && cp -r .claude/skills/playwright-cli ~/.pi/agent/skills/
```

## 內容

### Extensions（`./extensions/`）

- `permission-gate.ts` — 攔截 bash 危險指令（`rm -rf` / `sudo` / `chmod 777` / `chown 777`）
- `protected-paths.ts` — 攔截 `write` / `edit` 寫到含 `.env` / `.git/` / `node_modules/` 的路徑
- `financial-news.ts` — 註冊 `/daily-news` command + `save_news_report` tool；agent 用 playwright-cli skill 抓 Google News 後落檔 `~/financial-news/YYYY-MM-DD[-<kw>...].md`（依賴下方 `playwright-cli` skill）

`permission-gate.ts` / `protected-paths.ts` 來自 `@mariozechner/pi-coding-agent` 官方 examples（MIT），原樣 copy。

### Pi packages（獨立 npm package，見上方安裝指令）

- `npm:pi-subagents`（nicobailon／MIT）— sub-agent 委派工具：single / parallel / chain 模式 + background runs + `/agents` 互動管理 + `/subagents-status` / `/subagents-doctor` + `agentOverrides`；自帶 8 個 builtin agents（scout / researcher / planner / worker / reviewer / context-builder / oracle / delegate）+ 3 個 prompts + 1 個 skill。

  不打包進本 repo 的原因：作者另一個獨立 package，迭代頻繁，分開裝後續才能跟著上游 `pi update` 升級。

### Skills（上游一鍵安裝，不在本 package 內）

- `playwright-cli` — 由 Microsoft 官方 `playwright-cli install --skills` 直接安裝，本 repo 不維護副本
