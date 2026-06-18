import { describe, it, expect } from "vitest";
import { __resetFireproofForTesting, fireproof } from "../base/fireproof-node.js";

// Regression guard for #2444: opening a db with an unreachable apiUrl triggers
// several fire-and-forget background connection attempts (grant reactivity,
// resubscribe, onMsg registration). If any of those don't handle the
// connection's rejection, it surfaces as an unhandled rejection that fails the
// whole `pnpm test` run (exit 1) even though every test passes. This asserts
// none escape.
describe("fireproof() (node) — bad apiUrl", () => {
  it("does not produce unhandled rejections", async () => {
    const seen: unknown[] = [];
    const onUnhandled = (reason: unknown) => seen.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const opts = {
        apiUrl: "ws://test.invalid",
        appSlug: "my-app",
        getToken: (async () => ({
          isOk: () => true,
          Ok: () => ({ type: "device-id", token: "t" }),
          isErr: () => false,
        })) as never,
      };
      __resetFireproofForTesting();
      fireproof("a", opts);
      fireproof("b", opts);
      __resetFireproofForTesting();
      fireproof("todos", opts);
      // Let the async DNS failures and any reconnect attempts settle.
      await new Promise((r) => setTimeout(r, 3000));
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
    expect(seen).toHaveLength(0);
  });
});
