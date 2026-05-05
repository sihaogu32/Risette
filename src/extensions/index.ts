import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import permissionGate from "./permission-gate.js";
import protectedPaths from "./protected-paths.js";
import financialNews from "./financial-news.js";

export const extensionFactories: ExtensionFactory[] = [
	permissionGate,
	protectedPaths,
	financialNews,
];
