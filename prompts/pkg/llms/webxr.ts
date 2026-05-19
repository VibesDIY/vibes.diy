import type { LlmConfig } from "./types.js";

export const webxrConfig: LlmConfig = {
  name: "webxr",
  label: "Babylon.js WebXR",
  module: "webxr",
  description:
    "Babylon.js WebXR library for immersive VR and AR experiences. Covers " +
    "createDefaultXRExperienceAsync, AR passthrough with hit-testing and surface anchors, " +
    "generative art with particle systems and procedural geometry, custom GLSL shaders, " +
    "controller and hand-tracking events, single-file CDN deployable. " +
    "Keywords: WebXR, VR, AR, spatial computing, immersive, mixed reality, Quest, Vision Pro, " +
    "babylon, babylonjs, xr, vr headset, augmented reality, virtual reality",
  importModule: "babylonjs",
  importName: "BABYLON",
  importType: "namespace",
};
