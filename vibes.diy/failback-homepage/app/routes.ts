import { type RouteConfig, index, route } from "@react-router/dev/routes";
// Original routes: import { flatRoutes } from "@react-router/fs-routes"; export default flatRoutes() satisfies RouteConfig;
export default [
//   index("routes/test-menu.tsx", { id: "index" }),
//   route("*", "routes/test-menu.tsx", { id: "test-menu" }),
  index("routes/catch-all.tsx", { id: "index" }),
  route("*", "routes/catch-all.tsx", { id: "catch-all" }),
] satisfies RouteConfig;
