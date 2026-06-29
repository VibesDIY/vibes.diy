// #2802 slice 4: attemptVibeSsr — the pure SSR-attempt orchestration with
// structured fallback reasons. Runs in node env (no window); uses the real
// NodeExecutor (mode "node") for the happy/error paths and a fake LOADER binding
// for the loader path. loadSource is injected, so no asset store is needed.

import { describe, it, expect } from "vitest";
import { attemptVibeSsr, selectConventionEntry, type AttemptVibeSsrInput } from "../../../api/svc/intern/vibe-ssr-attempt.js";
import type { WorkerLoaderBinding } from "../../../vibe/runtime/worker-loader-executor.js";
import type { FileSystemItem } from "@vibes.diy/api-types";

function entryItem(fileName: string, assetId: string): FileSystemItem {
  return {
    fileName,
    mimeType: "text/javascript",
    assetId,
    assetURI: `sql://Assets.${assetId}`,
    size: 0,
    transform: { type: "jsx-to-js", transformedAssetId: `${assetId}-t` },
  };
}

// Map assetId → raw source, so loadSource resolves the entry the test set up.
function loaderFrom(sources: Record<string, string>): AttemptVibeSsrInput["loadSource"] {
  return async (item) => {
    const src = sources[item.assetId];
    if (src === undefined) throw new Error(`no source for ${item.assetId}`);
    return src;
  };
}

const APP_OK = `export default function App(){ return <main>attempt-ssr-ok</main>; }`;

describe("selectConventionEntry", () => {
  it("picks the single App.jsx entry", () => {
    const sel = selectConventionEntry([entryItem("/App.jsx", "a"), entryItem("/Badge.jsx", "b")]);
    expect(sel.kind).toBe("one");
  });
  it("reports none when there is no App.{jsx,tsx}", () => {
    expect(selectConventionEntry([entryItem("/Badge.jsx", "b")]).kind).toBe("none");
  });
  it("reports ambiguous when both App.jsx and App.tsx exist", () => {
    expect(selectConventionEntry([entryItem("/App.jsx", "a"), entryItem("/App.tsx", "b")]).kind).toBe("ambiguous");
  });
});

describe("attemptVibeSsr", () => {
  it("mode off ⇒ ssr_disabled, no html", async () => {
    const r = await attemptVibeSsr({
      mode: "off",
      fsItems: [entryItem("/App.jsx", "a")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({ a: APP_OK }),
    });
    expect(r.reason).toBe("ssr_disabled");
    expect(r.ssrHtml).toBeUndefined();
  });

  it("node mode + single entry ⇒ ok with rendered html", async () => {
    const r = await attemptVibeSsr({
      mode: "node",
      fsItems: [entryItem("/App.jsx", "a")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({ a: APP_OK }),
    });
    expect(r.reason).toBe("ok");
    expect(r.ssrHtml).toContain("attempt-ssr-ok");
  });

  it("no convention entry ⇒ source_missing", async () => {
    const r = await attemptVibeSsr({
      mode: "node",
      fsItems: [entryItem("/Badge.jsx", "b")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({ b: APP_OK }),
    });
    expect(r.reason).toBe("source_missing");
  });

  it("both App.jsx and App.tsx ⇒ entry_ambiguous", async () => {
    const r = await attemptVibeSsr({
      mode: "node",
      fsItems: [entryItem("/App.jsx", "a"), entryItem("/App.tsx", "b")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({ a: APP_OK, b: APP_OK }),
    });
    expect(r.reason).toBe("entry_ambiguous");
  });

  it("relative import in the entry ⇒ relative_import_unsupported", async () => {
    const r = await attemptVibeSsr({
      mode: "node",
      fsItems: [entryItem("/App.jsx", "a")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({ a: `import Badge from "./Badge.jsx";\nexport default () => <Badge/>;` }),
    });
    expect(r.reason).toBe("relative_import_unsupported");
  });

  it("loadSource throws ⇒ source_missing", async () => {
    const r = await attemptVibeSsr({
      mode: "node",
      fsItems: [entryItem("/App.jsx", "a")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({}), // 'a' missing ⇒ throws
    });
    expect(r.reason).toBe("source_missing");
  });

  it("executor render throws (no default export) ⇒ executor_error", async () => {
    const r = await attemptVibeSsr({
      mode: "node",
      fsItems: [entryItem("/App.jsx", "a")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({ a: `export const NotDefault = () => null;` }),
    });
    expect(r.reason).toBe("executor_error");
  });

  it("loader mode without a binding ⇒ select_error (no 500)", async () => {
    const r = await attemptVibeSsr({
      mode: "loader",
      fsItems: [entryItem("/App.jsx", "a")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({ a: APP_OK }),
    });
    expect(r.reason).toBe("select_error");
  });

  it("loader mode with a fake binding ⇒ ok with the isolate's html", async () => {
    const fakeLoader: WorkerLoaderBinding = {
      get() {
        return {
          getEntrypoint() {
            return { fetch: async () => new Response("<main>fake-isolate</main>") };
          },
        };
      },
    };
    const r = await attemptVibeSsr({
      mode: "loader",
      loader: fakeLoader,
      fsItems: [entryItem("/App.jsx", "a")],
      mountParams: { usrEnv: {} },
      loadSource: loaderFrom({ a: APP_OK }),
    });
    expect(r.reason).toBe("ok");
    expect(r.ssrHtml).toContain("fake-isolate");
  });
});
