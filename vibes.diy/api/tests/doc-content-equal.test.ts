import { describe, expect, it } from "vitest";
import { docContentEqual } from "@vibes.diy/api-svc";

// Unit coverage for the content-equality predicate that lets putDoc absorb a
// content-identical re-put into a no-op (issue #2644).
describe("docContentEqual (#2644)", () => {
  it("treats objects with the same content but different key order as equal", () => {
    expect(docContentEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("ignores the _id field (carried out-of-band as the docId column)", () => {
    expect(docContentEqual({ _id: "x", title: "hi" }, { title: "hi" })).toBe(true);
    expect(docContentEqual({ _id: "x", title: "hi" }, { _id: "y", title: "hi" })).toBe(true);
  });

  it("returns false when any content field differs", () => {
    expect(docContentEqual({ title: "hi" }, { title: "bye" })).toBe(false);
    expect(docContentEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("compares nested objects and arrays deeply, key-order independent", () => {
    const a = { grant: { users: { alice: ["c1", "c2"] }, roles: { owner: ["c1"] } } };
    const b = { grant: { roles: { owner: ["c1"] }, users: { alice: ["c1", "c2"] } } };
    expect(docContentEqual(a, b)).toBe(true);
    // array order IS significant
    expect(docContentEqual({ ch: ["a", "b"] }, { ch: ["b", "a"] })).toBe(false);
  });

  it("compares _files attachments by their stored uploadId/CID reference", () => {
    const a = { _files: { pic: { uploadId: "up-123", size: 10 } }, caption: "x" };
    const b = { caption: "x", _files: { pic: { uploadId: "up-123", size: 10 } } };
    expect(docContentEqual(a, b)).toBe(true);
    const c = { _files: { pic: { uploadId: "up-999", size: 10 } }, caption: "x" };
    expect(docContentEqual(a, c)).toBe(false);
  });

  it("ignores the read-only minted _files.<key>.url (added on read, not content)", () => {
    // stored shape (no url) vs returned/round-tripped shape (with the derived
    // url) must compare equal — the url is a pure function of uploadId.
    const stored = { _files: { pic: { uploadId: "up-123", type: "image/png", size: 10 } } };
    const returned = {
      _files: {
        pic: { uploadId: "up-123", type: "image/png", size: 10, url: "https://assets.example/_files/o/a/db/d/pic?v=up-123" },
      },
    };
    expect(docContentEqual(stored, returned)).toBe(true);
    // a different url with the SAME identity fields is still equal…
    const otherUrl = { _files: { pic: { uploadId: "up-123", type: "image/png", size: 10, url: "https://other/host" } } };
    expect(docContentEqual(stored, otherUrl)).toBe(true);
    // …but a changed uploadId (real attachment swap) is NOT absorbed.
    const swapped = { _files: { pic: { uploadId: "up-999", type: "image/png", size: 10, url: "https://other/host" } } };
    expect(docContentEqual(stored, swapped)).toBe(false);
    // a non-url field change (e.g. size) is still a real change.
    const resized = { _files: { pic: { uploadId: "up-123", type: "image/png", size: 11 } } };
    expect(docContentEqual(stored, resized)).toBe(false);
  });

  it("distinguishes null from absent and from other falsy values", () => {
    expect(docContentEqual({ a: null }, {})).toBe(false);
    expect(docContentEqual({ a: null }, { a: 0 })).toBe(false);
    expect(docContentEqual({ a: false }, { a: 0 })).toBe(false);
  });

  it("treats an undefined-valued key as absent (matches JSON semantics)", () => {
    expect(docContentEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
});
