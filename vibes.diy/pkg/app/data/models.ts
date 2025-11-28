import modelsData from "./models.json" with { type: "json" };

export interface Model {
  id: string;
  name: string;
  description: string;
  featured?: boolean;
}

export const allModels: Model[] = modelsData;

export const featuredModels: Model[] = allModels.filter((m) => m.featured);
