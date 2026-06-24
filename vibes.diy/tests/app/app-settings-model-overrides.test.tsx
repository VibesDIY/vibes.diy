import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Result } from "@adviser/cement";
import type { AIParams, Model } from "@vibes.diy/api-types";
import { vibesWrapper } from "./vibes-provider-harness.js";

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.unmock("~/vibes.diy/app/components/ModelSettingsCards.js");
vi.unmock("~/vibes.diy/app/components/mine/settings-tab/index.js");

function model(id: string, name: string, supports: ("codegen" | "runtime" | "img")[]): Model {
  return {
    id,
    name,
    description: `${name} description`,
    supports,
  };
}

function appSettingsRes(args: {
  entries?: unknown[];
  codegen?: Partial<AIParams>;
  runtime?: Partial<AIParams>;
  img?: Partial<AIParams>;
}) {
  return Result.Ok({
    type: "vibes.diy.res-ensure-app-settings",
    userId: "u1",
    appSlug: "demo-app",
    ownerHandle: "demo-owner",
    ledger: "demo-ledger",
    tenant: "demo-tenant",
    settings: {
      entries: args.entries ?? [],
      entry: {
        settings: {
          codegen: args.codegen,
          runtime: args.runtime,
          img: args.img,
          env: [],
        },
      },
    },
    updated: new Date().toISOString(),
    created: new Date().toISOString(),
  });
}

const catalogCodegen = model("catalog-codegen", "Catalog Codegen", ["codegen"]);
const catalogRuntime = model("catalog-runtime", "Catalog Runtime", ["runtime"]);
const catalogImg = model("catalog-img", "Catalog Img", ["img"]);
const overrideCodegen = model("override-codegen", "Override Codegen", ["codegen"]);

const listModelsResult = Result.Ok({ models: [catalogCodegen, catalogRuntime, catalogImg, overrideCodegen] });

describe("app settings model overrides UI", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("ModelSettingsCards shows inherited vs pinned state and reset affordance", async () => {
    const { ModelSettingsCards } = await import("~/vibes.diy/app/components/ModelSettingsCards.js");
    const onResetCodegen = vi.fn();
    const onResetRuntime = vi.fn();

    render(
      <ModelSettingsCards
        codegenConfig={{ model: catalogCodegen }}
        runtimeConfig={{ model: catalogRuntime }}
        imgConfig={{ model: catalogImg }}
        savingCodegen={false}
        savingRuntime={false}
        savingImg={false}
        codegenIsOverridden={false}
        runtimeIsOverridden
        imgIsOverridden
        onSaveCodegen={vi.fn()}
        onSaveRuntime={vi.fn()}
        onSaveImg={vi.fn()}
        onResetCodegen={onResetCodegen}
        onResetRuntime={onResetRuntime}
      />,
      {
        wrapper: vibesWrapper({
          sharedApi: {
            listModels: vi.fn().mockResolvedValue(listModelsResult),
          },
        }),
      }
    );

    await screen.findByText("Inherited default");
    expect(screen.getAllByText("Pinned override")).toHaveLength(2);

    const codegenCard = screen.getByText("Codegen Model").closest("li");
    expect(codegenCard).toBeTruthy();
    if (!codegenCard) throw new Error("Codegen card missing");
    expect(within(codegenCard).queryByRole("button", { name: "Reset to inherited" })).not.toBeInTheDocument();
    expect(within(codegenCard).getByText("Current: Catalog Codegen")).toBeInTheDocument();

    const runtimeCard = screen.getByText("App Runtime Model").closest("li");
    expect(runtimeCard).toBeTruthy();
    if (!runtimeCard) throw new Error("Runtime card missing");

    const resetRuntimeButton = await within(runtimeCard).findByRole("button", { name: "Reset to inherited" });
    fireEvent.click(resetRuntimeButton);
    expect(onResetRuntime).toHaveBeenCalledTimes(1);
    expect(onResetCodegen).not.toHaveBeenCalled();
  });

  it("SettingsTab reset sends remove request and flips card state to inherited", async () => {
    const { SettingsTab } = await import("~/vibes.diy/app/components/mine/settings-tab/index.js");

    const ensureAppSettings = vi
      .fn()
      .mockResolvedValueOnce(
        appSettingsRes({
          entries: [{ type: "active.model", usage: "codegen", param: { model: overrideCodegen } }],
          codegen: { model: overrideCodegen },
          runtime: { model: catalogRuntime },
          img: { model: catalogImg },
        })
      )
      // SettingsTab initializes pending=fetch, then immediately reissues fetch
      // in an effect keyed by appSlug/ownerHandle/sharedApi.
      .mockResolvedValueOnce(
        appSettingsRes({
          entries: [{ type: "active.model", usage: "codegen", param: { model: overrideCodegen } }],
          codegen: { model: overrideCodegen },
          runtime: { model: catalogRuntime },
          img: { model: catalogImg },
        })
      )
      .mockResolvedValueOnce(
        appSettingsRes({
          entries: [],
          codegen: { model: catalogCodegen },
          runtime: { model: catalogRuntime },
          img: { model: catalogImg },
        })
      );

    render(<SettingsTab ownerHandle="demo-owner" appSlug="demo-app" />, {
      wrapper: vibesWrapper({
        sharedApi: {
          ensureAppSettings,
          listModels: vi.fn().mockResolvedValue(listModelsResult),
        },
      }),
    });

    const codegenCard = await waitFor(() => {
      const card = screen.getByText("Codegen Model").closest("li");
      if (!card) throw new Error("Codegen card not rendered yet");
      return card;
    });

    await within(codegenCard).findByText("Pinned override");
    const resetButton = await within(codegenCard).findByRole("button", { name: "Reset to inherited" });

    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(ensureAppSettings).toHaveBeenCalledWith({ appSlug: "demo-app", ownerHandle: "demo-owner", codegen: null });
    });

    await within(codegenCard).findByText("Inherited default");
    await waitFor(() => {
      expect(within(codegenCard).getByText(/Current:\s*Catalog Codegen/)).toBeInTheDocument();
    });
  });
});
