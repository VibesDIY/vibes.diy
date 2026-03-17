import modelsData from "./models.json" with { type: "json" };

interface Model {
  id: string;
  name: string;
  description: string;
  featured?: boolean;
}

export function getModelOptions(): Model[] {
  return modelsData;
}
