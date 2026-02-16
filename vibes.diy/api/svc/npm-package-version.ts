import { Result } from "@adviser/cement";
import { CfCacheIf } from "./types.js";
import { noopCache } from "./noop-cache.js";

export type ResolveFunction = (pkg: string, semVersion?: string) => Promise<Result<{ src: string; version: string }>>;

interface DefaultsFetchOpts {
  url: string;
  fetch: (url: string) => Promise<Response>;
  cache: CfCacheIf;
}

export interface DefaultFetchPkgVersionOptions {
  presetFn?: ResolveFunction;
  defaults?: Partial<DefaultsFetchOpts>;
}

export function defaultFetchPkgVersion(
  iopts: DefaultFetchPkgVersionOptions = {}
): (pkg: string, semVersion?: string) => Promise<Result<{ src: string; version: string }>> {
  if (iopts.presetFn) {
    return iopts.presetFn;
  }
  const opts: DefaultsFetchOpts = {
    url: iopts.defaults?.url || "https://registry.npmjs.org",
    cache: iopts.defaults?.cache || noopCache,
    fetch: iopts.defaults?.fetch || ((url: string) => fetch(url)),
  };

  return async (pkg: string, semVersion?: string) => {
    const furl = `${opts.url}/${pkg}/${semVersion || "latest"}`;
    // console.log(`[defaultFetchPkgVersion] using default with url: ${furl}`);
    return opts.cache
      .match(furl)
      .then((cachedRes) => {
        if (cachedRes) {
          console.log(`[defaultFetchPkgVersion] cache hit for ${furl}`);
          return Promise.resolve(cachedRes);
        }
        console.log(`[defaultFetchPkgVersion] cache miss for ${furl}, fetching...`);
        return opts.fetch(furl);
      })
      .then((res) => {
        if (!res || !res.ok) {
          return Result.Err(`Failed to fetch version for ${pkg} with semver ${semVersion}: ${res?.status} ${res?.statusText}`);
        }
        return opts.cache.put(furl, res.clone()).then(() => res.json());
      })
      .then((data) => Result.Ok({ src: furl, version: data.version }))
      .catch((e) => Result.Err(e));
  };
}
