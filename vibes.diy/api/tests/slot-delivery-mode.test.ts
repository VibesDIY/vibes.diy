import { describe, it, expect } from "vitest";
import { renderSlotMessagesAs } from "../svc/intern/slot-assembler.js";

describe("renderSlotMessagesAs", () => {
  it("renderSlotMessagesAs('user') emits role:user messages", () => {
    const r = renderSlotMessagesAs([{ role: "user", label: "ORIGINAL", text: "..." }], "user");
    expect(r[0].role).toBe("user");
    expect(r).toHaveLength(1);
  });

  it("renderSlotMessagesAs('system') concatenates into a single role:system message", () => {
    const r = renderSlotMessagesAs(
      [
        { role: "user", label: "ORIGINAL", text: "A" },
        { role: "user", label: "PREVIOUS", text: "B" },
      ],
      "system"
    );
    expect(r).toHaveLength(1);
    expect(r[0].role).toBe("system");
    expect(r[0].content[0].text).toContain("A");
    expect(r[0].content[0].text).toContain("B");
  });
});
