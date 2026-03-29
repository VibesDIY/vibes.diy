export function resolveModel(opts: {
  mode: "creation" | "application";
  promptModel?: string;
  appCodegenModel?: string;
  appRuntimeModel?: string;
  userCodegenModel?: string;
  ownerRuntimeModel?: string;
  serverRuntimeModel?: string;
  serverDefaultModel: string;
}): string {
  if (opts.mode === "creation") {
    return opts.promptModel ?? opts.appCodegenModel ?? opts.userCodegenModel ?? opts.serverDefaultModel;
  }
  return opts.promptModel ?? opts.appRuntimeModel ?? opts.ownerRuntimeModel ?? opts.serverRuntimeModel ?? opts.serverDefaultModel;
}
