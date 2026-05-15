import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Result } from "@adviser/cement";

const queryDocs = vi.fn();
const putDoc = vi.fn();
const deleteDoc = vi.fn();
const subscribeDocs = vi.fn();
const onDocChanged = vi.fn();

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
  });

  it("renders comment avatars using /u/{slug}/avatar (not Clerk URLs)", async () => {
    const { container } = render(
      <CommentsSection userSlug="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />
    );

    await screen.findByText("hello");

    const avatar = container.querySelector("img");
    expect(avatar?.getAttribute("src")).toBe("/u/alice/avatar");
    expect(avatar?.getAttribute("src")?.includes("clerk")).toBe(false);
  });

  it("posts comments without persisting authorImageUrl", async () => {
    render(<CommentsSection userSlug="owner" appSlug="my-app" canModerate={false} composerDisabled={false} />);

    await screen.findByText("hello");

    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), { target: { value: "new comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(putDoc).toHaveBeenCalledTimes(1));

    const request = putDoc.mock.calls[0][0] as { doc: Record<string, unknown> };
    expect(request.doc.authorUserSlug).toBe("commenter-slug");
    expect(request.doc).not.toHaveProperty("authorImageUrl");
  });
});
