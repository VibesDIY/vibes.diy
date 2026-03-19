export * from "./hooks/useMobile.js";
export * from "./components/icons/index.js";
export * from "./components/index.js";

export async function loadThemeCSS() {
  const { loadAsset } = await import("@adviser/cement");
  return loadAsset("./theme.css", {
    fallBackUrl: "https://esm.sh/@vibes.diy/base/theme.css",
    basePath: () => import.meta.url,
  });
}
