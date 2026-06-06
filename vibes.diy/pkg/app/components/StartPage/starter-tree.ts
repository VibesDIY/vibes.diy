import type { ComponentType } from "react";
import AmbientDot from "./apps/AmbientDot.js";
import StepSequencer from "./apps/StepSequencer.js";
import ChordExplorer from "./apps/ChordExplorer.js";
import PlaceholderApp from "./apps/PlaceholderApp.js";
import TodoApp from "./apps/TodoApp.js";
import SurveyApp from "./apps/SurveyApp.js";
import KanbanApp from "./apps/KanbanApp.js";
import HabitTrackerApp from "./apps/HabitTrackerApp.js";
import JobApplicationsApp from "./apps/JobApplicationsApp.js";
import PhotoLabApp from "./apps/PhotoLabApp.js";
import PizzaVoteApp from "./apps/PizzaVoteApp.js";

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
  Productive: "productive-todo",
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
registerStarterApp(makePlaceholder("games-reflex", "games", "Games"));

// --- Productive tree ---
registerStarterApp({
  id: "productive-todo",
  category: "productive",
  title: "Todo",
  component: TodoApp,
  chiclets: [
    { label: "Survey", targetId: "productive-survey", variant: "blue" },
    { label: "Kanban", targetId: "productive-kanban", variant: "red" },
  ],
});

registerStarterApp({
  id: "productive-survey",
  category: "productive",
  title: "Survey",
  component: SurveyApp,
  chiclets: [
    { label: "Pizza Vote", targetId: "productive-pizza-vote", variant: "yellow" },
    { label: "Job Applications", targetId: "productive-job-apps", variant: "blue" },
  ],
});

registerStarterApp({
  id: "productive-kanban",
  category: "productive",
  title: "Kanban",
  component: KanbanApp,
  chiclets: [
    { label: "Photo Lab Queue", targetId: "productive-photo-lab", variant: "yellow" },
    { label: "Habit Tracker", targetId: "productive-habits", variant: "blue" },
  ],
});

registerStarterApp({
  id: "productive-pizza-vote",
  category: "productive",
  title: "Pizza Vote",
  component: PizzaVoteApp,
  chiclets: [
    { label: "Job Applications", targetId: "productive-job-apps", variant: "red" },
    { label: "Habit Tracker", targetId: "productive-habits", variant: "yellow" },
  ],
});

registerStarterApp({
  id: "productive-job-apps",
  category: "productive",
  title: "Job Applications",
  component: JobApplicationsApp,
  chiclets: [
    { label: "Pizza Vote", targetId: "productive-pizza-vote", variant: "blue" },
    { label: "Photo Lab Queue", targetId: "productive-photo-lab", variant: "red" },
  ],
});

registerStarterApp({
  id: "productive-photo-lab",
  category: "productive",
  title: "Photo Lab Queue",
  component: PhotoLabApp,
  chiclets: [
    { label: "Habit Tracker", targetId: "productive-habits", variant: "blue" },
    { label: "Job Applications", targetId: "productive-job-apps", variant: "yellow" },
  ],
});

registerStarterApp({
  id: "productive-habits",
  category: "productive",
  title: "Habit Tracker",
  component: HabitTrackerApp,
  chiclets: [
    { label: "Photo Lab Queue", targetId: "productive-photo-lab", variant: "red" },
    { label: "Pizza Vote", targetId: "productive-pizza-vote", variant: "yellow" },
  ],
});
