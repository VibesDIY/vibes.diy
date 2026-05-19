import type { LlmConfig } from "./types.js";

export const webxrConfig: LlmConfig = {
  name: "webxr",
  label: "Babylon.js WebXR",
  module: "webxr",
  description:
    "Babylon.js 3D engine with first-class WebXR: immersive VR and AR passthrough, " +
    "hit-testing, surface anchors, particle systems, SolidParticleSystem, custom GLSL shaders, " +
    "controller and hand-tracking events, PBR materials, Quest performance patterns. " +
    "babylon, babylonjs, WebXR, VR, AR, spatial computing, immersive, mixed reality, xr, " +
    "augmented reality, virtual reality, Quest, Vision Pro",
  importModule: "@babylonjs/core",
  importName: "BABYLON",
  importType: "namespace",
};
