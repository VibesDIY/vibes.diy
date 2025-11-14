import React from "react";
import { useLocation, Outlet } from "react-router";
import { HomeScreen } from "../pages/index.js";

export function meta() {
  return [
    { title: "Create - Vibes DIY" },
    { name: "description", content: "Create a new Vibe" },
  ];
}

export default function Create() {
  const location = useLocation();

  // Check if we're on the preview route
  const isPreviewRoute = location.pathname.endsWith("/preview");

  // If on preview route, only render the Outlet
  if (isPreviewRoute) {
    return <Outlet />;
  }

  // Otherwise render HomeScreen (which contains CreateSection in Section 8)
  return <HomeScreen />;
}
