import React from "react";
import { VibeIframeContainerComponent } from "./vibe-container.js";
import { FIREHOSE_SLUG } from "../config/firehose.js";

export function Firehose() {
  return <VibeIframeContainerComponent vibeSlug={FIREHOSE_SLUG} />;
}
