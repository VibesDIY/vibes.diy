import { Bool, OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import { Variables } from "../middleware/auth";
import { createKey, increaseKeyLimitBy } from "./keyLib";

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
            schema: z
              .object({
                userId: z.string().optional(),
                name: z.string().optional(),
                label: z.string().optional(),
                hash: z.string().optional(), // If provided, updates existing key instead of creating new one
              })
              .refine(
                (data) => {
                  // If hash is provided, name is not required.
                  // If hash is not provided, name is required.
                  return data.hash ? true : data.name !== undefined;
                },
                {
                  message:
                    "The 'name' field is required when creating a new key (i.e., when 'hash' is not provided).",
                  path: ["name"],
                },
              ),
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

    if (!user) {
      throw new Error("User not authenticated");
    }
    const resolvedUserId = user.userId;

    // Determine if we're updating or creating a key
    if (keyRequest.hash) {
      console.log(`🔑 Increasing key limit for: ${keyRequest.hash}`);

      // Increase the key's limit by $2.50
      return await increaseKeyLimitBy({
        hash: keyRequest.hash,
        amount: 2.5,
        provisioningKey,
      });
    } else {
      console.log(`🔑 Creating new key`);

      // Call the core function to create a key
      return await createKey({
        userId: resolvedUserId,
        name: keyRequest.name,
        label: keyRequest.label,
        provisioningKey, // Pass the key from context
      });
    }
  }
}
