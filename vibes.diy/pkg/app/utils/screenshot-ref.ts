import type { MetaScreenShot } from "@vibes.diy/api-types";

export function screenshotRefToProxyUrl(shot: Pick<MetaScreenShot, "assetUrl" | "mime">): string {
  return `/assets/cid/?url=${encodeURIComponent(shot.assetUrl)}&mime=${encodeURIComponent(shot.mime)}`;
}
