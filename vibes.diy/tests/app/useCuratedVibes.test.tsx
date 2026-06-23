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
}

function okApp({ ownerHandle, appSlug, grant, title, icon }: OkAppArgs) {
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({
      type: "vibes.diy.res-get-app-by-fsid",
      ownerHandle,
      appSlug,
      grant,
      error: undefined,
      meta: title ? [{ type: "title", title }] : [],
      ...(icon ? { icon } : {}),
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

  it("keeps only publicly-viewable apps, builds title/icon, and drops empty groups", async () => {
    // "melodle" (first group, Mind games) is public with a title + icon.
    // Everything else is gated or errors, so its group collapses away.
    mockGetAppByFsId.mockImplementation(async ({ ownerHandle, appSlug }: { ownerHandle: string; appSlug: string }) => {
      if (appSlug === "melodle") {
        return okApp({
          ownerHandle,
          appSlug,
          grant: "public-access",
          title: "Melodle",
          icon: { cid: "sql://icon", mime: "image/png" },
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

    // Only the Mind games group survives, with just the viewable app.
    expect(result.current.groups).toHaveLength(1);
    const group = result.current.groups[0];
    expect(group.category).toBe("Mind games");
    expect(group.items).toHaveLength(1);
    expect(group.items[0]).toMatchObject({
      ownerHandle: "jchris",
      appSlug: "melodle",
      title: "Melodle",
      icon: { cid: "sql://icon", mime: "image/png" },
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

    const item = result.current.groups[0].items[0];
    expect(item.title).toBe("melodle");
    expect(item.icon).toBeUndefined();
  });
});
