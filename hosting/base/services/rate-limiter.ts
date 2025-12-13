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

export interface TokenUsage {
  daily: { prompt: number; completion: number };
  monthly: { prompt: number; completion: number };
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

// TTL values in seconds
const DAILY_TTL = 48 * 60 * 60; // 48 hours
const MONTHLY_TTL = 35 * 24 * 60 * 60; // 35 days

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
 * Increment usage for a user in KV (both daily and monthly)
 */
export async function incrementUsage(
  kv: KVNamespace,
  userId: string,
  cost: number,
  tokensPrompt: number = 0,
  tokensCompletion: number = 0,
): Promise<void> {
  const dailyKey = getDailyKey(userId);
  const monthlyKey = getMonthlyKey(userId);

  // Get current values
  const [dailyData, monthlyData] = await Promise.all([
    kv.get(dailyKey),
    kv.get(monthlyKey),
  ]);

  let currentDaily: KVStoredCost = {
    cost: 0,
    tokensPrompt: 0,
    tokensCompletion: 0,
  };
  let currentMonthly: KVStoredCost = {
    cost: 0,
    tokensPrompt: 0,
    tokensCompletion: 0,
  };

  if (dailyData) {
    try {
      const parsed = JSON.parse(dailyData) as KVStoredCost;
      currentDaily = {
        cost: parsed.cost || 0,
        tokensPrompt: parsed.tokensPrompt || 0,
        tokensCompletion: parsed.tokensCompletion || 0,
      };
    } catch {
      // Keep defaults
    }
  }

  if (monthlyData) {
    try {
      const parsed = JSON.parse(monthlyData) as KVStoredCost;
      currentMonthly = {
        cost: parsed.cost || 0,
        tokensPrompt: parsed.tokensPrompt || 0,
        tokensCompletion: parsed.tokensCompletion || 0,
      };
    } catch {
      // Keep defaults
    }
  }

  const now = Date.now();
  const newDaily: KVStoredCost = {
    cost: currentDaily.cost + cost,
    tokensPrompt: currentDaily.tokensPrompt! + tokensPrompt,
    tokensCompletion: currentDaily.tokensCompletion! + tokensCompletion,
    lastUpdated: now,
  };
  const newMonthly: KVStoredCost = {
    cost: currentMonthly.cost + cost,
    tokensPrompt: currentMonthly.tokensPrompt! + tokensPrompt,
    tokensCompletion: currentMonthly.tokensCompletion! + tokensCompletion,
    lastUpdated: now,
  };

  // Write both in parallel with appropriate TTLs
  await Promise.all([
    kv.put(dailyKey, JSON.stringify(newDaily), { expirationTtl: DAILY_TTL }),
    kv.put(monthlyKey, JSON.stringify(newMonthly), {
      expirationTtl: MONTHLY_TTL,
    }),
  ]);
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

/**
 * Fetch generation details from OpenRouter and record usage
 * Called via queue consumer for async processing
 */
export async function fetchAndRecordUsage(
  kv: KVNamespace,
  userId: string,
  generationId: string,
  apiKey: string,
): Promise<void> {
  try {
    const url = new URL("https://openrouter.ai/api/v1/generation");
    url.searchParams.set("id", generationId);
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch generation ${generationId}: ${response.status}`,
      );
      return;
    }

    const data = (await response.json()) as {
      data?: {
        usage?: number;
        upstream_inference_cost?: number;
        tokens_prompt?: number;
        tokens_completion?: number;
      };
    };

    // Extract cost in dollars from OpenRouter response
    // For non-BYOK accounts, "usage" has the cost
    // For BYOK accounts, "usage" is 0 but "upstream_inference_cost" has the actual cost
    const cost = data.data?.usage || data.data?.upstream_inference_cost || 0;
    const tokensPrompt = data.data?.tokens_prompt || 0;
    const tokensCompletion = data.data?.tokens_completion || 0;

    if (cost > 0 || tokensPrompt > 0 || tokensCompletion > 0) {
      await incrementUsage(kv, userId, cost, tokensPrompt, tokensCompletion);
    }
  } catch (error) {
    console.error(`Error fetching/recording usage for ${generationId}:`, error);
  }
}
