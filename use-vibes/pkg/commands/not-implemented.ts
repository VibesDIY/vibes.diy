import { Result } from "@adviser/cement";

export interface NotImplementedOptions {
  readonly name: string;
}

export function notImplemented(options: NotImplementedOptions): () => Promise<Result<void>> {
  return async function runNotImplemented(): Promise<Result<void>> {
    return Result.Err(`use-vibes ${options.name}: not yet implemented`);
  };
}
