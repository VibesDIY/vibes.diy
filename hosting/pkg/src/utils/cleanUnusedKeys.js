import fetch from "node-fetch";
import { setTimeout } from "node:timers/promises";
import "dotenv/config";

const BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_PROV_KEY = process.env.OPENROUTER_PROV_KEY;
const CONFIRM = process.argv.includes("--confirm");
const PAGE_SIZE = 100;
const WAIT_TIME_MS = 1000;

async function deleteKey(hash) {
  const res = await fetch(`${BASE_URL}/keys/${hash}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${OPENROUTER_PROV_KEY}` },
  });
  if (!res.ok) {
    console.error(`Failed to delete key ${hash}: ${res.status} ${res.statusText} ${await res.text()}`);
    return false;
  }
  return true;
}

async function processKeys(keys) {
  const unused = [];
  let usedCount = 0;
  for (const k of keys) {
    if ((k.usage || 0) > 0) {
      console.log([`Hash: ${k.hash}`, `Label: ${k.label}`, `Usage: $${k.usage.toFixed(2)}`].join(" | "));
      usedCount++;
    }
    unused.push(k.hash);
  }

  if (CONFIRM && unused.length) {
    for (const hash of unused) {
      const ok = await deleteKey(hash);
      console.log(ok ? `✅ Deleted unused key ${hash}` : `❌ Failed to delete key ${hash}`);
      await setTimeout(WAIT_TIME_MS / 10);
    }
  }
  return { used: usedCount, deleted: unused.length };
}

async function cleanUnusedKeys() {
  let offset = 0,
    page = 1,
    total = { used: 0, deleted: 0 };
  while (true) {
    const res = await fetch(`${BASE_URL}/keys?offset=${offset}`, {
      headers: { Authorization: `Bearer ${OPENROUTER_PROV_KEY}` },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const { data } = await res.json();
    if (!data.length) break;

    const { used, deleted } = await processKeys(data);
    console.log(`Page ${page}: ${used} used, ${deleted} unused${CONFIRM ? " (deleted)" : ""}`);
    total.used += used;
    total.deleted += deleted;

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    page += 1;
    await setTimeout(WAIT_TIME_MS);
  }

  console.log(
    `\nTotals – used: ${total.used}, ${CONFIRM ? `deleted: ${total.deleted}` : `would delete: ${total.deleted}`}`
  );
}

cleanUnusedKeys().catch(console.error);
