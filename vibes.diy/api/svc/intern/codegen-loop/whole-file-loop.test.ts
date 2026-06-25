import { describe, it, expect } from "vitest";
import { runWholeFileCodegen } from "./whole-file-loop.js";

/**
 * @openrouter/agent's `tool()` wraps a config into `{ type, function: { execute, ... } }`,
 * so the executor passed to `callModel({ tools })` lives at `tools[0].function.execute`.
 * This helper reaches it from a mock's `tools` argument.
 */
interface WrappedTool {
  function: { execute: (a: { path: string; contents: string }) => Promise<unknown> };
}
function execOf(tools: unknown[]): (a: { path: string; contents: string }) => Promise<unknown> {
  return (tools[0] as WrappedTool).function.execute;
}

/**
 * A no-op async iterable standing in for ModelResult.getItemsStream() (no items
 * streamed in unit tests). Returned as a plain async iterator so it satisfies the
 * `for await` contract without being a yield-less generator.
 */
function emptyItems(): AsyncIterableIterator<never> {
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next: async () => ({ done: true, value: undefined as never }),
  };
}

/**
 * Minimal ModelResult-shaped mock: callModel executes the write_file tool once
 * with `contents`, then resolves getText/getResponse with a fixed usage block.
 * Mirrors the @openrouter/agent ModelResult surface the loop consumes.
 */
function mockClientWritingApp(contents: string, path = "/App.jsx") {
  return {
    callModel: ({ tools }: { tools: unknown[] }) => {
      const exec = execOf(tools)({ path, contents });
      return {
        getText: async () => {
          await exec;
          return "";
        },
        getResponse: async () => ({ usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } }),
        getItemsStream: emptyItems,
      };
    },
  } as unknown as Parameters<typeof runWholeFileCodegen>[0]["client"];
}

describe("runWholeFileCodegen", () => {
  it("returns the written file on a clean verify", async () => {
    const app = "export default function App(){ return <div>ok</div>; }";
    const r = await runWholeFileCodegen({
      client: mockClientWritingApp(app),
      model: "frontier",
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
    });
    expect(r.files).toHaveLength(1);
    expect(r.files[0].filename).toBe("/App.jsx");
    expect(r.files[0].content).toBe(app);
    expect(r.files[0].lang).toBe("jsx");
  });

  it("normalizes a bare path to a leading slash and tags .js as js", async () => {
    const access = "export default async function () { return true; }";
    const r = await runWholeFileCodegen({
      client: mockClientWritingApp(access, "access.js"),
      model: "frontier",
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
    });
    expect(r.files[0].filename).toBe("/access.js");
    expect(r.files[0].lang).toBe("js");
    expect(r.files[0].content).toBe(access);
  });

  it("maps the model usage block to prompt/completion/total tokens", async () => {
    const app = "export default function App(){ return <div>ok</div>; }";
    const r = await runWholeFileCodegen({
      client: mockClientWritingApp(app),
      model: "frontier",
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
    });
    expect(r.usage).toEqual({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 });
  });

  it("retries a transient failure then succeeds", async () => {
    const app = "export default function App(){ return <div>ok</div>; }";
    let attempts = 0;
    const flakyClient = {
      callModel: ({ tools }: { tools: unknown[] }) => {
        attempts++;
        if (attempts === 1) {
          return {
            getText: async () => {
              throw new Error("503 service unavailable");
            },
            getResponse: async () => ({ usage: {} }),
            getItemsStream: emptyItems,
          };
        }
        const exec = execOf(tools)({ path: "/App.jsx", contents: app });
        return {
          getText: async () => {
            await exec;
            return "";
          },
          getResponse: async () => ({ usage: { inputTokens: 5, outputTokens: 6, totalTokens: 11 } }),
          getItemsStream: emptyItems,
        };
      },
    } as unknown as Parameters<typeof runWholeFileCodegen>[0]["client"];

    const r = await runWholeFileCodegen({
      client: flakyClient,
      model: "frontier",
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
      retries: 2,
    });
    expect(attempts).toBe(2);
    expect(r.files[0].content).toBe(app);
    expect(r.usage).toEqual({ prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 });
  });
});
