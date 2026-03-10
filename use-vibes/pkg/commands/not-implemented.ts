import { Result } from "@adviser/cement";

export interface NotImplementedOptions {
  readonly name: string;
}

export function notImplemented(options: NotImplementedOptions): () => Promise<Result<void>> {
  return function runNotImplemented(): Promise<Result<void>> {
    return Promise.resolve(Result.Err(`use-vibes ${options.name}: not yet implemented`));
  };
}
