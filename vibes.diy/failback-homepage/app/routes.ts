import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/test-menu.tsx", { id: "index" }),
  layout("routes/general-layout.tsx", [
    route("auth", "routes/auth.tsx", { id: "auth" }),
  ]),
  route("*", "routes/test-menu.tsx", { id: "catch-all" }),
] satisfies RouteConfig;
