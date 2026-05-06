#!/usr/bin/env node
import { main } from "@mariozechner/pi-coding-agent";
import { extensionFactories } from "./extensions/index.js";
import { VERSION } from "./version.js";

const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
	console.log(VERSION);
	process.exit(0);
}

await main(args, { extensionFactories });
