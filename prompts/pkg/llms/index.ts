import { callaiConfig } from "./callai.js";
import { fireproofConfig } from "./fireproof.js";
import { imageGenConfig } from "./image-gen.js";
import { webAudioConfig } from "./web-audio.js";
import { d3Config } from "./d3.js";
import { threeJsConfig } from "./three-js.js";

export { callaiConfig } from "./callai.js";
export { fireproofConfig } from "./fireproof.js";
export { imageGenConfig } from "./image-gen.js";
export { webAudioConfig } from "./web-audio.js";
export { d3Config } from "./d3.js";
export { threeJsConfig } from "./three-js.js";
export type { LlmConfig } from "./types.js";

// Array of all configs for easy iteration
export const allConfigs = [callaiConfig, fireproofConfig, imageGenConfig, webAudioConfig, d3Config, threeJsConfig] as const;
