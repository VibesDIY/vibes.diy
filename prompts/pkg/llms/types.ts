export interface LlmConfig {
  name: string;
  label: string;
  module: string;
  description: string;
  // Omit both for skills that document a browser built-in (e.g. web-audio's
  // window.AudioContext). The prompt builder skips entries missing either.
  importModule?: string;
  importName?: string;
  importType?: "named" | "namespace" | "default";
}
