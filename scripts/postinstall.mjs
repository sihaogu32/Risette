#!/usr/bin/env node
/**
 * Risette postinstall:
 *   1) stage skills/playwright-cli/ to ~/.pi/agent/skills/playwright-cli/
 *   2) ensure "npm:pi-subagents" is in ~/.pi/agent/settings.json packages[]
 *   3) best-effort: spawn `npm exec --yes playwright install chromium` via npm_execpath
 *
 * Idempotent. Skipped via RISETTE_SKIP_POSTINSTALL=1 or CI=true.
 * Failures here never block npm install.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

if (process.env.RISETTE_SKIP_POSTINSTALL === "1") process.exit(0);

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = dirname(here);
const agentDir = join(homedir(), ".pi", "agent");

// 1) Stage skill (do not overwrite user-modified copy)
const skillSrc = join(pkgRoot, "skills", "playwright-cli");
const skillDst = join(agentDir, "skills", "playwright-cli");
try {
	if (existsSync(skillSrc) && !existsSync(skillDst)) {
		mkdirSync(dirname(skillDst), { recursive: true });
		cpSync(skillSrc, skillDst, { recursive: true });
		console.log("risette: staged playwright-cli skill →", skillDst);
	}
} catch (err) {
	console.warn("risette: skill stage skipped:", err?.message ?? err);
}

// 2) Ensure pi-subagents package entry in settings.json
try {
	const settingsPath = join(agentDir, "settings.json");
	let settings = {};
	if (existsSync(settingsPath)) {
		try {
			settings = JSON.parse(readFileSync(settingsPath, "utf8"));
		} catch {
			console.warn("risette: settings.json unreadable, leaving as-is");
			settings = null;
		}
	}
	if (settings && typeof settings === "object") {
		const target = "npm:pi-subagents";
		const packages = Array.isArray(settings.packages) ? settings.packages : [];
		const present = packages.some((p) =>
			(typeof p === "string" && p === target) ||
			(typeof p === "object" && p && p.source === target),
		);
		if (!present) {
			packages.push(target);
			settings.packages = packages;
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
			console.log("risette: registered npm:pi-subagents in", settingsPath);
		}
	}
} catch (err) {
	console.warn("risette: settings update skipped:", err?.message ?? err);
}

// 3) Chromium install (skip on CI / offline)
//    Spawn `npm exec --yes playwright install chromium` via npm_execpath
//    (set by npm during lifecycle scripts) so we use absolute paths and
//    don't depend on PATH — npm install -g doesn't put the new prefix's
//    .bin on subprocess PATH yet, and npx is not guaranteed on PATH.
if (process.env.CI === "true" || process.env.CI === "1") {
	console.log("risette: CI detected — skipping chromium install");
	process.exit(0);
}
try {
	const npmCli = process.env.npm_execpath;
	if (!npmCli) {
		console.warn("risette: chromium install skipped — not in npm lifecycle (no npm_execpath).");
		console.warn("        run `npx playwright install chromium` manually.");
	} else {
		const r = spawnSync(
			process.execPath,
			[npmCli, "exec", "--yes", "--", "playwright", "install", "chromium"],
			{ stdio: "inherit" },
		);
		if (r.status !== 0) {
			console.warn(`risette: chromium install exited ${r.status}. Run \`npx playwright install chromium\` manually.`);
			if (r.error) console.warn("        error:", r.error.message);
		}
	}
} catch (err) {
	console.warn("risette: chromium install skipped:", err?.message ?? err);
}
