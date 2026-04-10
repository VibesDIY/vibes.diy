import React from "react";
import VibeGalleryCard from "./VibeGalleryCard.js";
import { FaceIcon1, FaceIcon2, FaceIcon3, FaceIcon4 } from "@vibes.diy/base";

interface Category {
  label: string;
  prompts: string[];
}

const categories: Category[] = [
  {
    label: "Music",
    prompts: [
      "Create a drum machine with tempo control, 8 pattern slots, and a step sequencer grid.",
      "A music loop composition tool that uses createOscillator to make an 8-step sequencer with distinct tones for each instrument.",
      "Build a chord progression explorer where I pick a key and it shows me common progressions with playback.",
      "Create a soundboard app with 16 pads that play different samples when tapped.",
      "Build a music quiz that plays short clips and I guess the song title.",
      "Create a piano roll editor where I can draw notes and hear them play back.",
      "Build a BPM tapper — I tap a button and it calculates the tempo.",
      "Create a lo-fi beat generator with ambient rain sounds and chill chords.",
      "Build a karaoke lyrics scroller that syncs with a timer.",
      "Create a synthesizer with oscillator controls, filter, and ADSR envelope.",
    ],
  },
  {
    label: "Games",
    prompts: [
      "A full screen paddle-and-ball game where the goal is to break all bricks. Start slow and speed up each level.",
      "Trivia game show that lets me pick a topic, and uses AI to make questions and judge answers. Style like a board game.",
      "Memory matching game with emoji cards that flip when clicked.",
      "Create a snake game with arrow key controls and a growing tail.",
      "Build a word guessing game like hangman with AI-generated words by category.",
      "Create a reaction time tester — click as fast as you can when the screen changes color.",
      "Build a maze generator that creates a new random maze each time, solvable with arrow keys.",
      "Create a typing speed test with random sentences and WPM calculation.",
      "Build a rock-paper-scissors game against AI with score tracking.",
      "Create a 2048 number sliding puzzle game.",
    ],
  },
  {
    label: "Productive",
    prompts: [
      "Create a task tracker with freeform textarea entry, that sends the text to AI to create task list items using json.",
      "Create a pomodoro timer app with multiple timers, work/break intervals, and session tracking.",
      "Two text areas, paste the availability for each person, and AI finds the best time to meet.",
      "Create a personal finance calculator with student loan and compound interest formulas.",
      "Build a habit tracker with daily checkboxes and a streak counter.",
      "Create a kanban board with drag-and-drop columns: To Do, Doing, Done.",
      "Build a meeting notes app that records bullet points and generates a summary with AI.",
      "Create a goal tracker where I set milestones and track progress with a visual bar.",
      "Build a bookmark manager that categorizes links and lets me search by tag.",
      "Create a daily journal with mood selector and AI-generated reflection prompts.",
    ],
  },
  {
    label: "Creative",
    prompts: [
      "Create a super simple full-screen painting app with only natural pigments on the palette and one humongous brush.",
      "Give me a color picker specifically for maritime and ocean colors. When I'm happy with a color, use AI to name it.",
      "Get live camera and convert it to ascii art in real time.",
      "Use three.js to create a 3D scene of Paul Cézanne's The Basket of Apples.",
      "Build a pixel art editor with a 16x16 grid and color palette.",
      "Create a gradient generator where I pick two colors and it shows me CSS gradients.",
      "Build a generative art tool that makes random geometric patterns I can save.",
      "Create an emoji mosaic maker — upload an image and it reconstructs it with emojis.",
      "Build a font preview tool where I type text and see it in 20 different Google Fonts.",
      "Create a mandala drawing tool with radial symmetry — draw on one section and it mirrors everywhere.",
    ],
  },
];

interface VibeGalleryProps {
  count?: number;
  isMobile?: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export default function VibeGallery({ count = 4, isMobile = false, onSelectPrompt }: VibeGalleryProps) {
  const faceIcons = [FaceIcon1, FaceIcon2, FaceIcon3, FaceIcon4];
  const displayCategories = categories.slice(0, count);

  return (
    <div className={`flex flex-wrap items-center justify-center ${isMobile ? "gap-3 p-3" : "gap-2.5 p-6"} w-full`}>
      {displayCategories.map((category, index) => (
        <VibeGalleryCard
          key={category.label}
          category={category.label}
          prompts={category.prompts}
          IconComponent={faceIcons[index % faceIcons.length]}
          isMobile={isMobile}
          onSelectPrompt={onSelectPrompt}
        />
      ))}
    </div>
  );
}
