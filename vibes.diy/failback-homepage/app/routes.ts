import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx", { id: "home-index" }),
  route("chat/:sessionId", "./routes/home.tsx", { id: "home-chat" }),
  route("chat/:sessionId/:slug", "./routes/home.tsx", { id: "home-chat-slug" }),

  route("about", "./routes/about.tsx"),
  route("groups", "./routes/groups.tsx"),
  route("invite", "./routes/invite.tsx"),
  route("logout", "./routes/logout.tsx"),
  route("my-vibes", "./routes/my-vibes.tsx"),
  route("remix", "./routes/remix.tsx"),
  route("settings", "./routes/settings.tsx"),
  route("sso-callback", "./routes/sso-callback.tsx"),
  route("firehose", "./routes/firehose.tsx"),
  
  route("vibe-container", "./routes/vibe-container.tsx"),
  route("vibe-instance-list", "./routes/vibe-instance-list.tsx"),
  route("vibe-viewer", "./routes/vibe-viewer.tsx"),

  route("legal/tos", "./routes/legal/tos.tsx"),
  route("legal/privacy", "./routes/legal/privacy.tsx"),

  route("*?", "./routes/catch-all.tsx"),
] satisfies RouteConfig;
