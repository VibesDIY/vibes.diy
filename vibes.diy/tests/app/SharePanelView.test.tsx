import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharePanelView } from "@vibes.diy/base";
import type { ShareMember } from "@vibes.diy/base";

const ROSTER: readonly ShareMember[] = [
  { handle: "meghan", role: "owner" },
  { handle: "alex", role: "editor" },
];

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("SharePanelView", () => {
  it("anonymous visitor: only Copy URL — no roster, no access setting", () => {
    const onCopy = vi.fn();
    render(<SharePanelView url="vibes.diy/meghan/bloom" viewer="anonymous" onCopy={onCopy} />);
    expect(screen.getByText("vibes.diy/meghan/bloom")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopy).toHaveBeenCalled();
    expect(screen.queryByText(/in this vibe/i)).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("granted member: shows the roster, but no access setting", () => {
    render(<SharePanelView url="u" viewer="member" members={ROSTER} />);
    expect(screen.getByText("@meghan")).toBeTruthy();
    expect(screen.getByText("@alex")).toBeTruthy();
    expect(screen.getByText(/in this vibe · 2/i)).toBeTruthy();
    // members don't get the access toggle or the manage entry
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();
  });

  it("author: roster + manage + the access setting, which fires on change", () => {
    const onChangeAccess = vi.fn();
    const onManageMembers = vi.fn();
    render(
      <SharePanelView
        url="u"
        viewer="author"
        members={ROSTER}
        access="public"
        onChangeAccess={onChangeAccess}
        onManageMembers={onManageMembers}
      />
    );
    expect(screen.getByText("@meghan")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /anyone with the link/i }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /people you approve/i }));
    expect(onChangeAccess).toHaveBeenCalledWith("request");
    fireEvent.click(screen.getByRole("button", { name: /manage/i }));
    expect(onManageMembers).toHaveBeenCalled();
  });

  it("reflects the access state in the explainer copy", () => {
    const { rerender } = render(<SharePanelView url="u" viewer="author" access="public" />);
    expect(screen.getByText(/anyone with the link can open/i)).toBeTruthy();
    rerender(<SharePanelView url="u" viewer="author" access="request" />);
    expect(screen.getByText(/people you approve can open/i)).toBeTruthy();
  });
});
