/**
 * Financial News Extension
 *
 * Registers /daily-news command + save_news_report tool.
 * Command builds a prompt and injects it as a user message; agent uses
 * playwright-cli skill to scrape Google News and calls save_news_report
 * to write ~/financial-news/YYYY-MM-DD[-<kw>...].md.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const ILLEGAL_KEYWORD = /[\/\x00-\x1f]|\.\./;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayLocal(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function reportPath(date: string, keywords: string[]): string {
	const stem = keywords.length === 0 ? date : `${date}-${keywords.join("_")}`;
	return join(homedir(), "financial-news", `${stem}.md`);
}

function buildPrompt(date: string, keywords: string[], path: string): string {
	const kwJson = JSON.stringify(keywords);
	return `你的任務：產出今日（${date}）的金融新聞日報，並落檔到 ${path}。

【關鍵字】
${kwJson}            ← 例：["AI", "半導體"]；若空陣列則走「全市場通用模式」

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
# 金融日報 — ${date}${keywords.length > 0 ? `（主題：${keywords.join("、")}）` : ""}

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
  date: "${date}",
  keywords: ${kwJson},
  markdown: <整份日報>
})

成功後對使用者回報一句：「✓ 已存到 ${path}（共 N 條）」。`;
}

const SAVE_PARAMS = Type.Object({
	date: Type.String({ description: "YYYY-MM-DD" }),
	keywords: Type.Array(Type.String(), {
		description: "關鍵字陣列；空陣列表示全市場通用日報",
	}),
	markdown: Type.String({ description: "完整日報內容（B5-3 結構）" }),
});

export default function financialNewsExtension(pi: ExtensionAPI) {
	pi.registerCommand("daily-news", {
		description: "產出今日金融日報並落檔到 ~/financial-news/",
		handler: async (args, ctx) => {
			const keywords = args
				.split(/\s+/)
				.map((k) => k.trim())
				.filter((k) => k.length > 0);

			for (const kw of keywords) {
				if (ILLEGAL_KEYWORD.test(kw)) {
					ctx.ui.notify(`關鍵字含非法字元（/、..、控制字元）：${kw}`, "error");
					return;
				}
			}

			const date = todayLocal();
			const path = reportPath(date, keywords);
			pi.sendUserMessage(buildPrompt(date, keywords, path));
		},
	});

	pi.registerTool({
		name: "save_news_report",
		label: "Save News Report",
		description: "儲存當日金融新聞日報為 markdown 檔。會自動判斷檔名、建立目錄。",
		parameters: SAVE_PARAMS,
		async execute(_toolCallId, params) {
			if (!DATE_RE.test(params.date)) {
				throw new Error(`date 格式錯誤（需 YYYY-MM-DD）：${params.date}`);
			}
			for (const kw of params.keywords) {
				if (ILLEGAL_KEYWORD.test(kw)) {
					throw new Error(`keywords 含非法字元（/ 或 ..）：${kw}`);
				}
			}

			const path = reportPath(params.date, params.keywords);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, params.markdown);

			const itemCount = (params.markdown.match(/^- /gm) ?? []).length;
			const bytesWritten = Buffer.byteLength(params.markdown, "utf8");

			return {
				content: [{ type: "text", text: `Saved ${path} (${itemCount} items, ${bytesWritten} bytes)` }],
				details: { path, itemCount, bytesWritten },
			};
		},
	});
}
