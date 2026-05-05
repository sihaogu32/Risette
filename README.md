# Risette

Opinionated [pi-coding-agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) CLI: financial news + safety extensions + playwright-cli skill, one install.

## 安裝

```bash
npm install -g risette@latest
risette
```

`postinstall` 會自動把 `playwright-cli` skill stage 到 `~/.pi/agent/skills/`、把 `npm:pi-subagents` 註冊進 `~/.pi/agent/settings.json`、再 best-effort 跑 `npx playwright install chromium`（~300MB）。要關掉這段：`RISETTE_SKIP_POSTINSTALL=1 npm install -g risette@latest`。

## Compatibility

Tested with `@mariozechner/pi-coding-agent ^0.70.5`. Node `>=22.12` required.

v0.2.0 是舊版「pi extension package」形態，凍結在 git tag `v0.2.0`，安裝走 `pi install git:github.com/sihaogu32/Risette` 流程；不再維護。

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

## License

MIT — 見 `LICENSE`。
