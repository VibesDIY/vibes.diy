import React, { useState } from "react";
import { useNavigate } from "react-router";
import { BrutalistCard, VibesButton } from "@vibes.diy/use-vibes-base";
import {
  partyPlannerPrompt,
  progressTrackerPrompt,
  jamSessionPrompt,
} from "../data/quick-suggestions-data.js";

export function meta() {
  return [
    { title: "Create - Vibes DIY" },
    { name: "description", content: "Create a new Vibe" },
  ];
}

export default function Create() {
  const [promptText, setPromptText] = useState("");
  const navigate = useNavigate();

  const handleLetsGo = () => {
    if (promptText.trim()) {
      const params = new URLSearchParams();
      params.set("prompt", promptText.trim());
      navigate(`/?${params.toString()}`);
    }
  };

  return (
    <div className="grid-background fixed inset-0">
      <div className="flex h-screen w-screen items-start justify-center p-4 overflow-y-auto">
        <div
          style={{
            maxWidth: "800px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <BrutalistCard size="lg">
            <h1 className="text-4xl font-bold">Let's code something up</h1>
          </BrutalistCard>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <VibesButton
              variant="primary"
              style={{ flex: "1" }}
              onClick={() => setPromptText(partyPlannerPrompt)}
            >
              Party Planner
            </VibesButton>
            <VibesButton
              variant="secondary"
              style={{ flex: "1" }}
              onClick={() => setPromptText(progressTrackerPrompt)}
            >
              Progress Tracker
            </VibesButton>
            <VibesButton
              variant="tertiary"
              style={{ flex: "1" }}
              onClick={() => setPromptText(jamSessionPrompt)}
            >
              Jam Session
            </VibesButton>
          </div>

          <BrutalistCard size="md" style={{ width: "100%" }}>
            <div style={{ marginBottom: "12px", fontWeight: 600 }}>
              Describe your vibe
            </div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="What do you want to build..."
              rows={6}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                color: "inherit",
                fontSize: "inherit",
                fontWeight: "inherit",
                letterSpacing: "inherit",
                padding: "4px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </BrutalistCard>

          <VibesButton variant="primary" style={{ width: "200px" }} onClick={handleLetsGo}>
            Let's Go
          </VibesButton>

          <a
            href="/"
            style={{ textAlign: "right", textDecoration: "underline" }}
          >
            Learn
          </a>
        </div>
      </div>
    </div>
  );
}
