import {
  FPDbData,
  isResErrorVibeRegisterFPDb,
  isResFetchCloudToken,
  isResOkVibeRegisterFPDb,
  isResVibeRegisterFPDb,
  isResCallAI,
  ReqCallAI,
  ResCallAI,
  isResImageGen,
  ReqImageGen,
  ResImageGen,
  ReqFetchCloudToken,
  ReqVibeRegisterFPDb,
  ResFetchCloudToken,
  ResVibeRegisterFPDb,
  EvtVibeAttachStatusFPDb,
  isEvtAttachFPDb,
} from "@vibes.diy/vibe-types";
import { Future, KeyedResolvOnce, Lazy, Logger, OnFunc, ResolveOnce, Result, timeouted } from "@adviser/cement";
import { ToCloudOpts, TokenAndClaims, TokenStrategie } from "@fireproof/core-types-protocols-cloud";
import { Ledger, SuperThis, toCloud } from "use-fireproof";
import { type } from "arktype";
import { CallAIOpts, registerCallAI } from "./call-ai.js";
import { registerImageGen } from "./img-gen.js";

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

  imageGen(prompt: string): Promise<Result<ResImageGen>> {
    return this.request<ReqImageGen, ResImageGen>(
      {
        type: "vibe.req.imageGen",
        prompt,
        ...this.svc.vibeApp,
      },
      { wait: isResImageGen, timeout: 120000 }
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

class VibeTokenStrategie implements TokenStrategie {
  readonly vibeApi: VibeSandboxApi;
  readonly my: FPDbData;
  constructor(vibeApi: VibeSandboxApi, my: FPDbData) {
    this.vibeApi = vibeApi;
    this.my = my;
  }

  hash(): string {
    return "vibe-token-strategie";
  }
  open(_sthis: SuperThis, _logger: Logger, _deviceId: string, _opts: ToCloudOpts): void {
    return;
  }
  tryToken(_sthis: SuperThis, _logger: Logger, _opts: ToCloudOpts): Promise<TokenAndClaims | undefined> {
    return Promise.resolve(undefined);
  }
  async waitForToken(
    _sthis: SuperThis,
    _logger: Logger,
    _deviceId: string,
    _opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    const resToken = await this.vibeApi.fetchCloudToken({
      data: this.my,
    });
    if (resToken.isErr()) {
      console.error("Failed to fetch cloud token from vibe sandbox", resToken.Err());
      return undefined;
    }
    const token = resToken.Ok();
    return {
      token: token.token.cloudToken,
      claims: token.token.claims as unknown as TokenAndClaims["claims"],
    };
    return Promise.resolve(undefined);
  }
  stop(): void {
    console.log("VibeTokenStrategie stop called");
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
  const useFireproofDep = deps["use-fireproof"];
  if (useFireproofDep && window.parent !== window) {
    runTimeReady.push("use-fireproof");
    const fp = (await import(useFireproofDep)) as typeof import("use-fireproof");
    // const vibeApi = ({
    //   addEventListener: window.addEventListener.bind(window),
    //   postMessage: window.parent.postMessage.bind(window.parent),
    // });

    const attachables = new Map<
      string,
      {
        key: string;
        ledger: Ledger;
        attach: ResolveOnce<void>;
      }
    >();
    ctxVibeApi.onMsg((event) => {
      // console.log("Received message event in vibeApi onMsg handler", event);
      const { data: evt } = event;
      if (isEvtAttachFPDb(evt)) {
        const key = `${evt.data.dbName}-${evt.data.userSlug}-${evt.data.appSlug}`;
        const attabable = attachables.get(key);
        if (attabable) {
          attabable.attach.once(async () => {
            console.log("Attaching FPDb with key", evt.data);
            const result = await attabable.ledger.attach(
              toCloud({
                name: `vibe-${evt.data.dbName}-${evt.data.userSlug}-${evt.data.appSlug}`,
                strategy: new VibeTokenStrategie(ctxVibeApi, evt.data),
                urls: {
                  base: evt.data.fpcloudUrl,
                },
              })
            );
            ctxVibeApi.sendAttachStatusFPDbMessage({
              data: evt.data,
              status: result.status(),
            });
          });
        }
      }
    });

    fp.getLedgerSvc().onCreate((ledger) => {
      ctxVibeApi
        .sendRegisterFPDbMessage({
          dbName: ledger.name,
          appSlug: vibeApp.appSlug,
          userSlug: vibeApp.userSlug,
          fsId: vibeApp.fsId,
        })
        .then((rResMsg) => {
          if (rResMsg.isErr()) {
            console.error("Failed to register FPDb with vibe sandbox", rResMsg.Err());
          }
          const res = rResMsg.Ok();
          if (isResErrorVibeRegisterFPDb(res)) {
            console.error("Failed to register FPDb with vibe sandbox", res.message);
          }
          if (isResOkVibeRegisterFPDb(res)) {
            console.log("Registered FPDb with vibe sandbox", res);
            const key = `${res.data.dbName}-${res.data.userSlug}-${res.data.appSlug}`;
            attachables.set(key, {
              key,
              ledger,
              attach: new ResolveOnce<void>(),
            });
          }
        });
    });
  }
  const callAI = deps["call-ai"];
  if (callAI && window.parent !== window) {
    runTimeReady.push("call-ai");
    registerCallAI(ctxVibeApi);
    registerImageGen(ctxVibeApi);
  }
  ctxVibeApi.sendRuntimeReady(runTimeReady);
  return;
}
