// #2802 slice 4: VibePage injects SSR HTML + the data-vibe-ssr hydration marker
// into the vibe-app-container when vsctx.ssrHtml is present, and ships an empty
// marker-less container otherwise (today's client-only path). Pure renderToString
// in node env (mirrors how render-vibe.ts calls `VibePage(vsctx)` directly). Lives
// in the app SSR project because that's where react-dom/server resolves.

import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { VibePage } from "../../../api/svc/intern/components/vibe-page.js";
import type { VibesDiyServCtx } from "@vibes.diy/api-types";

function baseCtx(overrides: Partial<VibesDiyServCtx> = {}): VibesDiyServCtx {
  return {
    wrapper: { state: "waiting" },
    usrEnv: {},
    svcEnv: {
      CLERK_PUBLISHABLE_KEY: "pk_test",
      VIBES_DIY_API_URL: "https://api.vibes.diy",
      VIBES_DIY_PUBLIC_BASE_URL: "https://vibes.diy",
    },
    importMap: { imports: {} },
    metaProps: { title: "t", description: "d" },
    mountJS: "/* mount */",
    ...overrides,
  };
}

describe("VibePage SSR injection", () => {
  it("injects ssrHtml and the data-vibe-ssr marker into the container", () => {
    const html = renderToString(VibePage(baseCtx({ ssrHtml: "<main>ssr-body</main>" })));
    expect(html).toContain("data-vibe-ssr");
    expect(html).toContain("ssr-body");
    // The marker and the body live on the container.
    expect(html).toMatch(/class="vibe-app-container"[^>]*data-vibe-ssr[^>]*>.*ssr-body/s);
  });

  it("ships an empty, marker-less container when ssrHtml is absent", () => {
    const html = renderToString(VibePage(baseCtx()));
    expect(html).toContain('class="vibe-app-container"');
    expect(html).not.toContain("data-vibe-ssr");
  });
});
