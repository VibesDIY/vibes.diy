import { describe, it, expect } from "vitest";
import { extractExportSource as serverExtract } from "../svc/public/access-function.js";
import { extractExportSource as clientExtract } from "../../vibe/runtime/access-extract.js";

const SOURCES: Array<[string, string]> = [
  [`export function notes(doc, oldDoc, user, ctx) { return { channels: ["n"] }; }`, "notes"],
  [`export default function (doc) { return {}; }`, "*"],
  [`export default (doc) => { return { channels: ["c"] }; }`, "*"],
  [`function chat(doc) { return {}; }\nexport { chat as "chat-db" }`, "chat-db"],
  [`export function a(){return{}}\nexport function b(){return{channels:["x"]}}`, "b"],
];

describe("extractor parity: runtime port === server", () => {
  for (const [src, db] of SOURCES) {
    it(`matches for db="${db}"`, () => {
      expect(clientExtract(src, db)).toBe(serverExtract(src, db));
    });
  }
});
