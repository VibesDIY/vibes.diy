import type { ComponentType } from "react";
import AmbientDot from "./apps/AmbientDot.js";
import StepSequencer from "./apps/StepSequencer.js";
import ChordExplorer from "./apps/ChordExplorer.js";
import PlaceholderApp from "./apps/PlaceholderApp.js";

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

// --- Music tree ---
registerStarterApp({
  id: "music-ambient",
  category: "music",
  title: "Ambient Dot",
  component: AmbientDot,
  chiclets: [
    { label: "Drum machine", targetId: "music-sequencer", variant: "blue" },
    { label: "Chord explorer", targetId: "music-chords", variant: "red" },
  ],
});

registerStarterApp({
  id: "music-sequencer",
  category: "music",
  title: "Step Sequencer",
  component: StepSequencer,
  chiclets: [
    { label: "Chord explorer", targetId: "music-chords", variant: "blue" },
    { label: "Ambient dot", targetId: "music-ambient", variant: "yellow" },
  ],
});

registerStarterApp({
  id: "music-chords",
  category: "music",
  title: "Chord Explorer",
  component: ChordExplorer,
  chiclets: [
    { label: "Drum machine", targetId: "music-sequencer", variant: "yellow" },
    { label: "Ambient dot", targetId: "music-ambient", variant: "blue" },
  ],
});

// --- Placeholder trees (one root node each) ---
function makePlaceholder(id: string, category: "creative" | "productive" | "games", title: string): StarterNode {
  return {
    id,
    category,
    title,
    component: () => PlaceholderApp({ category: title }),
    chiclets: [
      { label: "Coming soon", targetId: id, variant: "blue" },
      { label: "Coming soon", targetId: id, variant: "red" },
    ],
  };
}

registerStarterApp(makePlaceholder("creative-canvas", "creative", "Creative"));
registerStarterApp(makePlaceholder("productive-notes", "productive", "Productive"));
registerStarterApp(makePlaceholder("games-reflex", "games", "Games"));
