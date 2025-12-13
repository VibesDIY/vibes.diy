/**
 * Rate Limiter Service
 *
 * Per-user cost-based rate limiting using Cloudflare KV.
 * Tracks daily and monthly API usage costs in dollars.
 */

// Types
export interface CostUsage {
  daily: number; // Cost in dollars (e.g., 0.50 = $0.50)
  monthly: number; // Cost in dollars
  lastUpdated: number;
}

export interface RateLimitConfig {
  daily: number; // Daily budget in dollars
  monthly: number; // Monthly budget in dollars
}

export interface BudgetCheckResult {
  allowed: boolean;
  usage: CostUsage;
  limits: RateLimitConfig;
  reason?: "daily_exceeded" | "monthly_exceeded";
}

interface KVStoredCost {
  cost: number;
  tokensPrompt?: number;
  tokensCompletion?: number;
  lastUpdated?: number;
}

// Default limits per tier (in dollars)
export const TIER_LIMITS: Record<string, RateLimitConfig> = {
  free: { daily: 5.0, monthly: 50.0 }, // $5/day, $50/month
  pro: { daily: 10.0, monthly: 100.0 }, // $10/day, $100/month
  unlimited: { daily: Infinity, monthly: Infinity },
};

/**
 * Generate KV key for daily cost tracking
 * Format: cost:daily:{userId}:{YYYY-MM-DD}
 */
export function getDailyKey(userId: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `cost:daily:${userId}:${today}`;
}

/**
 * Generate KV key for monthly cost tracking
 * Format: cost:monthly:{userId}:{YYYY-MM}
 */
export function getMonthlyKey(userId: string): string {
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  return `cost:monthly:${userId}:${month}`;
}

/**
 * Get current usage for a user from KV
 */
export async function getUserUsage(
  kv: KVNamespace,
  userId: string,
): Promise<CostUsage> {
  const dailyKey = getDailyKey(userId);
  const monthlyKey = getMonthlyKey(userId);

  const [dailyData, monthlyData] = await Promise.all([
    kv.get(dailyKey),
    kv.get(monthlyKey),
  ]);

  let dailyCost = 0;
  let monthlyCost = 0;

  if (dailyData) {
    try {
      const parsed = JSON.parse(dailyData) as KVStoredCost;
      dailyCost = parsed.cost || 0;
    } catch {
      // Handle corrupted data gracefully
      dailyCost = 0;
    }
  }

  if (monthlyData) {
    try {
      const parsed = JSON.parse(monthlyData) as KVStoredCost;
      monthlyCost = parsed.cost || 0;
    } catch {
      // Handle corrupted data gracefully
      monthlyCost = 0;
    }
  }

  return {
    daily: dailyCost,
    monthly: monthlyCost,
    lastUpdated: Date.now(),
  };
}

/**
 * Check if a user is within their budget limits
 */
export async function checkBudget(
  kv: KVNamespace,
  userId: string,
  limits: RateLimitConfig,
): Promise<BudgetCheckResult> {
  const usage = await getUserUsage(kv, userId);

  if (usage.daily >= limits.daily) {
    return {
      allowed: false,
      usage,
      limits,
      reason: "daily_exceeded",
    };
  }

  if (usage.monthly >= limits.monthly) {
    return {
      allowed: false,
      usage,
      limits,
      reason: "monthly_exceeded",
    };
  }

  return {
    allowed: true,
    usage,
    limits,
  };
}

/**
 * Get user tier from Clerk user metadata
 */
export function getUserTier(user: {
  publicMetadata?: { tier?: string };
}): string {
  const tier = user.publicMetadata?.tier;

  // Validate tier is one of the known tiers
  if (tier && tier in TIER_LIMITS) {
    return tier;
  }

  return "free";
}
