import { describe, expect, it } from "vitest";
import { cmdTsEvento } from "./cmd-evento.js";

describe("cmdTsEvento", () => {
  it("registers the edit command handler", () => {
    const handlers = cmdTsEvento().handlers().actions.map((h) => h.hash);
    expect(handlers).toContain("use-vibes.cli.edit");
  });
});
