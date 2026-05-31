import { eq } from "drizzle-orm";
import type { ApiTestCtx } from "../api-test-setup.js";
import { appendTurnToChat } from "../../svc/intern/append-turn-to-chat.js";

async function userIdForSlug(ctx: ApiTestCtx, ownerHandle: string): Promise<string> {
  const row = await ctx.appCtx.vibesCtx.sql.db
    .select({ userId: ctx.appCtx.vibesCtx.sql.tables.handleBinding.userId })
    .from(ctx.appCtx.vibesCtx.sql.tables.handleBinding)
    .where(eq(ctx.appCtx.vibesCtx.sql.tables.handleBinding.handle, ownerHandle))
    .limit(1)
    .then((r) => r[0]);
  if (row === undefined) throw new Error(`No handleBinding found for ownerHandle=${ownerHandle}`);
  return row.userId;
}

export interface C7ScenarioResult {
  readonly chatId: string;
}

export const c7Scenario = {
  prompt: "Go back to the simpler version we had at the start, then add a footer.",

  async setup(ctx: ApiTestCtx): Promise<C7ScenarioResult> {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const userId = await userIdForSlug(ctx, ownerHandle);
    const vctx = ctx.appCtx.vibesCtx;

    // openChat gives us the chatId. createApp() seeds turn 0 (scaffold/original).
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    if (rOpen.isOk() === false) throw new Error(`openChat failed: ${String(rOpen.Err())}`);
    const chat = rOpen.Ok();
    const chatId = chat.chatId;

    // Append 15 evolution turns (turns 1–15). Together with the scaffold turn
    // seeded by createApp(), this produces a 16-entry timeline so that
    // assemblePromptPayload populates both ORIGINAL (turn 0) and PREVIOUS (turn 15).
    for (let i = 1; i <= 15; i++) {
      const rAppend = await appendTurnToChat(vctx, {
        chatId,
        userId,
        ownerHandle,
        appSlug,
        fileSystem: [
          {
            type: "code-block",
            filename: "/App.jsx",
            lang: "jsx",
            content: `export default function App() { return <div>turn ${i}</div>; } // evolution-${i}`,
          },
        ],
        userMessage: `evolution turn ${i}`,
        promptId: `p${i}`,
      });
      if (rAppend.isOk() === false) throw new Error(`appendTurnToChat turn ${i} failed: ${String(rAppend.Err())}`);
    }

    await chat.close();
    return { chatId };
  },
};
