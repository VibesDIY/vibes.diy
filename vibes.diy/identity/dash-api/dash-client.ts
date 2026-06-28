// Lifted verbatim from @fireproof/core-protocols-dashboard@0.24.19
// `dashboard-api.js` (upstream tag fireproof-storage/fireproof@v0.24.19). The
// browser-side dashboard HTTP client: `DashboardApiImpl` (a thin typed wrapper
// over a single PUT-per-request JSON endpoint) and `clerkDashApi` (wires a Clerk
// session's token into the client). This is the last `@fireproof/*` VALUE import
// on the browser `.` surface (Task 6.2).
//
// It is a pure HTTP client — it never decodes a JWT or parses claims through a
// strict schema, so it carries none of the Task-5 strict-decode bug class. Only
// imports were adjusted: the request/response wire-types stay type-only from
// `@fireproof/core-types-protocols-dashboard` (Bucket B, kept), and `clerkDashApi`
// takes the real `LoadedClerk` from `@clerk/shared/types` (the exact type
// `@clerk/react`'s `useClerk()` returns), so the sole consumer
// (`use-vibes/.../VibeContext.tsx`) passes `clerk` directly with no cast.
import { Result, KeyedResolvOnce, WaitingForValue, Option, exception2Result } from "@adviser/cement";
import type {
  ReqEnsureUser,
  ResEnsureUser,
  ReqFindUser,
  ResFindUser,
  ReqCreateTenant,
  ResCreateTenant,
  ReqUpdateTenant,
  ResUpdateTenant,
  ReqDeleteTenant,
  ResDeleteTenant,
  ReqRedeemInvite,
  ResRedeemInvite,
  ReqListTenantsByUser,
  ResListTenantsByUser,
  ReqInviteUser,
  ResInviteUser,
  ReqListInvites,
  ResListInvites,
  ReqDeleteInvite,
  ResDeleteInvite,
  ReqUpdateUserTenant,
  ResUpdateUserTenant,
  ReqCreateLedger,
  ResCreateLedger,
  ReqUpdateLedger,
  ResUpdateLedger,
  ReqDeleteLedger,
  ResDeleteLedger,
  ReqListLedgersByUser,
  ResListLedgersByUser,
  ReqCloudSessionToken,
  ResCloudSessionToken,
  ReqCertFromCsr,
  ResCertFromCsr,
  ReqExtendToken,
  ReqTokenByResultId,
  ResExtendToken,
  ResTokenByResultId,
  ReqEnsureCloudToken,
  ResEnsureCloudToken,
  ClerkDashboardApiConfig,
  DashboardApiConfigIntern,
  FPApiInterface,
  DashboardApiConfig,
  WithoutTypeAndAuth,
} from "@fireproof/core-types-protocols-dashboard";
import type { LoadedClerk, GetTokenOptions } from "@clerk/shared/types";

export class DashboardApiImpl<T> implements FPApiInterface {
  readonly cfg: DashboardApiConfigIntern<T>;
  constructor(cfg: DashboardApiConfig<T>) {
    this.cfg = {
      gracePeriodMs: 5000,
      ...cfg,
    } as DashboardApiConfigIntern<T>;
  }
  private async request<R>(req: { type: string; auth?: unknown } & Record<string, unknown>): Promise<Result<R>> {
    let auth = req.auth;
    if (!req.auth) {
      const rAuth = await this.cfg.getToken(this.cfg.getTokenCtx);
      if (rAuth.isErr()) {
        return Result.Err(rAuth);
      }
      auth = rAuth.Ok();
    }
    const reqBody = JSON.stringify({
      ...req,
      auth,
    });
    const res = await this.cfg.fetch(this.cfg.apiUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: reqBody,
    });
    if (res.ok) {
      const jso = await res.json();
      return Result.Ok(jso);
    }
    const body = await res.text();
    return Result.Err(`HTTP: ${res.status} ${res.statusText}: ${body}`);
  }
  ensureUser(req: WithoutTypeAndAuth<ReqEnsureUser>): Promise<Result<ResEnsureUser>> {
    return this.request({ ...req, type: "reqEnsureUser" });
  }
  findUser(req: WithoutTypeAndAuth<ReqFindUser>): Promise<Result<ResFindUser>> {
    return this.request({ ...req, type: "reqFindUser" });
  }
  createTenant(req: WithoutTypeAndAuth<ReqCreateTenant>): Promise<Result<ResCreateTenant>> {
    return this.request({ ...req, type: "reqCreateTenant" });
  }
  updateTenant(req: WithoutTypeAndAuth<ReqUpdateTenant>): Promise<Result<ResUpdateTenant>> {
    return this.request({ ...req, type: "reqUpdateTenant" });
  }
  deleteTenant(req: WithoutTypeAndAuth<ReqDeleteTenant>): Promise<Result<ResDeleteTenant>> {
    return this.request({ ...req, type: "reqDeleteTenant" });
  }
  connectUserToTenant(req: WithoutTypeAndAuth<ReqRedeemInvite>): Promise<Result<ResRedeemInvite>> {
    return this.request({ ...req, type: "reqRedeemInvite" });
  }
  listTenantsByUser(req: WithoutTypeAndAuth<ReqListTenantsByUser>): Promise<Result<ResListTenantsByUser>> {
    return this.request({ ...req, type: "reqListTenantsByUser" });
  }
  inviteUser(req: WithoutTypeAndAuth<ReqInviteUser>): Promise<Result<ResInviteUser>> {
    return this.request({ ...req, type: "reqInviteUser" });
  }
  listInvites(req: WithoutTypeAndAuth<ReqListInvites>): Promise<Result<ResListInvites>> {
    return this.request({ ...req, type: "reqListInvites" });
  }
  deleteInvite(req: WithoutTypeAndAuth<ReqDeleteInvite>): Promise<Result<ResDeleteInvite>> {
    return this.request({ ...req, type: "reqDeleteInvite" });
  }
  updateUserTenant(req: WithoutTypeAndAuth<ReqUpdateUserTenant>): Promise<Result<ResUpdateUserTenant>> {
    return this.request({ ...req, type: "reqUpdateUserTenant" });
  }
  createLedger(req: WithoutTypeAndAuth<ReqCreateLedger>): Promise<Result<ResCreateLedger>> {
    return this.request({ ...req, type: "reqCreateLedger" });
  }
  updateLedger(req: WithoutTypeAndAuth<ReqUpdateLedger>): Promise<Result<ResUpdateLedger>> {
    return this.request({ ...req, type: "reqUpdateLedger" });
  }
  deleteLedger(req: WithoutTypeAndAuth<ReqDeleteLedger>): Promise<Result<ResDeleteLedger>> {
    return this.request({ ...req, type: "reqDeleteLedger" });
  }
  listLedgersByUser(req: WithoutTypeAndAuth<ReqListLedgersByUser>): Promise<Result<ResListLedgersByUser>> {
    return this.request({ ...req, type: "reqListLedgersByUser" });
  }
  getCloudSessionToken(req: WithoutTypeAndAuth<ReqCloudSessionToken>): Promise<Result<ResCloudSessionToken>> {
    return this.request({ ...req, type: "reqCloudSessionToken" });
  }
  getCertFromCsr(req: WithoutTypeAndAuth<ReqCertFromCsr>): Promise<Result<ResCertFromCsr>> {
    return this.request({ ...req, type: "reqCertFromCsr" });
  }
  redeemInvite(req: ReqRedeemInvite): Promise<Result<ResRedeemInvite>> {
    return this.request({ ...req, type: "reqRedeemInvite" });
  }
  getTokenByResultId(req: ReqTokenByResultId): Promise<Result<ResTokenByResultId>> {
    return this.request({ ...req, type: "reqTokenByResultId" });
  }
  extendToken(req: ReqExtendToken): Promise<Result<ResExtendToken>> {
    return this.request({ ...req, type: "reqExtendToken" });
  }
  #ensureCloudToken = new KeyedResolvOnce<Result<ResEnsureCloudToken>>();
  ensureCloudToken(req: WithoutTypeAndAuth<ReqEnsureCloudToken>): Promise<Result<ResEnsureCloudToken>> {
    return this.#ensureCloudToken
      .get(
        JSON.stringify({
          appId: req.appId,
          env: req.env ?? "prod",
          tenant: req.tenant ?? undefined,
          ledger: req.ledger ?? undefined,
        })
      )
      .once(async (my) => {
        const rRes = await this.request<ResEnsureCloudToken>({ ...req, type: "reqEnsureCloudToken" });
        if (rRes.isErr()) {
          return Result.Err(rRes);
        }
        const res = rRes.Ok();
        const resetAfter = res.expiresInSec * 1000 - this.cfg.gracePeriodMs;
        my.self.setResetAfter(resetAfter < 0 ? 60000 : resetAfter);
        return rRes;
      });
  }
}
const keyedDashApis = new KeyedResolvOnce<DashboardApiImpl<unknown>>();
// `T` is the Clerk token-fetch context, which on this Clerk-specific path is a
// `GetTokenOptions` — constraining it lets `session.getToken(cfg.getTokenCtx)`
// type-check against the real Clerk SDK with no cast (upstream built against an
// older @clerk/shared whose looser `getToken` accepted an unconstrained `T`).
export function clerkDashApi<T extends GetTokenOptions = GetTokenOptions>(
  clerk: LoadedClerk,
  iopts: ClerkDashboardApiConfig<T>
): DashboardApiImpl<T> {
  return keyedDashApis.get(iopts.apiUrl).once(() => {
    const waitForToken = new WaitingForValue<string>();
    const dashApi = new DashboardApiImpl<T>({
      ...iopts,
      getTokenCtx: iopts.getTokenCtx ?? { template: iopts.template ?? "with-email" },
      gracePeriodMs: iopts.gracePeriodMs && iopts.gracePeriodMs > 0 ? iopts.gracePeriodMs : 5000,
      getToken: () =>
        waitForToken
          .waitValue()
          .then((token) => Result.Ok({ type: "clerk", token }))
          .catch((err) => Result.Err(err)),
      fetch: iopts.fetch ?? fetch.bind(globalThis),
    } as DashboardApiConfig<T>);
    clerk.addListener(({ session }) => {
      const preValue = waitForToken.value();
      waitForToken.setValue(Option.None());
      if (!(session && typeof session.getToken == "function")) {
        return;
      }
      exception2Result(() => session.getToken(dashApi.cfg.getTokenCtx)).then((rGetToken) => {
        if (rGetToken.isErr()) {
          waitForToken.setError(rGetToken.Err());
          waitForToken.setValue(preValue);
          return;
        }
        const token = rGetToken.Ok();
        waitForToken.setValue(Option.From(token));
      });
    });
    return dashApi as DashboardApiImpl<unknown>;
  }) as DashboardApiImpl<T>;
}
