import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

/**
 * Generations table - tracks all AI API usage per user
 * Each user has their own SQLite database via Durable Objects
 */
export const generations = sqliteTable("generations", {
  id: text("id").primaryKey(), // OpenRouter generation ID (gen-xxx)
  model: text("model").notNull(), // e.g., "openai/gpt-4o-mini"
  cost: real("cost").notNull().default(0), // Cost in USD
  tokensPrompt: integer("tokens_prompt").default(0),
  tokensCompletion: integer("tokens_completion").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type inference
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
