#!/usr/bin/env -S npx tsx
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSchemaSystemMessage } from "../build-schema-prompt.js";

const dir = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(await fs.readFile(join(dir, "sandwich-schema.json"), "utf-8"));
console.log(buildSchemaSystemMessage(schema));
