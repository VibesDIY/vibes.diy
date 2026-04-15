import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType, exception2Result } from "@adviser/cement";
import {
  ActiveEntry,
  ActiveTitle,
  EvtGenerateTitle,
  MsgBase,
  isActiveTitle,
  isEvtGenerateTitle,
  msgBase,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";
import { and, eq } from "drizzle-orm/sql/expressions";

export const evtGenerateTitleEvento: EventoHandler<unknown, MsgBase<EvtGenerateTitle>, void> = {
  hash: "evt-generate-title",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtGenerateTitle(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtGenerateTitle>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtGenerateTitle>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const payload = ctx.validated.payload;

    // Call LLM to generate a title
    const rTitle = await generateTitle(qctx, payload);
    if (rTitle.isErr()) {
      console.error("Error generating title:", rTitle.Err());
      return Result.Ok(EventoResult.Continue);
    }
    const title = rTitle.Ok();

    // Store as ActiveTitle in app_settings
    const rStore = await storeTitle(qctx, payload, title);
    if (rStore.isErr()) {
      console.error("Error storing title:", rStore.Err());
    }

    return Result.Ok(EventoResult.Continue);
  },
};

async function generateTitle(qctx: QueueCtx, payload: EvtGenerateTitle): Promise<Result<string>> {
  const { LLM_BACKEND_URL, LLM_BACKEND_API_KEY } = qctx.params.vibes.env;

  const rRes = await exception2Result(() =>
    fetch(LLM_BACKEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLM_BACKEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 50,
        stream: false,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "title",
            schema: {
              type: "object",
              properties: { title: { type: "string" } },
              required: ["title"],
            },
          },
        },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Generate a short, descriptive title (3-8 words) for this web app. Respond with JSON {"title": "..."}.

Description:
${payload.markdownContent}

Code preview:
${payload.codePreview}`,
              },
            ],
          },
        ],
      }),
    })
  );
  if (rRes.isErr()) {
    return Result.Err(rRes);
  }
  const res = rRes.Ok();
  if (!res.ok) {
    return Result.Err(`LLM request failed: ${res.status} ${res.statusText}`);
  }

  const rJson = await exception2Result(async () => {
    const body = await res.json();
    // OpenAI-compatible response: body.choices[0].message.content
    const content = (body as { choices: { message: { content: string } }[] }).choices[0].message.content;
    const parsed = JSON.parse(content) as { title: string };
    return parsed.title;
  });
  if (rJson.isErr()) {
    return Result.Err(rJson);
  }
  return Result.Ok(rJson.Ok());
}

async function storeTitle(qctx: QueueCtx, payload: EvtGenerateTitle, title: string): Promise<Result<void>> {
  const now = new Date().toISOString();
  const { userId, userSlug, appSlug } = payload;

  // Read existing settings
  const rPrev = await exception2Result(() =>
    qctx.sql.db
      .select()
      .from(qctx.sql.tables.appSettings)
      .where(
        and(
          eq(qctx.sql.tables.appSettings.userId, userId),
          eq(qctx.sql.tables.appSettings.userSlug, userSlug),
          eq(qctx.sql.tables.appSettings.appSlug, appSlug)
        )
      )
      .limit(1)
      .then((r) => r[0])
  );
  if (rPrev.isErr()) {
    return Result.Err(rPrev);
  }

  const existing: ActiveEntry[] = (rPrev.Ok()?.settings as ActiveEntry[]) ?? [];
  const titleEntry: ActiveTitle = { type: "active.title", title };

  // Replace existing title or append
  const idx = existing.findIndex(isActiveTitle);
  if (idx >= 0) {
    existing[idx] = titleEntry;
  } else {
    existing.push(titleEntry);
  }

  const rIns = await exception2Result(() =>
    qctx.sql.db
      .insert(qctx.sql.tables.appSettings)
      .values({
        userId,
        appSlug,
        userSlug,
        settings: existing,
        updated: now,
        created: rPrev.Ok()?.created ?? now,
      })
      .onConflictDoUpdate({
        target: [qctx.sql.tables.appSettings.userId, qctx.sql.tables.appSettings.userSlug, qctx.sql.tables.appSettings.appSlug],
        set: {
          settings: existing,
          updated: now,
        },
      })
  );
  return rIns.isErr() ? Result.Err(rIns) : Result.Ok(undefined);
}
