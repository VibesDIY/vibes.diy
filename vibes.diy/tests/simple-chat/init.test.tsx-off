import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createWrapper } from "./setup.js";
import { useSimpleChat } from "~/vibes.diy/app/hooks/useSimpleChat.js";

describe("useSimpleChat", () => {
  it("initializes with expected mock messages", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSimpleChat("test-session-id"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.docs.length).toBeGreaterThan(0));
  });
});
