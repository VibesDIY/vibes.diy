import { BuildURI, URI, Result } from "@adviser/cement";

// Build the `fetch` override that makeBaseSystemPrompt uses to load asset
// files (system-prompt.md, llms/*.md) from the worker's `/vibe-pkg/`
// endpoint instead of esm.sh. With `pkgBaseUrl` passed into prompts.ts, the
// URL we receive here is already the workspace URL — just delegate to
// fetchAsset, no path math.
export interface PromptAssetFetchDeps {
  readonly fetchAsset: (url: string) => Promise<Result<ReadableStream<Uint8Array>>>;
}

export function createPromptAssetFetch(deps: PromptAssetFetchDeps): typeof fetch {
  return async (url, _init) => {
    const uri = URI.from(url);
    if (uri.protocol === "file:") {
      return fetch(url, _init);
    }
    const rRes = await deps.fetchAsset(uri.toString());
    if (rRes.isErr()) {
      return new Response(JSON.stringify({ error: rRes.Err() }), { status: 500 });
    }
    return new Response(rRes.Ok());
  };
}

export function promptsPkgBaseUrl(workspace: string): string {
  return BuildURI.from(workspace).appendRelative("@vibes.diy/prompts/").toString();
}
