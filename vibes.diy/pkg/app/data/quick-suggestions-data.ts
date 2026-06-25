// Static export of the quick suggestions data
// This avoids issues with YAML parsing in test environments

export interface Suggestion {
  label: string;
  text: string;
}

export const quickSuggestions: Suggestion[] = [
  {
    label: "Character Bot",
    text: "Create a chat app where I design a character — name, personality, and speaking style — then have a conversation with them. Let me edit the character's style anytime, keep my drafts private, and publish the ones I like to a public gallery others can chat with.",
  },
  {
    label: "Neighborhood Map",
    text: "Create a community resource map where anyone can add local resources (food banks, shelters, free wifi) with name, address, hours, and category — everyone's contributions show up in a shared, filterable list the whole neighborhood can browse.",
  },
  {
    label: "Workout Log",
    text: "Create a workout tracker where I log exercises, sets, reps, and weight each session, see my progress over time, and can share my routine for others to copy.",
  },
  {
    label: "Chord Maker",
    text: "Create a chord progression generator for songwriting — pick a key and mood, hear it play back with the Web Audio API, tweak each chord, and save the progressions you like.",
  },
  {
    label: "Event Tracker",
    text: "Create a festival schedule app where a group builds a shared lineup of acts with stage and time, and each person stars their own favorites. Include a text area to paste and parse any schedule.",
  },
  {
    label: "Dream Job",
    text: "Take my photo with the camera, ask me my dream job, then generate a fun caricature of me doing that job. Post it to a public gallery so everyone can see each other's dream jobs.",
  },
  {
    label: "History Quest",
    text: "Create a history RPG where the AI writes a short scene set in a real era, then gives you 3 choices. Each choice leads to a new scene. Track your score on a public leaderboard.",
  },
  {
    label: "Jam Session",
    text: "Create a drum machine with tempo control, 8 pattern slots, and a step sequencer grid. Use createOscillator for hi-hats, kicks, and snares.",
  },
  {
    label: "Brain Dump",
    text: "Create a task tracker with freeform textarea entry that sends the text to AI to create task list items using json, tags them into the selected list, and lets you keep a list private or invite someone to share it.",
  },
  {
    label: "Photo Wall",
    text: "Shared photo wall where anyone can drop in images that auto-save, analyze, tag, and describe themselves, appearing in a masonry grid everyone can browse as the tags and descriptions come back.",
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
    text: "Create a shared availability poll — invite people to mark when they're free and AI instantly finds the best overlapping time to meet.",
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
export const partyPlannerPrompt =
  "Create a party planning app with a shared guest list where invitees RSVP themselves, plus collaborative budget tracking.";
export const progressTrackerPrompt = "Create a random app idea and build it automatically.";
export const eventTrackerPrompt =
  "Create a festival schedule app where a group builds a shared lineup of acts with stage and time, and each person stars their own favorites. Include a text area to paste and parse any schedule.";
export const historyQuestPrompt =
  "Create a history RPG where the AI writes a short scene set in a real era, then gives you 3 choices. Each choice leads to a new scene. Track your score on a public leaderboard.";
export const jamSessionPrompt =
  "Create a drum machine with tempo control, 8 pattern slots, and a step sequencer grid. Use createOscillator for hi-hats, kicks, and snares.";
