import { Result } from "@adviser/cement";

export interface ResolvedTarget {
  readonly handle: string;
  readonly app: string;
  readonly group: string;
  readonly full: string;
}

export interface ResolveTargetContext {
  readonly app: string;
  readonly handle: string;
}

export function resolveTarget(ctx: ResolveTargetContext, input?: string): Result<ResolvedTarget> {
  const { app, handle } = ctx;

  if (input === undefined) {
    return Result.Ok({ handle, app, group: "default", full: `${handle}/${app}/default` });
  }

  if (input === "") {
    return Result.Err("Target must not be empty");
  }

  if (input.startsWith("/") || input.endsWith("/")) {
    return Result.Err(`Invalid target "${input}": must not start or end with /`);
  }

  const slashes = input.split("/").length - 1;

  if (slashes === 0) {
    return Result.Ok({ handle, app, group: input, full: `${handle}/${app}/${input}` });
  }

  if (slashes === 1) {
    const [targetApp, targetGroup] = input.split("/");
    if (targetApp === "" || targetGroup === "") {
      return Result.Err(`Invalid target "${input}": app and group must both be non-empty`);
    }
    return Result.Ok({
      handle,
      app: targetApp,
      group: targetGroup,
      full: `${handle}/${targetApp}/${targetGroup}`,
    });
  }

  if (slashes === 2) {
    const [targetHandle, targetApp, targetGroup] = input.split("/");
    if (targetHandle === "" || targetApp === "" || targetGroup === "") {
      return Result.Err(`Invalid target "${input}": handle, app, and group must all be non-empty`);
    }
    return Result.Ok({
      handle: targetHandle,
      app: targetApp,
      group: targetGroup,
      full: input,
    });
  }

  return Result.Err(`Invalid target "${input}": expected "group", "app/group", or "handle/app/group"`);
}
