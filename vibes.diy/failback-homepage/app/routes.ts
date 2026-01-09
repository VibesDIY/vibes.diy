import { type RouteConfig, route } from "@react-router/dev/routes";
// import { flatRoutes } from "@react-router/fs-routes";

// Enrutamiento original comentado temporalmente
// Para activar todas las rutas, descomentar la siguiente línea:
// export default flatRoutes() satisfies RouteConfig;

// Configuración temporal: Todas las rutas muestran HomeScreen
export default [
  route("*", "routes/_index.tsx"),
] satisfies RouteConfig;
