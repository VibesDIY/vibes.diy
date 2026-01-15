import {
  DashAuthType,
  MsgBase,
  MsgBaseCfg,
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  ResultVibesDiy,
  VibesDiyApiIface,
  VibesDiyError,
} from "vibes-diy-api-pkg";
import { exception2Result, Result } from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { ensureSuperThis } from "@fireproof/core-runtime";

export interface VibesDiyApiParam {
  readonly apiUrl?: string;
  readonly fetch?: typeof fetch; // defaulted to global fetch
  getToken(): Promise<Result<DashAuthType>>;
  readonly msg?: MsgBaseCfg;
  readonly sthis?: SuperThis;
}

interface VibesDiyApiConfig {
  readonly apiUrl: string;
  readonly fetch: typeof fetch;
  getToken(): Promise<Result<DashAuthType>>;
  readonly msg: MsgBaseCfg;
  readonly sthis: SuperThis;
}

export class VibeDiyApi implements VibesDiyApiIface<{
  auth?: DashAuthType;
  type?: string;
}> {
  readonly cfg: VibesDiyApiConfig;

  constructor(cfg: VibesDiyApiParam) {
    this.cfg = {
      apiUrl: cfg.apiUrl ?? "https://api.vibes.diy/v1",
      fetch: cfg.fetch ?? fetch.bind(globalThis),
      getToken: cfg.getToken,
      msg: {
        src: "vibes.diy.client",
        dst: "vibes.diy.server",
        ttl: 10,
        ...cfg.msg,
      },
      sthis: cfg.sthis ?? ensureSuperThis(),
    };
  }

  async request<Q extends { auth?: DashAuthType }, S>(req: Q): Promise<ResultVibesDiy<S>> {
    const rDashAuth = await (req.auth ? Promise.resolve(Result.Ok(req.auth)) : this.cfg.getToken());
    if (rDashAuth.isErr()) {
      return Result.Err<S, VibesDiyError>({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: rDashAuth.Err().message,
        code: "auth-error",
      });
    }
    const auth = rDashAuth.unwrap();

    const reqBody = JSON.stringify({
      ...this.cfg.msg,
      tid: this.cfg.sthis.nextId().str,
      payload: {
        ...req,
        auth,
      },
    });
    // console.log(API_URL, API_URL, reqBody);
    const rres = await exception2Result(() =>
      this.cfg.fetch(this.cfg.apiUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: reqBody,
      })
    );
    if (rres.isErr()) {
      const err = rres.Err();
      return Result.Err<S, VibesDiyError>({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: `Network error: ${err.message}`,
        code: "network-error",
      });
    }
    const res = rres.unwrap();
    if (res.ok) {
      const jso = (await res.json()) as MsgBase;
      // console.log("jso", jso);
      return Result.Ok(jso.payload as S);
    }
    const body = await res.text();
    return Result.Err<S, VibesDiyError>({
      type: "vibes.diy.error",
      name: "VibesDiyError",
      message: `HTTP: ${res.status} ${res.statusText}: ${body}`,
      code: "http-error",
    });
  }

  async ensureAppSlug(
    req: Omit<ReqEnsureAppSlug, "type" | "auth"> & { auth?: DashAuthType }
  ): Promise<Result<ResEnsureAppSlug, VibesDiyError>> {
    return this.request({ ...req, type: "vibes.diy.req-ensure-app-slug" });
  }
}
