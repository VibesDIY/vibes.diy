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

  it("fires onSelect with the chosen slug", () => {
    const onSelect = vi.fn();
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /@meghan_work/i }));
    expect(onSelect).toHaveBeenCalledWith("meghan_work");
  });

  it("reveals the inline create form and submits the typed (sanitized) handle", () => {
    const onNewHandle = vi.fn();
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" onNewHandle={onNewHandle} />);
    // Clicking "New handle" no longer creates one outright — it opens the form.
    fireEvent.click(screen.getByRole("menuitem", { name: /new handle/i }));
    expect(onNewHandle).not.toHaveBeenCalled();
    const input = screen.getByLabelText("New handle name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "My Cool Handle!" } });
    // Preview mirrors server sanitization.
    expect(screen.getByText("@my-cool-handle")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onNewHandle).toHaveBeenCalledWith("my-cool-handle");
  });

  it("submits the typed handle on Enter", () => {
    const onNewHandle = vi.fn();
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" onNewHandle={onNewHandle} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /new handle/i }));
    const input = screen.getByLabelText("New handle name");
    fireEvent.change(input, { target: { value: "ziggy" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onNewHandle).toHaveBeenCalledWith("ziggy");
  });

  it("does not submit an empty/invalid handle (Create stays disabled)", () => {
    const onNewHandle = vi.fn();
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" onNewHandle={onNewHandle} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /new handle/i }));
    const create = screen.getByRole("button", { name: /^create$/i }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("New handle name"), { target: { value: "---" } });
    expect(create.disabled).toBe(true);
    fireEvent.click(create);
    expect(onNewHandle).not.toHaveBeenCalled();
  });

  it("'Surprise me' mints a random handle (no argument)", () => {
    const onNewHandle = vi.fn();
    render(<HandlePickerMenu handles={HANDLES} activeSlug="meghan" onNewHandle={onNewHandle} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /new handle/i }));
    fireEvent.click(screen.getByRole("button", { name: /surprise me/i }));
    expect(onNewHandle).toHaveBeenCalledWith();
    expect(onNewHandle.mock.calls[0][0]).toBeUndefined();
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
