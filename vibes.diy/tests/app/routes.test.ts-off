import { describe, it, expect, vi } from "vitest";

// Mock React Router dev routes before importing
vi.mock("@react-router/dev/routes", () => ({
  index: (file: string) => ({ type: "index", file }),
  route: (path: string, file: string, options?: Record<string, unknown>) => ({
    type: "route",
    path,
    file,
    ...options,
  }),
}));

import routes from "~/vibes.diy/app/routes.js";

describe("Routes", () => {
  it("defines the correct routes", () => {
    // Check that routes is an array
    expect(Array.isArray(routes)).toBe(true);

    // Check that there is at least one route defined
    expect(routes.length).toBeGreaterThan(0);

    // Check that the index route is defined
    const indexRoute = routes[0];
    expect(indexRoute).toBeDefined();

    // Check that the route has a file property that includes unified-session.tsx
    expect(indexRoute).toHaveProperty("file");
    expect(indexRoute.file).toContain("home.tsx");
  });
});
