/**
 * Test routes for Durable Object integration testing
 * Only included when running in test mode via unstable_dev
 */
import { Hono } from "hono";

const testRoutes = new Hono<{ Bindings: Env }>();

// Test endpoint to interact with DurableDatabase
testRoutes.all("/__test/do/:userId/:method", async (c) => {
  const { userId, method } = c.req.param();

  // Get the user's Durable Object
  const doId = c.env.DURABLE_DATABASE.idFromName(userId);
  const userDB = c.env.DURABLE_DATABASE.get(doId);

  try {
    switch (method) {
      case "recordGeneration": {
        const body = await c.req.json();
        const result = await userDB.recordGeneration(body);
        return c.json(result);
      }
      case "getAggregates": {
        const result = await userDB.getAggregates();
        return c.json(result);
      }
      case "getGenerations": {
        const limit = parseInt(c.req.query("limit") || "50");
        const offset = parseInt(c.req.query("offset") || "0");
        const result = await userDB.getGenerations(limit, offset);
        return c.json(result);
      }
      default:
        return c.json({ error: `Unknown method: ${method}` }, 400);
    }
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

export default testRoutes;
