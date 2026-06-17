#!/usr/bin/env node

// Guards the vendored superpowers skills against drift (see
// .claude/skills/superpowers-vendor/README.md). These skills are forked from
// upstream and updated by hand, so this check enforces the three invariants a
// reviewer would otherwise have to verify manually:
//
//   1. A vendored version pin is declared in manifest.json.
//   2. The expected skill set is present (each as a discoverable <name>/SKILL.md
//      whose frontmatter `name` matches its directory), and excluded skills
//      (e.g. using-superpowers) are absent.
//   3. No plugin-namespaced `superpowers:` cross-references remain in vendored
//      markdown — project skills invoke by bare name, so a leaked prefix would
//      dangle in cloud sessions.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const skillsDir = join(repoRoot, ".claude", "skills");
const vendorDir = join(skillsDir, "superpowers-vendor");
const manifestPath = join(vendorDir, "manifest.json");

const errors = [];

if (!existsSync(manifestPath)) {
  console.error(`❌ Missing manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// 1. Version pin declared.
if (!manifest.version || typeof manifest.version !== "string") {
  errors.push("manifest.json is missing a non-empty `version` pin.");
}

const expected = Array.isArray(manifest.skills) ? manifest.skills : [];
const excluded = Array.isArray(manifest.excluded) ? manifest.excluded : [];

if (expected.length === 0) {
  errors.push("manifest.json declares no `skills`.");
}

// 2a. Every expected skill is present and well-formed.
for (const name of expected) {
  const skillMd = join(skillsDir, name, "SKILL.md");
  if (!existsSync(skillMd)) {
    errors.push(`Expected vendored skill missing: .claude/skills/${name}/SKILL.md`);
    continue;
  }
  const body = readFileSync(skillMd, "utf8");
  const m = body.match(/^---\n([\s\S]*?)\n---/);
  const nameLine = m && m[1].match(/^name:\s*(.+)$/m);
  const frontName = nameLine ? nameLine[1].trim() : null;
  if (frontName !== name) {
    errors.push(`Skill ${name}/SKILL.md frontmatter name is "${frontName}", expected "${name}".`);
  }
}

// 2b. Excluded skills are absent.
for (const name of excluded) {
  if (existsSync(join(skillsDir, name))) {
    errors.push(`Excluded skill should not be vendored: .claude/skills/${name}/`);
  }
}

// 3. No leaked plugin namespace in vendored markdown.
for (const name of expected) {
  const dir = join(skillsDir, name);
  if (!existsSync(dir)) continue;
  for (const file of walkMarkdown(dir)) {
    const content = readFileSync(file, "utf8");
    if (content.includes("superpowers:")) {
      errors.push(`Leaked plugin-namespaced ref "superpowers:" in ${file.replace(repoRoot + "/", "")}`);
    }
  }
}

function walkMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

if (errors.length > 0) {
  console.error("❌ Vendored superpowers skills check failed:");
  for (const e of errors) console.error(`   - ${e}`);
  console.error("\n   See .claude/skills/superpowers-vendor/README.md for the update procedure.");
  process.exit(1);
}

console.log(`✅ Vendored superpowers skills check passed (v${manifest.version}, ${expected.length} skills, no namespace leaks).`);
