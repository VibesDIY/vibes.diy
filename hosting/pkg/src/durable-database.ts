import { DurableObject } from "cloudflare:workers";
import { drizzle, DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import { sum, gte } from "drizzle-orm";
import * as schema from "./db/schema.js";
import migrations from "../drizzle/migrations.js";

/**
 * DurableDatabase - Per-user SQLite database via Durable Objects with Drizzle ORM
 *
 * Each user gets their own isolated database storing all their AI generation
 * records. Aggregates are computed on-demand and cached in KV for fast budget checks.
 *
 * Reference: https://boristane.com/blog/durable-objects-database-per-user/
 */

// Re-export types
export type { Generation, NewGeneration } from "./db/schema.js";

export interface UsageAggregates {
  daily: { cost: number; tokensPrompt: number; tokensCompletion: number };
  monthly: { cost: number; tokensPrompt: number; tokensCompletion: number };
}

// Input type for recording a generation
export interface GenerationInput {
  id: string;
  model: string;
  cost: number;
  tokensPrompt: number;
  tokensCompletion: number;
  createdAt: number; // Unix timestamp in seconds
}

export class DurableDatabase extends DurableObject<Env> {
  private db: DrizzleSqliteDODatabase<typeof schema>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = drizzle(ctx.storage, { schema });

    // Run migrations on cold start
    ctx.blockConcurrencyWhile(async () => {
      migrate(this.db, migrations);
    });
  }

  /**
   * Record a generation and return updated aggregates.
   * Uses onConflictDoUpdate for idempotency (safe for queue retries).
   */
  async recordGeneration(gen: GenerationInput): Promise<UsageAggregates> {
    await this.db
      .insert(schema.generations)
      .values({
        id: gen.id,
        model: gen.model,
        cost: gen.cost,
        tokensPrompt: gen.tokensPrompt,
        tokensCompletion: gen.tokensCompletion,
        createdAt: new Date(gen.createdAt * 1000), // Convert Unix timestamp to Date
      })
      .onConflictDoUpdate({
        target: schema.generations.id,
        set: {
          model: gen.model,
          cost: gen.cost,
          tokensPrompt: gen.tokensPrompt,
          tokensCompletion: gen.tokensCompletion,
        },
      });

    return this.getAggregates();
  }

  /**
   * Get current usage aggregates for daily and monthly periods.
   */
  async getAggregates(): Promise<UsageAggregates> {
    // Calculate start of today (UTC midnight)
    const todayDate = new Date();
    todayDate.setUTCHours(0, 0, 0, 0);

    // Calculate start of this month (1st day, UTC midnight)
    const monthDate = new Date();
    monthDate.setUTCDate(1);
    monthDate.setUTCHours(0, 0, 0, 0);

    // Query daily aggregates
    const dailyResult = this.db
      .select({
        cost: sum(schema.generations.cost),
        tokensPrompt: sum(schema.generations.tokensPrompt),
        tokensCompletion: sum(schema.generations.tokensCompletion),
      })
      .from(schema.generations)
      .where(gte(schema.generations.createdAt, todayDate))
      .get();

    // Query monthly aggregates
    const monthlyResult = this.db
      .select({
        cost: sum(schema.generations.cost),
        tokensPrompt: sum(schema.generations.tokensPrompt),
        tokensCompletion: sum(schema.generations.tokensCompletion),
      })
      .from(schema.generations)
      .where(gte(schema.generations.createdAt, monthDate))
      .get();

    return {
      daily: {
        cost: Number(dailyResult?.cost) || 0,
        tokensPrompt: Number(dailyResult?.tokensPrompt) || 0,
        tokensCompletion: Number(dailyResult?.tokensCompletion) || 0,
      },
      monthly: {
        cost: Number(monthlyResult?.cost) || 0,
        tokensPrompt: Number(monthlyResult?.tokensPrompt) || 0,
        tokensCompletion: Number(monthlyResult?.tokensCompletion) || 0,
      },
    };
  }

  /**
   * Get generation history for user dashboard.
   */
  async getGenerations(limit = 50, offset = 0): Promise<schema.Generation[]> {
    return this.db.query.generations.findMany({
      orderBy: (generations, { desc }) => [desc(generations.createdAt)],
      limit,
      offset,
    });
  }
}
