import {
  isResFetchCloudToken,
  isResVibeRegisterFPDb,
  isResCallAI,
  ReqCallAI,
  ResCallAI,
  isResImgGen,
  ReqImgGen,
  ResImgGen,
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
  ReqVibePutAsset,
  ResVibePutAsset,
  isResVibePutAsset,
  ReqVibeWhoAmI,
  ResVibeWhoAmI,
  isResVibeWhoAmI,
  type ReqVibeUpdateAvatarCid,
  type ResVibeUpdateAvatarCid,
  isResVibeUpdateAvatarCid,
  type ReqVibeLogin,
  isResSetDbAcl,
  type ResSetDbAcl,
  type DbAcl,
  type QueryFilter,
} from "@vibes.diy/vibe-types";
import { exception2Result, Future, KeyedResolvOnce, Lazy, OnFunc, OnFuncReturn, Result, timeouted } from "@adviser/cement";
import { type } from "arktype";
import { transform } from "sucrase";
import { FunctionComponent } from "react";
import { CallAIOpts, registerCallAI } from "./call-ai.js";
import { registerImgGen } from "./img-gen.js";
import { registerFirefly } from "./use-firefly.js";
import { getActiveProps, mountVibe } from "./mount-vibes.js";
import { getActiveImportMap, rewriteBareSpecifiers } from "./bare-specifier-rewrite.js";

export interface VibeApp {
  readonly appSlug: string;
  readonly ownerHandle: string;
  readonly fsId: string;
}

export interface VibeSandboxApiOptions {
  vibeApp: VibeApp;
  addEventListener: typeof window.addEventListener;
  postMessage: typeof window.postMessage;
}

interface RequestOpts {
  timeout?: number;
  // When set, replaces the wall-clock `timeout`: the request fails after
  // `idleTimeout` ms of NO incoming messages with a matching tid, but any
  // matching message resets the timer. Used by long-running RPCs (e.g.
  // putAsset for a 100 MiB upload) where the host emits periodic progress
  // events to keep the request alive.
  idleTimeout?: number;
  wait(x: unknown): boolean;
}

export class VibeSandboxApi {
  readonly svc: VibeSandboxApiOptions;

  // Resolves the first time the host posts vibe.evt.runtime.ack — i.e. once
  // we know the host's message listener is attached and will catch our posts.
  // Every outgoing request awaits this before postMessage, so RPCs that fire
  // during iframe boot (e.g. registerFirefly's subscribeDocs) don't get sent
  // into a void when the host's React provider hasn't mounted yet.
  readonly ackReady = new Future<void>();
  acked = false;

  readonly handleMessage = (event: MessageEvent): void => {
    if (!this.acked && isEvtRuntimeAck(event.data)) {
      this.acked = true;
      this.ackReady.resolve();
    }
    this.onMsg.invoke(event);
  };

  async request<Q, S>(msg: Omit<Q, "tid">, opts: RequestOpts): Promise<Result<S>> {
    // Gate every request on the host's ack so we don't send into a void
    // before the parent's message listener exists. Once acked, this is a
    // no-op (Future.asPromise() resolves immediately).
    await this.ackReady.asPromise();

    if (opts.idleTimeout !== undefined) {
      // Long-running idle-mode RPCs (e.g. subscribeDocs) intentionally stay
      // open for the lifetime of the subscription — instrumenting them
      // would pin the pill twinkle forever.
      return this.requestIdle<Q, S>(msg, opts, opts.idleTimeout);
    }

    beginNetworkActivity();
    try {
      const res = await timeouted(
        () => {
          const tid = crypto.randomUUID();
          const result = new Future<ResVibeRegisterFPDb>();
          this.onMsg((event) => {
            const d = event.data as { tid?: string; status?: string; type?: string } | undefined;
            if (d?.tid !== tid) return;
            if (opts.wait(event.data) || d.status === "error") {
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
        const v = res.value as { status?: string; message?: string };
        if (v.status === "error") {
          return Result.Err(v.message ?? "request rejected");
        }
        return Result.Ok(res.value as S);
      } else if (res.isError()) {
        return Result.Err(res.error);
      }
      return Result.Err(`Request timed out`);
    } finally {
      endNetworkActivity();
    }
  }

  // Variant of request() with idle-reset semantics: the request fails only
  // after `idleMs` of total silence on this tid. Any tid-matching message
  // (whether a terminal `wait()`-match or a progress heartbeat) resets the
  // timer. The host's vibePutAsset handler emits
  // `vibe.evt.putAsset.progress` every few seconds while the upload is in
  // flight to keep this alive across slow networks.
  private async requestIdle<Q, S>(msg: Omit<Q, "tid">, opts: RequestOpts, idleMs: number): Promise<Result<S>> {
    const tid = crypto.randomUUID();
    const result = new Future<{ kind: "ok"; value: S } | { kind: "timeout" }>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => result.resolve({ kind: "timeout" }), idleMs);
    };
    this.onMsg((event: MessageEvent) => {
      const data = event.data as { tid?: string } | undefined;
      if (data?.tid !== tid) return;
      reset();
      if (opts.wait(event.data)) {
        if (timer) clearTimeout(timer);
        result.resolve({ kind: "ok", value: event.data as S });
        return OnFuncReturn.UNREGISTER;
      }
    });
    this.svc.postMessage({ tid, ...msg }, "*");
    reset();
    const res = await result.asPromise();
    if (timer) clearTimeout(timer);
    if (res.kind === "ok") return Result.Ok(res.value);
    return Result.Err(`Request idle for ${idleMs}ms (no progress)`);
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

  imgGen(prompt: string, inputImageBase64?: string, model?: string): Promise<Result<ResImgGen>> {
    return this.request<ReqImgGen, ResImgGen>(
      {
        type: "vibe.req.imgGen",
        prompt,
        ...(inputImageBase64 ? { inputImageBase64 } : {}),
        ...(model ? { model } : {}),
        ...this.svc.vibeApp,
      },
      { wait: isResImgGen, timeout: 120000 }
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

  queryDocs(dbName = "default", filter?: QueryFilter): Promise<Result<ResQueryDocs>> {
    return this.request<ReqQueryDocs, ResQueryDocs>(
      {
        type: "vibes.diy.req-query-docs",
        ...this.svc.vibeApp,
        dbName,
        ...(filter !== undefined ? { filter } : {}),
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

  setDbAcl(dbName: string, acl: DbAcl): Promise<Result<ResSetDbAcl>> {
    return this.request<{ type: string; appSlug: string; ownerHandle: string; dbName: string; acl: DbAcl }, ResSetDbAcl>(
      {
        type: "vibes.diy.req-set-db-acl",
        ...this.svc.vibeApp,
        dbName,
        acl,
      },
      { wait: isResSetDbAcl, timeout: 10000 }
    );
  }

  listDbNames(): Promise<Result<ResListDbNames>> {
    return this.request<{ type: string; appSlug: string; ownerHandle: string }, ResListDbNames>(
      {
        type: "vibes.diy.req-list-db-names",
        ...this.svc.vibeApp,
      },
      { wait: isResListDbNames, timeout: 10000 }
    );
  }

  whoAmI(): Promise<Result<ResVibeWhoAmI>> {
    return this.request<ReqVibeWhoAmI, ResVibeWhoAmI>(
      {
        type: "vibe.req.whoAmI",
        appSlug: this.svc.vibeApp.appSlug,
        ownerHandle: this.svc.vibeApp.ownerHandle,
      },
      { wait: isResVibeWhoAmI, timeout: 10000 }
    );
  }

  // Stage B Phase 5: stream a Blob/File to the host, which mints a grant
  // (Stage A WS handler) and POSTs to /assets. Returns
  // { uploadId, cid, getURL, size } on success — Firefly's uploadFiles
  // helper swaps the Blob for { uploadId, type, size, lastModified }
  // before put-doc, so the doc serializes as JSON.
  //
  // 10s idle-reset timeout, not wall-clock: the host emits
  // vibe.evt.putAsset.progress heartbeats every few seconds during the
  // upload, so a slow 100 MiB push stays alive but a stuck connection
  // dies in 10s.
  putAsset(blob: Blob, mimeType?: string): Promise<Result<ResVibePutAsset>> {
    return this.request<ReqVibePutAsset, ResVibePutAsset>(
      {
        type: "vibe.req.putAsset",
        ...this.svc.vibeApp,
        blob,
        ...(mimeType ? { mimeType } : {}),
      },
      { wait: isResVibePutAsset, idleTimeout: 10000 }
    );
  }

  requestLogin(): void {
    const tid = crypto.randomUUID();
    void this.ackReady.asPromise().then(() => {
      this.svc.postMessage({ tid, type: "vibe.req.login", ...this.svc.vibeApp } satisfies ReqVibeLogin, "*");
    });
  }

  updateAvatarCid(cid: string): Promise<Result<ResVibeUpdateAvatarCid>> {
    return this.request<ReqVibeUpdateAvatarCid, ResVibeUpdateAvatarCid>(
      {
        type: "vibe.req.updateAvatarCid",
        ...this.svc.vibeApp,
        cid,
      },
      { wait: isResVibeUpdateAvatarCid, timeout: 10000 }
    );
  }

  readonly tokenCache = new KeyedResolvOnce();
  fetchCloudToken(req: Omit<ReqFetchCloudToken, "type" | "tid">): Promise<Result<ResFetchCloudToken>> {
    const key = `vibe-${req.data.dbName}-${req.data.ownerHandle}-${req.data.appSlug}`;
    return this.tokenCache.get(key).once(async (opts) => {
      console.info("Fetching cloud token with key", key);
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

let _registeredApi: VibeSandboxApi | undefined;

export function getRegisteredVibeApi(): VibeSandboxApi | undefined {
  return _registeredApi;
}

export const vibeApi = Lazy((svc: VibeSandboxApiOptions) => new VibeSandboxApi(svc));

export async function registerDependencies(vibeApp: VibeApp): Promise<void> {
  const ctxVibeApi = vibeApi({
    vibeApp,
    addEventListener: window.addEventListener.bind(window),
    postMessage: window.parent.postMessage.bind(window.parent),
  });
  _registeredApi = ctxVibeApi;

  await registerFirefly(ctxVibeApi);
  registerCallAI(ctxVibeApi);
  registerImgGen(ctxVibeApi);

  // Surface generic fetch activity from the vibe app to the host so the
  // VibesSwitch pill can twinkle while there's work in-flight.
  installFetchActivityMonitor();

  // Register the hot-swap listener BEFORE signalling ready, so any set-source
  // the host posts in response to runtime.ready arrives at a live listener.
  registerHotSwapHandler();
  // Send runtime.ready and retry until the host acks. The host's message
  // listener is attached inside its React provider, which can mount AFTER
  // the iframe boots when assets are 304-cached on a regular reload. Without
  // retry, the first runtime.ready is lost and the api.ackReady future never
  // resolves — every queued RPC hangs.
  sendRuntimeReadyWithRetry(ctxVibeApi);

  // Fire-and-forget bootstrap whoAmI: render-vibe.ts ships viewer:null in
  // mountParams because it can't reach Clerk session from the HTTP path.
  // Once the WS bridge is live (ackReady) we ask the host for the real
  // identity and dispatch a synthetic vibe.evt.viewerChanged into the same
  // listener VibeContext uses for live updates. This is what makes signed-in
  // viewers stop seeing themselves as anonymous on first render.
  bootstrapViewer(ctxVibeApi).catch((e) => {
    console.warn("[viewer] bootstrap whoAmI failed", e);
  });
}

function sendRuntimeReadyWithRetry(api: VibeSandboxApi): void {
  const post = (): void => api.sendRuntimeReady(["use-fireproof", "call-ai", "img-gen"]);
  post();
  // Retry every 500ms until acked. Posts are idempotent on the host side
  // (re-capture of the same iframeSource is a no-op). Typical case: parent
  // mounts within a few seconds → 0–6 extra posts before the interval clears.
  const interval = setInterval(() => {
    if (api.acked) {
      clearInterval(interval);
      return;
    }
    post();
  }, 500);
  // Belt-and-suspenders: also stop on ack via the future itself, in case the
  // resolve happens between the timer ticks (avoids one extra post).
  api.ackReady.asPromise().then(() => clearInterval(interval));
}

// Shared in-flight counter — fed by both the globalThis.fetch monkey-patch
// AND the bridge request() method, so the parent gets a single source of
// truth via `vibe.evt.network.active` / `vibe.evt.network.idle`.
let networkInFlight = 0;

function postNetworkActivity(active: boolean): void {
  try {
    window.parent.postMessage(
      active ? { type: "vibe.evt.network.active", count: networkInFlight } : { type: "vibe.evt.network.idle" },
      "*"
    );
  } catch {
    // postMessage can throw if the parent reference is gone (iframe being
    // torn down). Safe to ignore — there's nothing to twinkle for.
  }
}

export function beginNetworkActivity(): void {
  networkInFlight += 1;
  postNetworkActivity(true);
}

export function endNetworkActivity(): void {
  networkInFlight = Math.max(0, networkInFlight - 1);
  postNetworkActivity(networkInFlight > 0);
}

let fetchMonitorInstalled = false;

/**
 * Wraps globalThis.fetch so every in-flight request bumps the shared
 * `networkInFlight` counter. Errors and cancellations both decrement, so a
 * failed request never leaves the counter pinned > 0.
 */
function installFetchActivityMonitor(): void {
  if (fetchMonitorInstalled) return;
  fetchMonitorInstalled = true;
  if (typeof globalThis.fetch !== "function") return;

  const originalFetch = globalThis.fetch.bind(globalThis) as typeof globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    beginNetworkActivity();
    return originalFetch(input, init).then(
      (res) => {
        endNetworkActivity();
        return res;
      },
      (err) => {
        endNetworkActivity();
        throw err;
      }
    );
  }) as typeof globalThis.fetch;
}

let hotSwapRegistered = false;

function registerHotSwapHandler(): void {
  if (hotSwapRegistered) return;
  hotSwapRegistered = true;
  window.addEventListener("message", handleHotSwapMessage);
}

async function handleHotSwapMessage(event: MessageEvent): Promise<void> {
  if (!isEvtVibeSetSource(event.data)) return;
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
  }
}

export async function bootstrapViewer(api: VibeSandboxApi): Promise<void> {
  const res = await api.whoAmI();
  if (res.isErr()) return;
  const r = res.Ok();
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        type: "vibe.evt.viewerChanged",
        viewer: r.viewer,
        access: r.access,
        ...(r.isOwner !== undefined ? { isOwner: r.isOwner } : {}),
        ...(r.dbAcls ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants ? { grants: r.grants } : {}),
      },
    })
  );
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
  // Rewrite bare specifiers not present in the active import map to esm.sh
  // URLs so hot-swap doesn't fail before the fsId-bound import map activates
  // (issue #1595).
  const rewritten = rewriteBareSpecifiers(rTransform.Ok().code, getActiveImportMap());
  const blob = new Blob([rewritten], { type: "application/javascript" });
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
