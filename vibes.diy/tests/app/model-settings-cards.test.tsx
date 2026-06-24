import React from "react";
import { render as rtlRender, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Result } from "@adviser/cement";
import type { Model } from "@vibes.diy/api-types";
import { vibesWrapper } from "./vibes-provider-harness.js";

// Stub react-hot-toast (toastError uses it on error paths).
vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { ModelSettingsCards } from "~/vibes.diy/app/components/ModelSettingsCards.js";

const MODELS: Model[] = [
  {
    id: "opus-4-8",
    name: "Claude Opus 4.8",
    description: "default codegen",
    preSelected: ["codegen", "runtime"],
    supports: ["codegen", "runtime"],
  },
  { id: "sonnet-4-6", name: "Claude Sonnet 4.6", description: "fast", supports: ["codegen", "runtime"] },
  { id: "img-default", name: "Image Model", description: "images", preSelected: ["img"], supports: ["img"] },
];

function makeApi() {
  return {
    listModels: vi.fn().mockResolvedValue(Result.Ok({ type: "vibes.diy.res-list-models", models: MODELS })),
  };
}

const render = (ui: React.ReactElement, api: ReturnType<typeof makeApi>) =>
  rtlRender(ui, { wrapper: vibesWrapper({ sharedApi: api }) });

const noop = () => undefined;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ModelSettingsCards reset / default affordance", () => {
  it("shows 'Following default' and no reset button when no pin is set", async () => {
    const api = makeApi();
    render(
      <ModelSettingsCards
        savingCodegen={false}
        savingRuntime={false}
        savingImg={false}
        onSaveCodegen={noop}
        onSaveRuntime={noop}
        onSaveImg={noop}
        onResetCodegen={noop}
        onResetRuntime={noop}
        onResetImg={noop}
      />,
      api
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Following default \(currently Claude Opus 4.8\)/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Use default")).not.toBeInTheDocument();
  });

  it("shows the pinned model and a reset control when a pin is set, and reset calls onReset", async () => {
    const api = makeApi();
    const onResetCodegen = vi.fn();
    render(
      <ModelSettingsCards
        codegenConfig={{ model: MODELS[1] }}
        savingCodegen={false}
        savingRuntime={false}
        savingImg={false}
        onSaveCodegen={noop}
        onSaveRuntime={noop}
        onSaveImg={noop}
        onResetCodegen={onResetCodegen}
        onResetRuntime={noop}
        onResetImg={noop}
      />,
      api
    );

    await waitFor(() => {
      expect(screen.getByText(/Pinned to/)).toBeInTheDocument();
    });
    // pinned label names the pinned model and shows the live default alongside
    expect(screen.getByText(/Pinned to/)).toHaveTextContent("Pinned to Claude Sonnet 4.6 · Default: Claude Opus 4.8");

    const resetBtn = screen.getByText("Use default");
    await act(async () => {
      fireEvent.click(resetBtn);
    });
    expect(onResetCodegen).toHaveBeenCalledTimes(1);
  });

  // App-level cards always backfill `config` with the resolved default, so they
  // pass an explicit `pinned` flag (derived from the raw override entries) rather
  // than inferring pinned state from config presence.
  it("treats a backfilled config as an explicit override when pinned is true", async () => {
    const api = makeApi();
    const onResetCodegen = vi.fn();
    render(
      <ModelSettingsCards
        codegenConfig={{ model: MODELS[1] }}
        codegenPinned={true}
        savingCodegen={false}
        savingRuntime={false}
        savingImg={false}
        onSaveCodegen={noop}
        onSaveRuntime={noop}
        onSaveImg={noop}
        onResetCodegen={onResetCodegen}
        onResetRuntime={noop}
        onResetImg={noop}
      />,
      api
    );

    await waitFor(() => {
      expect(screen.getByText(/Pinned to/)).toBeInTheDocument();
    });
    // In app mode the fallback target is the effective inherited model (which we
    // don't render here), so the catalog model is labelled neutrally rather than
    // claimed as the reset "Default".
    expect(screen.getByText(/Pinned to/)).toHaveTextContent("Pinned to Claude Sonnet 4.6 · Catalog default: Claude Opus 4.8");
    const resetBtn = screen.getByText("Use default");
    await act(async () => {
      fireEvent.click(resetBtn);
    });
    expect(onResetCodegen).toHaveBeenCalledTimes(1);
  });

  it("treats a backfilled config as inherited when pinned is false (no reset offered)", async () => {
    const api = makeApi();
    render(
      <ModelSettingsCards
        codegenConfig={{ model: MODELS[1] }}
        codegenPinned={false}
        savingCodegen={false}
        savingRuntime={false}
        savingImg={false}
        onSaveCodegen={noop}
        onSaveRuntime={noop}
        onSaveImg={noop}
        onResetCodegen={noop}
        onResetRuntime={noop}
        onResetImg={noop}
      />,
      api
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Following default \(currently Claude Sonnet 4.6\)/).length).toBeGreaterThan(0);
    });
    // Even though codegenConfig carries a model, it is the inherited default, so
    // no per-usage reset control appears for any card.
    expect(screen.queryByText("Use default")).not.toBeInTheDocument();
  });

  // Regression: clearing the API Key field must send apiKey: "" (not drop it),
  // otherwise the per-app SettingsTab path merges params field-by-field and the
  // old key stays stored even though the UI shows it cleared.
  it("sends an empty apiKey on save when the key field is cleared", async () => {
    const api = makeApi();
    const onSaveCodegen = vi.fn();
    render(
      <ModelSettingsCards
        codegenConfig={{ model: MODELS[0], apiKey: "sk-existing" }}
        savingCodegen={false}
        savingRuntime={false}
        savingImg={false}
        onSaveCodegen={onSaveCodegen}
        onSaveRuntime={noop}
        onSaveImg={noop}
      />,
      api
    );

    // codegen card is the first of the three cards
    const keyInput = (await screen.findAllByPlaceholderText("sk-…"))[0];
    expect((keyInput as HTMLInputElement).value).toBe("sk-existing");

    await act(async () => {
      fireEvent.change(keyInput, { target: { value: "" } });
    });

    const saveBtn = screen.getAllByText("Save")[0];
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(onSaveCodegen).toHaveBeenCalledTimes(1);
    expect(onSaveCodegen).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "" }));
  });
});
