import HomePage from "../components/HomePage.js";
import React from "react";

export function meta() {
  return [
    { title: "Vibes DIY — Instant custom apps. Share with friends, sell to customers." },
    {
      name: "description",
      content:
        "Instant apps, easy to share. Describe your app in plain words — it builds instantly and changes as you type. Take orders, kill the spreadsheet, run the front counter.",
    },
  ];
}

export default function Home() {
  return <HomePage />;
}
