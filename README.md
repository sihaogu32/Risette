# Risette

Opinionated [pi-coding-agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) CLI: financial news + safety extensions + playwright-cli skill, one install.

## 安裝

```bash
npm install -g risette@latest
risette
```

`postinstall` 會自動把 `playwright-cli` skill stage 到 `~/.pi/agent/skills/`、把 `npm:pi-subagents` 註冊進 `~/.pi/agent/settings.json`、再 best-effort 下載 chromium-headless-shell（~112MB）。要關掉這段：`RISETTE_SKIP_POSTINSTALL=1 npm install -g risette@latest`。

### 暫時方案：直接從 GitHub 安裝

npm registry 還沒發佈前可以這樣裝：

```bash
npm install -g github:sihaogu32/Risette#v1.0.0
```

從 git 安裝時 `prepare` script 會自動 `tsc` 把 `dist/` 生出來（`/dist` 沒 commit 到 repo），之後 `postinstall` lifecycle 與 npm 安裝完全一致。`main` 目前還是舊版 v0.2.0 形態，所以必須用 tag fragment（`#v1.0.0`）對到 v1.0.0 程式碼；正式 release 後會 merge 回 `main` 並改成 `npm install -g risette@latest`。

## Compatibility

Tested with `@mariozechner/pi-coding-agent ^0.70.5`. Node `>=22.12` required.

v0.2.0 是舊版「pi extension package」形態，凍結在 `main` 分支現存的提交（`27f32fc` 等），安裝走 `pi install git:github.com/sihaogu32/Risette` 流程；不再維護，會在 v1.0.0 merge 回 `main` 時被取代。

## 內含

### Extensions

- `permission-gate` — 攔截 bash 危險指令（`rm -rf` / `sudo` / `chmod 777` / `chown 777`）。
- `protected-paths` — 攔截 `write` / `edit` 寫到含 `.env` / `.git/` / `node_modules/` 的路徑。
- `financial-news` — 註冊 `/daily-news` command + `save_news_report` tool；agent 用 `playwright-cli` skill 抓 Google News 後落檔 `~/financial-news/YYYY-MM-DD[-<kw>...].md`。

`permission-gate` / `protected-paths` 取自 `@mariozechner/pi-coding-agent` 官方 examples（MIT）。

### Skills

- `playwright-cli/` — vendor 自微軟 [`@playwright/cli`](https://www.npmjs.com/package/@playwright/cli) 官方 `install --skills` 輸出。教 agent 用 `playwright-cli` 操作瀏覽器。

### Pi packages

- `npm:pi-subagents`（[nicobailon](https://github.com/nicobailon/pi-subagents)/MIT）— sub-agent 委派：single / parallel / chain + background runs + `/agents` 互動管理。Risette 在 postinstall 把它註冊進 `settings.json`，由 pi 標準 package loader 載入；之後跟著 `pi update` 升級。

## 運作流程

### 整體機制：install → 啟動

`npm install -g risette` 到使用者第一次能跑起 `risette`，中間經過兩段 lifecycle：

```mermaid
flowchart LR
    A(["npm install<br/>-g risette"]) --> B["拉 tarball<br/>+ deps"]
    B --> P{"SKIP_<br/>POSTINSTALL?"}
    P -- yes --> READY(["risette 可用"])
    P -- no --> P1["① stage<br/>playwright-cli"]
    P1 --> P2["② 加 pi-subagents<br/>到 settings.json"]
    P2 --> P3{"CI?"}
    P3 -- yes --> READY
    P3 -- no --> P4["③ chromium<br/>best-effort"]
    P4 --> READY
    READY --> M1["bin/<br/>risette.mjs"]
    M1 --> M2["pi-coding-agent<br/>main()"]
    M2 --> M3["ResourceLoader<br/>.reload()"]
    M3 --> L1["pi-subagents<br/>npm package"]
    M3 --> L2["inline<br/>extensions ×3"]
    M3 --> L3["playwright-cli<br/>skill"]
    L1 --> END(["TUI / REPL"])
    L2 --> END
    L3 --> END
```

要點：

- postinstall 三步全 idempotent；CI 環境自動跳過 chromium 下載（~112MB）。
- `npm:pi-subagents` 真正載入發生在啟動期 `ResourceLoader.reload()`、不是 postinstall — 之後跟著 `pi update` 升級。
- Risette 三個 extension 走 inline `ExtensionFactory`（`package.json` 的 `pi.extensions` 指向 `./dist/extensions`）；npm package 與 inline factory 是兩條載入路徑，但最後共用同一份 `ExtensionAPI`。

### Agent 運行流程

使用者打字後 REPL → LLM → tool 的主路徑。Extension 在三個位置切進來：**command handler**（攔截 slash command）、**`tool_call` pre-gate**（permission-gate / protected-paths）、**`tool_result` post hook**。

```mermaid
sequenceDiagram
    autonumber
    participant U as 使用者
    participant REPL as TUI / REPL
    participant Agent as agent-session
    participant Ext as Extensions
    participant LLM
    participant Tool as Tool runtime

    U->>REPL: 輸入文字 / slash command
    REPL->>Agent: prompt(text)
    alt "/" 開頭且命中註冊命令
        Agent->>Ext: command.handler(args, ctx)
        Note over Ext: 例 /daily-news →<br/>financial-news 組 prompt 後<br/>pi.sendUserMessage(...)
        Ext-->>Agent: 視情況注入新的 user message
    else 一般訊息
        Agent->>Agent: 展開 /skill:* 或 /template
    end

    Agent->>Agent: buildSystemPrompt<br/>(tools + skills + guidelines)
    Agent->>LLM: messages + tool defs

    loop 直到 LLM 收手
        LLM-->>Agent: assistant turn
        opt LLM 要求 tool_call
            Agent->>Ext: emit "tool_call" (pre-gate)
            alt 任一 listener 回 {block:true}
                Ext-->>Agent: block + reason
                Agent-->>LLM: tool result = blocked
            else 全部放行
                Agent->>Tool: tool.execute(params)
                Tool-->>Agent: result
                Agent->>Ext: emit "tool_result" (post hook)
                Agent-->>LLM: tool result
            end
        end
    end

    Agent-->>REPL: 最終 assistant 訊息
    REPL-->>U: 顯示結果
```

兩條 safety gate 在 pre-execution 階段攔截：

| Extension | 攔截對象 | 觸發條件 | 動作 |
| --- | --- | --- | --- |
| `permission-gate` | `bash` tool | command 命中 `rm -rf` / `sudo` / `chmod 777` / `chown 777` | 互動模式彈確認；非互動模式直接 block |
| `protected-paths` | `write` / `edit` tool | path 含 `.env` / `.git/` / `node_modules/` | 直接 block + warning |

### 範例：`/daily-news AI 半導體`

把上面兩張圖具體化成一條真實路徑。多關鍵字情境下，主 agent 會用 `pi-subagents` 把每個關鍵字派成一個 sub-agent 平行抓取，再合流產出單一份日報：

```mermaid
sequenceDiagram
    autonumber
    participant U as 使用者
    participant FN as financial-news
    participant Main as 主 agent
    participant Sub as pi-subagents<br/>(parallel dispatch)
    participant PG as permission-gate
    participant PW as playwright-cli<br/>(chromium)
    participant FS as 檔案系統

    U->>FN: /daily-news AI 半導體
    FN->>FN: 解析 keywords<br/>ILLEGAL_KEYWORD 校驗<br/>算出落檔 path
    FN->>Main: pi.sendUserMessage(buildPrompt)
    Main->>Sub: dispatch parallel<br/>(每關鍵字一個 sub-agent)

    par AI 子代
        Sub->>PG: tool_call: bash playwright-cli
        PG-->>Sub: 非危險 → 放行
        Sub->>PW: 抓 Google News (AI)
        PW-->>Sub: snapshot
    and 半導體 子代
        Sub->>PG: tool_call: bash playwright-cli
        PG-->>Sub: 非危險 → 放行
        Sub->>PW: 抓 Google News (半導體)
        PW-->>Sub: snapshot
    end

    Sub-->>Main: 兩組結果合流
    Main->>Main: 來源加權 + 組成<br/>B5-3 markdown
    Main->>FS: save_news_report<br/>→ mkdirSync + writeFileSync
    Note over Main,FS: permission-gate 不攔（非 bash）<br/>protected-paths 不攔（非 write/edit）
    FS-->>Main: ok (path, itemCount, bytes)
    Main-->>U: ✓ 已存到 ~/financial-news/...md（共 N 條）
```

幾個容易誤會的點：

- 主 agent 是否真的派 sub-agent，由 LLM 自己判斷；`pi-subagents`（postinstall 時註冊到 `settings.json` 的 npm package）只是在它的 toolbelt 裡。單關鍵字場景通常不會 dispatch、直接走 playwright。
- 每個 sub-agent 都是獨立 agent loop（自己的 system prompt 與 tool list），但**共用同一份 extension wiring** — 所以 `permission-gate` / `protected-paths` 對 sub-agent 的 tool call 一樣會 fire。
- `save_news_report` 是 financial-news extension 自己註冊的 tool，不會被任一條 gate 攔到（`permission-gate` 只看 `bash`、`protected-paths` 只看 `write` / `edit`），所以寫檔安全由 extension 自己負責 — `DATE_RE` + `ILLEGAL_KEYWORD` 兩道校驗在 `mkdirSync` / `writeFileSync` 之前。

## License

MIT — 見 `LICENSE`。
