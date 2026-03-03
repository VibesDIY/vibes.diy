import { processStream } from "@adviser/cement";
import {
  ChatMessage,
  isToplevelLine,
  type LLMRequest,
  type ResponseFormat,
} from "@vibes.diy/call-ai-v2";
import type { ReqCallAI, ResErrorCallAI, ResOkCallAI } from "@vibes.diy/vibe-types";

interface ResultLike<T = unknown> {
  isErr(): boolean;
  Err(): unknown;
  Ok(): T;
}

interface CallAIChat {
  readonly sectionStream: ReadableStream<unknown>;
  prompt(req: LLMRequest): Promise<ResultLike>;
}

export interface CallAIApi {
  openChat(req: {
    readonly userSlug: string;
    readonly appSlug: string;
    readonly mode: "application";
  }): Promise<ResultLike<CallAIChat>>;
}

interface SectionEventLike {
  readonly type: "vibes.diy.section-event";
  readonly promptId: string;
  readonly blocks: readonly unknown[];
}

function isSectionEventLike(msg: unknown): msg is SectionEventLike {
  if (typeof msg !== "object" || msg === null) {
    return false;
  }
  const obj = msg as Record<string, unknown>;
  return obj.type === "vibes.diy.section-event" && typeof obj.promptId === "string" && Array.isArray(obj.blocks);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export interface CollectedResult {
  readonly result: string;
  readonly promptId: string;
}

export function buildCallAIPrompt(prompt: string, schema: unknown): LLMRequest {
  const schemaMessages: ChatMessage[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: `Return a JSON object conforming to this schema: ${JSON.stringify(schema)}`,
        },
      ],
    },
  ];

  const responseFormat: ResponseFormat = { type: "json_object" };

  return {
    messages: [
      ...schemaMessages,
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    response_format: responseFormat,
  };
}

export async function collectStructuredResult(
  stream: ReadableStream<unknown>
): Promise<CollectedResult> {
  let promptId: string | undefined;
  let sawSectionEvent = false;
  const textParts: string[] = [];

  await processStream(stream, (msg) => {
    if (!isSectionEventLike(msg)) {
      return;
    }

    sawSectionEvent = true;
    promptId = msg.promptId;
    for (const block of msg.blocks) {
      if (isToplevelLine(block)) {
        textParts.push(block.line);
      }
    }
  });

  if (!sawSectionEvent || promptId === undefined) {
    throw new Error("No section events received");
  }

  const result = textParts.join("\n");
  if (result.length === 0) {
    throw new Error("No toplevel text received");
  }

  return { result, promptId };
}

export async function executeCallAI(
  req: ReqCallAI,
  vibeDiyApi: CallAIApi
): Promise<ResOkCallAI | ResErrorCallAI> {
  const rChat = await vibeDiyApi.openChat({
    userSlug: req.userSlug,
    appSlug: req.appSlug,
    mode: "application",
  });

  if (rChat.isErr()) {
    return {
      tid: req.tid,
      type: "vibe.res.callAI",
      status: "error",
      message: toErrorMessage(rChat.Err()),
    };
  }

  const chat = rChat.Ok();
  const collectedPromise = collectStructuredResult(chat.sectionStream);
  const promptReq = buildCallAIPrompt(req.prompt, req.schema);
  const rPrompt = await chat.prompt(promptReq);

  if (rPrompt.isErr()) {
    void collectedPromise.catch(() => {});
    return {
      tid: req.tid,
      type: "vibe.res.callAI",
      status: "error",
      message: toErrorMessage(rPrompt.Err()),
    };
  }

  try {
    const collected = await collectedPromise;
    return {
      tid: req.tid,
      type: "vibe.res.callAI",
      status: "ok",
      promptId: collected.promptId,
      result: collected.result,
    };
  } catch (error) {
    return {
      tid: req.tid,
      type: "vibe.res.callAI",
      status: "error",
      message: toErrorMessage(error),
    };
  }
}
