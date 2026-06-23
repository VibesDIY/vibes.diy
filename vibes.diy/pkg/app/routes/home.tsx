import HomePage from "../components/HomePage.js";
import React from "react";

export function meta() {
  return [
    { title: "Vibes DIY — Easy custom apps, securely share with friends." },
    {
      name: "description",
      content: "Instant apps, easy to share. Describe your app in plain words — it builds instantly and changes as you type.",
    },
  ];
}

export default function Home() {
  return <HomePage />;
}
