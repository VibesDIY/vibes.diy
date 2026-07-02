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

  it("holds the clicked chip in a working state until a promise-returning handler resolves", async () => {
    let release: (v: boolean) => void = () => undefined;
    const onSelectChip = vi.fn(() => new Promise<boolean>((res) => (release = res)));
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit", "Add a high score"]}
        onSelectChip={onSelectChip}
      />
    );
    const chip = screen.getByText("Make it a drum kit").closest("button") as HTMLButtonElement;
    fireEvent.click(chip);
    // Pending: pressed + animated working sweep + spinner; other chips locked.
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(chip.className).toContain("option-working");
    expect(screen.getByTestId("option-spinner")).toBeTruthy();
    // Resolving false releases the press and the chips are clickable again.
    release(false);
    await vi.waitFor(() => {
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    });
    expect(chip.className).not.toContain("option-working");
    fireEvent.click(screen.getByText("Add a high score"));
    expect(onSelectChip).toHaveBeenCalledTimes(2);
  });

  it("submits the Other free-text row", () => {
    const onSubmitOther = vi.fn();
    render(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={onSubmitOther} />);
    const input = screen.getByRole("textbox", { name: /change the app/i });
    fireEvent.change(input, { target: { value: "make it dark" } });
    const form = input.closest("form");
    if (!form) throw new Error("expected the Other row to be wrapped in a form");
    fireEvent.submit(form);
    expect(onSubmitOther).toHaveBeenCalledWith("make it dark");
  });

  it("shows a faux placeholder with 'magic' struck through, hidden once you type", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={() => undefined} />);
    // The strikethrough lives in an <s> element (a plain placeholder attribute
    // can't carry markup), and the surrounding copy renders as one line.
    const struck = document.querySelector("s");
    expect(struck?.textContent).toBe("magic");
    expect(struck?.closest("span")?.textContent).toBe("Change the app with magic words…");
    // Typing hides the faux placeholder.
    const input = screen.getByRole("textbox", { name: /change the app/i });
    fireEvent.change(input, { target: { value: "x" } });
    expect(document.querySelector("s")).toBeNull();
  });

  it("fires nav callbacks and closes via the toggle", () => {
    const onHome = vi.fn();
    const onShare = vi.fn();
    const onAbout = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        onHome={onHome}
        onShare={onShare}
        onAbout={onAbout}
        onOpenChange={onOpenChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /home/i }));
    expect(onHome).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(onShare).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /about vibes diy/i }));
    expect(onAbout).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /close vibe menu/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes when the click-away backdrop is clicked", () => {
    const onOpenChange = vi.fn();
    render(<UnifiedVibeCard appTitle="Bloom Machine" open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTestId("vibe-menu-backdrop"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders no click-away backdrop while closed", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" />);
    expect(screen.queryByTestId("vibe-menu-backdrop")).toBeNull();
  });

  it("renders the handle stub when handleSlug is set", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" />);
    expect(screen.getByText("@meghan")).toBeTruthy();
  });

  it("shows the owner's edit-in-place explainer plus Edit and Editor nav buttons", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open isOwner chips={["Make it a drum kit"]} />);
    expect(screen.getByText("Describe a change to edit this app live:")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^editor$/i })).toBeTruthy();
  });

  it("shows the remix explainer to a non-owner (a visitor's write forks, not edits in place)", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open chips={["Make it a drum kit"]} />);
    expect(screen.getByText("Describe a change to remix your own copy of this app:")).toBeTruthy();
    expect(screen.queryByText("Describe a change to edit this app live:")).toBeNull();
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

  it("layers streamBody over the chips: stream shows, chips stay mounted but hidden+inert", () => {
    const onSelectChip = vi.fn();
    const { rerender } = render(
      <UnifiedVibeCard appTitle="Bloom Machine" open chips={["Make it a drum kit"]} onSelectChip={onSelectChip} />
    );
    // Resting: chip is visible and clickable.
    const chip = screen.getByText("Make it a drum kit");
    expect(chip).toBeTruthy();

    // Streaming: the stream view shows; the chip stays in the DOM (reserving the
    // panel height, so it doesn't resize) but is hidden and inert.
    rerender(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit"]}
        onSelectChip={onSelectChip}
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    expect(screen.getByText("STREAMING NARRATION")).toBeTruthy();
    // Chip is still mounted (height reserved) but hidden behind an aria-hidden/inert wrapper.
    const stillThere = screen.getByText("Make it a drum kit");
    expect(stillThere).toBeTruthy();
    const hiddenWrap = stillThere.closest("[aria-hidden='true']");
    expect(hiddenWrap).toBeTruthy();
    expect((hiddenWrap as HTMLElement).style.visibility).toBe("hidden");
  });

  it("keeps the composer input visible and editable while a turn streams (queue-ahead)", () => {
    // The input must NOT disappear or become disabled while generating — some
    // people compose their next change while they wait.
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit"]}
        generating
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    const input = screen.getByRole("textbox", { name: /change the app/i }) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.disabled).toBe(false);
    // It is NOT inside the hidden/inert chips wrapper (that only hides the chips).
    expect(input.closest("[aria-hidden='true']")).toBeNull();
    // And it accepts typing while the turn streams.
    fireEvent.change(input, { target: { value: "then add sound" } });
    expect(input.value).toBe("then add sound");
  });

  it("swaps the submit button to a Stop button while generating (empty input) and fires onStop", () => {
    const onStop = vi.fn();
    const onSubmitOther = vi.fn();
    const { rerender } = render(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={onSubmitOther} onStop={onStop} />);
    // Resting: a Submit button, no Stop button.
    expect(screen.getByRole("button", { name: /submit change/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /stop generating/i })).toBeNull();

    // Generating with an empty input: the same slot now renders a Stop button
    // (submit is gone), and clicking it cancels the turn.
    rerender(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        onSubmitOther={onSubmitOther}
        onStop={onStop}
        generating
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    expect(screen.queryByRole("button", { name: /submit change/i })).toBeNull();
    const stop = screen.getByRole("button", { name: /stop generating/i });
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSubmitOther).not.toHaveBeenCalled();
  });

  it("flips Stop back to a send button the moment text is typed mid-turn, and queues on submit", () => {
    const onSubmitOther = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        onSubmitOther={onSubmitOther}
        onStop={vi.fn()}
        generating
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    const input = screen.getByRole("textbox", { name: /change the app/i }) as HTMLInputElement;
    // Typing swaps Stop → send (labelled Queue change mid-turn): you must clear
    // or send before Stop is reachable again.
    fireEvent.change(input, { target: { value: "queued change" } });
    expect(screen.queryByRole("button", { name: /stop generating/i })).toBeNull();
    const queueBtn = screen.getByRole("button", { name: /queue change/i });
    fireEvent.click(queueBtn);
    // Queued, not sent: the active turn keeps running, the input clears for the
    // next message, and the status line reports the queue.
    expect(onSubmitOther).not.toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(screen.getByText(/1 change queued/i)).toBeTruthy();
    // Input empty again → Stop is back.
    expect(screen.getByRole("button", { name: /stop generating/i })).toBeTruthy();
  });

  it("batches every queued message into ONE prompt and auto-sends when the turn ends", () => {
    const onSubmitOther = vi.fn();
    const { rerender } = render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        onSubmitOther={onSubmitOther}
        onStop={vi.fn()}
        generating
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    const input = screen.getByRole("textbox", { name: /change the app/i });
    const form = input.closest("form");
    if (!form) throw new Error("expected the Other row to be wrapped in a form");
    for (const msg of ["make it blue", "add a drum kit", "bigger buttons"]) {
      fireEvent.change(input, { target: { value: msg } });
      fireEvent.submit(form);
    }
    expect(onSubmitOther).not.toHaveBeenCalled();
    expect(screen.getByText(/3 changes queued/i)).toBeTruthy();
    // Turn ends → the queue flushes as a single batched prompt.
    rerender(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={onSubmitOther} onStop={vi.fn()} />);
    expect(onSubmitOther).toHaveBeenCalledTimes(1);
    expect(onSubmitOther).toHaveBeenCalledWith("make it blue\n\nadd a drum kit\n\nbigger buttons");
    expect(screen.queryByText(/queued/i)).toBeNull();
  });

  it("drops the queue when the vibe identity changes so it can't flush into another app", () => {
    // The /vibe route component is reused across client-side navigations; the
    // composer is keyed by appSlug so a queue built against one app never
    // auto-flushes into the next app's onSubmitOther (Codex P2 on #3020).
    const onSubmitOther = vi.fn();
    const { rerender } = render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        appSlug="alice/bloom"
        open
        onSubmitOther={onSubmitOther}
        onStop={vi.fn()}
        generating
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    const input = screen.getByRole("textbox", { name: /change the app/i });
    const form = input.closest("form");
    if (!form) throw new Error("expected the Other row to be wrapped in a form");
    fireEvent.change(input, { target: { value: "make it blue" } });
    fireEvent.submit(form);
    expect(screen.getByText(/1 change queued/i)).toBeTruthy();
    // Navigate to a different vibe (same mounted card), old turn still running.
    rerender(
      <UnifiedVibeCard
        appTitle="Other App"
        appSlug="bob/other"
        open
        onSubmitOther={onSubmitOther}
        onStop={vi.fn()}
        generating
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    expect(screen.queryByText(/queued/i)).toBeNull();
    // The old turn ends — nothing flushes into the new app's handler.
    rerender(<UnifiedVibeCard appTitle="Other App" appSlug="bob/other" open onSubmitOther={onSubmitOther} onStop={vi.fn()} />);
    expect(onSubmitOther).not.toHaveBeenCalled();
  });

  it("Stop with a queue drains it back into the input instead of auto-sending after the cancel", () => {
    const onSubmitOther = vi.fn();
    const onStop = vi.fn();
    const { rerender } = render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        onSubmitOther={onSubmitOther}
        onStop={onStop}
        generating
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    const input = screen.getByRole("textbox", { name: /change the app/i }) as HTMLInputElement;
    const form = input.closest("form");
    if (!form) throw new Error("expected the Other row to be wrapped in a form");
    fireEvent.change(input, { target: { value: "make it blue" } });
    fireEvent.submit(form);
    fireEvent.change(input, { target: { value: "add a drum kit" } });
    fireEvent.submit(form);
    // Input is empty → Stop is reachable; cancelling returns the queue to the box.
    fireEvent.click(screen.getByRole("button", { name: /stop generating/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
    // Single-line-safe join: the field is an <input>, which strips newlines.
    expect(input.value).toBe("make it blue; add a drum kit");
    // The turn ends (cancelled) — nothing auto-fires, the text just sits editable.
    rerender(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={onSubmitOther} onStop={onStop} />);
    expect(onSubmitOther).not.toHaveBeenCalled();
  });

  it("reserves a minimum stream height so a text-input-only card (no chips) doesn't crush the narration", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" open streamBody={<div>STREAMING NARRATION</div>} />);
    const stream = screen.getByText("STREAMING NARRATION");
    // The relative wrapper is the stream overlay's offset parent; it carries the
    // reserved minHeight so the absolutely-positioned stream has room to render.
    const overlay = stream.parentElement as HTMLElement;
    const relativeWrap = overlay.parentElement as HTMLElement;
    expect(relativeWrap.style.position).toBe("relative");
    expect(relativeWrap.style.minHeight).toBe("128px");
  });

  it("body (Share view) still fully replaces the chips even if streamBody is also passed", () => {
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit"]}
        body={<div>SHARE PANEL BODY</div>}
        streamBody={<div>STREAMING NARRATION</div>}
      />
    );
    expect(screen.getByText("SHARE PANEL BODY")).toBeTruthy();
    expect(screen.queryByText("STREAMING NARRATION")).toBeNull();
    expect(screen.queryByText("Make it a drum kit")).toBeNull();
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

  it("renders the open picker in a detached fixed layer (escapes the card clip) with a Log out row", () => {
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        handleSlug="meghan"
        handles={[{ slug: "meghan" }, { slug: "meghan_work" }]}
        onLogout={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /switch handle/i }));
    const menu = screen.getByRole("menu", { name: /acting as/i });
    // The menu lives in the detached [data-vibe-handle-menu] layer, NOT inside
    // the clipped card dialog — that's what lets it float near the top and scroll
    // to its bottom rows.
    const layer = menu.closest("[data-vibe-handle-menu]") as HTMLElement | null;
    expect(layer).not.toBeNull();
    expect(layer?.closest("[data-unified-vibe-card]")).toBeNull();
    expect(getComputedStyle(layer as HTMLElement).position).toBe("fixed");
    // Must re-enable hit-testing: the host wraps the card in a
    // `pointer-events-none` layer, so a detached sibling that doesn't set
    // pointerEvents:auto would be unclickable in production (Codex P1 #2996).
    expect(getComputedStyle(layer as HTMLElement).pointerEvents).toBe("auto");
    expect(screen.getByRole("menuitem", { name: /log out/i })).toBeTruthy();
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

  it("fires onNewHandle with the typed handle and closes the picker", () => {
    const onNewHandle = vi.fn();
    render(
      <UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" handles={[{ slug: "meghan" }]} onNewHandle={onNewHandle} />
    );
    fireEvent.click(screen.getByRole("button", { name: /switch handle/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /new handle/i }));
    fireEvent.change(screen.getByLabelText("New handle name"), { target: { value: "stardust" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onNewHandle).toHaveBeenCalledWith("stardust");
    // Picker closes after creating.
    expect(screen.queryByRole("menu", { name: /acting as/i })).toBeNull();
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

  // Cached-suggestion fast paths (#2917): the shield badge + owner bless/unbless.
  it("shows the 'Stays here' shield only on a shielded chip (#2917)", () => {
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit", "Add a high score"]}
        chipFastPaths={{ "Make it a drum kit": { shielded: true } }}
      />
    );
    // The shielded chip carries the badge; the other does not.
    expect(screen.getByRole("img", { name: /stays here/i })).toBeTruthy();
    expect(screen.getAllByRole("img", { name: /stays here/i })).toHaveLength(1);
  });

  it("renders no fast-path control without the owner callbacks (visitor) (#2917)", () => {
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit"]}
        // A visitor never gets canBless/canUnbless, and the host wires no callbacks.
        chipFastPaths={{ "Make it a drum kit": { shielded: true } }}
      />
    );
    expect(screen.queryByRole("button", { name: /feature as fast path/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /remove fast path/i })).toBeNull();
  });

  it("offers the owner a Feature (bless) control on a produced chip and fires onBlessChip (#2917)", () => {
    const onBlessChip = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit"]}
        chipFastPaths={{ "Make it a drum kit": { canBless: true } }}
        onBlessChip={onBlessChip}
        onUnblessChip={vi.fn()}
      />
    );
    // No shield yet (not blessed); a "Feature as fast path" button is offered.
    expect(screen.queryByRole("img", { name: /stays here/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /feature as fast path/i }));
    expect(onBlessChip).toHaveBeenCalledWith("Make it a drum kit");
  });

  it("offers the owner an Unbless control on a blessed chip and fires onUnblessChip (#2917)", () => {
    const onUnblessChip = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit"]}
        chipFastPaths={{ "Make it a drum kit": { shielded: true, canUnbless: true } }}
        onBlessChip={vi.fn()}
        onUnblessChip={onUnblessChip}
      />
    );
    // Blessed: the shield shows AND an unbless control is offered.
    expect(screen.getByRole("img", { name: /stays here/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /remove fast path/i }));
    expect(onUnblessChip).toHaveBeenCalledWith("Make it a drum kit");
  });

  it("selecting a decorated chip still fires onSelectChip (the chip stays the primary action) (#2917)", () => {
    const onSelectChip = vi.fn();
    render(
      <UnifiedVibeCard
        appTitle="Bloom Machine"
        open
        chips={["Make it a drum kit"]}
        chipFastPaths={{ "Make it a drum kit": { shielded: true, canUnbless: true } }}
        onBlessChip={vi.fn()}
        onUnblessChip={vi.fn()}
        onSelectChip={onSelectChip}
      />
    );
    fireEvent.click(screen.getByText("Make it a drum kit"));
    expect(onSelectChip).toHaveBeenCalledWith("Make it a drum kit");
  });
});
