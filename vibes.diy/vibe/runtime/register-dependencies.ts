import {
  isResFetchCloudToken,
  isResVibeRegisterFPDb,
  isResCallAI,
  ReqCallAI,
  ResCallAI,
  isResImgVibes,
  ReqImgVibes,
  ResImgVibes,
  ReqFetchCloudToken,
  ReqVibeRegisterFPDb,
  ResFetchCloudToken,
  ResVibeRegisterFPDb,
  EvtVibeAttachStatusFPDb,
  EvtVibeHotSwapError,
  isEvtVibeSetSource,
  isEvtRuntimeAck,
  isResPutDoc,
  isResGetDoc,
  isResGetDocNotFound,
  isResQueryDocs,
  isResDeleteDoc,
  isResSubscribeDocs,
  isResListDbNames,
  ReqPutDoc,
  ResPutDoc,
  ReqGetDoc,
  ResGetDoc,
  ReqQueryDocs,
  ResQueryDocs,
  ReqDeleteDoc,
  ResDeleteDoc,
  ReqSubscribeDocs,
  ResSubscribeDocs,
  ResListDbNames,
} from "@vibes.diy/vibe-types";
import { exception2Result, Future, KeyedResolvOnce, Lazy, OnFunc, Result, timeouted } from "@adviser/cement";
import { type } from "arktype";
import { transform } from "sucrase";
import { FunctionComponent } from "react";
import { CallAIOpts, registerCallAI } from "./call-ai.js";
import { registerImgVibes } from "./img-vibes.js";
import { registerFirefly } from "./use-firefly.js";
import { getActiveProps, mountVibe } from "./mount-vibes.js";

export interface VibeApp {
  readonly appSlug: string;
  readonly userSlug: string;
  readonly fsId: string;
}

export interface VibeSandboxApiOptions {
  vibeApp: VibeApp;
  addEventListener: typeof window.addEventListener;
  postMessage: typeof window.postMessage;
}

interface RequestOpts {
  timeout?: number;
  wait(x: unknown): boolean;
}

export class VibeSandboxApi {
  readonly svc: VibeSandboxApiOptions;

  readonly handleMessage = (event: MessageEvent): void => {
    this.onMsg.invoke(event);
  };

  async request<Q, S>(msg: Omit<Q, "tid">, opts: RequestOpts): Promise<Result<S>> {
    const res = await timeouted(
      () => {
        const tid = crypto.randomUUID();
        const result = new Future<ResVibeRegisterFPDb>();
        this.onMsg((event) => {
          // console.log("Received message event in request", event);
          if (opts.wait(event.data) && event.data.tid === tid) {
            result.resolve(event.data);
          }
        });
        this.svc.postMessage(
          {
            tid,
            ...msg,
          },
          "*"
        );
        return result.asPromise();
      },
      { timeout: opts.timeout ?? 5000 }
    );
    if (res.isSuccess()) {
      return Result.Ok(res.value as S);
    } else if (res.isError()) {
      return Result.Err(res.error);
    }
    return Result.Err(`Request timed out`);
  }

  readonly onMsg = OnFunc<(event: MessageEvent) => void>();

  constructor(svc: VibeSandboxApiOptions) {
    this.svc = svc;
    this.svc.addEventListener("message", this.handleMessage);
  }

  callAI(prompt: string, opts: CallAIOpts): Promise<Result<ResCallAI>> {
    return this.request<ReqCallAI, ResCallAI>(
      {
        type: "vibe.req.callAI",
        prompt,
        ...this.svc.vibeApp,
        schema: opts.schema,
      },
      { wait: isResCallAI, timeout: 60000 }
    );
  }

  imgVibes(prompt: string, inputImageBase64?: string, model?: string): Promise<Result<ResImgVibes>> {
    return this.request<ReqImgVibes, ResImgVibes>(
      {
        type: "vibe.req.imgVibes",
        prompt,
        ...(inputImageBase64 ? { inputImageBase64 } : {}),
        ...(model ? { model } : {}),
        ...this.svc.vibeApp,
      },
      { wait: isResImgVibes, timeout: 120000 }
    );
  }

  sendRegisterFPDbMessage(req: Omit<ReqVibeRegisterFPDb, "type" | "tid">) {
    // console.log("VibeSandboxApi sending register FPDb message", data);
    return this.request<ReqVibeRegisterFPDb, ResVibeRegisterFPDb>(
      {
        type: "vibe.req.register.fpdb",
        ...req,
      },
      { wait: isResVibeRegisterFPDb }
    );
  }

  sendRuntimeReady(deps: string[]) {
    this.svc.postMessage(
      {
        type: "vibe.evt.runtime.ready",
        deps,
      },
      "*"
    );
  }

  sendAttachStatusFPDbMessage(evt: Omit<EvtVibeAttachStatusFPDb, "type" | "tid">) {
    this.svc.postMessage(
      {
        type: "vibe.evt.attach.status.fpdb",
        ...evt,
      } satisfies EvtVibeAttachStatusFPDb,
      "*"
    );
  }
  // ── Firefly document operations ──────────────────────────────────────

  putDoc(doc: Record<string, unknown>, docId?: string, dbName = "default"): Promise<Result<ResPutDoc>> {
    return this.request<ReqPutDoc, ResPutDoc>(
      {
        type: "vibes.diy.req-put-doc",
        ...this.svc.vibeApp,
        dbName,
        doc,
        ...(docId ? { docId } : {}),
      },
      { wait: isResPutDoc, timeout: 10000 }
    );
  }

  getDoc(docId: string, dbName = "default"): Promise<Result<ResGetDoc>> {
    return this.request<ReqGetDoc, ResGetDoc>(
      {
        type: "vibes.diy.req-get-doc",
        ...this.svc.vibeApp,
        dbName,
        docId,
      },
      { wait: (x: unknown) => isResGetDoc(x) || isResGetDocNotFound(x), timeout: 10000 }
    );
  }

  queryDocs(dbName = "default"): Promise<Result<ResQueryDocs>> {
    return this.request<ReqQueryDocs, ResQueryDocs>(
      {
        type: "vibes.diy.req-query-docs",
        ...this.svc.vibeApp,
        dbName,
      },
      { wait: isResQueryDocs, timeout: 10000 }
    );
  }

  deleteDoc(docId: string, dbName = "default"): Promise<Result<ResDeleteDoc>> {
    return this.request<ReqDeleteDoc, ResDeleteDoc>(
      {
        type: "vibes.diy.req-delete-doc",
        ...this.svc.vibeApp,
        dbName,
        docId,
      },
      { wait: isResDeleteDoc, timeout: 10000 }
    );
  }

  subscribeDocs(dbName = "default"): Promise<Result<ResSubscribeDocs>> {
    return this.request<ReqSubscribeDocs, ResSubscribeDocs>(
      {
        type: "vibes.diy.req-subscribe-docs",
        ...this.svc.vibeApp,
        dbName,
      },
      { wait: isResSubscribeDocs, timeout: 10000 }
    );
  }

  listDbNames(): Promise<Result<ResListDbNames>> {
    return this.request<{ type: string; appSlug: string; userSlug: string }, ResListDbNames>(
      {
        type: "vibes.diy.req-list-db-names",
        ...this.svc.vibeApp,
      },
      { wait: isResListDbNames, timeout: 10000 }
    );
  }

  readonly tokenCache = new KeyedResolvOnce();
  fetchCloudToken(req: Omit<ReqFetchCloudToken, "type" | "tid">): Promise<Result<ResFetchCloudToken>> {
    const key = `vibe-${req.data.dbName}-${req.data.userSlug}-${req.data.appSlug}`;
    return this.tokenCache.get(key).once(async (opts) => {
      console.log("Fetching cloud token with key", key);
      const rRes = await this.request<ReqFetchCloudToken, ResFetchCloudToken>(
        {
          type: "vibe.req.fetchCloudToken",
          data: req.data,
        },
        { wait: isResFetchCloudToken }
      );
      opts.self.setResetAfter(100);
      if (rRes.isErr()) {
        console.error("Failed to fetch cloud token from vibe sandbox", rRes.Err());
        return rRes;
      }
      const res = rRes.Ok();
      const isValidRes = ResFetchCloudToken(res);
      if (isValidRes instanceof type.errors) {
        console.error("Failed to fetch cloud token from vibe sandbox", isValidRes.summary);
        return Result.Err(isValidRes.summary);
      }
      opts.self.setResetAfter(1000 * (isValidRes.token.expiresInSec - ~~(isValidRes.token.expiresInSec * 0.05)));
      return rRes;
    });
  }
}

export const vibeApi = Lazy((svc: VibeSandboxApiOptions) => new VibeSandboxApi(svc));

export async function registerDependencies(vibeApp: VibeApp): Promise<void> {
  const ctxVibeApi = vibeApi({
    vibeApp,
    addEventListener: window.addEventListener.bind(window),
    postMessage: window.parent.postMessage.bind(window.parent),
  });

  await registerFirefly(ctxVibeApi);
  registerCallAI(ctxVibeApi);
  registerImgVibes(ctxVibeApi);

  // Register the hot-swap listener BEFORE signalling ready, so any set-source
  // the host posts in response to runtime.ready arrives at a live listener.
  registerHotSwapHandler();
  // Send runtime.ready and retry on a bounded backoff until the host acks. The
  // host's message listener is attached inside its React provider, which can
  // mount AFTER the iframe boots when assets are 304-cached on a regular reload.
  // Without retry, the first runtime.ready is lost and every host→iframe RPC
  // that follows times out at 10s.
  sendRuntimeReadyWithRetry(ctxVibeApi);
}

const RUNTIME_READY_RETRY_DELAYS_MS = [100, 300, 1000, 3000];

function sendRuntimeReadyWithRetry(api: VibeSandboxApi): void {
  let acked = false;
  const onAck = (event: MessageEvent): void => {
    if (!isEvtRuntimeAck(event.data)) return;
    acked = true;
    window.removeEventListener("message", onAck);
  };
  window.addEventListener("message", onAck);
  const post = (): void => {
    if (acked) return;
    api.sendRuntimeReady(["use-fireproof", "call-ai", "img-vibes"]);
  };
  post();
  for (const delay of RUNTIME_READY_RETRY_DELAYS_MS) {
    setTimeout(post, delay);
  }
}

let hotSwapRegistered = false;

function registerHotSwapHandler(): void {
  if (hotSwapRegistered) return;
  hotSwapRegistered = true;
  window.addEventListener("message", handleHotSwapMessage);
  console.log("[hot-swap iframe] handler registered");
}

async function handleHotSwapMessage(event: MessageEvent): Promise<void> {
  if (!isEvtVibeSetSource(event.data)) return;
  console.log("[hot-swap iframe] received set-source", { len: event.data.source.length, origin: event.origin });
  const result = await applyHotSwap(event.data.source);
  if (result.isErr()) {
    // Iframe stays on the previous render (mountVibe re-renders into the
    // existing root, so React rolls back failed commits). Notify the parent
    // so it can surface a toast — without this, the user sees the iframe
    // silently stop updating mid-stream and assumes the app broke.
    console.error("[hot-swap iframe] failed", result.Err());
    const errMsg: EvtVibeHotSwapError = {
      type: "vibe.evt.hot-swap-error",
      message: String(result.Err()),
    };
    window.parent.postMessage(errMsg, "*");
  } else {
    console.log("[hot-swap iframe] applied successfully");
  }
}

async function applyHotSwap(source: string): Promise<Result<void>> {
  const rTransform = exception2Result(() =>
    transform(source, {
      transforms: ["jsx"],
      production: true,
      jsxRuntime: "automatic",
    })
  );
  if (rTransform.isErr()) return Result.Err(rTransform.Err());
  const blob = new Blob([rTransform.Ok().code], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const rImport = await exception2Result<{ default?: unknown }>(() => import(/* @vite-ignore */ blobUrl));
    if (rImport.isErr()) return Result.Err(rImport.Err());
    const App = rImport.Ok().default;
    if (typeof App !== "function") {
      return Result.Err("hot-swap module has no default-exported component");
    }
    // Re-render into the existing React root rather than unmount+remount.
    // If the new App throws on render, React keeps the previously-committed
    // DOM in place — the iframe doesn't blank out on a misapplied edit.
    const rMount = exception2Result(() => {
      mountVibe([App as FunctionComponent], getActiveProps());
    });
    if (rMount.isErr()) return Result.Err(rMount.Err());
    return Result.Ok(undefined);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
