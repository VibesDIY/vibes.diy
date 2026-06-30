import { afterEach, describe, expect, it, vi } from "vitest";
import { Result } from "@adviser/cement";
import * as os from "node:os";
import * as path from "node:path";
import fs from "node:fs/promises";
import { ReqWriteEnv, writeEnvEvento, writeEnvFile } from "./write-env-cmd.js";

// These assert the rehomed `writeEnv` reproduces `@fireproof/core-cli@0.24.19`'s
// `cmds/write-env-cmd.ts` behavior exactly — the byte-equivalence bar from
// VibesDIY/vibes.diy#2905. The env-resolution path goes through cement's
// `envFactory().gets()`, which is the same machinery the old `SuperThis.env`
// wrapped, so REQUIRED / OPTIONAL / literal-default / empty-string semantics
// match upstream by construction.

const PFX = "DEPLOY_CLI_TEST_";
const touched = new Set<string>();
function setEnv(k: string, v: string) {
  process.env[PFX + k] = v;
  touched.add(PFX + k);
}
afterEach(() => {
  for (const k of touched) Reflect.deleteProperty(process.env, k);
  touched.clear();
});

async function runWriteEnv(args: Partial<ReqWriteEnv> & Pick<ReqWriteEnv, "fromEnv">) {
  const req: ReqWriteEnv = {
    type: "core-cli.write-env",
    wranglerToml: "./wrangler.toml",
    env: "test",
    doNotOverwrite: false,
    excludeSecrets: false,
    out: "-",
    json: true,
    ...args,
  };
  let captured: { type: string; result: { type: string; output: string } } | undefined;
  const ctx = {
    validated: req,
    request: { type: "msg.cmd-ts", cmdTs: { raw: req, outputFormat: "json" }, result: undefined },
    send: {
      send: async (_c: unknown, data: typeof captured) => {
        captured = data;
        return Result.Ok();
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(((s: string) => {
    chunks.push(String(s));
    return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);
  try {
    const res = await writeEnvEvento.handle(ctx);
    return { res, captured, stdout: chunks.join("") };
  } finally {
    spy.mockRestore();
  }
}

describe("writeEnv handler", () => {
  it("emits JSON with keys deduped + sorted, to stdout for --out -", async () => {
    setEnv("B", "2");
    setEnv("A", "1");
    const { res, captured, stdout } = await runWriteEnv({
      fromEnv: [`${PFX}B`, `${PFX}A`, `${PFX}B`],
    });
    expect(res.isOk()).toBe(true);
    expect(stdout).toBe(JSON.stringify({ [`${PFX}A`]: "1", [`${PFX}B`]: "2" }, null, 2) + "\n");
    // `--out -` suppresses the "Wrote: …" summary
    expect(captured?.result.output).toBe("");
  });

  it("emits text form (KEY=value, newline-joined) when --json is off", async () => {
    setEnv("A", "1");
    setEnv("B", "2");
    const { stdout } = await runWriteEnv({ json: false, fromEnv: [`${PFX}B`, `${PFX}A`] });
    expect(stdout).toBe(`${PFX}A=1\n${PFX}B=2\n`);
  });

  it("honors --fromEnv KEY=value literal default without reading the env", async () => {
    const { stdout } = await runWriteEnv({ fromEnv: [`${PFX}LIT=hello`] });
    expect(stdout).toBe(JSON.stringify({ [`${PFX}LIT`]: "hello" }, null, 2) + "\n");
  });

  it("errors when a required (bare) --fromEnv key is absent from the environment", async () => {
    const { res } = await runWriteEnv({ fromEnv: [`${PFX}DEFINITELY_UNSET`] });
    expect(res.isErr()).toBe(true);
  });

  it("treats an empty-string env value as missing for a required key (fails loudly)", async () => {
    // cement's env.gets() treats "" as absent in required mode — the same
    // behavior the old @fireproof/core-cli path had. This is the desirable one:
    // a blanked-out secret errors rather than silently pushing an empty value.
    setEnv("EMPTY", "");
    const { res } = await runWriteEnv({ fromEnv: [`${PFX}EMPTY`] });
    expect(res.isErr()).toBe(true);
  });

  it("keeps an empty string when supplied as a --fromEnv KEY= literal default", async () => {
    // A literal default is used verbatim (the resolver only treats *env reads*
    // as missing when empty), so KEY= yields an empty string in the output.
    const { res, stdout } = await runWriteEnv({ fromEnv: [`${PFX}LITEMPTY=`] });
    expect(res.isOk()).toBe(true);
    expect(stdout).toBe(JSON.stringify({ [`${PFX}LITEMPTY`]: "" }, null, 2) + "\n");
  });
});

describe("writeEnvFile", () => {
  it("writes JSON to a file and respects doNotOverwrite", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "deploy-cli-"));
    const target = path.join(dir, "out.json");
    const first = await writeEnvFile("./wrangler.toml", target, "test", { A: "1" }, false, true);
    expect(first).toBe(target);
    expect(JSON.parse(await fs.readFile(target, "utf8"))).toEqual({ A: "1" });

    // doNotOverwrite leaves the existing file untouched
    await writeEnvFile("./wrangler.toml", target, "test", { A: "changed" }, true, true);
    expect(JSON.parse(await fs.readFile(target, "utf8"))).toEqual({ A: "1" });
    await fs.rm(dir, { recursive: true, force: true });
  });
});
