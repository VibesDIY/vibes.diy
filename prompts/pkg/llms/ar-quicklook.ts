import type { LlmConfig } from "./types.js";

export const arQuickLookConfig: LlmConfig = {
  name: "ar-quicklook",
  label: "AR Quick Look",
  module: "ar-quicklook",
  description:
    "Apple AR Quick Look — native iOS and macOS 3D model viewer. " +
    "Place USDZ or .reality files in augmented reality with a single HTML link in Safari: " +
    "<a rel='ar' href='model.usdz'>. No SDK or 3D engine required. Works on iPhone and iPad. " +
    "Covers QLPreviewController for iOS apps, ARQuickLookPreviewItem customization " +
    "(disable scaling, custom share URL), Apple Pay and custom action buttons in AR, " +
    "free USDZ models from Apple AR Quick Look Gallery, detecting iOS for fallback UI, " +
    "JavaScript trigger via programmatic click. " +
    "Keywords: AR Quick Look, USDZ, .reality, ARKit, QLPreviewController, " +
    "Apple AR, iOS AR, iPhone AR, iPad AR, macOS AR, Safari AR, " +
    "3D model viewer, augmented reality iOS, place object real world, " +
    "no WebXR, native AR, model preview, spatial",
};
