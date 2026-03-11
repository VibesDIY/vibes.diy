import { describe, expect, it } from "vitest";
import { resolveTarget } from "../../pkg/commands/resolve-target.js";

const ctx = { app: "my-app", handle: "jchris" };

describe("resolveTarget", () => {
  it("no arg resolves to default group", () => {
    const result = resolveTarget(ctx);
    expect(result.isOk()).toBe(true);
    const target = result.Ok();
    expect(target.full).toBe("jchris/my-app/default");
    expect(target.group).toBe("default");
  });

  it("bare name resolves to handle/app/group", () => {
    const result = resolveTarget(ctx, "work-lunch");
    expect(result.isOk()).toBe(true);
    const target = result.Ok();
    expect(target.full).toBe("jchris/my-app/work-lunch");
    expect(target.handle).toBe("jchris");
    expect(target.app).toBe("my-app");
    expect(target.group).toBe("work-lunch");
  });

  it("fully qualified is used as-is", () => {
    const result = resolveTarget(ctx, "alice/soup/team");
    expect(result.isOk()).toBe(true);
    const target = result.Ok();
    expect(target.full).toBe("alice/soup/team");
    expect(target.handle).toBe("alice");
    expect(target.app).toBe("soup");
    expect(target.group).toBe("team");
  });

  it("one slash resolves to handle/app/group", () => {
    const result = resolveTarget(ctx, "my-app-newname/some-group");
    expect(result.isOk()).toBe(true);
    const target = result.Ok();
    expect(target.full).toBe("jchris/my-app-newname/some-group");
    expect(target.handle).toBe("jchris");
    expect(target.app).toBe("my-app-newname");
    expect(target.group).toBe("some-group");
  });

  it("one slash overrides ctx.app", () => {
    const result = resolveTarget(ctx, "other-app/dev");
    expect(result.isOk()).toBe(true);
    const target = result.Ok();
    expect(target.app).toBe("other-app");
    expect(target.group).toBe("dev");
    expect(target.handle).toBe("jchris");
  });

  it("three slashes is invalid", () => {
    const result = resolveTarget(ctx, "a/b/c/d");
    expect(result.isErr()).toBe(true);
  });

  it("empty segments in qualified target are invalid", () => {
    expect(resolveTarget(ctx, "a//c").isErr()).toBe(true);
    expect(resolveTarget(ctx, "/b/c").isErr()).toBe(true);
    expect(resolveTarget(ctx, "a/b/").isErr()).toBe(true);
  });

  it("empty string is invalid", () => {
    const result = resolveTarget(ctx, "");
    expect(result.isErr()).toBe(true);
  });

  it("leading slash is invalid", () => {
    const result = resolveTarget(ctx, "/foo");
    expect(result.isErr()).toBe(true);
  });

  it("trailing slash is invalid", () => {
    const result = resolveTarget(ctx, "foo/");
    expect(result.isErr()).toBe(true);
  });
});
