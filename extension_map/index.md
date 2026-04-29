# pi 擴充紀錄

Last updated: 2026-04-29（改用 npm `pi-subagents` 取代手裝的 examples/subagent，移除對應 extension/agents/prompts）

依 pi 官方 docs 的 **Customization 五面向** 追蹤本機 `~/.pi/agent/` 累積的擴充。新增任何擴充後請更新本檔。

擴充面說明見 [`surfaces.md`](./surfaces.md)。

---

## Extensions

`~/.pi/agent/extensions/*.ts`

- `permission-gate.ts` — bash 危險指令（`rm -rf` / `sudo` / `chmod 777` / `chown 777`）攔截，事件 `tool_call`；hasUI 時 `ctx.ui.select` 詢問，否則 block
- `protected-paths.ts` — 阻擋 `write` / `edit` 寫到含 `.env` / `.git/` / `node_modules/` 的路徑，事件 `tool_call`
- `financial-news.ts` — 註冊 `/daily-news` command + `save_news_report` tool；handler 編 prompt 注入 agent，agent 用 `playwright-cli` skill 抓 Google News 後落檔 `~/financial-news/YYYY-MM-DD[-<kw>...].md`

## Skills

`~/.pi/agent/skills/<name>/SKILL.md`

- `playwright-cli/` — 微軟官方 SKILL.md（650 行 + 9 個 references/），教 agent 用 `@playwright/cli` 操作瀏覽器；`allowed-tools: Bash(playwright-cli:*) Bash(npx:*) Bash(npm:*)`；安裝：`(cd $(mktemp -d) && playwright-cli install --skills) && cp -r .claude/skills/playwright-cli ~/.pi/agent/skills/`

## Prompt templates

`~/.pi/agent/prompts/*.md`

*尚無*（npm `pi-subagents` 自帶 `/parallel-review` / `/parallel-research` / `/gather-context-and-clarify`，但這些隨 package 載入，不落盤到 `~/.pi/agent/prompts/`）

## Themes

`~/.pi/agent/themes/*.json`

*尚無*

## Pi packages

`~/.pi/agent/settings.json` 的 `packages: [...]`

- `npm:pi-subagents` — sub-agent 委派（single / parallel / chain）+ background runs + `/agents` 管理介面 + `/subagents-status` / `/subagents-doctor` + agent overrides；自帶 8 個 builtin agents（scout / researcher / planner / worker / reviewer / context-builder / oracle / delegate）+ 3 個 prompts + 1 個 skill；2026-04-29 安裝（取代手裝的 examples/subagent）

> 2026-04-28 移除 `npm:@ollama/pi-web-search`（原因：無法正常使用）

---

## 維護備註

- 新增擴充後：在對應 H2 下加一條，並把頂部 `Last updated` 更新到當天
- 條目格式：`` - `<識別>` — <一句話用途>，<補充欄位：事件 / 來源 / 觸發條件 / 日期…> ``
- H2 順序固定為 Customization 順序，不要重排：Extensions → Skills → Prompt templates → Themes → Pi packages
- 五面之外的擴充（Custom models / Custom providers / SDK / RPC / TUI）若哪天動到，另起 H2 區塊放在 Pi packages 之後
