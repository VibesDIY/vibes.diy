import {
  LLMChat,
  MsgBase,
  OnResponseTypes,
  Req,
  ReqOpenChat,
  VibeFile,
  ResOpenChat,
  ResPromptChatSection,
  ResultVibesDiy,
  VibesDiyError,
  W3CWebSocketEvent,
  isPromptLLMStyle,
  isResOpenChat,
  isResPromptChatSection,
  msgBase,
  mkResError,
  resError,
  sectionEvent,
  FSUpdate,
  isFSUpdate,
  vibeFile,
  ReqPromptFSSetChatSection,
  ReqPromptFSUpdateChatSection,
  ReqPromptLLMChatSection,
  SelectedSlotInput,
  OptionalAuth,
  MsgBox,
} from "@vibes.diy/api-types";
import {
  Evento,
  EventoResult,
  EventoSendProvider,
  HandleTriggerCtx,
  Option,
  Result,
  TriggerCtx,
  ValidateTriggerCtx,
} from "@adviser/cement";
import { type } from "arktype";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { DashAuthType } from "@vibes.diy/identity";
import { VibeDiyApiConnection } from "./api-connection.js";
import { ReqType, VibesDiyApiConfig, WithAuth } from "./vibes-diy-api-types.js";

interface VibesDiyApiForLLMChat {
  readonly cfg: Pick<VibesDiyApiConfig, "sthis">;
  getReadyConnection(): Promise<VibeDiyApiConnection>;
  send<T extends { auth?: DashAuthType }>(
    req: T,
    msgParam: Partial<Omit<MsgBase, "tid">> & { tid: string }
  ): Promise<Result<MsgBox<WithAuth<T>>, VibesDiyError>>;
  request<Q extends OptionalAuth, S>(
    req: Q,
    msgParam: {
      tid?: string;
      resMatch: (res: unknown) => boolean;
    }
  ): Promise<ResultVibesDiy<S>>;
}

export class LLMChatImpl implements LLMChat {
  readonly api: VibesDiyApiForLLMChat;
  readonly tid: string;
  readonly res: ResOpenChat;

  readonly sectionStream: ReadableStream<OnResponseTypes>;

  // Idempotent subscription teardown: unregisters the connection's onMessage
  // listener and closes the section-stream writer. Shared with transport-loss
  // handlers so explicit close() fully tears down a still-alive socket.
  readonly #teardown: () => void;
  // promptId?: string
  // onResponse = OnFunc<(msg: OnResponseTypes) => void>();
  // onError = OnFunc<(err: VibesDiyError) => void>();

  get chatId(): string {
    return this.res.chatId;
  }
  get ownerHandle(): string {
    return this.res.ownerHandle;
  }
  get appSlug(): string {
    return this.res.appSlug;
  }

  static async open(open: ReqType<ReqOpenChat>, api: VibesDiyApiForLLMChat): Promise<Result<LLMChat>> {
    const conn = await api.getReadyConnection();
    const tid = api.cfg.sthis.nextId(12).str;

    const sectionEvents = new TransformStream<OnResponseTypes, OnResponseTypes>();

    const sectionEventsWriter = sectionEvents.writable.getWriter();
    // const activePromptIds = new LRUMap<string, void>();
    const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
    evento.push({
      hash: "wait-open-chat-" + tid,
      validate: async (trigger: ValidateTriggerCtx<W3CWebSocketEvent, MsgBase, ResOpenChat>) => {
        const msg = msgBase(trigger.enRequest);
        if (msg instanceof type.errors) {
          return Result.Ok(Option.None());
        }
        if (msg.tid === tid) {
          return Result.Ok(Option.Some(msg));
        }
        return Result.Ok(Option.None());
      },
      handle: async (trigger: HandleTriggerCtx<W3CWebSocketEvent, MsgBase, ResOpenChat>) => {
        const isError = resError(trigger.validated.payload);
        if (!(isError instanceof type.errors)) {
          // console.log("Response message is an error for chatId:", req.chatId, isError);
          return Result.Err(mkResError(isError.error.message, isError.error.code));
        } else {
          const se = sectionEvent(trigger.validated.payload);
          if (!(se instanceof type.errors)) {
            await sectionEventsWriter.write(se);
          } else {
            // sectionEvent parse failed — skip silently
          }
        }
        return Result.Ok(EventoResult.Continue);
      },
    });
    const unreg = conn.onMessage((event) => {
      // const msg = w3cMessageEventBox(event);
      // if (!(msg instanceof type.errors)) {
      //   // console.log("LLMChat received message event:", new TextDecoder().decode(msg.event.data as Uint8Array));
      // }
      evento
        .trigger({
          request: event,
          send: (async (_ctx: TriggerCtx<W3CWebSocketEvent, unknown, unknown>, data: unknown) => {
            const res = await api.send(data as Parameters<typeof api.send>[0], { tid });
            return res;
          }) as unknown as EventoSendProvider<W3CWebSocketEvent, unknown, unknown>,
        })
        .catch((err) => {
          sectionEventsWriter.write(mkResError(`LLMChat evento trigger error: ${err.message}`, "llmchat-evento-error"));
          sectionEventsWriter.abort();
        });
    });
    // Single idempotent teardown shared by transport loss (onError/onClose)
    // and explicit close(). Unregistering the onMessage listener is the
    // load-bearing part: without it a still-alive socket that later flushes a
    // message for this tid — exactly the half-open reconnect case — would keep
    // invoking the evento handler, which writes into an already-closed
    // TransformStream and produces rejected writes. Closing the writer alone
    // (the old close() behavior) does not stop that.
    let toredown = false;
    const teardown = () => {
      if (toredown) return;
      toredown = true;
      unreg();
      // Close (not abort) so the route's processStream resolves cleanly and
      // can converge on the server's durable state. Catch: the writer may
      // already be closed (explicit close()) or aborted (evento error path).
      sectionEventsWriter.close().catch(() => undefined);
    };
    conn.onError(teardown);
    conn.onClose(teardown);

    const res = await api.request<Req<ReqOpenChat>, ResOpenChat>(open, { tid, resMatch: isResOpenChat });
    if (res.isErr()) {
      return Result.Err<LLMChat>(res.Err());
    }
    // console.log("LLMChat open succeeded for chatId:", res.Ok());
    const llmChat = new LLMChatImpl(api, tid, res.Ok(), sectionEvents.readable, teardown);
    return Result.Ok(llmChat);
  }

  // readonly #activePromptIds: LRUMap<string, void>;
  private constructor(
    api: VibesDiyApiForLLMChat,
    tid: string,
    res: ResOpenChat,
    sectionEvents: ReadableStream<OnResponseTypes>,
    teardown: () => void
  ) {
    this.api = api;
    this.tid = tid;
    this.res = res;
    this.sectionStream = sectionEvents;
    this.#teardown = teardown;
    // this.#activePromptIds = activePromptIds;
  }

  // addFS(fs: VibeFile[]) {
  //   console.log("LLMChat addFS called for chatId:", this.chatId, this.tid, fs);
  //   return this.api.request<ReqType<ReqAddFS>, ResAddFS>(
  //     {
  //       type: "vibes.diy.req-add-fs",
  //       chatId: this.chatId,
  //       outerTid: this.tid,
  //       fs,
  //     },
  //     {
  //       resMatch: isResAddFS,
  //     }
  //   );
  // }

  async promptFS(req: FSUpdate | VibeFile[]): Promise<Result<ResPromptChatSection, VibesDiyError>> {
    if (isFSUpdate(req)) {
      return this.api.request<ReqType<ReqPromptFSUpdateChatSection>, ResPromptChatSection>(
        {
          type: "vibes.diy.req-prompt-chat-section",
          mode: "fs-update",
          chatId: this.res.chatId,
          outerTid: this.tid, //leaking but necessary streaming
          fsUpdate: req,
        },
        {
          resMatch: isResPromptChatSection,
        }
      );
    } else {
      const possibleArray = vibeFile.array()(req);
      if (possibleArray instanceof type.errors) {
        return Result.Err(mkResError(`Invalid VibeFile array`, "invalid-vibefile-array"));
      }
      return this.api.request<ReqType<ReqPromptFSSetChatSection>, ResPromptChatSection>(
        {
          type: "vibes.diy.req-prompt-chat-section",
          mode: "fs-set",
          chatId: this.res.chatId,
          outerTid: this.tid, //leaking but necessary streaming
          fsSet: possibleArray,
        },
        {
          resMatch: isResPromptChatSection,
        }
      );
    }
  }

  async prompt(
    msg: LLMRequest,
    opts?: {
      inputImageBase64?: string;
      dryRun?: boolean;
      dryRunPreAllocate?: boolean;
      focusPath?: string;
      selected?: SelectedSlotInput;
    }
  ): Promise<Result<ResPromptChatSection, VibesDiyError>> {
    const mode = this.res.mode;
    if (!isPromptLLMStyle(mode)) {
      return Result.Err(mkResError(`Chat mode ${this.res.mode} does not support prompting`, "unsupported-chat-mode"));
    }
    const res = await this.api.request<ReqType<ReqPromptLLMChatSection>, ResPromptChatSection>(
      {
        type: "vibes.diy.req-prompt-chat-section",
        mode,
        chatId: this.res.chatId,
        outerTid: this.tid, //leaking but necessary streaming
        prompt: msg,
        ...(mode === "img" && opts?.inputImageBase64 ? { inputImageBase64: opts.inputImageBase64 } : {}),
        // dryRun and focusPath are chat-mode-only flags (per reqCreationPromptChatSection
        // type). Forward them only when mode === "chat" — for app/img the
        // server type won't carry them.
        // On dry-run we also forward the resolved owner/app inline so the server
        // can synthesize its chat context without a chatContexts read — required
        // when openChat ran persistence-free and never inserted a row (#2364).
        ...(mode === "chat" && opts?.dryRun === true
          ? { dryRun: true, ownerHandle: this.res.ownerHandle, appSlug: this.res.appSlug }
          : {}),
        ...(mode === "chat" && opts?.dryRun === true && opts?.dryRunPreAllocate === true ? { dryRunPreAllocate: true } : {}),
        ...(mode === "chat" && opts?.focusPath !== undefined ? { focusPath: opts.focusPath } : {}),
        ...(mode === "chat" && opts?.selected !== undefined ? { selected: opts.selected } : {}),
      },
      {
        resMatch: isResPromptChatSection,
      }
    );
    // if (res.isOk()) {
    // this.#activePromptIds.set(res.Ok().promptId, undefined);
    // }
    return res;
  }

  async close(_force = false) {
    // Full teardown (unregister listener + close writer), not just the writer:
    // a still-alive socket must stop reaching the evento handler so it can't
    // write into the closed stream. Idempotent, so racing a transport-loss
    // close is safe.
    this.#teardown();
  }
}
