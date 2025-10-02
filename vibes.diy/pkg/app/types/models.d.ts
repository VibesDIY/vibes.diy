/**
 * Type declarations for model data
 */

declare module "../data/models.json" {
  interface ModelInfo {
    id: string;
    name: string;
    description: string;
    featured?: boolean;
  }

  const models: ModelInfo[];
  export default models;
}
