import type { LlmConfig } from "./types.js";

export const imageGenConfig: LlmConfig = {
  name: "image-gen",
  label: "Image Generation",
  module: "OpenAi",
  description: "Generate and edit images",
  importModule: "use-vibes",
  importName: "ImgGen",
};
