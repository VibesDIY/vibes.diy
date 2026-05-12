import { beforeAll, describe, expect, it } from "vitest";
import { assemblePromptPayload } from "@vibes.diy/api-svc";
import { createApiTestCtx, type ApiTestCtx } from "../api-test-setup.js";
import { c7Scenario } from "./c7-scaffold-revert.fixture.js";

const C7_SEQ_BASE = 1_667_500;

describe("C7 scaffold-revert: payload includes ORIGINAL caption and breadcrumb", () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: C7_SEQ_BASE });
  });

  it("payload includes ORIGINAL slot and breadcrumb on PREVIOUS", async () => {
    const { chatId } = await c7Scenario.setup(ctx);
    const r = await assemblePromptPayload(ctx.appCtx.vibesCtx, {
      chatId,
      model: "anthropic/claude-sonnet-4-6",
      newUserMessages: [{ role: "user", content: [{ type: "text", text: c7Scenario.prompt }] }],
    });
    expect(r.isOk(), `assemblePromptPayload failed: ${r.isErr() ? String(r.Err()) : ""}`).toBe(true);
    const payload = r.Ok();
    const texts = payload.messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : "")));
    expect(texts.some((t) => t.includes("ORIGINAL"))).toBe(true);
    expect(texts.some((t) => t.includes("ORIGINAL scaffold is"))).toBe(true);
  });
});
