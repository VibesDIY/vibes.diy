import {
  FPDbData,
  isResErrorVibeRegisterFPDb,
  isResFetchCloudToken,
  isResOkVibeRegisterFPDb,
  isResVibeRegisterFPDb,
  ReqFetchCloudToken,
  ReqVibeRegisterFPDb,
  ResFetchCloudToken,
  ResVibeRegisterFPDb,
} from "@vibes.diy/vibe-types";
import { Future, KeyedResolvOnce, Logger, OnFunc, Result, timeouted } from "@adviser/cement";
import { ToCloudOpts, TokenAndClaims, TokenStrategie } from "@fireproof/core-types-protocols-cloud";
import { SuperThis, toCloud } from "use-fireproof";
import { type } from "arktype";

export interface VibeApp {
  readonly appSlug: string;
  readonly userSlug: string;
  readonly fsId: string;
}

class VibeSandboxApi {
  readonly svc: { addEventListener: typeof window.addEventListener; postMessage: typeof window.postMessage };

  readonly handleMessage = (event: MessageEvent): void => {
    this.onMsg.invoke(event);
  };

  async request<Q, S>(msg: Omit<Q, "tid">, wait: (x: unknown) => boolean): Promise<Result<S>> {
    const res = await timeouted(
      () => {
        const tid = crypto.randomUUID();
        const result = new Future<ResVibeRegisterFPDb>();
        this.onMsg((event) => {
          console.log("Received message event in request", event);
          if (wait(event.data) && event.data.tid === tid) {
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
      { timeout: 5000 }
    );
    if (res.isSuccess()) {
      return Result.Ok(res.value as S);
    } else if (res.isError()) {
      return Result.Err(res.error);
    }
    return Result.Err(`Request timed out`);
  }

  readonly onMsg = OnFunc<(event: MessageEvent) => void>();

  constructor(svc: { addEventListener: typeof window.addEventListener; postMessage: typeof window.postMessage }) {
    this.svc = svc;
    this.svc.addEventListener("message", this.handleMessage);
  }

  sendRegisterFPDbMessage(data: Omit<ReqVibeRegisterFPDb, "type" | "tid">) {
    // console.log("VibeSandboxApi sending register FPDb message", data);
    return this.request<ReqVibeRegisterFPDb, ResVibeRegisterFPDb>(
      {
        type: "vibe.req.register.fpdb",
        ...data,
      },
      isResVibeRegisterFPDb
    );
  }

  readonly tokenCache = new KeyedResolvOnce();
  fetchCloudToken(req: Omit<ReqFetchCloudToken, "type" | "tid">): Promise<Result<ResFetchCloudToken>> {
    const key = `vibe-${req.data.dbName}-${req.data.userSlug}-${req.data.appSlug}`;
    return this.tokenCache.get(key).once(async (opts) => {
      const rRes = await this.request<ReqFetchCloudToken, ResFetchCloudToken>(
        {
          type: "vibe.req.fetchCloudToken",
          data: req.data,
        },
        isResFetchCloudToken
      );
      opts.self.setResetAfter(100)
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
      opts.self.setResetAfter(isValidRes.token.expiresAfter - ~~(isValidRes.token.expiresAfter*0.05));
      return rRes
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
  async waitForToken(_sthis: SuperThis, _logger: Logger, _deviceId: string, opts: ToCloudOpts): Promise<TokenAndClaims | undefined> {
    const resToken = await this.vibeApi.fetchCloudToken({
      data: this.my,
    });
    if (resToken.isErr()) {
      console.error("Failed to fetch cloud token from vibe sandbox", resToken.Err());
      return undefined;
    }
    const token = resToken.Ok();
    return {
      token: token.token.token,
      claims: JSON.parse(token.token.claims) as unknown as TokenAndClaims["claims"],
    };
    return Promise.resolve(undefined);
  }
  stop(): void {
    console.log("VibeTokenStrategie stop called");
  }
}

export async function registerDependencies(vibeApp: VibeApp, deps: Record<string, string>): Promise<void> {
  const useFireproofDep = deps["use-fireproof"];
  if (useFireproofDep && window.parent !== window) {
    const fp = (await import(useFireproofDep)) as typeof import("use-fireproof");
    const vibeApi = new VibeSandboxApi({
      addEventListener: window.addEventListener.bind(window),
      postMessage: window.parent.postMessage.bind(window.parent),
    });
    fp.getLedgerSvc().onCreate((ledger) => {
      vibeApi
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
            ledger.attach(
              toCloud({
                name: `vibe-${res.dbName}-${res.userSlug}-${res.appSlug}`,
                strategy: new VibeTokenStrategie(vibeApi),
                ledger: res.ledger,
                tenant: res.tenant,
              })
            );
          }
        });
    });
  }
  return;
}
