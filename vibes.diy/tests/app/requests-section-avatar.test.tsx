import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderRequestUser } from "~/vibes.diy/app/components/mine/sharing-tab/RequestsSection.js";
import type { RequestGrantItem } from "~/vibes.diy/app/components/mine/sharing-tab/shared.js";

function makeRequestItem(overrides: Partial<RequestGrantItem>): RequestGrantItem {
  return {
    foreignUserId: "user-1",
    state: "pending",
    role: null,
    foreignInfo: {
      claims: {
        userId: "user-1",
        role: "user",
        sub: "sub-user-1",
        params: {
          email: "user@example.com",
          email_verified: true,
          first: "User",
          last: "One",
          name: "User One",
          image_url: "https://img.clerk.com/avatar.png",
          public_meta: {},
          nick: "user-one",
        },
      },
    },
    tick: "0",
    updated: "2026-01-01T00:00:00.000Z",
    created: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("renderRequestUser", () => {
  it("prefers foreignUserSlug for avatar route and ignores Clerk image_url", () => {
    const item = makeRequestItem({
      foreignUserSlug: "alice",
      foreignInfo: {
        claims: {
          userId: "user-1",
          role: "user",
          sub: "sub-user-1",
          params: {
            email: "alice@example.com",
            email_verified: true,
            first: "Alice",
            last: "A",
            name: "Alice A",
            image_url: "https://img.clerk.com/alice.png",
            public_meta: {},
            nick: "alice-nick",
          },
        },
      },
    });

    const { container } = render(<div>{renderRequestUser(item)}</div>);
    const avatar = container.querySelector("img");

    expect(avatar?.getAttribute("src")).toBe("/u/alice/avatar");
    expect(avatar?.getAttribute("src")?.includes("clerk")).toBe(false);
  });

  it("renders no avatar image when foreignUserSlug is missing, even if claims.nick is set", () => {
    // Clerk's `nick` may not match the server-derived Vibes slug, so falling
    // back to it would produce a 404 from /u/{nick}/avatar. Render nothing
    // instead — the row still shows the display text.
    const item = makeRequestItem({
      foreignUserSlug: undefined,
      foreignInfo: {
        claims: {
          userId: "user-1",
          role: "user",
          sub: "sub-user-1",
          params: {
            email: "bob@example.com",
            email_verified: true,
            first: "Bob",
            last: "B",
            name: "Bob B",
            image_url: "https://img.clerk.com/bob.png",
            public_meta: {},
            nick: "bob",
          },
        },
      },
    });

    const { container } = render(<div>{renderRequestUser(item)}</div>);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders no avatar image when neither slug nor nick is available", () => {
    const item = makeRequestItem({
      foreignUserSlug: undefined,
      foreignInfo: {
        claims: {
          userId: "user-1",
          role: "user",
          sub: "sub-user-1",
          params: {
            email: "missing@example.com",
            email_verified: true,
            first: "Missing",
            last: "Slug",
            name: "Missing Slug",
            image_url: "https://img.clerk.com/missing.png",
            public_meta: {},
            nick: undefined,
          },
        },
      },
    });

    const { container } = render(<div>{renderRequestUser(item)}</div>);
    expect(container.querySelector("img")).toBeNull();
  });
});
