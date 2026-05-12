import { beforeAll, describe, expect, it } from "vitest";
import { createApiTestCtx, type ApiTestCtx } from "../api-test-setup.js";
import { c7Scenario } from "./c7-scaffold-revert.fixture.js";

const AB_SEQ_BASE = 1_667_600;
const scenarios = [{ name: "C7", scenario: c7Scenario }] as const;

describe("Slot delivery mode A/B: payload shape parity", () => {
  let ctx: ApiTestCtx;
  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: AB_SEQ_BASE });
  });

  for (const { name, scenario } of scenarios) {
    it(`${name}: user-mode and system-mode payloads carry the same slot markers`, async () => {
      const { chatId } = await scenario.setup(ctx);
      const userPayload = await ctx.dryRun({
        chatId,
        promptText: scenario.prompt,
        slotDeliveryMode: "user",
      });
      const sysPayload = await ctx.dryRun({
        chatId,
        promptText: scenario.prompt,
        slotDeliveryMode: "system",
      });
      const userTexts = userPayload.messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : ""))).join("\n");
      const sysTexts = sysPayload.messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : ""))).join("\n");
      for (const marker of ["ORIGINAL", "PREVIOUS"]) {
        expect(userTexts).toContain(marker);
        expect(sysTexts).toContain(marker);
      }
    });
  }
});
