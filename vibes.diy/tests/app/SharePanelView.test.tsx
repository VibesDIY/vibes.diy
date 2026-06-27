import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharePanelView } from "@vibes.diy/base";

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("SharePanelView", () => {
  it("shows the url and fires onCopy", () => {
    const onCopy = vi.fn();
    render(<SharePanelView url="vibes.diy/meghan/bloom" onCopy={onCopy} />);
    expect(screen.getByText("vibes.diy/meghan/bloom")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(onCopy).toHaveBeenCalled();
  });

  it("owner: shows publish intent + Manage access, and fires intent change", () => {
    const onChangePublishIntent = vi.fn();
    const onManageAccess = vi.fn();
    render(
      <SharePanelView
        url="u"
        isOwner
        publishIntent="shared"
        onChangePublishIntent={onChangePublishIntent}
        onManageAccess={onManageAccess}
      />
    );
    // current intent is checked
    expect(screen.getByRole("radio", { name: /shared space/i }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /remix seed/i }));
    expect(onChangePublishIntent).toHaveBeenCalledWith("template");
    fireEvent.click(screen.getByRole("button", { name: /manage access/i }));
    expect(onManageAccess).toHaveBeenCalled();
  });

  it("visitor: shows Request access (no publish intent) and fires it", () => {
    const onRequestAccess = vi.fn();
    render(<SharePanelView url="u" isOwner={false} onRequestAccess={onRequestAccess} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /request access/i }));
    expect(onRequestAccess).toHaveBeenCalled();
  });
});
