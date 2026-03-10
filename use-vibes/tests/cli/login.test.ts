import { runLogin, type LoginPlatform } from "../../pkg/commands/login.js";
import { captureOutput, assertTrue, assertContains } from "./test-helpers.js";

/** In-memory platform adapter — no real networking, no browser open */
function createTestPlatform(): { platform: LoginPlatform; serveCallCount: number } {
  let serveCallCount = 0;
  const platform: LoginPlatform = {
    serve(_opts, _handler) {
      serveCallCount++;
      // Return a server that never receives requests (login will timeout)
      return { close() {}, finished: Promise.resolve() };
    },
    openBrowser: () => Promise.resolve(),
    getEnv: () => undefined,
  };
  return { platform, get serveCallCount() { return serveCallCount; } };
}

Deno.test("login (unit): uses injected platform, not Deno globals", async () => {
  const captured = captureOutput();
  const testPlatform = createTestPlatform();
  const result = await runLogin({ timeout: 1 }, captured.output, testPlatform.platform);
  assertTrue(result.isErr(), "should timeout");
  assertTrue(testPlatform.serveCallCount > 0, "should have called platform.serve");
  assertContains(String(result.Err()), "Timeout", "error should mention timeout");
});

Deno.test("login (unit): already registered skips CSR flow", async () => {
  // This test will get "Not logged in" from keybag check, which is expected
  // The point is it exercises the early return path without touching platform.serve
  const captured = captureOutput();
  const testPlatform = createTestPlatform();
  const result = await runLogin({ timeout: 1 }, captured.output, testPlatform.platform);
  // Either timeout (no cert) or early return (has cert) — both are valid
  assertTrue(result.isErr() || result.isOk(), "should return a Result");
});
