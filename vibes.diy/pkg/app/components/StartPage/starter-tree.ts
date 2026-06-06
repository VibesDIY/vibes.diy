import type { ComponentType } from "react";

type ButtonVariant = "blue" | "red" | "yellow";

export interface Chiclet {
  label: string;
  targetId: string;
  variant: ButtonVariant;
}

export interface StarterNode {
  id: string;
  category: "music" | "creative" | "productive" | "games";
  title: string;
  component: ComponentType;
  chiclets: [Chiclet, Chiclet];
}

export const CATEGORY_ROOTS: Record<string, string> = {
  Music: "music-ambient",
  Creative: "creative-canvas",
  Productive: "productive-notes",
  Games: "games-reflex",
};

const tree = new Map<string, StarterNode>();

export function registerStarterApp(node: StarterNode) {
  tree.set(node.id, node);
}

export function getStarterNode(id: string): StarterNode | undefined {
  return tree.get(id);
}

export function getCategoryRootId(category: string): string | undefined {
  return CATEGORY_ROOTS[category];
}
