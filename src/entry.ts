#!/usr/bin/env node
import { main } from "@mariozechner/pi-coding-agent";
import { extensionFactories } from "./extensions/index.js";

await main(process.argv.slice(2), { extensionFactories });
