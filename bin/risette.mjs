#!/usr/bin/env node
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
	console.error("risette: Node 22.12+ required (current: " + process.versions.node + ")");
	process.exit(1);
}

try {
	await import(new URL("../dist/entry.js", import.meta.url));
} catch (err) {
	if (err && err.code === "ERR_MODULE_NOT_FOUND" && /dist[\\/]entry\.js/.test(String(err))) {
		console.error("risette: dist/ missing. Run `npm install` then `npm run build`.");
		process.exit(1);
	}
	throw err;
}
