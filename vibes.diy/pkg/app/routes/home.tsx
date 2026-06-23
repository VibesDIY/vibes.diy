import HomePage from "../components/HomePage.js";
import React from "react";

export function meta() {
  return [
    { title: "Vibes DIY — Easy custom apps, securely share with friends." },
    { name: "description", content: "Customize a web app by talking to it. Describe your app, then share it with a link." },
  ];
}

export default function Home() {
  return <HomePage />;
}
