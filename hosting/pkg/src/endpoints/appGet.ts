import { OpenAPIRoute, contentJson } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

// Public metadata response - no sensitive data
const AppMetadataSchema = z.object({
  slug: z.string(),
  title: z.string().optional(),
  remixOf: z.string().nullable().optional(),
  hasScreenshot: z.boolean(),
  hasIcon: z.boolean(),
});

export class AppGet extends OpenAPIRoute {
  schema = {
    tags: ["Apps"],
    summary: "Get app metadata by slug",
    request: {
      params: z.object({
        slug: z.string(),
      }),
    },
    responses: {
      "200": {
        description: "Returns app metadata",
        ...contentJson(
          z.object({
            success: z.boolean(),
            app: AppMetadataSchema,
          }),
        ),
      },
      "404": {
        description: "App not found",
        ...contentJson(
          z.object({
            error: z.string(),
          }),
        ),
      },
    },
  };

  async handle(c: Context<{ Bindings: Env }>) {
    const { slug } = c.req.param();
    const kv = c.env.KV;

    // Fetch app from KV by slug
    const appData = await kv.get(slug);

    if (!appData) {
      return c.json({ error: "App not found" }, 404);
    }

    const app = JSON.parse(appData);

    // Return only public metadata - no code, userId, or chatId
    return c.json({
      success: true,
      app: {
        slug: app.slug,
        title: app.title || slug,
        remixOf: app.remixOf || null,
        hasScreenshot: app.hasScreenshot || false,
        hasIcon: app.hasIcon || false,
      },
    });
  }
}
