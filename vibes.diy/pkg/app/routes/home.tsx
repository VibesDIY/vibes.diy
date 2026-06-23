import HomePage from "../components/HomePage.js";
import React from "react";

export function meta() {
  return [
    { title: "Vibes DIY — Easy custom apps, securely share with friends." },
    { name: "description", content: "Customize a web app by talking. Describe your app, share the link." },
  ];
}

export default function Home() {
  return <HomePage />;
}
