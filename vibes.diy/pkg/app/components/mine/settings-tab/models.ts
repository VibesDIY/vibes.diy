export interface ModelOption {
  visibleModelName: string;
  modelName: string;
}

export function getModelOptions(): ModelOption[] {
  return [
    { visibleModelName: "Claude Sonnet 4.6", modelName: "claude-sonnet-4-6" },
    { visibleModelName: "Claude Opus 4.6", modelName: "claude-opus-4-6" },
    { visibleModelName: "GPT-4o", modelName: "openai/gpt-4o" },
  ];
}
