import { Bool, OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { Variables } from "../middleware/auth.js";
import { createKey } from "@vibes.diy/hosting";

interface Env {
  SERVER_OPENROUTER_PROV_KEY: string;
}

export class KeyCreate extends OpenAPIRoute {
  schema = {
    tags: ["Keys"],
    summary: "Create a new API key",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              userId: z.string().optional(),
              name: z.string(),
              label: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Returns the created key",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              key: z.object({
                hash: z.string(),
                name: z.string(),
                label: z.string(),
                disabled: z.boolean(),
                limit: z.number(),
                usage: z.number(),
                created_at: z.string(),
                updated_at: z.string().nullable(),
                key: z.string(),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<{ Variables: Variables; Bindings: Env }>) {
    const user = c.get("user");

    if (!user) {
      return c.json(
        {
          success: false,
          error: "Unauthorized: Invalid or missing token",
        },
        401,
      );
    }

    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();

    // Retrieve the validated request body
    const keyRequest = data.body;

    // Get the provisioning key from environment
    const provisioningKey = c.env.SERVER_OPENROUTER_PROV_KEY;

    const resolvedUserId = user.userId;

    console.log(`🔑 Creating new key`);
    console.log(`💰 Setting dollar amount to $2.5 for authenticated user`);
    console.log(`🏷️ Using label: user-${resolvedUserId}-session-${Date.now()}`);

    // Call the core function to create a key
    const result = await createKey({
      userId: resolvedUserId,
      name: keyRequest.name,
      label: keyRequest.label,
      provisioningKey, // Pass the key from context
    });
    return c.json(result);
  }
}
