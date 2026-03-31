import { type } from "arktype";
import modelsData from "./models.json" with { type: "json" };
import { Model } from "@vibes.diy/api-types";

export function getModelOptions(): Model[] {
  return Model.array()(modelsData).filter((m): m is Model => !(m instanceof type.errors));
}
