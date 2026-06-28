import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedVibeCard } from "@vibes.diy/base";

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("UnifiedVibeCard", () => {
  it("starts closed: title hidden, toggle present", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" />);
    expect(screen.queryByText("Bloom Machine")).toBeNull();
    expect(screen.getByRole("button", { name: /open vibe menu/i })).toBeTruthy();
  });

  it("opens to reveal the title when the toggle is clicked", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" appSlug="meghan/bloom" />);
    fireEvent.click(screen.getByRole("button", { name: /open vibe menu/i }));
    expect(screen.getByText("Bloom Machine")).toBeTruthy();
    expect(screen.getByText("meghan/bloom")).toBeTruthy();
  });

  it("renders chips and fires onSelectChip", () => {
    const onSelectChip = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit", "Add a high score"]}
        onSelectChip={onSelectChip}
      />
    );
    fireEvent.click(screen.getByText("Make it a drum kit"));
    expect(onSelectChip).toHaveBeenCalledWith("Make it a drum kit");
  });

  it("keeps chips clickable after a selection (no permanent lock)", () => {
    const onSelectChip = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit", "Add a high score"]}
        onSelectChip={onSelectChip}
      />
    );
    fireEvent.click(screen.getByText("Make it a drum kit"));
    fireEvent.click(screen.getByText("Add a high score"));
    expect(onSelectChip).toHaveBeenCalledTimes(2);
    expect(onSelectChip).toHaveBeenNthCalledWith(1, "Make it a drum kit");
    expect(onSelectChip).toHaveBeenNthCalledWith(2, "Add a high score");
  });

  it("submits the Other free-text row", () => {
    const onSubmitOther = vi.fn();
    render(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={onSubmitOther} />);
    const input = screen.getByPlaceholderText(/make it your own/i);
    fireEvent.change(input, { target: { value: "make it dark" } });
    const form = input.closest("form");
    if (!form) throw new Error("expected the Other row to be wrapped in a form");
    fireEvent.submit(form);
    expect(onSubmitOther).toHaveBeenCalledWith("make it dark");
  });

  it("fires nav callbacks and closes via the toggle", () => {
    const onHome = vi.fn();
    const onShare = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        onHome={onHome}
        onShare={onShare}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /home/i }));
    expect(onHome).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(onShare).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /close vibe menu/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the handle stub when handleSlug is set", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" />);
    expect(screen.getByText("@meghan")).toBeTruthy();
  });

  it("shows the in-vibe edit explainer and an Edit nav button", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open chips={["Make it a drum kit"]} />);
    expect(screen.getByText("Describe a change to edit this app live:")).toBeTruthy();
    expect(screen.getByRole("button", { name: /edit/i })).toBeTruthy();
  });

  it("renders a custom body in place of chips/Other and can select the Share nav", () => {
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit"]}
        selectedNav="share"
        body={<div>SHARE PANEL BODY</div>}
      />
    );
    // body override wins over chips
    expect(screen.getByText("SHARE PANEL BODY")).toBeTruthy();
    expect(screen.queryByText("Make it a drum kit")).toBeNull();
    // Share nav reads selected (3px ring), Edit does not
    const share = screen.getByRole("button", { name: /share/i });
    expect(share.style.boxShadow).toContain("3px");
  });

  it("keeps a single persistent toggle in both states (no remount/resize)", () => {
    const { rerender } = render(<UnifiedVibeCard appTitle="Bloom Machine" />);
    // Closed: the one toggle is present and labelled "Open vibe menu".
    expect(screen.getByRole("button", { name: /open vibe menu/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /close vibe menu/i })).toBeNull();
    // Open: the SAME toggle persists, now labelled "Close vibe menu" — there is
    // never a second, differently-sized switch.
    rerender(<UnifiedVibeCard appTitle="Bloom Machine" open />);
    expect(screen.getByRole("button", { name: /close vibe menu/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /open vibe menu/i })).toBeNull();
  });

  it("keeps the handle caret static when no handles are supplied (legacy)", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" />);
    // No interactive switcher button, no menu.
    expect(screen.queryByRole("button", { name: /switch handle/i })).toBeNull();
    expect(screen.queryByRole("menu", { name: /acting as/i })).toBeNull();
  });

  it("opens the handle picker from the caret and lists handles + New handle", () => {
    render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" handles={[{ slug: "meghan" }, { slug: "meghan_work" }]} />
    );
    // Closed by default.
    expect(screen.queryByRole("menu", { name: /acting as/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /switch handle/i }));
    expect(screen.getByRole("menu", { name: /acting as/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /@meghan_work/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /new handle/i })).toBeTruthy();
  });

  it("fires onSelectHandle and closes the picker", () => {
    const onSelectHandle = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        handles={[{ slug: "meghan" }, { slug: "meghan_work" }]}
        onSelectHandle={onSelectHandle}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /switch handle/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /@meghan_work/i }));
    expect(onSelectHandle).toHaveBeenCalledWith("meghan_work");
    // Picker closes after a selection.
    expect(screen.queryByRole("menu", { name: /acting as/i })).toBeNull();
  });

  it("no longer renders a disclosure triangle and opens the picker from the tag itself", () => {
    render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" handles={[{ slug: "meghan" }, { slug: "meghan_work" }]} />
    );
    // The ▾ caret is gone — the whole tag is the trigger now.
    expect(screen.queryByText("▾")).toBeNull();
    const trigger = screen.getByRole("button", { name: /switch handle/i });
    expect(trigger.textContent).toContain("@meghan");
    fireEvent.click(trigger);
    expect(screen.getByRole("menu", { name: /acting as/i })).toBeTruthy();
  });

  it("clicking the avatar makes a new avatar (file picker) instead of opening the picker", () => {
    const onPickAvatar = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        handles={[{ slug: "meghan" }]}
        onPickAvatar={onPickAvatar}
      />
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: /change avatar/i }));
    // The avatar opens the file picker and does NOT open the handle menu.
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu", { name: /acting as/i })).toBeNull();
  });

  it("the hidden file input's click does not bubble up and open the picker (Charlie blocking)", () => {
    // fileRef.current.click() dispatches a real bubbling click on the input;
    // without stopPropagation on the input it would reach the pill's onClick and
    // toggle the handle picker. Fire a real click on the input to assert it doesn't.
    render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" handles={[{ slug: "meghan" }]} onPickAvatar={vi.fn()} />
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.click(fileInput);
    expect(screen.queryByRole("menu", { name: /acting as/i })).toBeNull();
  });

  it("offers no avatar edit affordance without onPickAvatar", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" handles={[{ slug: "meghan" }]} />);
    expect(screen.queryByRole("button", { name: /change avatar/i })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("fires onNewHandle from the picker", () => {
    const onNewHandle = vi.fn();
    render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" handles={[{ slug: "meghan" }]} onNewHandle={onNewHandle} />
    );
    fireEvent.click(screen.getByRole("button", { name: /switch handle/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /new handle/i }));
    expect(onNewHandle).toHaveBeenCalled();
  });

  it("forwards shareButtonRef to the Share nav button (so an external popover can anchor)", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<UnifiedVibeCard appTitle="Bloom Machine" open shareButtonRef={ref} />);
    expect(ref.current).not.toBeNull();
    expect(ref.current?.getAttribute("aria-label")).toBe("Share");
  });

  it("shows a shield for the author viewer mode", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="author" />);
    expect(screen.getByRole("img", { name: /owner/i })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /read-only/i })).toBeNull();
  });

  it("shows a lock for a read-only member, nothing for a writer member", () => {
    const { rerender } = render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="member" memberReadOnly />
    );
    expect(screen.getByRole("img", { name: /read-only/i })).toBeTruthy();
    rerender(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="member" />);
    expect(screen.queryByRole("img", { name: /read-only/i })).toBeNull();
    expect(screen.queryByRole("img", { name: /owner/i })).toBeNull();
  });

  it("shows no mode indicator for a visitor", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="visitor" />);
    expect(screen.queryByRole("img", { name: /owner/i })).toBeNull();
    expect(screen.queryByRole("img", { name: /read-only/i })).toBeNull();
  });

  it("shows the admin-mode indicator, taking precedence over the author shield (#2178)", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="author" adminMode />);
    expect(screen.getByRole("img", { name: /admin mode/i })).toBeTruthy();
    // The plain "Owner" shield label is replaced by the admin one.
    expect(screen.queryByRole("img", { name: /^owner$/i })).toBeNull();
  });

  it("shows the 'Draft · unpublished' badge when publishState is draft (#2772)", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="author" publishState="draft" />);
    expect(screen.getByText(/draft · unpublished/i)).toBeTruthy();
    expect(screen.getByRole("status", { name: /unpublished/i })).toBeTruthy();
  });

  it("hides the draft badge when published or unset (#2772)", () => {
    const { rerender } = render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="author" publishState="published" />
    );
    expect(screen.queryByText(/draft · unpublished/i)).toBeNull();
    rerender(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="author" />);
    expect(screen.queryByText(/draft · unpublished/i)).toBeNull();
  });

  it("shows the Publish banner and fires onPublish for an owner draft (#2772 D2)", () => {
    const onPublish = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        viewerMode="author"
        publishState="draft"
        onPublish={onPublish}
      />
    );
    expect(screen.getByText(/unpublished changes/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("disables the Publish button and shows a pending label while publishing (#2772 D2)", () => {
    const onPublish = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        viewerMode="author"
        publishState="draft"
        onPublish={onPublish}
        publishing
      />
    );
    const btn = screen.getByRole("button", { name: /publishing/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("hides the Publish banner without onPublish (D1 badge-only) and in the Share view (#2772 D2)", () => {
    const { rerender } = render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="author" publishState="draft" />
    );
    // D1: badge shows, but no banner without onPublish.
    expect(screen.getByText(/draft · unpublished/i)).toBeTruthy();
    expect(screen.queryByText(/unpublished changes/i)).toBeNull();
    // Share view: banner stays hidden even with onPublish (it belongs to the Edit body).
    rerender(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        viewerMode="author"
        publishState="draft"
        onPublish={() => undefined}
        selectedNav="share"
        body={<div>SHARE</div>}
      />
    );
    expect(screen.queryByText(/unpublished changes/i)).toBeNull();
  });

  it("gates the admin badge to the owner: a stale adminMode never labels a member/visitor (Codex P2)", () => {
    const { rerender } = render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="member" memberReadOnly adminMode />
    );
    // adminMode is ignored for a member — they still get the read-only lock, not admin.
    expect(screen.queryByRole("img", { name: /admin mode/i })).toBeNull();
    expect(screen.getByRole("img", { name: /read-only/i })).toBeTruthy();
    // ...and nothing at all for a visitor.
    rerender(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" viewerMode="visitor" adminMode />);
    expect(screen.queryByRole("img", { name: /admin mode/i })).toBeNull();
    expect(screen.queryByRole("img", { name: /read-only/i })).toBeNull();
  });
});
