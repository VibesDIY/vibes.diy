import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandlePickerMenu } from "@vibes.diy/base";

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

const HANDLES = [{ slug: "meghan" }, { slug: "meghan_work", displayName: "@meghan_work" }];

describe("HandlePickerMenu", () => {
  it("lists handles under an 'Acting as' header plus a New handle row", () => {
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" />);
    expect(screen.getByText("Acting as")).toBeTruthy();
    expect(screen.getByText("@meghan")).toBeTruthy();
    expect(screen.getByText("@meghan_work")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /new handle/i })).toBeTruthy();
  });

  it("marks the active handle with aria-current", () => {
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" />);
    const active = screen.getByRole("menuitem", { name: /@meghan$/i });
    expect(active.getAttribute("aria-current")).toBe("true");
    const other = screen.getByRole("menuitem", { name: /@meghan_work/i });
    expect(other.getAttribute("aria-current")).toBeNull();
  });

  it("fires onSelect with the chosen slug and onNewHandle", () => {
    const onSelect = vi.fn();
    const onNewHandle = vi.fn();
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" onSelect={onSelect} onNewHandle={onNewHandle} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /@meghan_work/i }));
    expect(onSelect).toHaveBeenCalledWith("meghan_work");
    fireEvent.click(screen.getByRole("menuitem", { name: /new handle/i }));
    expect(onNewHandle).toHaveBeenCalled();
  });

  it("disables every row when busy", () => {
    const onSelect = vi.fn();
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" busy onSelect={onSelect} />);
    const row = screen.getByRole("menuitem", { name: /@meghan_work/i }) as HTMLButtonElement;
    expect(row.disabled).toBe(true);
    fireEvent.click(row);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
