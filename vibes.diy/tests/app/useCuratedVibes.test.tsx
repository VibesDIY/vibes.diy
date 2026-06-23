import { renderHook as rtlRenderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCuratedVibes } from "~/vibes.diy/app/hooks/useCuratedVibes.js";
import { vibesWrapper } from "./vibes-provider-harness.js";

const mockGetAppByFsId = vi.fn();
const mockVibeDiyApi = { getAppByFsId: mockGetAppByFsId };

const renderHook: typeof rtlRenderHook = (cb, options) =>
  rtlRenderHook(cb, { wrapper: vibesWrapper({ chatApi: mockVibeDiyApi }), ...(options as object) });

interface OkAppArgs {
  ownerHandle: string;
  appSlug: string;
  grant: string;
  title?: string;
  icon?: { cid: string; mime: string };
  screenshot?: { assetUrl: string; mime: string };
  enrichedPrompt?: string;
}

function okApp({ ownerHandle, appSlug, grant, title, icon, screenshot, enrichedPrompt }: OkAppArgs) {
  const meta: unknown[] = [];
  if (title) meta.push({ type: "title", title });
  if (screenshot) meta.push({ type: "screen-shot-ref", assetUrl: screenshot.assetUrl, mime: screenshot.mime });
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({
      type: "vibes.diy.res-get-app-by-fsid",
      ownerHandle,
      appSlug,
      grant,
      error: undefined,
      meta,
      ...(icon ? { icon } : {}),
      ...(enrichedPrompt ? { enrichedPrompt } : {}),
    }),
    Err: () => ({ message: "unexpected error" }),
  };
}

function errApp() {
  return {
    isOk: () => false,
    isErr: () => true,
    Ok: () => ({}),
    Err: () => ({ message: "boom" }),
  };
}

describe("useCuratedVibes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only publicly-viewable apps in one flat list and builds title/icon/screenshot/description", async () => {
    // "melodle" is public with full metadata; everything else is gated or
    // errors, so the flat list contains only melodle.
    mockGetAppByFsId.mockImplementation(async ({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) => {
      if (appSlug === "melodle") {
        return okApp({
          ownerHandle,
          appSlug,
          grant: "public-access",
          title: "Melodle",
          icon: { cid: "sql://icon", mime: "image/png" },
          screenshot: { assetUrl: "sql://shot", mime: "image/png" },
          enrichedPrompt: "A daily melody guessing game.",
        });
      }
      if (appSlug === "emoji-connections") {
        return okApp({ ownerHandle, appSlug, grant: "not-grant" });
      }
      if (appSlug === "color-sudoku") {
        return errApp();
      }
      return okApp({ ownerHandle, appSlug, grant: "req-login.request" });
    });

    const { result } = renderHook(() => useCuratedVibes());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Only the one viewable app survives, as a flat list.
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      ownerHandle: "jchris",
      appSlug: "melodle",
      title: "Melodle",
      icon: { cid: "sql://icon", mime: "image/png" },
      screenshot: { type: "screen-shot-ref", assetUrl: "sql://shot", mime: "image/png" },
      description: "A daily melody guessing game.",
    });
  });

  it("falls back to the slug when an app has no title and omits a missing icon", async () => {
    mockGetAppByFsId.mockImplementation(async ({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) => {
      if (appSlug === "melodle") {
        return okApp({ ownerHandle, appSlug, grant: "public-access" });
      }
      return okApp({ ownerHandle, appSlug, grant: "not-grant" });
    });

    const { result } = renderHook(() => useCuratedVibes());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const item = result.current.items[0];
    expect(item.title).toBe("melodle");
    expect(item.icon).toBeUndefined();
  });

  it("requests the lightweight summary payload", async () => {
    mockGetAppByFsId.mockImplementation(async ({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) =>
      okApp({ ownerHandle, appSlug, grant: "not-grant" })
    );

    const { result } = renderHook(() => useCuratedVibes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAppByFsId).toHaveBeenCalled();
    for (const call of mockGetAppByFsId.mock.calls) {
      expect(call[0]).toMatchObject({ summary: true });
    }
  });
});
