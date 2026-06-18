import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { NavigateFunction } from "react-router";
import { useChatNavigation } from "~/vibes.diy/app/hooks/useChatNavigation.js";
import type { PromptState, PromptBlock } from "~/vibes.diy/app/routes/chat/prompt-state.js";

// A fully-valid block.end so the route's real arktype `isBlockEnd` accepts it
// (it demands the full BlockBase + stats + usage payload, plus a normalizable
// fsRef). The navigation hook reads `streamId` and `fsRef.fsId` off it.
function blockEnd(streamId: string, fsId: string) {
  return {
    type: "block.end",
    blockId: `b-${streamId}`,
    streamId,
    seq: 1,
    blockNr: 1,
    timestamp: new Date(),
    stats: {
      toplevel: { lines: 0, bytes: 0 },
      code: { lines: 0, bytes: 0 },
      image: { lines: 0, bytes: 0 },
      total: { lines: 0, bytes: 0 },
    },
    usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
    fsRef: { appSlug: "app", ownerHandle: "owner", mode: "dev", fsId },
  };
}

function makeBlock(msgs: unknown[]): PromptBlock {
  return { msgs } as unknown as PromptBlock;
}

function makeState(opts: { blocks?: PromptBlock[]; running?: boolean }): PromptState {
  return { blocks: opts.blocks ?? [], running: opts.running ?? false } as unknown as PromptState;
}

interface HookProps {
  fsId?: string;
  promptState: PromptState;
  searchParams: URLSearchParams;
}

function renderNav(navigate: NavigateFunction, initial: HookProps) {
  return renderHook(
    (props: HookProps) =>
      useChatNavigation({
        ownerHandle: "owner",
        appSlug: "app",
        fsId: props.fsId,
        promptState: props.promptState,
        searchParams: props.searchParams,
        navigate,
      }),
    { initialProps: initial }
  );
}

describe("useChatNavigation", () => {
  let navigate: NavigateFunction;

  beforeEach(() => {
    navigate = vi.fn() as unknown as NavigateFunction;
  });

  describe("navigateToFsId", () => {
    it("defaults the view to preview and replace-navigates to the fsId path", () => {
      const { result } = renderNav(navigate, { promptState: makeState({}), searchParams: new URLSearchParams() });
      act(() => result.current.navigateToFsId("FS1"));
      expect(navigate).toHaveBeenCalledWith({ pathname: "/chat/owner/app/FS1", search: "view=preview" }, { replace: true });
    });

    it("preserves an existing view param instead of overriding it", () => {
      const { result } = renderNav(navigate, {
        promptState: makeState({}),
        searchParams: new URLSearchParams("view=code"),
      });
      act(() => result.current.navigateToFsId("FS1"));
      expect(navigate).toHaveBeenCalledWith({ pathname: "/chat/owner/app/FS1", search: "view=code" }, { replace: true });
    });

    it("targets the slug root when fsId is undefined", () => {
      const { result } = renderNav(navigate, { promptState: makeState({}), searchParams: new URLSearchParams() });
      act(() => result.current.navigateToFsId(undefined));
      expect(navigate).toHaveBeenCalledWith({ pathname: "/chat/owner/app", search: "view=preview" }, { replace: true });
    });

    it("leaves the view param untouched when ensureView is false", () => {
      const { result } = renderNav(navigate, { promptState: makeState({}), searchParams: new URLSearchParams() });
      act(() => result.current.navigateToFsId("FS1", { ensureView: false }));
      expect(navigate).toHaveBeenCalledWith({ pathname: "/chat/owner/app/FS1", search: "" }, { replace: true });
    });
  });

  describe("post-save navigation", () => {
    it("navigates to the new fsId when the matching block.end arrives", () => {
      const sp = new URLSearchParams();
      const { result, rerender } = renderNav(navigate, { promptState: makeState({}), searchParams: sp });
      act(() => result.current.onSaveQueued("P1"));
      rerender({ promptState: makeState({ blocks: [makeBlock([blockEnd("P1", "FS2")])] }), searchParams: sp });
      expect(navigate).toHaveBeenCalledWith({ pathname: "/chat/owner/app/FS2", search: "view=preview" }, { replace: true });
    });

    it("does not navigate for a block.end whose streamId does not match the queued save", () => {
      const sp = new URLSearchParams();
      const { result, rerender } = renderNav(navigate, { promptState: makeState({}), searchParams: sp });
      act(() => result.current.onSaveQueued("P1"));
      rerender({ promptState: makeState({ blocks: [makeBlock([blockEnd("OTHER", "FS2")])] }), searchParams: sp });
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe("first-paint navigation", () => {
    it("navigates to the latest fsRef.fsId on a running:true→false transition", () => {
      const sp = new URLSearchParams();
      const { rerender } = renderNav(navigate, { promptState: makeState({ running: false }), searchParams: sp });
      // running goes true (arm the edge), then false with a block.end carrying fsRef.
      rerender({ promptState: makeState({ running: true }), searchParams: sp });
      rerender({ promptState: makeState({ running: false, blocks: [makeBlock([blockEnd("PX", "FS9")])] }), searchParams: sp });
      expect(navigate).toHaveBeenCalledWith({ pathname: "/chat/owner/app/FS9", search: "view=preview" }, { replace: true });
    });

    it("does not navigate when the fsRef equals the fsId already in the URL", () => {
      const sp = new URLSearchParams();
      const { rerender } = renderNav(navigate, { fsId: "FS9", promptState: makeState({ running: false }), searchParams: sp });
      rerender({ fsId: "FS9", promptState: makeState({ running: true }), searchParams: sp });
      rerender({ fsId: "FS9", promptState: makeState({ running: false, blocks: [makeBlock([blockEnd("PX", "FS9")])] }), searchParams: sp });
      expect(navigate).not.toHaveBeenCalled();
    });

    it("does not navigate on a blocks update without a running:true→false edge (e.g. replay)", () => {
      const sp = new URLSearchParams();
      const { rerender } = renderNav(navigate, { promptState: makeState({ running: false }), searchParams: sp });
      // Blocks arrive (replay of an old chat) but running never went true→false.
      rerender({ promptState: makeState({ running: false, blocks: [makeBlock([blockEnd("PX", "FS9")])] }), searchParams: sp });
      expect(navigate).not.toHaveBeenCalled();
    });
  });
});
