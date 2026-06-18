import HomePage from "../components/HomePage.js";
import React from "react";

export function meta() {
  return [
    { title: "Vibes DIY — Describe apps. Share the link." },
    { name: "description", content: "Describe your vibe to make it a shareable app." },
  ];
}

export default function Home() {
  return <HomePage />;
}
