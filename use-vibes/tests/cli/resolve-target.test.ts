import { resolveTarget } from "../../pkg/commands/resolve-target.js";
import { assertTrue } from "./test-helpers.js";

const ctx = { app: "my-app", handle: "jchris" };

// `use-vibes publish` with no target — deploys to the default group (shortest URL)
Deno.test("resolveTarget: no arg resolves to default group", function (): void {
  const result = resolveTarget(ctx);
  assertTrue(result.isOk(), "should resolve");
  const t = result.Ok();
  assertTrue(t.full === "jchris/my-app/default", `expected jchris/my-app/default, got ${t.full}`);
  assertTrue(t.group === "default", "group should be default");
});

// `use-vibes live work-lunch` — deploys to a named group under the current user's app
Deno.test("resolveTarget: bare name resolves to handle/app/group", function (): void {
  const result = resolveTarget(ctx, "work-lunch");
  assertTrue(result.isOk(), "should resolve");
  const t = result.Ok();
  assertTrue(t.full === "jchris/my-app/work-lunch", `expected jchris/my-app/work-lunch, got ${t.full}`);
  assertTrue(t.handle === "jchris", "handle should be jchris");
  assertTrue(t.app === "my-app", "app should be my-app");
  assertTrue(t.group === "work-lunch", "group should be work-lunch");
});

// `use-vibes publish alice/soup/team` — cross-user deploy (requires membership.deploy on alice's group)
Deno.test("resolveTarget: fully qualified used as-is", function (): void {
  const result = resolveTarget(ctx, "alice/soup/team");
  assertTrue(result.isOk(), "should resolve");
  const t = result.Ok();
  assertTrue(t.full === "alice/soup/team", `expected alice/soup/team, got ${t.full}`);
  assertTrue(t.handle === "alice", "handle should be alice");
  assertTrue(t.app === "soup", "app should be soup");
  assertTrue(t.group === "team", "group should be team");
});

// `use-vibes publish my-app-newname/some-group` — one slash is app/group, handle comes from context
Deno.test("resolveTarget: one slash resolves to handle/app/group", function (): void {
  const result = resolveTarget(ctx, "my-app-newname/some-group");
  assertTrue(result.isOk(), "should resolve");
  const t = result.Ok();
  assertTrue(t.full === "jchris/my-app-newname/some-group", `expected jchris/my-app-newname/some-group, got ${t.full}`);
  assertTrue(t.handle === "jchris", "handle should come from context");
  assertTrue(t.app === "my-app-newname", "app should be my-app-newname");
  assertTrue(t.group === "some-group", "group should be some-group");
});

// `use-vibes publish other-app/dev` — overrides the vibes.json app name with the one from the target
Deno.test("resolveTarget: one slash overrides ctx.app", function (): void {
  const result = resolveTarget(ctx, "other-app/dev");
  assertTrue(result.isOk(), "should resolve");
  const t = result.Ok();
  assertTrue(t.app === "other-app", `app should be other-app, got ${t.app}`);
  assertTrue(t.group === "dev", `group should be dev, got ${t.group}`);
  assertTrue(t.handle === "jchris", "handle should still come from context");
});

// too many segments — not a valid target format
Deno.test("resolveTarget: three slashes is invalid", function (): void {
  const result = resolveTarget(ctx, "a/b/c/d");
  assertTrue(result.isErr(), "three slashes should be invalid");
});

// `a//c` has the right slash count but an empty app — don't leak invalid targets to deploy
Deno.test("resolveTarget: empty segments in qualified target is invalid", function (): void {
  const result = resolveTarget(ctx, "a//c");
  assertTrue(result.isErr(), "empty segment should be invalid");
  const result2 = resolveTarget(ctx, "/b/c");
  assertTrue(result2.isErr(), "empty handle should be invalid");
  const result3 = resolveTarget(ctx, "a/b/");
  assertTrue(result3.isErr(), "empty group should be invalid");
});

// explicit empty string is not the same as undefined (no arg)
Deno.test("resolveTarget: empty string is invalid", function (): void {
  const result = resolveTarget(ctx, "");
  assertTrue(result.isErr(), "empty string should be invalid");
});

// leading slash looks like an absolute path, not a target
Deno.test("resolveTarget: leading slash is invalid", function (): void {
  const result = resolveTarget(ctx, "/foo");
  assertTrue(result.isErr(), "leading slash should be invalid");
});

// trailing slash is a typo, not a valid bare group name
Deno.test("resolveTarget: trailing slash is invalid", function (): void {
  const result = resolveTarget(ctx, "foo/");
  assertTrue(result.isErr(), "trailing slash should be invalid");
});
