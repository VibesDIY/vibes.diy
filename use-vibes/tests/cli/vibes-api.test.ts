import { getCliDashAuth, getCliVibesApiUrl, toCliVibesApiParam } from "../../pkg/commands/vibes-api.js";
import { assertContains, assertTrue } from "./test-helpers.js";

Deno.test("getCliVibesApiUrl: defaults to public API URL", function (): void {
  const url = getCliVibesApiUrl({});
  assertTrue(url === "wss://api.vibes.diy/v1/ws", `expected default URL, got ${url}`);
});

Deno.test("getCliVibesApiUrl: uses VIBES_DIY_API_URL when provided", function (): void {
  const url = getCliVibesApiUrl({ VIBES_DIY_API_URL: "wss://dev.api.example/ws" });
  assertTrue(url === "wss://dev.api.example/ws", `expected override URL, got ${url}`);
});

Deno.test("getCliDashAuth: returns login-required error", async function (): Promise<void> {
  const result = await getCliDashAuth();
  assertTrue(result.isErr(), "default CLI auth should be an error until login ships");
  assertContains(String(result.Err()), "use-vibes login", "error should mention login");
});

Deno.test("toCliVibesApiParam: uses explicit options", async function (): Promise<void> {
  const params = toCliVibesApiParam({
    apiUrl: "wss://custom.example/ws",
    timeoutMs: 1234,
  });

  assertTrue(params.apiUrl === "wss://custom.example/ws", "apiUrl should match explicit option");
  assertTrue(params.timeoutMs === 1234, "timeoutMs should match explicit option");

  const auth = await params.getToken();
  assertTrue(auth.isErr(), "default getToken should still require login");
});
