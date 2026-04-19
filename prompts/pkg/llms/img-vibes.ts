import type { LlmConfig } from "./types.js";

export const imgVibesConfig: LlmConfig = {
  name: "img-vibes",
  label: "Image Generation",
  module: "OpenAi",
  description: "Generate and edit images",
  importModule: "img-vibes",
  importName: "ImgVibes",
};
