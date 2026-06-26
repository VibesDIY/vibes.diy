import { describe, expect, it } from "vitest";
import { extractJsonStringField } from "../svc/intern/codegen-loop/whole-file-loop.js";

describe("extractJsonStringField unicode handling", () => {
  it("decodes a \\uXXXX escape without throwing", () => {
    const raw = '{"contents":"A\\u0042C"}';
    expect(extractJsonStringField(raw, "contents")).toBe("ABC");
  });
  it("still decodes standard escapes", () => {
    const raw = '{"contents":"line1\\nline2\\t\\"q\\""}';
    expect(extractJsonStringField(raw, "contents")).toBe('line1\nline2\t"q"');
  });
});
