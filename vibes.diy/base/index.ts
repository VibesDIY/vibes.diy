export * from "./hooks/useMobile.js";
export * from "./components/icons/index.js";
export * from "./components/index.js";

let _themeCSSPromise: ReturnType<typeof _loadThemeCSS> | undefined;
let _cachedFallBackUrl: string | undefined;

async function _loadThemeCSS(fallBackUrl?: string) {
  const { loadAsset } = await import("@adviser/cement");
  const result = await loadAsset("./theme.css", {
    fallBackUrl: fallBackUrl ?? "https://esm.sh/@vibes.diy/base/theme.css",
    basePath: () => import.meta.url,
  });
  if (result.isErr()) {
    console.error("loadThemeCSS failed:", result.Err(), "fallBackUrl:", fallBackUrl, "import.meta.url:", import.meta.url);
    _themeCSSPromise = undefined; // don't cache failures
  }
  return result;
}

export function loadThemeCSS(fallBackUrl?: string) {
  if (!_themeCSSPromise || _cachedFallBackUrl !== fallBackUrl) {
    _cachedFallBackUrl = fallBackUrl;
    _themeCSSPromise = _loadThemeCSS(fallBackUrl);
  }
  return _themeCSSPromise;
}
