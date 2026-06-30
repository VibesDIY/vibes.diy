import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { chipsFromNarration } from "@vibes.diy/api-types";
import { isToplevelLine, type ToplevelLineMsg } from "@vibes.diy/call-ai-v2";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";
import { buildStarterChipSeedBlocks, seedStarterChips, STARTER_CHIP_SEED_PROMPT_ID } from "../svc/intern/seed-starter-chips.js";

const SEQ_BASE = 1_668_200;

// Pure-block test (no DB): the synthetic narration parses back to exactly the
// seeded chips through the SAME projection getVibeChips uses (chipsFromNarration
// over the toplevel.line narration). This is what guarantees the seed surfaces.
describe("buildStarterChipSeedBlocks", () => {
  function narrationOf(blocks: ReturnType<typeof buildStarterChipSeedBlocks>): string {
    return (
      blocks
        // NB: wrap the guard — isToplevelLine(msg, streamId?) has an optional 2nd
        // arg, so a bare .filter(isToplevelLine) passes the array index into it.
        .filter((b): b is ToplevelLineMsg => isToplevelLine(b))
        .map((b) => b.line)
        .join("\n")
    );
  }

  it("narration parses back to the seeded chips (the lead line stays prose)", () => {
    const blocks = buildStarterChipSeedBlocks({
      chatId: "c1",
      promptId: STARTER_CHIP_SEED_PROMPT_ID,
      blockId: "b1",
      streamId: "s1",
      chips: ["Add a pattern sequencer", "Make it a memory game"],
      timestamp: new Date("2026-06-30T00:00:00Z"),
    });
    expect(chipsFromNarration(narrationOf(blocks))).toEqual(["Add a pattern sequencer", "Make it a memory game"]);
  });

  it("caps at three chips (the existing chip-projection cap)", () => {
    const blocks = buildStarterChipSeedBlocks({
      chatId: "c1",
      promptId: STARTER_CHIP_SEED_PROMPT_ID,
      blockId: "b1",
      streamId: "s1",
      chips: ["one", "two", "three", "four"],
      timestamp: new Date("2026-06-30T00:00:00Z"),
    });
    expect(chipsFromNarration(narrationOf(blocks))).toEqual(["one", "two", "three"]);
  });
});

describe("seedStarterChips", () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: SEQ_BASE });
  });

  async function chatIdOf(ownerHandle: string, appSlug: string): Promise<string> {
    const vctx = ctx.appCtx.vibesCtx;
    const rows = await vctx.sql.db
      .select({ chatId: vctx.sql.tables.chatContexts.chatId })
      .from(vctx.sql.tables.chatContexts)
      .where(and(eq(vctx.sql.tables.chatContexts.ownerHandle, ownerHandle), eq(vctx.sql.tables.chatContexts.appSlug, appSlug)));
    return rows[0].chatId;
  }

  it("seeds curated chips onto a pushed vibe; getVibeChips then surfaces them (round-trip)", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const chips = ["Add a pattern sequencer", "Make it a memory game"];

    const r = await seedStarterChips(ctx.appCtx.vibesCtx, { ownerHandle, appSlug, chips });
    if (r.isErr()) throw new Error("seedStarterChips failed: " + r.Err().message);

    const got = await ctx.api.getVibeChips({ ownerHandle, appSlug });
    if (got.isErr()) throw new Error("getVibeChips failed: " + JSON.stringify(got.Err()));
    expect(got.Ok().chips).toEqual(chips);
  });

  it("is idempotent — re-seeding replaces the turn rather than stacking", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const vctx = ctx.appCtx.vibesCtx;

    await seedStarterChips(vctx, { ownerHandle, appSlug, chips: ["First chip"] });
    await seedStarterChips(vctx, { ownerHandle, appSlug, chips: ["Second chip", "Third chip"] });

    const chatId = await chatIdOf(ownerHandle, appSlug);
    const seedRows = await vctx.sql.db
      .select({ promptId: vctx.sql.tables.chatSections.promptId })
      .from(vctx.sql.tables.chatSections)
      .where(
        and(eq(vctx.sql.tables.chatSections.chatId, chatId), eq(vctx.sql.tables.chatSections.promptId, STARTER_CHIP_SEED_PROMPT_ID))
      );
    expect(seedRows).toHaveLength(1); // one seed turn, not two

    const got = await ctx.api.getVibeChips({ ownerHandle, appSlug });
    if (got.isErr()) throw new Error("getVibeChips failed: " + JSON.stringify(got.Err()));
    expect(got.Ok().chips).toEqual(["Second chip", "Third chip"]); // the latest seed wins
  });

  it("errors (does not create a chat) when the vibe has no chat context — must be pushed first", async () => {
    const r = await seedStarterChips(ctx.appCtx.vibesCtx, {
      ownerHandle: "never-pushed-owner",
      appSlug: "never-pushed-slug",
      chips: ["x"],
    });
    expect(r.isErr()).toBe(true);
  });

  it("rejects an empty chip list", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const r = await seedStarterChips(ctx.appCtx.vibesCtx, { ownerHandle, appSlug, chips: [] });
    expect(r.isErr()).toBe(true);
  });
});
