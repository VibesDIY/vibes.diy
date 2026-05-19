import type { LlmConfig } from "./types.js";

export const threeJsConfig: LlmConfig = {
  name: "three-js",
  label: "Three.js",
  module: "three-js",
  description:
    "Three.js 3D graphics library for WebGL rendering: mesh geometry, materials, lighting, animation, cameras, textures, GLSL shaders, GLTF/OBJ/FBX model loading, physics, particle systems, post-processing, visual effects, 3js",
  importModule: "three",
  importName: "THREE",
  importType: "namespace",
};
