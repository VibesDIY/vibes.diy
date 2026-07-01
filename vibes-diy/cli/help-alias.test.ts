import { describe, expect, it } from "vitest";
import { normalizeHelpArgv } from "./help-alias.js";

describe("normalizeHelpArgv", () => {
  it("maps a bare `help` to `--help`", () => {
    expect(normalizeHelpArgv(["help"])).toEqual(["--help"]);
  });

  it("maps `help <subcommand>` to `<subcommand> --help`", () => {
    expect(normalizeHelpArgv(["help", "pull"])).toEqual(["pull", "--help"]);
  });

  it("carries extra tokens through before appending --help", () => {
    expect(normalizeHelpArgv(["help", "db", "put"])).toEqual(["db", "put", "--help"]);
  });

  it("leaves a real subcommand untouched", () => {
    expect(normalizeHelpArgv(["pull", "jchris/hat-smeller"])).toEqual(["pull", "jchris/hat-smeller"]);
  });

  it("does not treat `help` in a later position as the alias", () => {
    // Only a LEADING `help` is the alias; `generate "... help ..."` must pass through.
    expect(normalizeHelpArgv(["generate", "help"])).toEqual(["generate", "help"]);
  });

  it("leaves an empty argv untouched", () => {
    expect(normalizeHelpArgv([])).toEqual([]);
  });

  it("returns a fresh array (no aliasing of the caller's argv)", () => {
    const argv = ["pull"];
    expect(normalizeHelpArgv(argv)).not.toBe(argv);
  });
});
