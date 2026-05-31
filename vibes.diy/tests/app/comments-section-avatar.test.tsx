import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Result } from "@adviser/cement";

const queryDocs = vi.fn();
const putDoc = vi.fn();
const deleteDoc = vi.fn();
const subscribeDocs = vi.fn();
const onDocChanged = vi.fn();
const whoAmI = vi.fn();

let mockAuth: { isSignedIn: boolean; userId: string | null } = { isSignedIn: true, userId: "viewer-1" };
let mockUser: {
  username?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  primaryEmailAddress?: { emailAddress?: string };
  imageUrl?: string;
} | null = {
  username: "commenter-slug",
  fullName: "Commenter",
  imageUrl: "https://img.clerk.com/avatar.png",
};

vi.mock("@clerk/react", () => ({
  useAuth: () => mockAuth,
  useUser: () => ({ user: mockUser }),
}));

vi.mock("~/vibes.diy/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({
    vibeDiyApi: {
      queryDocs,
      putDoc,
      deleteDoc,
      subscribeDocs,
      onDocChanged,
      whoAmI,
    },
  }),
}));

import { CommentsSection } from "~/vibes.diy/app/components/ResultPreview/CommentsSection.js";

describe("CommentsSection avatar behavior", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = { isSignedIn: true, userId: "viewer-1" };
    mockUser = {
      username: "commenter-slug",
      fullName: "Commenter",
      imageUrl: "https://img.clerk.com/avatar.png",
    };

    queryDocs.mockResolvedValue(
      Result.Ok({
        docs: [
          {
            _id: "comment-1",
            body: "hello",
            authorUserId: "viewer-2",
            authorUserSlug: "alice",
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
          ownerHandle: "commenter-resolved-slug",
          displayName: "Commenter",
          avatarUrl: "https://api.test/u/commenter-resolved-slug/avatar",
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
    mockUser = {
      username: "clerk-username-that-isnt-the-vibes-slug",
      fullName: "Commenter",
      imageUrl: "https://img.clerk.com/avatar.png",
    };

    render(<CommentsSection ownerHandle="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />);

    await screen.findByText("hello");
    await waitFor(() => expect(whoAmI).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), { target: { value: "new comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(putDoc).toHaveBeenCalledTimes(1));

    const request = putDoc.mock.calls[0][0] as { doc: Record<string, unknown> };
    expect(request.doc.authorUserSlug).toBe("commenter-resolved-slug");
    expect(request.doc).not.toHaveProperty("authorImageUrl");
  });

  it("still posts a comment when Clerk has no username (whoAmI supplies the slug)", async () => {
    // Codex P2 regression: previously authorUserSlug was derived from
    // user.username, so signed-in users without a Clerk username got
    // undefined and lost their avatar entirely.
    mockUser = {
      fullName: "No-Username User",
      primaryEmailAddress: { emailAddress: "no-username@example.com" },
    };

    render(<CommentsSection ownerHandle="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />);

    await screen.findByText("hello");
    await waitFor(() => expect(whoAmI).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), { target: { value: "first comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(putDoc).toHaveBeenCalledTimes(1));

    const request = putDoc.mock.calls[0][0] as { doc: Record<string, unknown> };
    expect(request.doc.authorUserSlug).toBe("commenter-resolved-slug");
  });
});
