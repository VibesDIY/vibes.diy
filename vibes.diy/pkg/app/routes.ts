import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),
  // This route is only needed for dev server to prevent 404 flash
  route("index.html", "./routes/home.tsx", { id: "index-html" }),

  route("chat/:sessionId/:title", "./routes/home.tsx", { id: "chat" }),
  route("chat/:sessionId/:title/app", "./routes/home.tsx", { id: "chat-app" }),
  route("chat/:sessionId/:title/code", "./routes/home.tsx", {
    id: "chat-code",
  }),
  route("chat/:sessionId/:title/data", "./routes/home.tsx", {
    id: "chat-data",
  }),
  route("chat/:sessionId/:title/chat", "./routes/home.tsx", {
    id: "chat-chat",
  }),
  route("chat/:sessionId/:title/settings", "./routes/home.tsx", {
    id: "chat-app-settings",
  }),
  route("vibes/mine", "./routes/mine.tsx", { id: "my-vibes" }),

  route("settings", "./routes/settings.tsx", { id: "settings" }),
  route("about", "./routes/about.tsx", { id: "about" }),
  route("login", "./routes/login.tsx", { id: "login" }),
  route("login/sso-callback", "./routes/login.tsx", { id: "login-sso-callback" }),
  route("signup", "./routes/signup.tsx", { id: "signup" }),
  route("signup/sso-callback", "./routes/signup.tsx", { id: "signup-sso-callback" }),
  route("auth/callback", "./routes/auth-callback.tsx", { id: "auth-callback" }),
  route("remix/:vibeSlug?", "./routes/remix.tsx", { id: "remix" }),
  route("vibe/:vibeSlug", "./routes/vibe.tsx", { id: "vibe-iframe" }),
  route("firehose", "./routes/firehose.tsx", { id: "firehose" }),
  route("legal/privacy", "./routes/legal/privacy.tsx", {
    id: "privacy-policy",
  }),
  route("legal/tos", "./routes/legal/tos.tsx", { id: "terms-of-service" }),
  // 404 catch-all route - must be last
  route("*", "./routes/$.tsx", { id: "not-found" }),
] satisfies RouteConfig;
