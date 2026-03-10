import { Result } from "@adviser/cement";
import { createCliVibesApi, getCliDashAuth } from "./vibes-api.js";
import type { CliOutput } from "./cli-output.js";
import type { ReqRegisterHandle, ResRegisterHandle } from "@vibes.diy/api-types";

export interface RunRegisterHandleOptions {
  readonly slug?: string;
}

export interface RegisterHandleDeps {
  readonly api?: RegisterHandleApi;
}

export interface RegisterHandleResultLike {
  isErr(): boolean;
  Err(): unknown;
  Ok(): ResRegisterHandle;
}

export interface RegisterHandleApi {
  registerHandle(req: Omit<ReqRegisterHandle, "type" | "auth">): Promise<RegisterHandleResultLike>;
}

function hasMessage(value: unknown): value is { readonly message: string } {
  switch (true) {
    case typeof value !== "object":
      return false;
    case value === null:
      return false;
    case !("message" in value):
      return false;
    default:
      return typeof Reflect.get(value, "message") === "string";
  }
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (hasMessage(error)) {
    return error.message;
  }
  return String(error);
}

function toRegisterReq(slug: string | undefined): Result<Omit<ReqRegisterHandle, "type" | "auth">> {
  if (typeof slug === "undefined") {
    return Result.Ok({});
  }
  const trimmed = slug.trim();
  if (trimmed.length === 0) {
    return Result.Err("Handle slug must not be empty");
  }
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (withoutAt.length === 0) {
    return Result.Err("Handle slug must not be empty");
  }
  return Result.Ok({ userSlug: withoutAt });
}

function emitRegistered(output: CliOutput, registered: ResRegisterHandle): void {
  output.stdout(`handle:     @${registered.userSlug}\n`);
  output.stdout(`created:    ${registered.created}\n`);
}

export async function runRegisterHandle(
  options: RunRegisterHandleOptions,
  output: CliOutput,
  deps: RegisterHandleDeps = {}
): Promise<Result<void>> {
  const rReq = toRegisterReq(options.slug);
  if (rReq.isErr()) {
    return Result.Err(rReq.Err());
  }

  const api = await (async function resolveApi(): Promise<Result<RegisterHandleApi>> {
    if (deps.api) {
      return Result.Ok(deps.api);
    }

    const rAuth = await getCliDashAuth();
    if (rAuth.isErr()) {
      return Result.Err(toErrorMessage(rAuth.Err()));
    }
    return Result.Ok(
      createCliVibesApi({
        getToken: () => Promise.resolve(rAuth),
      })
    );
  })();
  if (api.isErr()) {
    return Result.Err(api.Err());
  }

  const rRegistered = await api.Ok().registerHandle(rReq.Ok());
  if (rRegistered.isErr()) {
    return Result.Err(toErrorMessage(rRegistered.Err()));
  }

  emitRegistered(output, rRegistered.Ok());
  return Result.Ok(undefined);
}
