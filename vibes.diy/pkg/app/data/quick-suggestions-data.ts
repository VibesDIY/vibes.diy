// Static export of the quick suggestions data
// This avoids issues with YAML parsing in test environments

export interface Suggestion {
  label: string;
  text: string;
}

export const quickSuggestions: Suggestion[] = [
  {
    label: "Event Tracker",
    text: "Create an event schedule app where you add acts with stage and time, and star your favorites. Include a text area to paste and parse any schedule.",
  },
  {
    label: "Dream Job",
    text: "Take my photo with the camera, ask me my dream job, then generate a fun caricature of me doing that job. Post it to a public gallery so everyone can see each other's dream jobs.",
  },
  {
    label: "History Quest",
    text: "Create a history RPG where the AI writes a short scene set in a real era, then gives you 3 choices. Each choice leads to a new scene. Track your score.",
  },
  {
    label: "Jam Session",
    text: "Create a drum machine with tempo control, 8 pattern slots, and a step sequencer grid. Use createOscillator for hi-hats, kicks, and snares.",
  },
  {
    label: "Brain Dump",
    text: "Create a task tracker with freeform textarea entry, that sends the text to AI to create task list items using json, and tag them into the selected list.",
  },
  {
    label: "Photo Wall",
    text: "Image auto-tagger app that automatically saves, analyzes, tags, and describes images, displaying them in a masonry grid as soon as they're dropped on the page, adding tags and descriptions as they come back.",
  },
  {
    label: "Legends Chat",
    text: "Chat with historical legends — pick a figure and have a conversation. Results are streamed live.",
  },
  {
    label: "DJ Playlist",
    text: "Describe your mood and AI curates the perfect playlist with YouTube search links for each track.",
  },
  {
    label: "Money Moves",
    text: "Personal finance calculator with student loan payoff, compound interest, and retirement goal visualizations.",
  },
  {
    label: "Pigment Studio",
    text: "Full-screen painting app with only natural earth pigments on the palette and one gloriously oversized brush.",
  },
  {
    label: "Emoji Chef",
    text: "AI recipe generator that uses emoji for ingredients. An AI food critic tastes your creations and roasts them with scores.",
  },
  {
    label: "Meet Up",
    text: "Paste two people's availability and AI instantly finds the best overlapping times to meet.",
  },
  {
    label: "Sky Gradient",
    text: "Fetch real weather from the National Weather Service API for Key West, Florida and render the sky as a live CSS gradient.",
  },
  {
    label: "Focus Timer",
    text: "Pomodoro timer with multiple concurrent timers, work/break intervals, and session stats. Persists across page refreshes.",
  },
  {
    label: "Zen Toggle",
    text: "A single checkbox on a blank page. Checked: pure white. Unchecked: total darkness.",
  },
  {
    label: "Ocean Palette",
    text: "Color picker for maritime and ocean hues. Pick a color and AI names it, or type a poetic name and AI finds the shade.",
  },
  {
    label: "Literary Vistas",
    text: "Three famous landscape descriptions from American literature. Choose one and AI renders it as an image.",
  },
  {
    label: "Cat Portrait",
    text: "Pick an emoji from a board and AI generates a photorealistic portrait of an orange Persian tabby incorporating your choice.",
  },
  {
    label: "Loop Machine",
    text: "Music loop composition tool with an 8-step sequencer using createOscillator, with distinct tones per instrument track.",
  },
  {
    label: "Trivia Night",
    text: "Game show trivia — pick any topic, AI generates questions and judges your answers. Styled like a retro board game.",
  },
  {
    label: "Brick Breaker",
    text: "Full-screen paddle-and-ball game with sound effects via createOscillator. Break bricks, grab power-ups, survive the speed-up.",
  },
  {
    label: "Memory Match",
    text: "Flip-and-match card game with custom images and satisfying sound effects on every pair.",
  },
  {
    label: "Flash Study",
    text: "Flashcard app — pick any topic and AI generates a study deck you can flip through and shuffle.",
  },
  {
    label: "ASCII Cam",
    text: "Live camera feed converted to ASCII art in real time. Watch yourself rendered in characters.",
  },
  {
    label: "Still Life 3D",
    text: "Three.js scene recreating Paul Cézanne's The Basket of Apples in navigable 3D.",
  },
  {
    label: "Guitar",
    text: "Hendrix-style guitar solo machine using Web Audio API — sawtooth oscillators, wah-wah filter sweeps, feedback distortion, whammy bar dives, and pentatonic shredding with human-like timing. Crank the gain and let it rip.",
  },
  {
    label: "Wildcard",
    text: "Roll the dice — AI generates a completely unexpected app you didn't know you wanted.",
  },
];

// Named exports for specific prompts used in the create page
export const partyPlannerPrompt = "Create a party planning app with guest list, RSVP tracking, and budget calculator.";
export const progressTrackerPrompt = "Create a random app idea and build it automatically.";
export const eventTrackerPrompt =
  "Create an event schedule app where you add acts with stage and time, and star your favorites. Include a text area to paste and parse any schedule.";
export const historyQuestPrompt =
  "Create a history RPG where the AI writes a short scene set in a real era, then gives you 3 choices. Each choice leads to a new scene. Track your score.";
export const jamSessionPrompt =
  "Create a drum machine with tempo control, 8 pattern slots, and a step sequencer grid. Use createOscillator for hi-hats, kicks, and snares.";
