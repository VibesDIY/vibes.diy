import { describe, expect, it } from "vitest";
import { applyQueryFilter } from "../svc/public/app-documents.js";

type Doc = { _id: string } & Record<string, unknown>;

const docs: Doc[] = [
  { _id: "1", status: "active", count: 3 },
  { _id: "2", status: "inactive", count: 7 },
  { _id: "3", status: "active", count: 1 },
  { _id: "4", status: "pending", count: 5 },
];

describe("applyQueryFilter", () => {
  it("returns all docs when filter is undefined", () => {
    expect(applyQueryFilter(docs, undefined)).toHaveLength(4);
  });

  it("key: returns only docs where field equals value", () => {
    const result = applyQueryFilter(docs, { field: "status", key: "active" });
    expect(result).toHaveLength(2);
    expect(result.map((d) => d._id).sort()).toEqual(["1", "3"]);
  });

  it("key: returns empty when no doc matches", () => {
    const result = applyQueryFilter(docs, { field: "status", key: "archived" });
    expect(result).toHaveLength(0);
  });

  it("keys: returns docs where field is in the set", () => {
    const result = applyQueryFilter(docs, { field: "status", keys: ["active", "pending"] });
    expect(result.map((d) => d._id).sort()).toEqual(["1", "3", "4"]);
  });

  it("range: returns docs where field value is within [lo, hi] inclusive", () => {
    const result = applyQueryFilter(docs, { field: "count", range: [3, 6] });
    expect(result.map((d) => d._id).sort()).toEqual(["1", "4"]);
  });

  it("range: string range uses lexicographic comparison", () => {
    const result = applyQueryFilter(docs, { field: "status", range: ["active", "inactive"] });
    expect(result.map((d) => d._id).sort()).toEqual(["1", "2", "3"]);
  });

  it("excludes docs where the field is missing", () => {
    const withMissing: Doc[] = [{ _id: "5" }, ...docs];
    const result = applyQueryFilter(withMissing, { field: "status", key: "active" });
    expect(result.find((d) => d._id === "5")).toBeUndefined();
  });

  it("dedup correctness: operates on already-deduped docs (latest revision value visible)", () => {
    const postDedup: Doc[] = [{ _id: "doc-1", status: "active" }];
    const result = applyQueryFilter(postDedup, { field: "status", key: "active" });
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("doc-1");
  });
});
