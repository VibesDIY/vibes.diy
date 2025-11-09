import React from "react";
import { BrutalistCard, VibesButton } from "@vibes.diy/use-vibes-base";

export function meta() {
  return [
    { title: "Create - Vibes DIY" },
    { name: "description", content: "Create a new Vibe" },
  ];
}

export default function Create() {
  return (
    <div className="grid-background flex h-screen w-screen items-start justify-center p-4">
      <div style={{ maxWidth: '800px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <BrutalistCard size="lg">
          <h1 className="text-4xl font-bold">Can I code something up for you?</h1>
        </BrutalistCard>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <VibesButton variant="primary">Party Planner</VibesButton>
          <VibesButton variant="secondary">Progress Tracker</VibesButton>
          <VibesButton variant="tertiary">Jam Session</VibesButton>
        </div>

        <BrutalistCard size="md" style={{ width: '100%' }}>
          <textarea
            placeholder="Describe what you want to build..."
            rows={6}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              letterSpacing: 'inherit',
              padding: 0,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </BrutalistCard>
      </div>
    </div>
  );
}
