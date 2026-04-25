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
import { Future, KeyedResolvOnce, Lazy, OnFunc, Result, timeouted } from "@adviser/cement";
import { type } from "arktype";
import { transform } from "sucrase";
import { CallAIOpts, registerCallAI } from "./call-ai.js";
import { registerImgVibes } from "./img-vibes.js";
import { registerFirefly } from "./use-firefly.js";
import { getActiveProps, mountVibe, unmountVibe } from "./mount-vibes.js";

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

  ctxVibeApi.sendRuntimeReady(["use-fireproof", "call-ai", "img-vibes"]);
  registerHotSwapHandler();
}

let hotSwapRegistered = false;

function registerHotSwapHandler(): void {
  if (hotSwapRegistered) return;
  hotSwapRegistered = true;
  window.addEventListener("message", handleHotSwapMessage);
}

async function handleHotSwapMessage(event: MessageEvent): Promise<void> {
  const data = event.data as { type?: string; source?: unknown } | undefined;
  if (!data || data.type !== "vibe.req.set-source" || typeof data.source !== "string") return;
  const source = data.source;
  let blobUrl: string | undefined;
  try {
    const { code } = transform(source, {
      transforms: ["jsx"],
      production: true,
      jsxRuntime: "automatic",
    });
    const blob = new Blob([code], { type: "application/javascript" });
    blobUrl = URL.createObjectURL(blob);
    const mod = (await import(/* @vite-ignore */ blobUrl)) as { default?: unknown };
    const App = mod.default;
    if (typeof App !== "function") {
      throw new Error("hot-swap: module has no default-exported component");
    }
    unmountVibe();
    mountVibe([App as Parameters<typeof mountVibe>[0][number]], getActiveProps());
  } catch (err) {
    console.error("[hot-swap] failed", err);
    // Iframe stays on the previous render; end-of-turn autosave will navigate
    // to a fresh fsId and reload the iframe cleanly.
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
}
