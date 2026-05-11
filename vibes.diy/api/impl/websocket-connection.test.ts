import { describe, expect, it } from "vitest";
import { formatWsEvent } from "./websocket-connection.js";

describe("formatWsEvent", () => {
  it("returns strings verbatim", () => {
    expect(formatWsEvent("network down")).toBe("network down");
  });

  it("unwraps ws-library Error-like events to their message", () => {
    expect(formatWsEvent({ message: "ENOTFOUND vibes.diy" })).toBe("ENOTFOUND vibes.diy");
  });

  it("unwraps nested error.message", () => {
    expect(formatWsEvent({ error: { message: "ECONNRESET" }, type: "error" })).toBe("ECONNRESET");
  });

  it("formats close-event style payloads with code + reason", () => {
    expect(formatWsEvent({ code: 1006, reason: "abnormal closure" })).toBe("code=1006 abnormal closure");
  });

  it("falls back to event.type if nothing else is useful", () => {
    expect(formatWsEvent({ type: "error" })).toBe("error");
  });

  it("falls back to JSON for unknown shapes", () => {
    expect(formatWsEvent({ foo: 1 })).toBe('{"foo":1}');
  });

  it("never produces the literal '[object Object]'", () => {
    const cases: unknown[] = [
      "string",
      { message: "m" },
      { error: { message: "m" } },
      { code: 1006, reason: "x" },
      { type: "error" },
      { foo: 1 },
      null,
      undefined,
      42,
    ];
    for (const c of cases) {
      expect(formatWsEvent(c)).not.toBe("[object Object]");
    }
  });
});
