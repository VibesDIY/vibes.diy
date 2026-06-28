import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharePanelView } from "@vibes.diy/base";
import type { ShareMember } from "@vibes.diy/base";

const ROSTER: readonly ShareMember[] = [
  { handle: "alex", role: "editor" },
  { handle: "meghan", role: "owner" },
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

  it("granted member on a public vibe: no roster (open membership)", () => {
    render(<SharePanelView url="u" viewer="member" access="public" members={ROSTER} />);
    expect(screen.queryByText(/in this vibe/i)).toBeNull();
    expect(screen.queryByText("@meghan")).toBeNull();
  });

  it("owner sees the roster even on a public vibe", () => {
    render(<SharePanelView url="u" viewer="author" access="public" members={ROSTER} />);
    expect(screen.getByText("@meghan")).toBeTruthy();
  });

  it("granted member on a gated vibe: shows the roster (owner first), read-only, no access setting", () => {
    render(<SharePanelView url="u" viewer="member" access="request" members={ROSTER} />);
    expect(screen.getByText(/in this vibe/i)).toBeTruthy();
    expect(screen.getByText("@meghan")).toBeTruthy();
    expect(screen.getByText("@alex")).toBeTruthy();
    // owner is sorted first even though it's last in the input
    const names = screen.getAllByText(/^@/).map((n) => n.textContent);
    expect(names[0]).toBe("@meghan");
    // members don't get the access toggle or clickable manage tags
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: /manage @/i })).toBeNull();
  });

  it("author: tapping a member tag opens that member, and the access setting fires", () => {
    const onChangeAccess = vi.fn();
    const onSelectMember = vi.fn();
    render(
      <SharePanelView
        url="u"
        viewer="author"
        members={ROSTER}
        access="public"
        onChangeAccess={onChangeAccess}
        onSelectMember={onSelectMember}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /manage @meghan/i }));
    expect(onSelectMember).toHaveBeenCalledWith(expect.objectContaining({ handle: "meghan" }));
    expect(screen.getByRole("radio", { name: /anyone with the link/i }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /people you approve/i }));
    expect(onChangeAccess).toHaveBeenCalledWith("request");
  });

  it("shows each member's role in the roster (owner / editor / reader)", () => {
    render(<SharePanelView url="u" viewer="author" access="request" members={ROSTER} />);
    // ROSTER = alex (editor), meghan (owner). A "viewer" grant reads as "reader".
    expect(screen.getByText("owner")).toBeTruthy();
    expect(screen.getByText("editor")).toBeTruthy();
    render(<SharePanelView url="u" viewer="author" access="request" members={[{ handle: "sam", role: "viewer" }]} />);
    expect(screen.getByText("reader")).toBeTruthy();
  });

  it("surfaces a submitter as 'contributor' (write-capable, not a reader)", () => {
    render(<SharePanelView url="u" viewer="author" access="request" members={[{ handle: "sam", role: "submitter" }]} />);
    expect(screen.getByText("@sam")).toBeTruthy();
    expect(screen.getByText("contributor")).toBeTruthy();
    expect(screen.queryByText("reader")).toBeNull();
  });

  it("omits the role label when a member has no role", () => {
    render(<SharePanelView url="u" viewer="author" access="request" members={[{ handle: "sam" }]} />);
    expect(screen.getByText("@sam")).toBeTruthy();
    expect(screen.queryByText("reader")).toBeNull();
  });

  it("author: the access toggle is disabled (and inert) while accessPending", () => {
    const onChangeAccess = vi.fn();
    render(<SharePanelView url="u" viewer="author" access="public" accessPending onChangeAccess={onChangeAccess} />);
    const req = screen.getByRole("radio", { name: /people you approve/i }) as HTMLButtonElement;
    expect(req.disabled).toBe(true);
    fireEvent.click(req);
    expect(onChangeAccess).not.toHaveBeenCalled();
  });

  it("non-owner sees the access copy (reflecting the mode); the owner sees the toggle instead", () => {
    const { rerender } = render(<SharePanelView url="u" viewer="member" access="public" members={[]} />);
    expect(screen.getByText(/anyone with the link can open/i)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    rerender(<SharePanelView url="u" viewer="member" access="request" members={[]} />);
    expect(screen.getByText(/only approved members can access/i)).toBeTruthy();
    // the owner gets the toggle as the source of truth — not the sentence
    rerender(<SharePanelView url="u" viewer="author" access="public" />);
    expect(screen.queryByText(/anyone with the link can open/i)).toBeNull();
    expect(screen.getByRole("radiogroup")).toBeTruthy();
  });
});
