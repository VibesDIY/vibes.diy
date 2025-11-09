import React from "react";
import { BrutalistCard } from "@vibes.diy/use-vibes-base";

export function meta() {
  return [
    { title: "Create - Vibes DIY" },
    { name: "description", content: "Create a new Vibe" },
  ];
}

export default function Create() {
  return (
    <div className="grid-background flex h-screen w-screen items-center justify-center">
      <BrutalistCard size="lg">
        <h1 className="text-4xl font-bold">Can I code something up for you?</h1>
      </BrutalistCard>
    </div>
  );
}
