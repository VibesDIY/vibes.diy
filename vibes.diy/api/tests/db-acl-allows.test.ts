import { describe, it, expect } from "vitest";
import { aclAllows } from "@vibes.diy/vibe-runtime";

describe("aclAllows (client port)", () => {
  it("falls back to canRead when ACL has no read entry", () => {
    expect(aclAllows(undefined, "read", "override")).toBe(true);
    expect(aclAllows(undefined, "read", "viewer")).toBe(true);
    expect(aclAllows(undefined, "read", "submitter")).toBe(false);
    expect(aclAllows(undefined, "read", "none")).toBe(false);
  });

  it("falls back to canWrite when ACL has no write entry", () => {
    expect(aclAllows(undefined, "write", "override")).toBe(true);
    expect(aclAllows(undefined, "write", "submitter")).toBe(true);
    expect(aclAllows(undefined, "write", "viewer")).toBe(false);
    expect(aclAllows(undefined, "write", "none")).toBe(false);
  });

  it("members group includes editor/viewer/submitter (and owner implicitly)", () => {
    expect(aclAllows({ write: ["members"] }, "write", "viewer")).toBe(true);
    expect(aclAllows({ write: ["members"] }, "write", "override")).toBe(true);
    expect(aclAllows({ write: ["members"] }, "write", "none")).toBe(false);
  });

  it("editors group is editor + owner", () => {
    expect(aclAllows({ write: ["editors"] }, "write", "editor")).toBe(true);
    expect(aclAllows({ write: ["editors"] }, "write", "viewer")).toBe(false);
    expect(aclAllows({ write: ["editors"] }, "write", "override")).toBe(true);
  });

  it("submitters group is submitter + owner", () => {
    expect(aclAllows({ write: ["submitters"] }, "write", "submitter")).toBe(true);
    expect(aclAllows({ write: ["submitters"] }, "write", "viewer")).toBe(false);
  });

  it("readers group is editor + viewer + owner", () => {
    expect(aclAllows({ read: ["readers"] }, "read", "viewer")).toBe(true);
    expect(aclAllows({ read: ["readers"] }, "read", "submitter")).toBe(false);
  });

  it("owner-as-editor (admin off): submitters-only write denies editor", () => {
    expect(aclAllows({ write: ["submitters"] }, "write", "editor")).toBe(false);
  });

  it("owner-as-editor (admin off): editors group allows editor", () => {
    expect(aclAllows({ write: ["editors"] }, "write", "editor")).toBe(true);
  });

  it("owner-as-editor (admin off): members group allows editor", () => {
    expect(aclAllows({ write: ["members"] }, "write", "editor")).toBe(true);
  });
});
