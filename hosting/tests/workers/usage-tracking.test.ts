import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unstable_dev, UnstableDevWorker } from "wrangler";

/**
 * Usage Tracking integration tests
 *
 * Tests the flow from DurableDatabase to KV aggregates,
 * simulating what the queue consumer does.
 */
describe("Usage Tracking Integration", () => {
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
  ): Promise<Response> {
    return worker.fetch(`http://localhost/__test/do/${userId}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  describe("Idempotency for queue retries", () => {
    it("should not double-count on retry", async () => {
      const userId = `idempotent-test-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      const generationData = {
        id: "gen-retry-test",
        model: "openai/gpt-4o-mini",
        cost: 0.05,
        tokensPrompt: 1000,
        tokensCompletion: 500,
        createdAt: now,
      };

      // First attempt
      await callDO(userId, "recordGeneration", generationData);

      // Simulated retry (same generation ID)
      await callDO(userId, "recordGeneration", generationData);

      // Third attempt (same generation ID)
      const response = await callDO(userId, "recordGeneration", generationData);
      const aggregates = await response.json();

      // Should only count once
      expect(aggregates.daily.cost).toBe(0.05);
      expect(aggregates.daily.tokensPrompt).toBe(1000);
    });

    it("should update values if retry has different data", async () => {
      const userId = `retry-update-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      // First record
      await callDO(userId, "recordGeneration", {
        id: "gen-update-test",
        model: "openai/gpt-4o-mini",
        cost: 0.03,
        tokensPrompt: 500,
        tokensCompletion: 200,
        createdAt: now,
      });

      // Update with corrected cost (same ID)
      const response = await callDO(userId, "recordGeneration", {
        id: "gen-update-test",
        model: "openai/gpt-4o-mini",
        cost: 0.05, // Corrected cost
        tokensPrompt: 1000, // Corrected tokens
        tokensCompletion: 500,
        createdAt: now,
      });

      const aggregates = await response.json();

      // Should have updated values
      expect(aggregates.daily.cost).toBe(0.05);
      expect(aggregates.daily.tokensPrompt).toBe(1000);
    });
  });

  describe("User isolation", () => {
    it("should maintain separate databases per user", async () => {
      const now = Math.floor(Date.now() / 1000);

      const users = [
        `user-isolation-1-${Date.now()}`,
        `user-isolation-2-${Date.now()}`,
        `user-isolation-3-${Date.now()}`,
      ];

      // Each user gets different usage
      for (let i = 0; i < users.length; i++) {
        await callDO(users[i], "recordGeneration", {
          id: `gen-${users[i]}`,
          model: "openai/gpt-4o",
          cost: (i + 1) * 0.1, // $0.10, $0.20, $0.30
          tokensPrompt: (i + 1) * 1000,
          tokensCompletion: (i + 1) * 500,
          createdAt: now,
        });
      }

      // Verify each user has their own data
      for (let i = 0; i < users.length; i++) {
        const response = await callDO(users[i], "getAggregates");
        const aggregates = await response.json();
        expect(aggregates.daily.cost).toBeCloseTo((i + 1) * 0.1);
        expect(aggregates.daily.tokensPrompt).toBe((i + 1) * 1000);
      }
    });

    it("should not leak data between users", async () => {
      const now = Math.floor(Date.now() / 1000);

      const user1 = `leak-test-1-${Date.now()}`;
      const user2 = `leak-test-2-${Date.now()}`;

      // User 1 has high usage
      await callDO(user1, "recordGeneration", {
        id: "gen-high-usage",
        model: "openai/gpt-4o",
        cost: 50.0, // $50
        tokensPrompt: 100000,
        tokensCompletion: 50000,
        createdAt: now,
      });

      // User 2 has no usage - get aggregates
      const user2Response = await callDO(user2, "getAggregates");
      const user2Aggregates = await user2Response.json();

      // User 2 should see zero
      expect(user2Aggregates.daily.cost).toBe(0);
      expect(user2Aggregates.monthly.cost).toBe(0);
    });
  });

  describe("Accumulation across multiple generations", () => {
    it("should accumulate cost and tokens correctly", async () => {
      const userId = `accumulate-test-${Date.now()}`;
      const now = Math.floor(Date.now() / 1000);

      // First generation
      await callDO(userId, "recordGeneration", {
        id: "gen-acc-1",
        model: "openai/gpt-4o-mini",
        cost: 0.03,
        tokensPrompt: 500,
        tokensCompletion: 200,
        createdAt: now,
      });

      // Second generation
      const response = await callDO(userId, "recordGeneration", {
        id: "gen-acc-2",
        model: "openai/gpt-4o",
        cost: 0.07,
        tokensPrompt: 800,
        tokensCompletion: 400,
        createdAt: now,
      });

      const aggregates = await response.json();

      expect(aggregates.daily.cost).toBeCloseTo(0.1);
      expect(aggregates.daily.tokensPrompt).toBe(1300);
      expect(aggregates.daily.tokensCompletion).toBe(600);
    });
  });
});
