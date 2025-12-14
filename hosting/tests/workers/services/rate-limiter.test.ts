import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import {
  getDailyKey,
  getMonthlyKey,
  getUserUsage,
  checkBudget,
  getUserTier,
  TIER_LIMITS,
} from "@vibes.diy/hosting-base/services/rate-limiter";

describe("Rate Limiter Service", () => {
  // Uses real KV from Miniflare - no mocks needed

  describe("getDailyKey", () => {
    it("should generate key with current date in YYYY-MM-DD format", () => {
      const key = getDailyKey("user123");
      expect(key).toMatch(/^cost:daily:user123:\d{4}-\d{2}-\d{2}$/);
    });

    it("should generate unique keys for different users", () => {
      const key1 = getDailyKey("user1");
      const key2 = getDailyKey("user2");
      expect(key1).not.toBe(key2);
    });
  });

  describe("getMonthlyKey", () => {
    it("should generate key with current month in YYYY-MM format", () => {
      const key = getMonthlyKey("user123");
      expect(key).toMatch(/^cost:monthly:user123:\d{4}-\d{2}$/);
    });

    it("should generate unique keys for different users", () => {
      const key1 = getMonthlyKey("user1");
      const key2 = getMonthlyKey("user2");
      expect(key1).not.toBe(key2);
    });
  });

  describe("getUserUsage", () => {
    it("should return zero usage for new user", async () => {
      const usage = await getUserUsage(env.KV, "newuser-" + Date.now());
      expect(usage.daily).toBe(0);
      expect(usage.monthly).toBe(0);
    });

    it("should return stored cost from KV for daily usage", async () => {
      const userId = "testuser-daily-" + Date.now();
      const dailyKey = getDailyKey(userId);
      await env.KV.put(dailyKey, JSON.stringify({ cost: 0.5 }));

      const usage = await getUserUsage(env.KV, userId);
      expect(usage.daily).toBe(0.5);
    });

    it("should return stored cost from KV for monthly usage", async () => {
      const userId = "testuser-monthly-" + Date.now();
      const monthlyKey = getMonthlyKey(userId);
      await env.KV.put(monthlyKey, JSON.stringify({ cost: 5.25 }));

      const usage = await getUserUsage(env.KV, userId);
      expect(usage.monthly).toBe(5.25);
    });

    it("should handle corrupted KV data gracefully", async () => {
      const userId = "corrupted-user-" + Date.now();
      const dailyKey = getDailyKey(userId);
      await env.KV.put(dailyKey, "not valid json");

      const usage = await getUserUsage(env.KV, userId);
      expect(usage.daily).toBe(0);
    });
  });

  describe("checkBudget", () => {
    it("should allow request when under daily budget", async () => {
      const userId = "under-daily-limit-" + Date.now();
      const result = await checkBudget(env.KV, userId, TIER_LIMITS.free);
      expect(result.allowed).toBe(true);
    });

    it("should allow request when under monthly budget", async () => {
      const userId = "under-monthly-limit-" + Date.now();
      const result = await checkBudget(env.KV, userId, TIER_LIMITS.free);
      expect(result.allowed).toBe(true);
    });

    it("should reject request when over daily budget", async () => {
      const userId = "over-daily-limit-" + Date.now();
      const dailyKey = getDailyKey(userId);
      // Free tier has $5.00 daily limit
      await env.KV.put(dailyKey, JSON.stringify({ cost: 6.0 }));

      const result = await checkBudget(env.KV, userId, TIER_LIMITS.free);
      expect(result.allowed).toBe(false);
    });

    it("should reject request when over monthly budget", async () => {
      const userId = "over-monthly-limit-" + Date.now();
      const monthlyKey = getMonthlyKey(userId);
      // Free tier has $50.00 monthly limit
      await env.KV.put(monthlyKey, JSON.stringify({ cost: 55.0 }));

      const result = await checkBudget(env.KV, userId, TIER_LIMITS.free);
      expect(result.allowed).toBe(false);
    });

    it("should return correct usage info in result", async () => {
      const userId = "usage-info-" + Date.now();
      const dailyKey = getDailyKey(userId);
      const monthlyKey = getMonthlyKey(userId);
      await env.KV.put(dailyKey, JSON.stringify({ cost: 0.5 }));
      await env.KV.put(monthlyKey, JSON.stringify({ cost: 3.25 }));

      const result = await checkBudget(env.KV, userId, TIER_LIMITS.free);
      expect(result.usage.daily).toBe(0.5);
      expect(result.usage.monthly).toBe(3.25);
      expect(result.limits.daily).toBe(TIER_LIMITS.free.daily);
      expect(result.limits.monthly).toBe(TIER_LIMITS.free.monthly);
    });

    it("should use pro tier limits when specified", async () => {
      const userId = "pro-tier-" + Date.now();
      const dailyKey = getDailyKey(userId);
      // $7 would exceed free ($5) but not pro ($10)
      await env.KV.put(dailyKey, JSON.stringify({ cost: 7.0 }));

      const freeResult = await checkBudget(env.KV, userId, TIER_LIMITS.free);
      const proResult = await checkBudget(env.KV, userId, TIER_LIMITS.pro);

      expect(freeResult.allowed).toBe(false);
      expect(proResult.allowed).toBe(true);
    });
  });

  describe("getUserTier", () => {
    it("should return 'free' when no metadata", () => {
      const tier = getUserTier({});
      expect(tier).toBe("free");
    });

    it("should return 'free' when publicMetadata is empty", () => {
      const tier = getUserTier({ publicMetadata: {} });
      expect(tier).toBe("free");
    });

    it("should return tier from publicMetadata", () => {
      const tier = getUserTier({ publicMetadata: { tier: "pro" } });
      expect(tier).toBe("pro");
    });

    it("should return 'unlimited' tier when set", () => {
      const tier = getUserTier({ publicMetadata: { tier: "unlimited" } });
      expect(tier).toBe("unlimited");
    });

    it("should default to 'free' for unknown tier", () => {
      const tier = getUserTier({ publicMetadata: { tier: "unknown-tier" } });
      expect(tier).toBe("free");
    });
  });

  describe("TIER_LIMITS", () => {
    it("should have free tier with $5/day and $50/month", () => {
      expect(TIER_LIMITS.free.daily).toBe(5.0);
      expect(TIER_LIMITS.free.monthly).toBe(50.0);
    });

    it("should have pro tier with $10/day and $100/month", () => {
      expect(TIER_LIMITS.pro.daily).toBe(10.0);
      expect(TIER_LIMITS.pro.monthly).toBe(100.0);
    });

    it("should have unlimited tier with Infinity limits", () => {
      expect(TIER_LIMITS.unlimited.daily).toBe(Infinity);
      expect(TIER_LIMITS.unlimited.monthly).toBe(Infinity);
    });
  });
});
