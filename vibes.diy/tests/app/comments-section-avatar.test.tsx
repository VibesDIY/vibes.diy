import React from "react";
import { render as rtlRender, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { vibesWrapper } from "./vibes-provider-harness.js";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Result } from "@adviser/cement";
import { setTestAuth, setTestUser } from "./clerk-test-mock.js";

const queryDocs = vi.fn();
const putDoc = vi.fn();
const deleteDoc = vi.fn();
const subscribeDocs = vi.fn();
const onDocChanged = vi.fn();
const whoAmI = vi.fn();

// Clerk auth/user come from the shared singleton mock (clerk-test-mock.ts);
// each test sets the state it needs via setTestAuth()/setTestUser().

// Inject the VibesDiy context via the real provider instead of mocking it.
const render = (ui: React.ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, {
    wrapper: vibesWrapper({
      // Comments doc ops now ride the vibe/AppSessions connection; plain whoAmI
      // stays on sharedApi. This harness gives the component both planes.
      vibeApi: { queryDocs, putDoc, deleteDoc, subscribeDocs, onDocChanged },
      sharedApi: { whoAmI },
    }),
    ...options,
  });

import { CommentsSection } from "~/vibes.diy/app/components/ResultPreview/CommentsSection.js";

describe("CommentsSection avatar behavior", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setTestAuth({ isSignedIn: true, userId: "viewer-1" });
    setTestUser({
      username: "commenter-slug",
      fullName: "Commenter",
      imageUrl: "https://img.clerk.com/avatar.png",
    });

    queryDocs.mockResolvedValue(
      Result.Ok({
        docs: [
          {
            _id: "comment-1",
            body: "hello",
            authorUserId: "viewer-2",
            authorHandle: "alice",
            authorDisplay: "Alice",
            authorImageUrl: "https://img.clerk.com/legacy.png",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      })
    );
    putDoc.mockResolvedValue(Result.Ok({}));
    deleteDoc.mockResolvedValue(Result.Ok({}));
    subscribeDocs.mockResolvedValue(Result.Ok({}));
    onDocChanged.mockReturnValue(() => undefined);
    whoAmI.mockResolvedValue(
      Result.Ok({
        viewer: {
          // Canonical field is userHandle (see resolveWhoAmI / ResolvedWhoAmI);
          // the component reads viewer.userHandle (#2425).
          userHandle: "commenter-resolved-slug",
          displayName: "Commenter",
        },
        access: "viewer",
      })
    );
  });

  it("renders comment avatars using /u/{slug}/avatar (not Clerk URLs)", async () => {
    const { container } = render(
      <CommentsSection ownerHandle="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />
    );

    await screen.findByText("hello");

    const avatar = container.querySelector("img");
    expect(avatar?.getAttribute("src")).toBe("/u/alice/avatar");
    expect(avatar?.getAttribute("src")?.includes("clerk")).toBe(false);
  });

  it("posts comments with the server-resolved viewer slug, not Clerk's username", async () => {
    // Clerk username and the Vibes-resolved slug can diverge (sanitization,
    // settings overrides, email-derived defaults). The component must trust
    // whoAmI, not user.username.
    setTestUser({
      username: "clerk-username-that-isnt-the-vibes-slug",
      fullName: "Commenter",
      imageUrl: "https://img.clerk.com/avatar.png",
    });

    render(<CommentsSection ownerHandle="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />);

    await screen.findByText("hello");
    await waitFor(() => expect(whoAmI).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), { target: { value: "new comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(putDoc).toHaveBeenCalledTimes(1));

    const request = putDoc.mock.calls[0][0] as { doc: Record<string, unknown> };
    expect(request.doc.authorHandle).toBe("commenter-resolved-slug");
    expect(request.doc).not.toHaveProperty("authorImageUrl");
  });

  it("still posts a comment when Clerk has no username (whoAmI supplies the slug)", async () => {
    // Codex P2 regression: previously authorHandle was derived from
    // user.username, so signed-in users without a Clerk username got
    // undefined and lost their avatar entirely.
    setTestUser({
      fullName: "No-Username User",
      primaryEmailAddress: { emailAddress: "no-username@example.com" },
    });

    render(<CommentsSection ownerHandle="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />);

    await screen.findByText("hello");
    await waitFor(() => expect(whoAmI).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), { target: { value: "first comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(putDoc).toHaveBeenCalledTimes(1));

    const request = putDoc.mock.calls[0][0] as { doc: Record<string, unknown> };
    expect(request.doc.authorHandle).toBe("commenter-resolved-slug");
  });
});

describe("CommentsSection connection routing (#2265 A1)", () => {
  // Vibe-scoped doc ops must run on AppSessions (vibeApi) when present — that is
  // the connection with local broadcast + local QuickJS access-fn eval. When
  // vibeApi is absent, the component mints the AppSessions connection via
  // appApiFor(`<owner>--<app>`); there is no stale chatApi fallback.
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    setTestAuth({ isSignedIn: true, userId: "viewer-1" });
    setTestUser({ username: "commenter-slug", fullName: "Commenter" });
  });

  function mkApi(tag: string, sink: string[]) {
    return {
      whoAmI: vi.fn(async () => {
        sink.push(`${tag}:whoAmI`);
        return Result.Ok({ viewer: { userHandle: "commenter-resolved-slug" }, access: "viewer" });
      }),
      queryDocs: vi.fn(async () => {
        sink.push(`${tag}:queryDocs`);
        return Result.Ok({ docs: [] });
      }),
      subscribeDocs: vi.fn(async () => {
        sink.push(`${tag}:subscribeDocs`);
        return Result.Ok({});
      }),
      onDocChanged: vi.fn(() => () => undefined),
      putDoc: vi.fn(async () => {
        sink.push(`${tag}:putDoc`);
        return Result.Ok({});
      }),
      deleteDoc: vi.fn(async () => Result.Ok({})),
    };
  }

  it("routes doc ops and whoAmI through the vibe/shared connection, leaving chat untouched", async () => {
    const calls: string[] = [];
    // On a vibe page the provider aliases sharedApi === vibeApi, so both the
    // doc ops and the plain whoAmI ride the AppSessions connection. The plain
    // whoAmI no longer mutates the sticky adminMode flag (who-am-i.ts guard),
    // so it's safe there — and the heavy chat connection is never opened for
    // comments. (#2265 Track B)
    const vibeApi = mkApi("vibe", calls);
    const wrapper = vibesWrapper({ chatApi: mkApi("chat", calls), vibeApi, sharedApi: vibeApi });
    rtlRender(<CommentsSection ownerHandle="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />, {
      wrapper,
    });

    await waitFor(() => expect(calls).toContain("vibe:queryDocs"));

    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(calls).toContain("vibe:putDoc"));

    // Doc-plane ops go to AppSessions...
    expect(calls).toContain("vibe:subscribeDocs");
    // ...and whoAmI now rides sharedApi, which === vibeApi on a vibe page. The
    // plain whoAmI no longer writes the sticky adminMode flag (who-am-i.ts
    // guard), so it's safe on the AppSessions connection. (#2265 Track B)
    expect(calls).toContain("vibe:whoAmI");
    expect(calls).not.toContain("chat:whoAmI");
    // The heavy chat connection is never touched when rendering comments.
    expect(calls).not.toContain("chat:queryDocs");
    expect(calls).not.toContain("chat:putDoc");
  });

  it("mints the vibe doc connection via appApiFor when vibeApi is absent", async () => {
    const calls: string[] = [];
    const chatApi = mkApi("chat", calls);
    const appApi = mkApi("app", calls);
    const appApiFor = vi.fn(() => appApi);
    const wrapper = vibesWrapper({ chatApi, appApiFor });
    rtlRender(<CommentsSection ownerHandle="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />, {
      wrapper,
    });

    await waitFor(() => expect(appApiFor).toHaveBeenCalledWith("owner--my-app"));
    await waitFor(() => expect(calls).toContain("app:queryDocs"));

    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(calls).toContain("app:putDoc"));

    expect(calls).toContain("app:subscribeDocs");
    // Without vibeApi, sharedApi still resolves from the shared/chat plane.
    expect(calls).toContain("chat:whoAmI");
    expect(calls).not.toContain("chat:queryDocs");
    expect(calls).not.toContain("chat:putDoc");
  });
});
