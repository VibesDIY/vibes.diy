// Static export of the quick suggestions data
// This avoids issues with YAML parsing in test environments

export interface Suggestion {
  label: string;
  text: string;
}

export const quickSuggestions: Suggestion[] = [
  {
    label: "Tasks",
    text: "Create a task tracker with freeform textarea entry, that sends the text to AI to create task list items using json, and tag them into the selected list.",
  },
  {
    label: "Photos",
    text: "Image auto-tagger app that automatically saves, analyzes, tags, and describes images, displaying them in a list view as soon as they're dropped on the page, adding tags and descriptions as they come back.",
  },
  {
    label: "Chat",
    text: "Chat with legends, results are streamed and then queried by legendId.",
  },
  {
    label: "Playlist",
    text: "I send messages and AI responds with a playlist for me, with YouTube search links for each song.",
  },
  {
    label: "Finance",
    text: "Create a personal finance calculator with student loan and compound interest formulas, and retirement goal tracking.",
  },
  {
    label: "Paint",
    text: "Create a super simple full-screen painting app with only natural pigments on the palette and one humongous brush.",
  },
  {
    label: "Cook",
    text: "Make an AI receipe generator that uses emoji for ingredients. Give me an AI critic who will taste the recipes and score them.",
  },
  {
    label: "Schedule",
    text: "Two text areas, paste the availability for each person, and AI finds the best time to meet.",
  },
  {
    label: "Weather API",
    text: "Use the National Weather Service API to get the weather in Key West, Florida. Render a CSS gradient to represent the sky under those conditions.",
  },
  // {
  //   label: 'Guitar',
  //   text: "Create Hendrix-like guitar solos with Web Audio API: Set up oscillators (ctx.createOscillator()) with 'sawtooth' waveforms for guitar-like harmonics, use modulator.connect(modulationGain).connect(carrier.frequency) for expressive bends and feedback effects, create signature wah-wah with BiquadFilter (filter.frequency.setValueAtTime() + automated sweeps), simulate feedback using high modulationGain.gain values, achieve dramatic dives with carrier.frequency.exponentialRampToValueAtTime(), implement string bending/vibrato by modulating pitch with LFOs, create percussive attacks with gainNode.gain.linearRampToValueAtTime() for fast attack/sustain, and simulate whammy bar techniques with rapid frequency wobbles. Add distortion via WaveShaperNode with custom curves for that iconic fuzz tone, and schedule phrases with setTimeout()/Math.random() for human-like timing variations in pentatonic patterns. Average carrier wave around 1kHz, note density: rests are rare.",
  // },
  {
    label: "Timer",
    text: "Create a pomodoro timer app with multiple timers, work/break intervals, and session tracking. Save time start times so I can refresh the page with running timers.",
  },
  {
    label: "Toggle",
    text: "Put a checkbox on a blank page. When checked, the page is white. When unchecked, the page is black.",
  },
  {
    label: "Color Picker",
    text: "Give me a color picker specifically for maritime and ocean colors. When I'm happy with a color, use AI to name it. Also let me type in a color name and have AI pick an actual color.",
  },
  {
    label: "Landscape",
    text: "Show me three quotes of famous landscape descriptions from American literature. Give me the option to render those landscapes with images using AI.",
  },
  {
    label: "Cat Portrait",
    text: "Let me pick an emoji from a small board. Generate a photorealistic portrait of orange Persian tabby cat incorporating the selected emoji.",
  },
  {
    label: "Music",
    text: "A music loop composition tool that uses createOscillator to make an 8-step sequencer with distinct tones for each instrument.",
  },
  {
    label: "Quiz",
    text: "Trivia game show that lets me pick a topic, and uses AI to make questions and judge answers. Style like a board game.",
  },
  {
    label: "Blocks",
    text: "A full screen paddle-and-ball game where a horizontal paddle at the bottom of the screen follows the mouse or jumps to touch locations, and the goal is to bounce a ball upward. Use createOscillator for sound effects. The ball breaks a wall of bricks at the top, and the goal is to clear all bricks without letting the ball fall. Start slow and speed up each level. Power-ups drop from some bricks, adding effects like multiple balls, lasers, or a wider paddle.",
  },
  {
    label: "Memory",
    text: "Memory matching game with custom images and sound effects.",
  },
  {
    label: "Flashcards",
    text: "Flashcard study app that prompts for a topic.",
  },
  {
    label: "Camera",
    text: "Get live camera and convert it to ascii.",
  },
  {
    label: "3D",
    text: "Use three js to create a 3D scene of Paul Cézanne's The Basket of Apples.",
  },
  {
    label: "Wildcard",
    text: "Generate a wildcard app, something I wouldn't expect.",
  },
  {
    label: "Party Planner",
    text: "Create a party planning app with guest list, RSVP tracking, and budget calculator.",
  },
  {
    label: "Progress Tracker",
    text: "Build a goal tracker with progress bars, streak counters, and milestone celebrations.",
  },
  {
    label: "Jam Session",
    text: "Create a music collaboration tool with chord progressions and shared lyrics editor.",
  },
];

// Named exports for specific prompts used in the create page
export const partyPlannerPrompt =
  "Create a party planning app with guest list, RSVP tracking, and budget calculator.";
export const progressTrackerPrompt =
  "Build a goal tracker with progress bars, streak counters, and milestone celebrations.";
export const jamSessionPrompt =
  "Create a music collaboration tool with chord progressions and shared lyrics editor.";
