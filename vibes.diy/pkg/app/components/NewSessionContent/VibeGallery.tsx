import React from "react";
import VibeGalleryCard from "./VibeGalleryCard.js";
import { FaceIcon1, FaceIcon2, FaceIcon3, FaceIcon4 } from "@vibes.diy/base";
import { getVibeGalleryWrapperStyle } from "./NewSessionContent.styles.js";

interface Category {
  label: string;
  prompts: string[];
}

const categories: Category[] = [
  {
    label: "Music",
    prompts: [
      "Drum machine with tempo slider, 8 saveable patterns, and a step sequencer grid that lights up as it plays.",
      "Loop station — layer oscillator tracks on an 8-step sequencer, each instrument a different waveform color.",
      "Chord progression explorer: pick a key, see common progressions, hear them play with one click.",
      "Soundboard with 16 neon pads that ripple when tapped — load your own sounds or use built-in kits.",
      "Name-that-tune quiz — AI hums a melody with oscillators and you guess the song.",
      "Piano roll editor where you paint notes on a grid and hear them play back instantly.",
      "BPM tapper — tap any rhythm and it locks onto your tempo with a pulsing visual.",
      "Lo-fi chill generator — ambient rain, vinyl crackle, and lazy chord loops you can tweak.",
      "Karaoke scroller — paste lyrics, set the tempo, and words highlight in time.",
      "Synth playground with oscillator waveforms, filter sweeps, and a draggable ADSR envelope.",
    ],
  },
  {
    label: "Games",
    prompts: [
      "Brick breaker with sound effects, power-up drops, and levels that speed up until you can't keep up.",
      "Trivia night — pick any topic, AI writes the questions and roasts wrong answers. Retro board-game style.",
      "Emoji memory match — flip cards, find pairs, beat your best time with confetti on completion.",
      "Snake with arrow keys, a growing neon tail, and a high-score board that persists.",
      "AI hangman — pick a category, AI picks the word, and a stick figure's fate is in your hands.",
      "Reflex test — screen flashes a random color, smash the button and see your reaction time in milliseconds.",
      "Infinite maze — a new random maze every round, navigate with arrow keys, timer ticking.",
      "Speed typer — random sentences fly in, type them out, and watch your WPM climb.",
      "Rock-paper-scissors showdown against AI with animated throws and a win-streak counter.",
      "2048 puzzle — slide numbered tiles, merge them, and chase the elusive 2048 tile.",
    ],
  },
  {
    label: "Productive",
    prompts: [
      "Brain dump — type anything, AI parses it into tagged task items and sorts them into your lists.",
      "Pomodoro dashboard with multiple concurrent timers, break reminders, and session stats that survive refresh.",
      "Schedule smasher — paste two people's availability, AI instantly spots the best overlap.",
      "Compound interest visualizer with student loan payoff curves and retirement countdown.",
      "Habit streak tracker — daily check-ins, flame streaks, and a gentle nudge when you slip.",
      "Kanban board with buttery drag-and-drop across To Do, Doing, and Done columns.",
      "Meeting notes app — bullet-point capture during the call, AI summary at the end.",
      "Goal tracker with milestones, a visual progress bar, and celebratory animations on completion.",
      "Bookmark vault — save links, auto-tag by topic, search everything instantly.",
      "Daily journal with a mood picker and AI-generated reflection prompts to end your day.",
    ],
  },
  {
    label: "Creative",
    prompts: [
      "Pigment studio — full-screen painting with only earth-tone pigments and one gloriously oversized brush.",
      "Ocean palette — pick maritime colors and AI gives them poetic names, or type a name and AI finds the hue.",
      "ASCII cam — live camera feed rendered as scrolling characters in real time.",
      "Three.js still life — navigate around Cézanne's Basket of Apples in explorable 3D.",
      "Pixel art editor with a 16×16 grid, custom palette, and export to PNG.",
      "Gradient lab — pick two colors, see every CSS gradient variant, copy the code.",
      "Generative art machine — random geometric compositions you can tweak and save as SVG.",
      "Emoji mosaic — drop in a photo and watch it rebuild itself entirely out of emoji.",
      "Font tester — type a phrase and preview it across 20 Google Fonts side by side.",
      "Mandala maker with radial symmetry — draw in one slice and it mirrors everywhere.",
      "Sandwich artist — describe your dream sandwich in words and AI generates a mouthwatering image of it.",
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
    <div style={getVibeGalleryWrapperStyle(isMobile)}>
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
