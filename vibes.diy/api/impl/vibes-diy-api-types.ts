import { MsgBaseCfg, OptionalAuth } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";
import { SuperThis } from "@fireproof/core-types-base";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";

export interface VibesDiyApiParam {
  readonly apiUrl: string;
  // readonly pkgRepos?: Partial<PkgRepos>;
  readonly ca?: string[];
  readonly me?: string;
  fetch?(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  readonly ws?: WebSocket;
  getToken(): Promise<Result<DashAuthType>>;
  readonly msg?: MsgBaseCfg;
  readonly sthis?: SuperThis;
  readonly timeoutMs?: number;
  // Optional perf hint: pin this connection's DO shard to a stable value (e.g.
  // "${ownerHandle}--${appSlug}" for a viewer route) so multiple visitors to the
  // same vibe land on the same warm DO instead of each paying ~1s cold-start.
  // Omit for codegen / load-balanced traffic — random UUID is used.
  readonly shardKey?: string;
}

export interface VibesDiyApiConfig {
  readonly apiUrl: string;
  readonly ca?: string[];
  // readonly pkgRepos: PkgRepos;
  readonly me: string;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  readonly ws?: WebSocket;
  getToken(): Promise<Result<DashAuthType>>;
  readonly msg: MsgBaseCfg;
  readonly sthis: SuperThis;
  readonly timeoutMs: number;
}

export type ReqType<T> = Omit<T, "auth"> & OptionalAuth;
export type WithAuth<T> = Omit<T, "auth"> & { readonly auth: DashAuthType };
