import { describe, it, expect } from "vitest";
import { extractExportSource as serverExtract } from "../svc/public/access-function.js";
import { extractExportSource as clientExtract } from "../../vibe/runtime/access-extract.js";
import { evaluateWrite } from "../../vibe/runtime/access-runner.js";

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

// Channel-gated write: only channel members may post; anon hits requireAccess.
const channelDb = `export function db(doc, oldDoc, user, ctx) {
  if (doc.type === "msg") { ctx.requireAccess(doc.channelId); return { channels: [doc.channelId] }; }
  throw { forbidden: "unknown document type" };
}`;
const member = { userHandle: "m", isOwner: false };
const grants = (chs: string[]) => ({ channels: chs, publicChannels: [], roles: [] });

describe("verdict parity matrix", () => {
  it("member in channel → ok", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "msg", channelId: "eng" },
        oldDoc: null,
        user: member,
        grants: grants(["eng"]),
        adminMode: false,
      })
    ).toEqual({ ok: true });
  });
  it("non-member → not in channel", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "msg", channelId: "eng" },
        oldDoc: null,
        user: member,
        grants: grants([]),
        adminMode: false,
      })
    ).toEqual({ ok: false, reason: "not in channel: eng", code: "access-denied" });
  });
  it("anon at a requireAccess gate → authentication required", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "msg", channelId: "eng" },
        oldDoc: null,
        user: null,
        grants: grants([]),
        adminMode: false,
      })
    ).toEqual({ ok: false, reason: "authentication required", code: "access-denied" });
  });
  it("adminMode bypasses the channel gate", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "msg", channelId: "eng" },
        oldDoc: null,
        user: member,
        grants: grants([]),
        adminMode: true,
      })
    ).toEqual({ ok: true });
  });
  it("unknown doc type → its own forbidden reason", () => {
    expect(
      evaluateWrite({
        source: channelDb,
        dbName: "db",
        doc: { type: "other" },
        oldDoc: null,
        user: member,
        grants: grants(["eng"]),
        adminMode: false,
      })
    ).toEqual({ ok: false, reason: "unknown document type", code: "access-denied" });
  });
});
