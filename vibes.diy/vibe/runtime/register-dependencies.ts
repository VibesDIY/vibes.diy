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
  isResQueryDocs,
  isResDeleteDoc,
  isResSubscribeDocs,
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
} from "@vibes.diy/vibe-types";
import { Future, KeyedResolvOnce, Lazy, OnFunc, Result, timeouted } from "@adviser/cement";
import { type } from "arktype";
import { CallAIOpts, registerCallAI } from "./call-ai.js";
import { registerImgVibes } from "./img-vibes.js";
import { registerFirefly } from "./use-firefly.js";

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

  imgVibes(prompt: string, inputImageBase64?: string): Promise<Result<ResImgVibes>> {
    return this.request<ReqImgVibes, ResImgVibes>(
      {
        type: "vibe.req.imgVibes",
        prompt,
        ...(inputImageBase64 ? { inputImageBase64 } : {}),
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

  putDoc(doc: Record<string, unknown>, docId?: string): Promise<Result<ResPutDoc>> {
    return this.request<ReqPutDoc, ResPutDoc>(
      {
        type: "vibes.diy.req-put-doc",
        ...this.svc.vibeApp,
        doc,
        ...(docId ? { docId } : {}),
      },
      { wait: isResPutDoc, timeout: 10000 }
    );
  }

  getDoc(docId: string): Promise<Result<ResGetDoc>> {
    return this.request<ReqGetDoc, ResGetDoc>(
      {
        type: "vibes.diy.req-get-doc",
        ...this.svc.vibeApp,
        docId,
      },
      { wait: isResGetDoc, timeout: 10000 }
    );
  }

  queryDocs(): Promise<Result<ResQueryDocs>> {
    return this.request<ReqQueryDocs, ResQueryDocs>(
      {
        type: "vibes.diy.req-query-docs",
        ...this.svc.vibeApp,
      },
      { wait: isResQueryDocs, timeout: 10000 }
    );
  }

  deleteDoc(docId: string): Promise<Result<ResDeleteDoc>> {
    return this.request<ReqDeleteDoc, ResDeleteDoc>(
      {
        type: "vibes.diy.req-delete-doc",
        ...this.svc.vibeApp,
        docId,
      },
      { wait: isResDeleteDoc, timeout: 10000 }
    );
  }

  subscribeDocs(): Promise<Result<ResSubscribeDocs>> {
    return this.request<ReqSubscribeDocs, ResSubscribeDocs>(
      {
        type: "vibes.diy.req-subscribe-docs",
        ...this.svc.vibeApp,
      },
      { wait: isResSubscribeDocs, timeout: 10000 }
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

export async function registerDependencies(vibeApp: VibeApp, deps: Record<string, string>): Promise<void> {
  // bind vibeApi to runtime
  const ctxVibeApi = vibeApi({
    vibeApp,
    addEventListener: window.addEventListener.bind(window),
    postMessage: window.parent.postMessage.bind(window.parent),
  });

  const runTimeReady: string[] = [];
  // use-fireproof is aliased to vibe-runtime in the import map,
  // so app code gets Firefly's useFireproof. Hooks are inlined — no dynamic import needed.
  const useFireproofDep = deps["use-fireproof"] || deps["@fireproof/use-fireproof"];
  if (useFireproofDep && window.parent !== window) {
    runTimeReady.push("use-fireproof");

    // Firefly mode: route all database operations through the API via evento bridge
    await registerFirefly(ctxVibeApi);
  }
  const callAI = deps["call-ai"];
  if (callAI && window.parent !== window) {
    runTimeReady.push("call-ai");
    registerCallAI(ctxVibeApi);
  }
  const imgVibes = deps["img-vibes"];
  if (imgVibes && window.parent !== window) {
    runTimeReady.push("img-vibes");
    registerImgVibes(ctxVibeApi);
  }
  ctxVibeApi.sendRuntimeReady(runTimeReady);
  return;
}
