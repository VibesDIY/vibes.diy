import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router";
import { toast } from "react-hot-toast";
import { useYoursNowToast } from "~/vibes.diy/app/hooks/use-yours-now-toast.js";

// Spy on the real toast rather than vi.mock-ing the module: under this project's
// isolate:false config a partial module mock bleeds into sibling files (e.g. leaves
// toast.error undefined). Spying touches only toast.success and restores cleanly.
let successSpy: ReturnType<typeof vi.spyOn>;

function Harness() {
  useYoursNowToast();
  const [params] = useSearchParams();
  return <div data-testid="yours">{params.get("yours") ?? "none"}</div>;
}

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
  successSpy = vi.spyOn(toast, "success").mockReturnValue("id");
});
afterEach(() => {
  successSpy.mockRestore();
});

describe("useYoursNowToast", () => {
  it("fires the one-time message and scrubs the flag when ?yours=1 is present", async () => {
    render(
      <MemoryRouter initialEntries={["/vibe/meghan/bloom?yours=1"]}>
        <Harness />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(successSpy).toHaveBeenCalledWith(
        "It's yours now — the original is unchanged.",
        expect.objectContaining({ id: "made-it-yours" })
      )
    );
    await waitFor(() => expect(screen.getByTestId("yours").textContent).toBe("none"));
    expect(successSpy).toHaveBeenCalledOnce();
  });

  it("does nothing when the flag is absent", async () => {
    render(
      <MemoryRouter initialEntries={["/vibe/meghan/bloom"]}>
        <Harness />
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(successSpy).not.toHaveBeenCalled();
  });
});
