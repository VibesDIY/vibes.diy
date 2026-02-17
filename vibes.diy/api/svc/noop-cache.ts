import { CfCacheIf } from "./types.js";

export class NoopCache implements CfCacheIf {
  async delete(): Promise<boolean> {
    return false;
  }

  async match(): Promise<Response | undefined> {
    return undefined;
  }

  async put(): Promise<void> {
    // noop
  }
}

export const noopCache = new NoopCache();
