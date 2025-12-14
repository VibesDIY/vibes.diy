import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unstable_dev, UnstableDevWorker } from "wrangler";

/**
 * DurableDatabase integration tests using wrangler's unstable_dev
 *
 * These tests spin up a real worker with proper bundling to test
 * the Durable Object with SQLite storage via Drizzle ORM.
 */
describe("DurableDatabase", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("../../pkg/src/index.ts", {
      config: "../../pkg/wrangler.jsonc",
      experimental: {
        disableExperimentalWarning: true,
      },
    });
  });

  afterAll(async () => {
    await worker?.stop();
  });

  // Helper to call the worker's DO test endpoint
  async function callDO(
    userId: string,
    method: string,
    body?: Record<string, unknown>,
    query?: string,
  ): Promise<Response> {
    const url = `http://localhost/__test/do/${userId}/${method}${query ? `?${query}` : ""}`;
    return worker.fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  describe("recordGeneration", () => {
    it("should record a new generation and return aggregates", async () => {
      const userId = `test-user-${Date.now()}`;
      const response = await callDO(userId, "recordGeneration", {
        id: "gen-test-123",
        model: "openai/gpt-4o-mini",
        cost: 0.05,
        tokensPrompt: 1000,
        tokensCompletion: 500,
        createdAt: Math.floor(Date.now() / 1000),
      });

      expect(response.status).toBe(200);
      const aggregates = await response.json();

      expect(aggregates.daily.cost).toBe(0.05);
      expect(aggregates.daily.tokensPrompt).toBe(1000);
      expect(aggregates.daily.tokensCompletion).toBe(500);
      expect(aggregates.monthly.cost).toBe(0.05);
    });

    it("should accumulate multiple generations", async () => {
      const userId = `test-user-accumulate-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      // First generation
      await callDO(userId, "recordGeneration", {
        id: "gen-first",
        model: "openai/gpt-4o-mini",
        cost: 0.03,
        tokensPrompt: 500,
        tokensCompletion: 200,
        createdAt: now,
      });

      // Second generation
      const response = await callDO(userId, "recordGeneration", {
        id: "gen-second",
        model: "openai/gpt-4o",
        cost: 0.07,
        tokensPrompt: 800,
        tokensCompletion: 400,
        createdAt: now,
      });

      expect(response.status).toBe(200);
      const aggregates = await response.json();

      expect(aggregates.daily.cost).toBeCloseTo(0.1);
      expect(aggregates.daily.tokensPrompt).toBe(1300);
      expect(aggregates.daily.tokensCompletion).toBe(600);
    });

    it("should be idempotent for same generation ID (queue retries)", async () => {
      const userId = `test-user-idempotent-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      const genData = {
        id: "gen-duplicate",
        model: "openai/gpt-4o-mini",
        cost: 0.05,
        tokensPrompt: 1000,
        tokensCompletion: 500,
        createdAt: now,
      };

      // First record
      await callDO(userId, "recordGeneration", genData);

      // Same generation ID again (simulating retry)
      const response = await callDO(userId, "recordGeneration", genData);

      expect(response.status).toBe(200);
      const aggregates = await response.json();

      // Should not double-count
      expect(aggregates.daily.cost).toBe(0.05);
      expect(aggregates.daily.tokensPrompt).toBe(1000);
    });

    it("should handle different users with isolated databases", async () => {
      const now = Math.floor(Date.now() / 1000);

      const user1 = `user-1-${Date.now()}`;
      const user2 = `user-2-${Date.now()}`;

      // User 1 records
      await callDO(user1, "recordGeneration", {
        id: "gen-user1",
        model: "openai/gpt-4o",
        cost: 0.1,
        tokensPrompt: 2000,
        tokensCompletion: 1000,
        createdAt: now,
      });

      // User 2 records
      await callDO(user2, "recordGeneration", {
        id: "gen-user2",
        model: "openai/gpt-4o-mini",
        cost: 0.02,
        tokensPrompt: 500,
        tokensCompletion: 200,
        createdAt: now,
      });

      // Check user 1 aggregates
      const user1Response = await callDO(user1, "getAggregates");
      const user1Aggregates = await user1Response.json();
      expect(user1Aggregates.daily.cost).toBe(0.1);

      // Check user 2 aggregates - should be isolated
      const user2Response = await callDO(user2, "getAggregates");
      const user2Aggregates = await user2Response.json();
      expect(user2Aggregates.daily.cost).toBe(0.02);
    });
  });

  describe("getAggregates", () => {
    it("should return zero for new user with no generations", async () => {
      const userId = `new-user-${Date.now()}`;
      const response = await callDO(userId, "getAggregates");

      expect(response.status).toBe(200);
      const aggregates = await response.json();

      expect(aggregates.daily.cost).toBe(0);
      expect(aggregates.daily.tokensPrompt).toBe(0);
      expect(aggregates.daily.tokensCompletion).toBe(0);
      expect(aggregates.monthly.cost).toBe(0);
    });

    it("should calculate daily aggregates correctly", async () => {
      const userId = `daily-test-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      // Add multiple generations
      await callDO(userId, "recordGeneration", {
        id: "gen-1",
        model: "openai/gpt-4o",
        cost: 0.15,
        tokensPrompt: 3000,
        tokensCompletion: 1500,
        createdAt: now,
      });

      await callDO(userId, "recordGeneration", {
        id: "gen-2",
        model: "anthropic/claude-3.5-sonnet",
        cost: 0.25,
        tokensPrompt: 5000,
        tokensCompletion: 2500,
        createdAt: now,
      });

      const response = await callDO(userId, "getAggregates");
      const aggregates = await response.json();

      expect(aggregates.daily.cost).toBeCloseTo(0.4);
      expect(aggregates.daily.tokensPrompt).toBe(8000);
      expect(aggregates.daily.tokensCompletion).toBe(4000);
    });
  });

  describe("getGenerations", () => {
    it("should return empty array for new user", async () => {
      const userId = `no-generations-${Date.now()}`;
      const response = await callDO(userId, "getGenerations");

      expect(response.status).toBe(200);
      const generations = await response.json();

      expect(generations).toEqual([]);
    });

    it("should return generations in descending order by createdAt", async () => {
      const userId = `ordered-generations-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      // Add generations with different timestamps
      await callDO(userId, "recordGeneration", {
        id: "gen-old",
        model: "openai/gpt-4o-mini",
        cost: 0.01,
        tokensPrompt: 100,
        tokensCompletion: 50,
        createdAt: now - 3600, // 1 hour ago
      });

      await callDO(userId, "recordGeneration", {
        id: "gen-new",
        model: "openai/gpt-4o",
        cost: 0.05,
        tokensPrompt: 500,
        tokensCompletion: 250,
        createdAt: now,
      });

      await callDO(userId, "recordGeneration", {
        id: "gen-middle",
        model: "anthropic/claude-3.5-sonnet",
        cost: 0.03,
        tokensPrompt: 300,
        tokensCompletion: 150,
        createdAt: now - 1800, // 30 minutes ago
      });

      const response = await callDO(userId, "getGenerations");
      const generations = await response.json();

      expect(generations).toHaveLength(3);
      expect(generations[0].id).toBe("gen-new");
      expect(generations[1].id).toBe("gen-middle");
      expect(generations[2].id).toBe("gen-old");
    });

    it("should respect limit parameter", async () => {
      const userId = `limited-generations-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      // Add 5 generations
      for (let i = 0; i < 5; i++) {
        await callDO(userId, "recordGeneration", {
          id: `gen-${i}`,
          model: "openai/gpt-4o-mini",
          cost: 0.01,
          tokensPrompt: 100,
          tokensCompletion: 50,
          createdAt: now - i * 60,
        });
      }

      const response = await callDO(
        userId,
        "getGenerations",
        undefined,
        "limit=2",
      );
      const generations = await response.json();

      expect(generations).toHaveLength(2);
    });

    it("should respect offset parameter for pagination", async () => {
      const userId = `paginated-generations-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      // Add 5 generations
      for (let i = 0; i < 5; i++) {
        await callDO(userId, "recordGeneration", {
          id: `gen-${i}`,
          model: "openai/gpt-4o-mini",
          cost: 0.01,
          tokensPrompt: 100,
          tokensCompletion: 50,
          createdAt: now - i * 60,
        });
      }

      // Get second page (skip first 2)
      const response = await callDO(
        userId,
        "getGenerations",
        undefined,
        "limit=2&offset=2",
      );
      const generations = await response.json();

      expect(generations).toHaveLength(2);
      expect(generations[0].id).toBe("gen-2");
      expect(generations[1].id).toBe("gen-3");
    });
  });

  describe("schema and edge cases", () => {
    it("should store all generation fields correctly", async () => {
      const userId = `full-fields-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      await callDO(userId, "recordGeneration", {
        id: "gen-full-test",
        model: "google/gemini-2.0-flash",
        cost: 0.123456,
        tokensPrompt: 12345,
        tokensCompletion: 6789,
        createdAt: now,
      });

      const response = await callDO(
        userId,
        "getGenerations",
        undefined,
        "limit=1",
      );
      const generations = await response.json();

      expect(generations[0]).toMatchObject({
        id: "gen-full-test",
        model: "google/gemini-2.0-flash",
        cost: 0.123456,
        tokensPrompt: 12345,
        tokensCompletion: 6789,
      });
    });

    it("should handle zero cost and tokens", async () => {
      const userId = `zero-values-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      const response = await callDO(userId, "recordGeneration", {
        id: "gen-zero",
        model: "test/free-model",
        cost: 0,
        tokensPrompt: 0,
        tokensCompletion: 0,
        createdAt: now,
      });

      expect(response.status).toBe(200);
      const aggregates = await response.json();

      expect(aggregates.daily.cost).toBe(0);
      expect(aggregates.daily.tokensPrompt).toBe(0);
    });

    it("should handle very small cost values accurately", async () => {
      const userId = `small-costs-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      await callDO(userId, "recordGeneration", {
        id: "gen-tiny-1",
        model: "openai/gpt-4o-mini",
        cost: 0.000001,
        tokensPrompt: 10,
        tokensCompletion: 5,
        createdAt: now,
      });

      await callDO(userId, "recordGeneration", {
        id: "gen-tiny-2",
        model: "openai/gpt-4o-mini",
        cost: 0.000002,
        tokensPrompt: 20,
        tokensCompletion: 10,
        createdAt: now,
      });

      const response = await callDO(userId, "getAggregates");
      const aggregates = await response.json();

      expect(aggregates.daily.cost).toBeCloseTo(0.000003, 6);
    });
  });
});
