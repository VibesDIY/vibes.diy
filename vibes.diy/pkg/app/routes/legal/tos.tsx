import React, { useEffect, useState } from "react";
import SimpleAppLayout from "../../components/SimpleAppLayout.js";
import { HomeIcon } from "../../components/SessionSidebar/HomeIcon.js";
import VibesDIYLogo from "../../components/VibesDIYLogo.js";
import ReactMarkdown from "react-markdown";
import { loadAsset, URI } from "@adviser/cement";
import tosContentAssetUrl from "./tos-notes.md?url";

export function meta() {
  return [{ title: "Terms of Service - Vibes DIY" }, { name: "description", content: "Terms of Service for Vibes DIY" }];
}

export default function Legal_Tos() {
  const [tosContent, setTosContent] = useState<string | null>(null);

  useEffect(() => {
    const markdownPath = URI.from(window.location.origin).build().resolve(tosContentAssetUrl).URI().pathname;

    void loadAsset(markdownPath, {
      basePath: () => window.location.origin,
    }).then((result) => {
      if (result.isOk()) {
        setTosContent(result.Ok());
        return;
      }

      console.error("Failed to load terms markdown", result.Err());
    });
  }, []);

  return (
    <SimpleAppLayout
      headerLeft={
        <div className="flex items-center">
          <a
            href="/"
            className="text-light-primary dark:text-dark-primary hover:text-accent-02-light dark:hover:text-accent-02-dark flex items-center px-3 py-2"
            aria-label="Go to home"
          >
            <HomeIcon className="h-6 w-6" />
          </a>
        </div>
      }
    >
      <div className="h-full">
        <div className="mw-10 flex items-center justify-center">
          <VibesDIYLogo width={300} />
        </div>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="pb-4 text-2xl font-bold">Terms of Service</h1>

          <div className="prose dark:prose-invert space-y-4">
            <ReactMarkdown>{tosContent}</ReactMarkdown>
          </div>
        </div>
        <p className="text-light-secondary dark:text-dark-secondary text-center text-xs">
          Copyright © 2025{" "}
          <a href="https://fireproof.storage" target="_blank" className="text-blue-600 hover:underline dark:text-blue-400">
            Fireproof
          </a>
        </p>
      </div>
    </SimpleAppLayout>
  );
}
