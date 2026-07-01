import {
  Evento,
  EventoEnDecoder,
  HandleTriggerCtx,
  Lazy,
  Result,
  ValidateTriggerCtx,
  Option,
  EventoResultType,
  EventoResult,
  EventoSendProvider,
  EventoHandler,
  OnFunc,
} from "@adviser/cement";
import {
  isEvtRuntimeReady,
  type EvtRuntimeReady,
  type EvtRuntimeAck,
  type EvtVibeSetSource,
  isEvtVibeHotSwapError,
  type EvtVibeViewerChanged,
  type EvtVibeColorOverride,
  isReqOpenDmThread,
  type ReqOpenDmThread,
} from "@vibes.diy/vibe-types";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";
import { vibeCallAI, vibeImgGen } from "./srv-sandbox-ai-image-handlers.js";
import {
  vibePutDoc,
  vibeGetDoc,
  vibeQueryDocs,
  vibeDeleteDoc,
  vibeSubscribeDocs,
  vibeBroadcastEphemeral,
  vibeSetDbAcl,
  vibeListDbNames,
} from "./srv-sandbox-firefly-doc-handlers.js";
import {
  vibePutAsset,
  vibeWhoAmI,
  vibeAccessFnSource,
  vibeUpdateAvatarCid,
  vibeRequestLogin,
} from "./srv-sandbox-asset-identity-auth-handlers.js";
import type { VibesDiySrvSandboxArgs } from "./srv-sandbox-types.js";

export { getCodeBlock, getImageFiles } from "./srv-sandbox-ai-image-handlers.js";

export class MessageEventEventoEnDecoder implements EventoEnDecoder<MessageEvent, unknown> {
  async encode(me: MessageEvent): Promise<Result<unknown>> {
    return Result.Ok(me);
  }
  decode(data: unknown): Promise<Result<unknown>> {
    return Promise.resolve(Result.Ok(data));
  }
}

export class PostMsgSendProvider implements EventoSendProvider<MessageEvent, unknown, unknown> {
  readonly window: Window;
  readonly event: MessageEvent;

  constructor(window: Window, event: MessageEvent) {
    this.window = window;
    this.event = event;
  }

  send<IS, OS>(trigger: HandleTriggerCtx<MessageEvent<unknown>, unknown, unknown>, data: IS): Promise<Result<OS, Error>> {
    (this.event.source as Window).postMessage(data, this.event.origin);
    return Promise.resolve(Result.Ok(data as unknown as OS));
  }
}

function vibeRuntimeReady(sandbox: vibesDiySrvSandbox): EventoHandler {
  return {
    hash: "vibe.runtime.ready",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, EvtRuntimeReady, unknown>) => {
      const { request: req } = ctx;
      if (isEvtRuntimeReady(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, EvtRuntimeReady, unknown>): Promise<Result<EventoResultType>> => {
      sandbox.onRuntimeReady.invoke(ctx.validated);
      return Result.Ok(EventoResult.Continue);
    },
  };
}

export class vibesDiySrvSandbox implements Disposable {
  readonly evento: Evento;

  readonly onRuntimeReady = OnFunc<(evt: EvtRuntimeReady) => void>();

  // Iframe → parent hot-swap failure dispatch. Subscribers (PreviewApp) toast
  // so the user sees that a streamed edit failed to compile/mount, instead of
  // assuming the silently-stale preview is the latest state.
  readonly onHotSwapError = OnFunc<(err: { readonly message: string }) => void>();

  // Iframe → parent DM navigation request. Subscribers navigate the parent
  // app to /messages/<myUserSlug>/<recipientUserSlug>.
  readonly onOpenDmThread = OnFunc<(req: Pick<ReqOpenDmThread, "recipientUserSlug">) => void>();

  // Captured iframe postMessage target — set on first message from iframe
  private iframeSource: Window | undefined;
  private iframeOrigin: string | undefined;

  // cid → storage getURL for assets this host uploaded on the vibe's behalf.
  // Populated from the (server-trusted) put-asset response in vibePutAsset and
  // read by the avatar-confirm gate so the modal can preview the exact bytes a
  // CID resolves to without trusting a sandbox-supplied URL (#2418). Bounded so
  // a long-lived session can't grow it without limit; eviction is FIFO (Map
  // preserves insertion order) and only ever drops stale entries — a missing
  // entry just means "no preview", never an incorrect one.
  private readonly assetGetURLByCid = new Map<string, string>();
  private static readonly ASSET_GETURL_CACHE_MAX = 64;
  // Latest source we've ever attempted to push. Replayed on every runtime.ready
  // so the iframe is rehydrated whether the ready fires from a brand-new boot,
  // an HMR reload, or a cross-vibe navigation that destroyed the previous
  // iframe Window (the prior reference would still look "alive" to a naive
  // pushSource — postMessage to a detached Window is a silent no-op, so without
  // replay the first chat-B push would be lost between the dead iframeSource
  // and the new iframe's runtime.ready).
  private pendingSource: string | undefined;

  // The vibe-data backing API (AppSessions). Resolved live rather than frozen
  // at construction: the host provider builds this sandbox once (module-level
  // Lazy) but `vibeApi` only becomes available — or changes between vibes — on
  // later renders. Reading a frozen constructor copy meant a sandbox first
  // built on a non-vibe render answered every vibe-data op with the
  // "vibeApi unavailable" error forever, or kept routing to the previous
  // vibe after navigation (#2348). Updated via setVibeApi.
  private currentVibeApi: VibesDiyApiIface | undefined;
  // Unsubscribe for the current vibeApi's onDocChanged forwarder, so swapping
  // vibeApi tears down the prior subscription instead of leaking forwarders.
  private docChangedUnsub: (() => void) | undefined;
  // Same, for the ephemeral presence (#1756) forwarders.
  private docEphemeralUnsub: (() => void) | undefined;
  private docEphemeralDropUnsub: (() => void) | undefined;

  get vibeApi(): VibesDiyApiIface | undefined {
    return this.currentVibeApi;
  }

  // Attach (or detach) the live vibe-data API. Idempotent on the same
  // reference. On change it rewires the doc-changed → iframe forwarder,
  // dropping the previous subscription first.
  setVibeApi(vibeApi: VibesDiyApiIface | undefined): void {
    if (vibeApi === this.currentVibeApi) return;
    this.docChangedUnsub?.();
    this.docChangedUnsub = undefined;
    this.docEphemeralUnsub?.();
    this.docEphemeralUnsub = undefined;
    this.docEphemeralDropUnsub?.();
    this.docEphemeralDropUnsub = undefined;
    this.currentVibeApi = vibeApi;
    if (vibeApi !== undefined) {
      this.docChangedUnsub = vibeApi.onDocChanged((ownerHandle, appSlug, dbName, docId) => {
        this.forwardDocChangedToIframe(ownerHandle, appSlug, dbName, docId);
      });
      // Ephemeral presence (#1756): forward the full evt (snapshot + originPeer +
      // channel) and drop events straight into the iframe, where
      // FireflyDatabase's onMsg listener folds them into its overlay. Guarded so
      // a partial/legacy vibeApi (e.g. test mocks predating #1756) doesn't crash
      // setVibeApi — presence is additive, its absence just disables presence.
      if (typeof vibeApi.onDocEphemeral === "function") {
        this.docEphemeralUnsub = vibeApi.onDocEphemeral((evt) => {
          this.forwardToIframe(evt);
        });
      }
      if (typeof vibeApi.onDocEphemeralDrop === "function") {
        this.docEphemeralDropUnsub = vibeApi.onDocEphemeralDrop((originPeer) => {
          this.forwardToIframe({ type: "vibes.diy.evt-doc-ephemeral-drop", originPeer });
        });
      }
    }
  }

  // Record the server-supplied storage URI for a CID this host just uploaded.
  // Re-recording a CID refreshes its position so it survives eviction; once the
  // cache is full the oldest entry is dropped.
  recordAssetGetURL(cid: string, getURL: string): void {
    if (this.assetGetURLByCid.has(cid)) this.assetGetURLByCid.delete(cid);
    this.assetGetURLByCid.set(cid, getURL);
    if (this.assetGetURLByCid.size > vibesDiySrvSandbox.ASSET_GETURL_CACHE_MAX) {
      const oldest = this.assetGetURLByCid.keys().next().value;
      if (oldest !== undefined) this.assetGetURLByCid.delete(oldest);
    }
  }

  // The recorded storage URI for a CID, or undefined if this host never
  // uploaded it (e.g. a CID from a prior session). Callers must treat undefined
  // as "no preview", not as an error.
  getAssetGetURL(cid: string): string | undefined {
    return this.assetGetURLByCid.get(cid);
  }

  readonly handleMessage = async (event: MessageEvent): Promise<void> => {
    // vibe.* prefix filters out Clerk auth / analytics iframes that postMessage first.
    const isVibeMsg = event.source && typeof event.data?.type === "string" && event.data.type.startsWith("vibe.");
    // runtime.ready signals the iframe just (re-)booted with the hot-swap listener
    // registered. Always re-capture iframeSource here so HMR reloads, manual page
    // reloads, etc. don't leave us posting to a stale (dead) Window reference.
    const isRuntimeReady = isVibeMsg && (event.data as { type?: string } | undefined)?.type === "vibe.evt.runtime.ready";
    if (isRuntimeReady) {
      this.iframeSource = event.source as Window;
      this.iframeOrigin = event.origin;
      // Stage C: bridge the asset-host session cookie BEFORE acking the
      // iframe. The iframe gates every RPC on this ack, so any meta.url
      // the iframe ever sees comes back post-cookie. No race window for
      // <img> requests. Bridge failures (signed-out user, network blip)
      // still proceed to ack — public-readable vibes keep working;
      // private vibes show broken-image, which is correct.
      if (this.args.ensureAssetSession) {
        try {
          await this.args.ensureAssetSession();
        } catch (e) {
          console.warn("[stage-c] ensureAssetSession failed before runtime.ack", e);
        }
      }
      // Acknowledge so the iframe can stop its retry loop. The iframe re-posts
      // runtime.ready until it sees this ack, defeating the race where a
      // cached-assets iframe boots before the parent's React provider mounts.
      this.iframeSource.postMessage({ type: "vibe.evt.runtime.ack" } satisfies EvtRuntimeAck, this.iframeOrigin);
      if (this.pendingSource !== undefined) {
        const msg: EvtVibeSetSource = { type: "vibe.evt.set-source", source: this.pendingSource };
        this.iframeSource.postMessage(msg, this.iframeOrigin);
      }
    } else if (isVibeMsg && !this.iframeSource) {
      // Edge case: a non-runtime.ready vibe.* message arriving before runtime.ready
      // (shouldn't happen in normal flow, but capture defensively).
      this.iframeSource = event.source as Window;
      this.iframeOrigin = event.origin;
    }
    if (isEvtVibeHotSwapError(event.data)) {
      this.onHotSwapError.invoke({ message: event.data.message });
    }
    if (isReqOpenDmThread(event.data)) {
      this.onOpenDmThread.invoke({ recipientUserSlug: event.data.recipientUserSlug });
      return;
    }
    this.evento.trigger<MessageEvent, unknown, unknown>({
      request: event,
      send: new PostMsgSendProvider(window, event),
    });
  };

  // Forward a doc-changed event from the API to the iframe
  forwardDocChangedToIframe(ownerHandle: string, appSlug: string, dbName: string, docId: string): void {
    if (this.iframeSource && this.iframeOrigin) {
      this.iframeSource.postMessage({ type: "vibes.diy.evt-doc-changed", ownerHandle, appSlug, dbName, docId }, this.iframeOrigin);
    }
  }

  // Forward an already-shaped server event (e.g. evt-doc-ephemeral / -drop) to
  // the iframe verbatim (#1756).
  private forwardToIframe(msg: Record<string, unknown>): void {
    if (this.iframeSource && this.iframeOrigin) {
      this.iframeSource.postMessage(msg, this.iframeOrigin);
    }
  }

  // Push viewer identity into the iframe. Called by PreviewApp on runtime.ready
  // so the iframe has the correct access level before bootstrapViewer's WS
  // roundtrip completes, avoiding the read-only flash caused by the HTTP render
  // path embedding access:"none" (no Clerk session available there).
  pushViewerChanged(msg: EvtVibeViewerChanged): void {
    if (this.iframeSource && this.iframeOrigin) {
      this.iframeSource.postMessage(msg, this.iframeOrigin);
    }
  }

  // Push a fresh palette to the running app so the user sees the recolor
  // instantly — no codegen turn required. The runtime side injects a
  // <style id="vibe-color-override"> that defines CSS custom properties
  // for every token. Send empty `colors` to clear the override.
  pushColorOverride(msg: EvtVibeColorOverride): void {
    if (this.iframeSource && this.iframeOrigin) {
      this.iframeSource.postMessage(msg, this.iframeOrigin);
    }
  }

  // Hot-swap the iframe's App.jsx with new source. Always cache the source in
  // pendingSource so a subsequent runtime.ready (HMR reload, cross-vibe
  // navigation, iframe replacement) can replay it — postMessage to a detached
  // Window is a silent no-op, so without this cache the first push after the
  // old iframe dies but before the new one acks would be lost.
  pushSource(source: string): boolean {
    this.pendingSource = source;
    if (this.iframeSource === undefined || this.iframeOrigin === undefined) {
      return false;
    }
    const msg: EvtVibeSetSource = { type: "vibe.evt.set-source", source };
    this.iframeSource.postMessage(msg, this.iframeOrigin);
    return true;
  }

  // Drop the cached source. PreviewApp calls this on cross-vibe navigation so
  // a subsequent runtime.ready doesn't rehydrate the new iframe with the prior
  // vibe's code — the new iframe's entry URL already loads the correct app,
  // and a stale replay before chat B's processStream emits a qualifying push
  // (or in the case where it never does — empty chats, sub-200-char buffers,
  // missing `export default`) would overwrite it indefinitely.
  clearPendingSource(): void {
    if (this.pendingSource === undefined) return;
    this.pendingSource = undefined;
  }

  readonly removeEventListeners: typeof window.removeEventListener;
  readonly args: VibesDiySrvSandboxArgs;

  constructor(args: VibesDiySrvSandboxArgs) {
    this.args = args;
    this.evento = new Evento(new MessageEventEventoEnDecoder());
    this.evento.push(
      ...[
        vibeRuntimeReady(this),
        vibeCallAI(this),
        vibeImgGen(this),
        vibePutDoc(this),
        vibeGetDoc(this),
        vibeQueryDocs(this),
        vibeDeleteDoc(this),
        vibeSubscribeDocs(this),
        vibeBroadcastEphemeral(this),
        vibeSetDbAcl(this),
        vibeListDbNames(this),
        vibePutAsset(this),
        vibeWhoAmI(this),
        vibeAccessFnSource(this),
        vibeUpdateAvatarCid(this),
        vibeRequestLogin(this),
      ]
    );
    this.args.eventListeners.addEventListener("message", this.handleMessage);
    this.removeEventListeners = this.args.eventListeners.removeEventListener;

    // Seed the live vibeApi (and its doc-changed → iframe forwarder) from the
    // constructor args. Later renders refresh it via setVibeApi.
    this.setVibeApi(args.vibeApi);
  }

  /** @internal — test inspection only */
  get _testInternals(): { iframeSource: Window | undefined; iframeOrigin: string | undefined } {
    return { iframeSource: this.iframeSource, iframeOrigin: this.iframeOrigin };
  }

  [Symbol.dispose](): void {
    this.removeEventListeners("message", this.handleMessage);
    this.docChangedUnsub?.();
    this.docChangedUnsub = undefined;
  }
}

export const VibesDiySrvSandbox = Lazy((ctx: VibesDiySrvSandboxArgs) => {
  if (!ctx.eventListeners) {
    return {} as vibesDiySrvSandbox;
  }
  return new vibesDiySrvSandbox(ctx);
});
