# pi 擴充面總覽（pi 0.70.5）

本檔整理 `@mariozechner/pi-coding-agent` 提供的所有擴充入口，作為「要擴充什麼能力時，該往哪寫」的決策地圖。

> 引用規範：本檔只引 npm 套件 public API（`@mariozechner/pi-coding-agent`）與其內附 docs，不指任何 pi-mono clone 的內部 source 路徑。

> 套件 docs 在：`<global-node-modules>/@mariozechner/pi-coding-agent/docs/<檔名>.md`
> 套件範例在：`<global-node-modules>/@mariozechner/pi-coding-agent/examples/extensions/`
> 本機 config dir：`~/.pi/agent/`

---

## A. Customization 五面向

這五個面向是 pi 官方 docs `index.md` 列在 *Customization* 段下的入口，也是日常擴充最常用的五個面。`index.md`（同目錄）依此順序追蹤本機累積。

### 1. Extensions

- **用途**：寫 TypeScript 模組，掛進 pi 內部生命週期 — 最強大的一面，幾乎什麼都能做
- **放哪裡**：`~/.pi/agent/extensions/*.ts`（pi 啟動時自動掃描載入）
- **能做什麼**：
  - 註冊新 tool 給 agent 用
  - 註冊新 slash command
  - 訂閱事件（`tool_call`、`session_start` …）攔截/改寫/log
  - 覆寫 UI（status line / footer / header / titlebar / overlay / modal）
  - 覆寫既有 tool 的行為
- **介面**：
  ```ts
  import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
  export default function (pi: ExtensionAPI) {
      pi.on("tool_call", async (event, ctx) => { /* ... */ });
  }
  ```
- **docs**：`docs/extensions.md`
- **典型範例**（`examples/extensions/` 內，70+ 個）：
  - 事件攔截：`bash-spawn-hook.ts`、`dirty-repo-guard.ts`、`file-trigger.ts`、`notify.ts`、`auto-commit-on-exit.ts`
  - tool 系：`tools.ts`、`dynamic-tools.ts`、`tool-override.ts`、`truncated-tool.ts`
  - command 系：`commands.ts`、`shutdown-command.ts`、`bookmark.ts`
  - UI 客製：`status-line.ts`、`custom-footer.ts`、`custom-header.ts`、`titlebar-spinner.ts`、`modal-editor.ts`、`working-indicator.ts`
  - 進階：`subagent/`、`plan-mode/`、`sandbox/`、`with-deps/`、`dynamic-resources/`

### 2. Skills

- **用途**：Agent Skills — 按需載入的能力描述，類 Claude Code skill
- **放哪裡**：`~/.pi/agent/skills/<name>/SKILL.md`
- **能做什麼**：寫一份描述告訴 agent「在什麼情境下用這套流程」，agent 在判斷需要時把整份 SKILL.md 內容載入當參考
- **適合場景**：可重用的工作流程（例如「review PR 的步驟」、「寫測試的固定模板」），比直接塞進 system prompt 輕量
- **docs**：`docs/skills.md`

### 3. Prompt templates

- **用途**：把常用 prompt 包成 slash command；最輕量的擴充面（純 markdown）
- **放哪裡**：`~/.pi/agent/prompts/*.md`
- **能做什麼**：在 REPL 打 `/<檔名>` 即送出該模板；可帶參數
- **適合場景**：重複任務（日報、commit message 起手式、code review checklist…），又不需動態邏輯
- **docs**：`docs/prompt-templates.md`

### 4. Themes

- **用途**：終端配色
- **放哪裡**：`~/.pi/agent/themes/*.json`
- **能做什麼**：自訂 syntax highlight、UI 配色等
- **docs**：`docs/themes.md`

### 5. Pi packages

- **用途**：把上面四面（Extensions / Skills / Prompts / Themes）打包成 npm 套件，方便共享或跨機同步
- **放哪裡**：`~/.pi/agent/settings.json` 的 `packages: ["npm:<scope>/<name>", ...]`
- **能做什麼**：載入別人寫好的擴充（例：`npm:@ollama/pi-web-search` 加 web search），或把自己的擴充發成 npm package
- **docs**：`docs/packages.md`

---

## B. 模型與服務商

不在 Customization 五面之列，但同屬本機可改的擴充入口。

### Custom models

- 給既有 provider 加新模型條目
- **docs**：`docs/models.md`

### Custom providers

- 自寫 API 客戶端 / OAuth 流程，接非內建的服務商
- **docs**：`docs/custom-provider.md`
- 範例：`examples/extensions/custom-provider-anthropic/`、`custom-provider-gitlab-duo/`、`custom-provider-qwen-cli/`

---

## C. 程式化嵌入

不是給互動 REPL 用，是讓外部程式驅動 pi。寫 extension 時若需要自製 UI 也會回來查 TUI components。

| 模式 | 用途 | docs |
|---|---|---|
| **SDK** | Node.js 內嵌 pi（程式化呼叫 agent） | `docs/sdk.md` |
| **RPC** | stdin/stdout JSONL 跟 pi 對話 | `docs/rpc.md` |
| **JSON event stream** | print mode 把事件結構化輸出 | `docs/json.md` |
| **TUI components** | 給 extension 自製終端 UI 用的元件庫 | `docs/tui.md` |

---

## 怎麼選擴充面（決策表）

| 你的需求 | 走哪面 | 範例可參考 |
|---|---|---|
| 新增一條 hook（攔截、log、自動補資料） | Extensions（事件型） | `permission-gate.ts`、`protected-paths.ts`、`dirty-repo-guard.ts` |
| 讓 agent 多一招 tool（呼叫某 API、操作某服務） | Extensions（tool 系） | `tools.ts`、`dynamic-tools.ts` |
| 攔下 / 改寫某個內建 tool | Extensions（tool override） | `tool-override.ts` |
| 多一個 `/xxx` 重複任務指令（純 prompt） | Prompt templates | — |
| 多一個 `/xxx` 帶動態邏輯 / 互動 | Extensions（command 系） | `commands.ts`、`bookmark.ts` |
| 換 status line / footer / header / titlebar | Extensions（UI 系） | `status-line.ts`、`custom-footer.ts` |
| 提供可重用工作流程描述給 agent 隨取隨用 | Skills | — |
| 換配色 | Themes | — |
| 換 / 自架 provider | Custom providers + Custom models | `examples/extensions/custom-provider-*` |
| 想做的東西別人也用得到 | 寫成 Extension/Skill/Prompt/Theme 後包成 Pi package | — |
| 從外部程式驅動 pi | SDK / RPC / JSON | — |

---

## 建議擴充清單

依 Customization 五面向分表，每表按「推薦度」排序（高 → 低）。「已安裝」對應本機 `~/.pi/agent/` 與 `settings.json` 當下狀態，新增/移除擴充時要同步更新。推薦度判準：

- **高**：補 pi 核心缺口或已驗證在用
- **中**：實用補強，看工作流需求加裝
- **低**：特定情境才用

### 1. Extensions

`~/.pi/agent/extensions/*.ts`，從 `examples/extensions/` copy 或自寫。

| 名稱 | 用途 | 來源 | 已安裝 | 推薦度 |
|---|---|---|---|---|
| `permission-gate.ts` | bash 危險指令（`rm -rf` / `sudo` …）攔截 | examples/ | 是 | 高 |
| `protected-paths.ts` | 阻擋 write/edit 寫到 `.env` / `.git/` / `node_modules/` | examples/ | 是 | 高 |
| `financial-news.ts` | `/daily-news` command + `save_news_report` tool | 自製 | 是 | 高 |
| `notify.ts` | 任務完成桌面通知 | examples/ | 否 | 中 |
| `dirty-repo-guard.ts` | dirty repo 時警告／攔截 | examples/ | 否 | 中 |
| `auto-commit-on-exit.ts` | 結束 session 時自動 commit | examples/ | 否 | 中 |
| `git-checkpoint.ts` | 操作前打 git checkpoint，可回退 | examples/ | 否 | 中 |
| `bash-spawn-hook.ts` | 攔截 bash 子 process，多一層安全網 | examples/ | 否 | 低 |
| `bookmark.ts` | bookmark slash command（記錄／跳轉） | examples/ | 否 | 低 |
| `todo.ts` | todo tool + 持久 widget | examples/ | 否 | 低 |

### 2. Skills

`~/.pi/agent/skills/<name>/SKILL.md`，多數從上游 CLI `install --skills` 取得，少有獨立 npm 市場。

| 名稱 | 用途 | 來源 | 已安裝 | 推薦度 |
|---|---|---|---|---|
| `playwright-cli` | 教 agent 用 `@playwright/cli` 操作瀏覽器 | `playwright-cli install --skills` | 是 | 高 |

> 取得管道：上游官方 CLI（例：`playwright-cli`、`anthropic` 系列）的 `install --skills` 子命令；或 [`anthropics/skills`](https://github.com/anthropics/skills) repo 直接 copy `SKILL.md`。

### 3. Prompt templates

`~/.pi/agent/prompts/*.md`，純 markdown，無 npm 市場，皆自製。

| 名稱 | 用途 | 來源 | 已安裝 | 推薦度 |
|---|---|---|---|---|
| `commit-msg.md` | 從 staged diff 產 conventional commit message | 自製 | 否 | 中 |
| `code-review.md` | 對 PR / diff 跑固定 review checklist | 自製 | 否 | 中 |
| `daily-report.md` | 每日工作摘要範本 | 自製 | 否 | 低 |
| `debug-checklist.md` | bug 重現／隔離／假設驗證流程 | 自製 | 否 | 低 |

### 4. Themes

`~/.pi/agent/themes/*.json`，主要靠 pi 內附；無顯著第三方市場。

| 名稱 | 用途 | 來源 | 已安裝 | 推薦度 |
|---|---|---|---|---|
| （內附 theme） | pi 預設提供數套配色，可 `/theme` 切換 | pi-coding-agent | 是 | 中 |

### 5. Pi packages

`settings.json` 的 `packages: ["npm:<pkg>", ...]`。npm 上 `pi-extension` / `pi-package` keyword 是這面的主要市場。

| 名稱 | 用途 | 來源 | 已安裝 | 推薦度 |
|---|---|---|---|---|
| `pi-mcp-adapter` | 接 MCP 生態（GitHub / Slack / 本地 server …）為 pi tool | npm | 否 | 高 |
| `pi-web-access` | web search + URL fetch + GitHub clone + PDF + YouTube | npm | 否 | 高 |
| `pi-subagents` | sub-agent 委派、chains、平行執行（pi 無原生對應） | npm | 是 | 高 |
| `pi-lens` | 即時 LSP / linter / formatter / type-check 回饋 | npm | 否 | 高 |
| `pi-schedule-prompt` | cron-like 排程，定期跑指定 prompt | npm | 否 | 中 |
| `pi-markdown-preview` | markdown + LaTeX 預覽（terminal / browser / PDF） | npm | 否 | 中 |
| `pi-btw` | `/btw` 平行側邊對話，主線不打斷 | npm | 否 | 中 |
| `@samfp/pi-memory` | 持久記憶，學習偏好／修正 | npm | 否 | 中 |
| `taskplane` | 平行任務 orchestration + checkpoint 紀律 | npm | 否 | 中 |
| `pi-powerline-footer` | powerline 風 footer | npm | 否 | 低 |
| `pi-mermaid` | TUI 內 mermaid → ASCII | npm | 否 | 低 |
| `pi-studio` | 雙窗 browser workspace，prompt/response 編輯 | npm | 否 | 低 |
| `@feniix/pi-notion` | Notion API 整合 | npm | 否 | 低 |
| `pi-convex` | Convex Cloud 整合 | npm | 否 | 低 |
| `whatsapp-pi` | WhatsApp 整合 | npm | 否 | 低 |
| `@aliou/pi-processes` | 子 process 管理 | npm | 否 | 低 |
| `@ollama/pi-web-search` | Ollama web search／fetch | npm | 否（曾裝後移除） | 不推 |
