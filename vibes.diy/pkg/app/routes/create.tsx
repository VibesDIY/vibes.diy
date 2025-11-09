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
    <div className="grid-background fixed inset-0">
      <div className="flex h-screen w-screen items-start justify-center p-4 overflow-y-auto">
        <div style={{ maxWidth: '800px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <BrutalistCard size="lg">
          <h1 className="text-4xl font-bold">Let's code something up</h1>
        </BrutalistCard>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <VibesButton variant="primary" style={{ flex: '1' }}>
            Party Planner
          </VibesButton>
          <VibesButton variant="secondary" style={{ flex: '1' }}>
            Progress Tracker
          </VibesButton>
          <VibesButton variant="tertiary" style={{ flex: '1' }}>
            Jam Session
          </VibesButton>
        </div>

        <BrutalistCard size="md" style={{ width: '100%' }}>
          <div style={{ marginBottom: '12px', fontWeight: 600 }}>Describe your vibe</div>
          <textarea
            placeholder="What do you want to build..."
            rows={6}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              letterSpacing: 'inherit',
              padding: '4px',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </BrutalistCard>

        <VibesButton variant="primary" style={{ width: '200px' }}>
          Let's Go
        </VibesButton>

        <a href="/" style={{  textAlign: 'right', textDecoration: 'underline' }}>
          Learn
        </a>
        </div>
      </div>
    </div>
  );
}
