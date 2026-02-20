import { isResVibeRegisterFPDb, ReqVibeRegisterFPDb, ResVibeRegisterFPDb } from "@vibes.diy/vibe-types";
import { Future, OnFunc, Result, timeouted } from "@adviser/cement";

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
        .then((res) => {
          if (res.isErr()) {
            console.error("Failed to register FPDb with vibe sandbox", res.Err());
          }
          console.log("Registered FPDb with vibe sandbox", res.Ok());
        });
    });
  }
  return;
}
