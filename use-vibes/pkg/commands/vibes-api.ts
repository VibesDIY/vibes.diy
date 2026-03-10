import { Result } from "@adviser/cement";
import { VibeDiyApi, type VibesDiyApiParam } from "@vibes.diy/api-impl";
import type { DashAuthType, VibesDiyApiIface } from "@vibes.diy/api-types";
import { env as processEnv } from "node:process";

const DEFAULT_CLI_VIBES_API_URL = "wss://api.vibes.diy/v1/ws";
const VIBES_API_URL_ENV = "VIBES_DIY_API_URL";

export interface CliVibesApiOptions {
  readonly apiUrl?: string;
  readonly getToken?: () => Promise<Result<DashAuthType>>;
  readonly timeoutMs?: number;
  readonly fetch?: VibesDiyApiParam["fetch"];
  readonly ws?: WebSocket;
}

export function getCliVibesApiUrl(env: Readonly<Record<string, string | undefined>> = processEnv): string {
  const envUrl = env[VIBES_API_URL_ENV];
  switch (true) {
    case typeof envUrl === "string" && envUrl.length > 0:
      return envUrl;
    default:
      return DEFAULT_CLI_VIBES_API_URL;
  }
}

export function getCliDashAuth(): Promise<Result<DashAuthType>> {
  return Promise.resolve(Result.Err("Not logged in. Run: use-vibes login"));
}

export function toCliVibesApiParam(options: CliVibesApiOptions = {}): VibesDiyApiParam {
  return {
    apiUrl: options.apiUrl ?? getCliVibesApiUrl(),
    getToken: options.getToken ?? getCliDashAuth,
    timeoutMs: options.timeoutMs,
    fetch: options.fetch,
    ws: options.ws,
  };
}

export function createCliVibesApi(options: CliVibesApiOptions = {}): VibesDiyApiIface {
  return new VibeDiyApi(toCliVibesApiParam(options));
}
