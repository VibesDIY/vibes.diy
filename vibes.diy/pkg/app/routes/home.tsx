import HomePage from "../components/HomePage.js";
import React from "react";

export function meta() {
  return [
    { title: "Vibes DIY — Custom apps, from inside jokes to invoices." },
    {
      name: "description",
      content:
        "Describe your app in plain words and it's live at its own link — instant, live, yours. From a group-chat bit to an order form for your shop.",
    },
  ];
}

export default function Home() {
  return <HomePage />;
}
