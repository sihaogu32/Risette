# Risette — agent invariants

本檔列出維護 Risette 時必須守住的規則。任何工作（含 LLM agent 自動化）都先讀這份。

## 1. Extensions 只 import `@mariozechner/pi-coding-agent` public exports

`src/extensions/*.ts` 不可引 `@mariozechner/pi-coding-agent/dist/core/...` / `dist/internal/...` 之類深層路徑，也不指 pi-mono clone 的本地 source。一律從 npm package 入口 `@mariozechner/pi-coding-agent` 引（`ExtensionAPI` / `ExtensionFactory` 等 type 從這裡來）。

## 2. `extension_map/` 是單一事實來源

任何 extension / skill / command / tool 增刪改之前，先在 `extension_map/development/YYYY-MM-DD-<topic>-spec.md` 落 spec，再動程式碼。`extension_map/index.md` 五個 H2（Customization 五面向：Extensions → Skills → Prompt templates → Themes → Pi packages）的順序不重排；新增擴充後同步更新對應條目與頂部 Last updated。

## 3. 不增加新的頂層 doc 檔

除 `AGENTS.md` 與 `README.md`，所有文件進 `extension_map/`。不加 `CHANGELOG.md` / `CONTRIBUTING.md` / `docs/`（CHANGELOG 由 git tag + commit log 充當）。

## 4. 「只在使用者本機 `~/.pi/agent/` 改」的行為不算 Risette 工作

若一段擴充行為不能透過 `npm install -g risette@latest` 在他人乾淨環境重現，就不該進這個 repo。本機臨時測試完要嘛搬到 `src/extensions/` / `skills/` / `scripts/postinstall.mjs`，要嘛當 personal extension 留在 `~/.pi/agent/extensions/` 但**不 commit**。

## 5. 單包，不 workspace

不切 `packages/*`、不轉 pnpm workspace。extensions 成長到 5+ 且依賴互斥之前不重新評估這條。

## 6. Build before publish

`prepublishOnly: "npm run clean && npm run build"` 強制；絕不徒手 `npm publish`，更不在本機跑 `npm publish` 跳過 prepublishOnly hook。

## 7. `playwright-cli` skill 同步流程固定

skill 升級時走下面這套指令（不可改）：

```bash
tmp=$(mktemp -d) && (cd "$tmp" && playwright-cli install --skills) && \
  rm -rf skills/playwright-cli && \
  cp -r "$tmp/.claude/skills/playwright-cli" skills/playwright-cli
git add skills/playwright-cli
git commit -m "skills: resync playwright-cli (upstream <YYYY-MM-DD>)"
```

commit 訊息格式固定 `skills: resync playwright-cli (upstream <date>)`，方便日後對照上游 release 時點。保留上游 LICENSE / NOTICE 不刪。
