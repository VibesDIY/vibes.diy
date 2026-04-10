export interface LlmConfig {
  name: string;
  label: string;
  module: string;
  description: string;
  importModule: string;
  importName: string;
  importType?: "named" | "namespace" | "default";
}
