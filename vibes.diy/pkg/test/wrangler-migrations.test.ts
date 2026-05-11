import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import toml from "toml";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WRANGLER_PATH = resolve(__dirname, "..", "wrangler.toml");

interface Migration {
  tag: string;
  new_classes?: string[];
  deleted_classes?: string[];
  renamed_classes?: { from: string; to: string }[];
  transferred_classes?: { from: string; from_script: string; to: string }[];
}

interface EnvBlock {
  migrations?: Migration[];
  [key: string]: unknown;
}

interface Parsed {
  migrations?: Migration[];
  env?: Record<string, EnvBlock>;
}

const ALLOWED_KINDS = ["new_classes", "deleted_classes", "renamed_classes", "transferred_classes"] as const;

function collectMigrationArrays(parsed: Parsed): { envLabel: string; migrations: Migration[] }[] {
  const out: { envLabel: string; migrations: Migration[] }[] = [];
  if (parsed.migrations?.length) out.push({ envLabel: "<top-level>", migrations: parsed.migrations });
  for (const [name, block] of Object.entries(parsed.env ?? {})) {
    if (block?.migrations?.length) out.push({ envLabel: `env.${name}`, migrations: block.migrations });
  }
  return out;
}

describe("wrangler.toml DO migrations are append-only", () => {
  const raw = readFileSync(WRANGLER_PATH, "utf-8");
  const parsed = toml.parse(raw) as Parsed;
  const arrays = collectMigrationArrays(parsed);

  it("file contains at least one migrations array", () => {
    expect(arrays.length).toBeGreaterThan(0);
  });

  for (const { envLabel, migrations } of arrays) {
    describe(envLabel, () => {
      it("uses sequential v1, v2, v3, ... with no gaps", () => {
        const tags = migrations.map((m) => m.tag);
        const expected = migrations.map((_, i) => `v${i + 1}`);
        expect(tags, `tags must be exactly ${expected.join(", ")} (append-only history; see agents/do-migrations.md)`).toEqual(
          expected
        );
      });

      it("has unique tags", () => {
        const tags = migrations.map((m) => m.tag);
        expect(new Set(tags).size).toBe(tags.length);
      });

      for (const migration of migrations) {
        it(`migration ${migration.tag} declares at least one of ${ALLOWED_KINDS.join("/")}`, () => {
          const declared = ALLOWED_KINDS.filter((k) => migration[k] !== undefined);
          expect(declared.length, `migration ${migration.tag} in ${envLabel} has no class operation`).toBeGreaterThan(0);
        });
      }
    });
  }
});
