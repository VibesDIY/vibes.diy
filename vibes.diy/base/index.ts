export * from "./hooks/useMobile.js";
export * from "./components/icons/index.js";
export * from "./components/index.js";

let _themeCSSPromise: ReturnType<typeof _loadThemeCSS> | undefined;

async function _loadThemeCSS() {
  const { loadAsset } = await import("@adviser/cement");
  return loadAsset("./theme.css", {
    fallBackUrl: "https://esm.sh/@vibes.diy/base/theme.css",
    basePath: () => import.meta.url,
  });
}

export function loadThemeCSS() {
  if (!_themeCSSPromise) {
    _themeCSSPromise = _loadThemeCSS();
  }
  return _themeCSSPromise;
}
