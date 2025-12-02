import React from "react";
import BrutalistLayout from "../components/BrutalistLayout.js";
import { BrutalistCard } from "@vibes.diy/use-vibes-base";

export function meta() {
  return [
    { title: "About - Vibes DIY" },
    { name: "description", content: "About Vibes DIY - AI App Builder" },
  ];
}

export default function About() {
  return (
    <BrutalistLayout title="About" subtitle="AI-powered app builder">
      {/* What is Vibes DIY */}
      <BrutalistCard size="md">
        <h2 className="text-xl font-bold mb-3">What is Vibes DIY?</h2>
        <p>
          An AI-powered app builder that lets you create custom applications
          with your preferred style and functionality. No extensive coding
          knowledge required.
        </p>
      </BrutalistCard>

      {/* Open Source */}
      <BrutalistCard size="md">
        <h2 className="text-xl font-bold mb-3">Open source</h2>
        <p>
          Share your apps with the{" "}
          <a
            href="https://discord.gg/vnpWycj4Ta"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            community
          </a>{" "}
          and fork the{" "}
          <a
            href="https://github.com/fireproof-storage/vibes.diy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            builder repo
          </a>
          .
        </p>
      </BrutalistCard>

      {/* Key Features */}
      <BrutalistCard size="md">
        <h2 className="text-xl font-bold mb-3">Key Features</h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <span className="font-medium">AI-Powered Generation</span> - Create
            applications using natural language prompts
          </li>
          <li>
            <span className="font-medium">Custom Styling</span> - Choose from
            various design styles or create your own
          </li>
          <li>
            <span className="font-medium">Local-First Architecture</span> - Your
            data is managed on your device
          </li>
          <li>
            <span className="font-medium">
              <a
                href="https://use-fireproof.com"
                target="_blank"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Fireproof
              </a>
            </span>{" "}
            - Reliable, secure database that syncs across devices
          </li>
          <li>
            <span className="font-medium">Choose Your Model</span> - Access to a
            variety of AI models through{" "}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              OpenRouter
            </a>
          </li>
        </ul>
      </BrutalistCard>

      {/* Footer */}
      <BrutalistCard size="sm">
        <p className="text-center text-xs">
          Copyright © 2025{" "}
          <a
            href="https://fireproof.storage"
            target="_blank"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Fireproof
          </a>
          {" · "}
          <a
            href="mailto:help@vibes.diy"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Email Support
          </a>
          {" · "}
          <a
            href="/legal/privacy"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Privacy Policy
          </a>
          {" · "}
          <a
            href="/legal/tos"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Terms of Service
          </a>
        </p>
      </BrutalistCard>
    </BrutalistLayout>
  );
}
