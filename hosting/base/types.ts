import { Str } from "chanfana";
import { z } from "zod";

// todo dedupe with vibes.diy/hosting/pkg/src/types.ts

const App = z.object({
  name: Str({ example: "my-awesome-app" }),
  slug: Str().min(4),
  code: Str(),
  raw: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  templatedCode: z.string().nullable().optional(),
  chatId: Str(),
  userId: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  hasScreenshot: z.boolean().nullable().optional(),
  screenshotKey: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  iconKey: z.string().nullable().optional(),
  hasIcon: z.boolean().nullable().optional(),
  remixOf: z.string().nullable().optional(),
  updateCount: z.number().nullable().optional(),
  shareToFirehose: z.boolean().nullable().optional(),
  customDomain: z.string().nullable().optional(),
});

const PublishEvent = z.object({
  type: z.enum(["app_created", "app_updated"]),
  app: App,
  metadata: z.object({
    timestamp: z.number(),
    userId: z.string().optional(),
    isUpdate: z.boolean(),
  }),
});

// Type aliases for Zod schemas
export type PublishEventType = z.infer<typeof PublishEvent>;

export { App, PublishEvent };
