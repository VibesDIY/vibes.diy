import { type RouteConfig, route } from "@react-router/dev/routes";
// Original routes: import { flatRoutes } from "@react-router/fs-routes"; export default flatRoutes() satisfies RouteConfig;
export default [route("*", "routes/catch-all.tsx")] satisfies RouteConfig;
