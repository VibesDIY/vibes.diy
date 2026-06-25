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
 * A `getItemsStream()` stand-in that yields the supplied items in order.
 * Mirrors @openrouter/agent's StreamableOutputItem cumulative-emit contract:
 * the same `function_call` id is re-emitted with progressively growing
 * `arguments` JSON as the tool call streams in.
 */
function itemsFrom(items: unknown[]): () => AsyncIterableIterator<unknown> {
  return () => {
    let i = 0;
    return {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: async () => (i < items.length ? { done: false, value: items[i++] } : { done: true, value: undefined }),
    } as AsyncIterableIterator<unknown>;
  };
}

/** Build a cumulative `function_call` item snapshot (the SDK re-emits the same id as arguments grow). */
function fnCall(name: string, args: object) {
  return { type: "function_call", id: "fc_1", callId: "call_1", name, arguments: JSON.stringify(args) };
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

  it("invokes onLine for each streamed file line", async () => {
    const seen: string[] = [];
    // Cumulative write_file stream: the SDK re-emits the same item id as the
    // `contents` argument grows. Only completed (newline-terminated) lines fire,
    // and the per-file line cursor prevents a re-emitted growing item from
    // double-firing earlier lines.
    const items = [
      fnCall("write_file", { path: "/App.jsx", contents: "line1\n" }),
      fnCall("write_file", { path: "/App.jsx", contents: "line1\nline2\n" }),
    ];
    const client = {
      callModel: ({ tools }: { tools: unknown[] }) => {
        const exec = execOf(tools)({ path: "/App.jsx", contents: "line1\nline2\n" });
        return {
          getText: async () => {
            await exec;
            return "";
          },
          getResponse: async () => ({ usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } }),
          getItemsStream: itemsFrom(items),
        };
      },
    } as unknown as Parameters<typeof runWholeFileCodegen>[0]["client"];

    await runWholeFileCodegen({
      client,
      model: "frontier",
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
      onLine: (_file, _lang, line) => {
        seen.push(line);
      },
    });
    expect(seen).toEqual(["line1", "line2"]);
  });

  it("passes the file path and language to onLine for each line", async () => {
    const calls: { file: string; lang: string; line: string; lineNr: number }[] = [];
    const items = [fnCall("write_file", { path: "access.js", contents: "a\nb\n" })];
    const client = {
      callModel: ({ tools }: { tools: unknown[] }) => {
        const exec = execOf(tools)({ path: "access.js", contents: "a\nb\n" });
        return {
          getText: async () => {
            await exec;
            return "";
          },
          getResponse: async () => ({ usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } }),
          getItemsStream: itemsFrom(items),
        };
      },
    } as unknown as Parameters<typeof runWholeFileCodegen>[0]["client"];

    await runWholeFileCodegen({
      client,
      model: "frontier",
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
      onLine: (file, lang, line, lineNr) => {
        calls.push({ file, lang, line, lineNr });
      },
    });
    expect(calls).toEqual([
      { file: "/access.js", lang: "js", line: "a", lineNr: 0 },
      { file: "/access.js", lang: "js", line: "b", lineNr: 1 },
    ]);
  });

  it("ignores non-write_file function_call items when streaming lines", async () => {
    const seen: string[] = [];
    const items = [
      fnCall("some_other_tool", { foo: "bar\nbaz\n" }),
      fnCall("write_file", { path: "/App.jsx", contents: "only\n" }),
    ];
    const client = {
      callModel: ({ tools }: { tools: unknown[] }) => {
        const exec = execOf(tools)({ path: "/App.jsx", contents: "only\n" });
        return {
          getText: async () => {
            await exec;
            return "";
          },
          getResponse: async () => ({ usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } }),
          getItemsStream: itemsFrom(items),
        };
      },
    } as unknown as Parameters<typeof runWholeFileCodegen>[0]["client"];

    await runWholeFileCodegen({
      client,
      model: "frontier",
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
      onLine: (_file, _lang, line) => {
        seen.push(line);
      },
    });
    expect(seen).toEqual(["only"]);
  });

  it("routes model as a function of numberOfTurns", () => {
    const pick = (ctx: { numberOfTurns: number }) => (ctx.numberOfTurns > 1 ? "cheap" : "frontier");
    expect(pick({ numberOfTurns: 1 })).toBe("frontier");
    expect(pick({ numberOfTurns: 2 })).toBe("cheap");
  });

  it("passes a dynamic (ctx) => model selector straight through to callModel", async () => {
    let receivedModel: unknown;
    const app = "export default function App(){ return <div>ok</div>; }";
    const pick = (ctx: { numberOfTurns: number }) => (ctx.numberOfTurns > 1 ? "cheap" : "frontier");
    const client = {
      callModel: ({ model, tools }: { model: unknown; tools: unknown[] }) => {
        receivedModel = model;
        const exec = execOf(tools)({ path: "/App.jsx", contents: app });
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

    await runWholeFileCodegen({
      client,
      model: pick,
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
    });
    // The loop forwards the selector verbatim; @openrouter/agent resolves it per turn.
    expect(receivedModel).toBe(pick);
  });
});
