# A2-2 金融日報擴充 — 設計文件

> 日期：2026-04-29
> 階段：A — pi 擴充教材實戰範例（A → B → C 路線的第一步）
> 驗收水位：A2-2（手動 `/daily-news` + markdown 落檔，無排程）
> 後續：B（個人工具，加排程 / 多 profile / 通知）→ C（多用戶平台）

---

## 1. 背景與定位

`/home/sihaogu/pi` 是「介紹 harness agent」的教材專案，base 是 [`@mariozechner/pi-coding-agent`](https://www.npmjs.com/package/@mariozechner/pi-coding-agent)。本機已累積的擴充紀錄在 [`extension_map/index.md`](../../extension_map/index.md)。

需求源頭：使用者要建立一個「金融新聞自動化平台」，最終目標是 C（對外多用戶服務），但採 A → B → C 循序漸進。**本文件只規範 A2-2 的範圍**。

A2-2 的成功定義（驗收水位）：
> 在 pi REPL 打 `/daily-news 台積電`，agent 在 1–3 分鐘內產出一份結構化 markdown 日報，並寫到 `~/financial-news/YYYY-MM-DD-台積電.md`。

教材重點：用最少程式碼示範 **Skill + Extension tool + Extension command** 三件組合，以及 harness agent 「prompt 凍結規則 + LLM 處理模糊失敗」的設計哲學。

---

## 2. 涵蓋範圍

| 維度 | A2-2 範圍 |
|---|---|
| 觸發 | 手動在 REPL 打 `/daily-news [關鍵字...]` |
| 市場 | 台股 / 美股 / 加密 / 宏觀 / 產業 — A–E 全市場 |
| 資料來源 | playwright-cli skill 開瀏覽器 + Google News 廣搜 + 白名單來源加權（A4-3） |
| 輸出 | markdown 檔，B5-3 結構（開頭重點段 + 分類條列） |
| 排程 | ❌ 不在 A2-2 |
| 多 profile / config | ❌ 不在 A2-2 |
| 通知（email / Slack） | ❌ 不在 A2-2 |

---

## 3. 架構

```
┌─────────────────────────────────────────────────────────────┐
│  使用者在 pi REPL 打：/daily-news AI 半導體                 │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Extension: financial-news.ts                               │
│  ─ 註冊 slash command  /daily-news                          │
│  ─ 註冊 custom tool    save_news_report                     │
│  ─ command handler 把使用者輸入 → 組成日報 prompt → 注入    │
│    回對話，agent 自己跑                                     │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Skill: playwright-cli (已裝在 ~/.pi/agent/skills/)         │
│  agent 用 Bash(playwright-cli:*) 開瀏覽器                   │
│  ─ Google News 多關鍵字各跑一輪                             │
│  ─ 對白名單來源加權                                         │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  agent 整理 B5-3 markdown → 呼叫 save_news_report tool      │
│  → 寫到 ~/financial-news/YYYY-MM-DD-<關鍵字>.md             │
│  → 對使用者回報「✓ 已存到 <path>（共 N 條）」               │
└─────────────────────────────────────────────────────────────┘
```

**設計核心：command 不抓資料，只編 prompt**。原因：
1. playwright-cli skill 已經教會 agent 怎麼抓網頁，重做就糟蹋 skill。
2. command handler 把搜尋邏輯硬寫成 TS，會失去 agent 在「來源失敗」「結果模糊」時的 LLM 判斷力。
3. 教材性：剛好示範三大擴充面的典型分工 — **Skill 教流程、Extension tool 加硬能力、Extension command 編任務**。

---

## 4. `/daily-news` command

### 4.1 入口格式

```
/daily-news                  → 全市場通用日報（C6b-2）
/daily-news <kw1>            → 單主題日報，分類維度為「市場」
/daily-news <kw1> <kw2> ...  → 多主題日報，分類維度為「主題」（C6a-3）
```

### 4.2 檔名規則

```
YYYY-MM-DD.md                 全市場通用日報
YYYY-MM-DD-台積電.md          單關鍵字
YYYY-MM-DD-AI_半導體.md       多關鍵字（_ 連，順序保留使用者輸入）
```

- 同日同關鍵字組合：**覆蓋**（不附時間戳）
- 中文檔名保留中文，不轉拼音、不 URL-encode

### 4.3 handler 行為

1. 解析 args → `keywords: string[]`（可能空陣列）
2. 算當天日期字串 + 目標檔名（絕對路徑 `~/financial-news/...`）
3. 組 prompt（見 §6）並注入為 user message 送回 agent
4. 不阻塞、不等待 — 後續流程由 agent 自己推進，使用者在 REPL 看得到每一步

### 4.4 拒絕條件

只擋「絕對禁止輸入」，其餘交 agent 自處：

- 關鍵字含 `/`、`..`、控制字元 → handler 直接報錯不送 prompt
- 其他情況都送 prompt

---

## 5. `save_news_report` tool

### 5.1 為什麼不直接用內建 `write`

1. **路徑不該交給 agent 自由發揮** — `write` 接任意路徑，會把規則責任丟給 LLM。tool 把路徑規則內化，agent 只傳「日期 + 關鍵字 + 內容」。
2. **可順便做統計** — tool 在落檔同時數條目數、回給 agent 當 result，agent 才能正確回報「共 N 條」。

### 5.2 Schema

```ts
{
  name: "save_news_report",
  description: "儲存當日金融新聞日報為 markdown 檔。會自動判斷檔名、建立目錄。",
  parameters: {
    date:     { type: "string", description: "YYYY-MM-DD" },
    keywords: { type: "array",  items: { type: "string" },
                description: "關鍵字陣列；空陣列表示全市場通用日報" },
    markdown: { type: "string", description: "完整日報內容（B5-3 結構）" }
  }
}
```

### 5.3 實作

1. 驗證 `date` 為 `YYYY-MM-DD`、`keywords` 元素不含 `/` 或 `..`
2. 算路徑 `~/financial-news/<date>[-<kw1>_<kw2>...].md`
3. `mkdirSync(dir, { recursive: true })` + `writeFileSync(path, markdown)`（覆蓋）
4. 數條目（regex 抓 markdown bullet 或 `【來源】` 前綴）→ `itemCount`
5. 回傳 `{ path, itemCount, bytesWritten }`

預估 10–20 行 TypeScript，純 IO + 驗證，無網路、無 agent 邏輯。

---

## 6. handler 注入的 prompt 樣板

`{{date}}` `{{keywords}}` `{{path}}` 由 handler 填入。

```
你的任務：產出今日（{{date}}）的金融新聞日報，並落檔到 {{path}}。

【關鍵字】
{{keywords}}            ← 例：["AI", "半導體"]；若空陣列則走「全市場通用模式」

【搜尋策略】
1. 用 playwright-cli skill 開瀏覽器
2. 對每個關鍵字到 Google News 搜：site:news.google.com "<關鍵字>"
   （若關鍵字為空，改搜：金融 OR 財經 OR markets OR economy）
3. 抓最近 24 小時的條目；每組關鍵字抓 ~15 條候選
4. 抓到的條目按來源加權排序：以下白名單來源優先納入
   ─ 中文/台股：鉅亨網、工商時報、經濟日報、Yahoo 股市
   ─ 國際/美股+宏觀：Reuters、Bloomberg、WSJ、Financial Times、CNBC
   ─ 加密：CoinDesk、The Block
   非白名單來源仍可入選，但同一主題下若白名單已夠 3–5 條，優先用白名單

【日報結構（B5-3）】
# 金融日報 — {{date}}{{若有關鍵字: 「主題：A、B、C」}}

## 今日重點
（5–7 行，跨主題或跨市場歸納主線。例：「Fed 暗示 6 月不降息，
台股 ADR 普遍承壓，半導體類股弱於大盤」。這段要由你自己分析，
不是條目摘抄。）

## <分類>
- 【來源】標題 — 一句話重點（時間，連結）
- ...

分類維度：
─ 多關鍵字 → 用「主題」分類（每個關鍵字一節，每節 3–5 條）
─ 單關鍵字 / 無關鍵字 → 用「市場」分類：台股 / 美股 / 加密 / 宏觀 / 產業
  （某類當天無新聞就略過該節）

【產出方式】
完成 markdown 後呼叫 save_news_report({
  date: "{{date}}",
  keywords: {{keywords}},
  markdown: <整份日報>
})

成功後對使用者回報一句：「✓ 已存到 {{path}}（共 N 條）」。
```

### 6.1 為什麼把規則全寫在 prompt

- 跑 100 次都套同一規則，可重現
- 白名單只出現一次，要客製就改 extension 原始檔（A2-2 不做 config 化，YAGNI）
- 「今日重點」明示「不是條目摘抄」，防止 agent 偷懶

---

## 7. 錯誤處理（分三層責任）

| 失敗點 | 處理者 | 行為 |
|---|---|---|
| 關鍵字含 `/` `..` 等非法字元 | command handler | 直接拒絕、不送 prompt |
| playwright 抓網頁失敗 / Google News 結果為空 / 來源頁解析失敗 | agent | 重試一次 / 換來源 / 日報註明「本日無相關新聞」 |
| save tool IO 失敗 | tool 拋例外 → agent | agent 收到 tool error 後對使用者回報 |

設計準則：command 跟 tool 只擋「絕對禁止」與「IO 異常」，所有模糊失敗都交 agent。

---

## 8. 驗收（A2-2 完成標準）

- [ ] `pi` 啟動後 `/help` 看得到 `/daily-news`
- [ ] 跑 `/daily-news`，產出 `~/financial-news/YYYY-MM-DD.md`，B5-3 結構，含五市場分類（無資料的市場略過）
- [ ] 跑 `/daily-news 台積電`，產出 `~/financial-news/YYYY-MM-DD-台積電.md`
- [ ] 跑 `/daily-news AI 半導體`，產出 `~/financial-news/YYYY-MM-DD-AI_半導體.md`，分類維度為「主題：AI / 半導體」各 3–5 條
- [ ] 同一關鍵字組合連跑兩次，第二次覆蓋第一次（檔案不並存）
- [ ] 故意傳含 `/` 的關鍵字 → command 直接拒絕、不啟動 agent

---

## 9. 教材交付

- **程式碼**：`~/.pi/agent/extensions/financial-news.ts`（單檔）
- **擴充紀錄**：[`extension_map/index.md`](../../extension_map/index.md) 的 Extensions 區塊新增一條
  - 識別：`financial-news.ts`
  - 用途：註冊 `/daily-news` command + `save_news_report` tool；依賴 playwright-cli skill 抓網頁
- **教材短文**：`docs/07-extension-case-financial-news.md`（待寫）— 主軸是「Skill + Extension tool + Extension command 三件組合的設計理由」

---

## 10. 留給 B 階段的事（不在 A2-2 範圍）

- **排程**：每天 8:00 自動跑預設關鍵字組
- **多 profile**：在 `~/.pi/agent/settings.json` 或獨立 config 訂多組關鍵字，各別產日報
- **通知**：日報產出後寄 email / 推 Slack / Discord
- **白名單可配置**：把 §6 prompt 裡的白名單抽到 config，讓使用者可改

---

## 11. 留給 C 階段的事（不在 A2-2 範圍）

- Web UI、用戶系統、訂閱付費、跨用戶資料隔離、雲端部署等。本文件不展開。
