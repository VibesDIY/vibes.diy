import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),
  // This route is only needed for dev server to prevent 404 flash
  // route("index.html", "./routes/home.tsx", { id: "index-html" }),

  // Protected routes - wrapped by auth layout (no path segment added)
  layout("./routes/auth.tsx", [
    route("chat/prompt", "./routes/chat/prompt.tsx"),
    route("chat/:userSlug/:appSlug/:fsId?", "./routes/chat/chat.$userSlug.$appSlug.tsx"),
    route("remix/:userSlug/:appSlug/:fsId?", "./routes/remix.$userSlug.$appSlug.tsx"),
    route("vibes/mine/:userSlug?/:appSlug?/:tab?", "./routes/vibes/mine.tsx"),
    route("settings", "./routes/settings.tsx", { id: "settings" }),
    route("settings/csr-to-cert", "./routes/settings/csr-to-cert.tsx", { id: "settings-csr-to-cert" }),
  ]),

  route("vibe/:userSlug/:appSlug/:fsId?", "./routes/vibe.$userSlug.$appSlug.tsx"),

  route("about", "./routes/about.tsx", { id: "about" }),
  // route("sso-callback", "./routes/sso-callback.tsx", { id: "sso-callback" }),

  route("legal/privacy", "./routes/legal/privacy.tsx", {
    id: "privacy-policy",
  }),
  route("legal/tos", "./routes/legal/tos.tsx", { id: "terms-of-service" }),
  route("login", "./routes/login.tsx", { id: "login" }),

  // 404 catch-all route - must be last
  route("*", "./routes/$.tsx", { id: "not-found" }),
] satisfies RouteConfig;
