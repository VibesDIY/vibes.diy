import { HomeScreen } from "../pages/HomeScreen/HomeScreen.js";

export function meta() {
  return [
    { title: "Vibes DIY - AI App Builder" },
    { name: "description", content: "Generate apps in one prompt" },
  ];
}

export default function CatchAll() {
  return <HomeScreen />;
}

