export * from "./hooks/useMobile.js";
export * from "./components/icons/index.js";
export * from "./components/index.js";

import { loadAsset, Result } from "@adviser/cement";

export async function loadThemeCSS(): Promise<Result<string>> {
  return loadAsset("./theme.css", {
    fallBackUrl: "https://esm.sh/@vibes.diy/base/",
    basePath: () => import.meta.url,
  });
}
