// SSR + loader coverage for the /embed/ route (#1568). The embed route is a
// chrome-free, authless sibling of the /vibe/ viewer; it must render safely on
// the worker (no synchronous `window`) and fall back to the instruction card
// when the vibe isn't publicly embeddable.

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router";

vi.mock("../../../pkg/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({
    chatApi: {
      getAppByFsId: () => Promise.resolve({ isErr: () => true, Err: () => new Error("ssr") }),
    },
    webVars: {
      env: { VIBES_SVC_HOSTNAME_BASE: "test.vibesdiy.net" },
      pkgRepos: { workspace: "https://test.vibesdiy.net/vibe-pkg/", public: "https://esm.sh" },
    },
  }),
}));

vi.mock("../../../pkg/app/hooks/useDocumentTitle.js", () => ({
  useDocumentTitle: () => undefined,
}));

import EmbedRoute, {
  InstructionCard,
  loader as embedLoader,
  meta as embedMeta,
} from "../../../pkg/app/routes/embed.$ownerHandle.$appSlug.js";
import { URI } from "@adviser/cement";

const PREVIEW_BASE = "pr-7.vibespreview.dev";

function makeContext(overrides?: { isPubliclyEmbeddable?: boolean }) {
  return {
    vibeDiyAppParams: {
      vibes: { svc: { hostnameBase: PREVIEW_BASE } },
      pkgRepos: { workspace: "https://pr-7.vibespreview.dev/vibe-pkg/?v=deadbeef" },
    },
    ...(overrides ?? {}),
  } as unknown as Parameters<typeof embedLoader>[0]["context"];
}

describe("embed route loader", () => {
  it("builds the runtime iframe URL on the configured base with npmUrl, no fsId segment", async () => {
    const { iframeUrl, isPubliclyEmbeddable } = await embedLoader({
      params: { ownerHandle: "alice", appSlug: "myapp" },
      request: new Request("https://pr-7-vibes-diy-v2.jchris.workers.dev/embed/alice/myapp"),
      context: makeContext({ isPubliclyEmbeddable: true }),
    });
    expect(iframeUrl).toBeDefined();
    const u = URI.from(iframeUrl as string);
    expect(u.hostname).toBe("myapp--alice.pr-7.vibespreview.dev");
    expect(u.pathname).toBe("/");
    expect(u.getParam("npmUrl")).toBe("https://pr-7.vibespreview.dev/vibe-pkg/?v=deadbeef");
    expect(isPubliclyEmbeddable).toBe(true);
  });

  it("defaults isPubliclyEmbeddable to false when the context omits it", async () => {
    const { isPubliclyEmbeddable } = await embedLoader({
      params: { ownerHandle: "alice", appSlug: "myapp" },
      request: new Request("https://x/embed/alice/myapp"),
      context: makeContext(),
    });
    expect(isPubliclyEmbeddable).toBe(false);
  });
});

describe("embed route meta", () => {
  it("marks the embed surface noindex", () => {
    const tags = embedMeta({ params: { ownerHandle: "alice", appSlug: "myapp" } }) as {
      name?: string;
      content?: string;
      title?: string;
    }[];
    expect(tags.find((t) => t.name === "robots")?.content).toBe("noindex");
  });
});

describe("embed instruction card", () => {
  // The not-published fallback: explains the situation and links OUT to the
  // canonical viewer (relative href resolves to the vibes.diy origin), never an
  // in-frame sign-in.
  it("renders the not-published message and an out-of-frame link to the viewer", () => {
    const html = renderToString(<InstructionCard ownerHandle="alice" appSlug="myapp" />);
    expect(html).toMatch(/isn.t published/i);
    expect(html).toContain('href="/vibe/alice/myapp"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("<iframe");
  });
});

describe("embed route SSR", () => {
  it("globalThis.window is undefined in this test (node env)", () => {
    expect(typeof globalThis.window).toBe("undefined");
  });

  // Guard the SSR-specific bug class: a synchronous `window.foo` access in the
  // route render phase that crashes the worker. A non-data router makes
  // useMatches throw (tolerated here); a `window` reference must not appear.
  it("synchronous render does not reference `window`", () => {
    let caught: unknown;
    try {
      renderToString(
        <MemoryRouter initialEntries={["/embed/alice/myapp"]}>
          <Routes>
            <Route path="/embed/:ownerHandle/:appSlug" element={<EmbedRoute />} />
          </Routes>
        </MemoryRouter>
      );
    } catch (e) {
      caught = e;
    }
    if (caught) {
      const msg = String((caught as Error)?.message ?? caught);
      expect(msg).not.toMatch(/window/i);
    }
  });
});
