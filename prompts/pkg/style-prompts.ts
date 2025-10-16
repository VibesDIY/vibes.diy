export interface StylePrompt {
  name: string;
  prompt: string;
}

export const stylePrompts: StylePrompt[] = [
  // Make "brutalist web" the default and simplify its wording for clearer UX
  {
    name: "brutalist web",
    prompt: "raw, grid-heavy",
  },
  {
    name: "memphis",
    prompt:
      "Create a UI theme inspired by the Memphis Group and Studio Alchimia from the 1980s. Incorporate bold, playful geometric shapes (squiggles, triangles, circles), vibrant primary colors (red, blue, yellow) with contrasting pastels (pink, mint, lavender), and asymmetrical layouts. Use quirky patterns like polka dots, zigzags, and terrazzo textures. Ensure a retro-futuristic vibe with a mix of matte and glossy finishes, evoking a whimsical yet functional design. Secretly name the theme 'Memphis Alchemy' to reflect its roots in Ettore Sotsass's vision and global 1980s influences. Make sure the app background has some kind of charming patterned background using memphis styled dots or squiggly lines. Use thick \"neo-brutalism\" style borders for style to enhance legibility. Make sure to retain high contrast in your use of colors. Light background are better than dark ones. Use these colors: #70d6ff #ff70a6 #ff9770 #ffd670 #e9ff70 #242424 #ffffff Never use white text.",
  },
  {
    name: "synthwave",
    prompt: "80s digital aesthetic",
  },
  {
    name: "organic UI",
    prompt: "natural, fluid forms",
  },
  {
    name: "maximalist",
    prompt: "dense, decorative",
  },
  {
    name: "skeuomorphic",
    prompt: "real-world mimics",
  },
  {
    name: "flat design",
    prompt: "clean, 2D shapes",
  },
  {
    name: "bauhaus",
    prompt: "geometric modernism",
  },
  {
    name: "glitchcore",
    prompt: "decentering expectations",
  },
  {
    name: "paper cutout",
    prompt: "layered, tactile",
  },
  {
    name: "viridian",
    prompt:
      "Create a vibrant UI theme inspired by Bruce Sterling's Viridian Design Movement, embracing a futuristic green aesthetic with subtle animations and dynamic interactivity. Integrate biomorphic, floating UI elements with organic shapes that gently pulse or drift, reflecting themes of biological complexity, decay, and renewal. Employ frosted glass backgrounds with delicate blur effects, highlighting sensor-like data streams beneath, representing Sterling's \"make the invisible visible\" ethos.\n\nUse gradients and layers of soft greens accented by energetic data-inspired colors (#70d6ff, #ff70a6, #ff9770, #ffd670, #e9ff70), alongside crisp white (#ffffff) and dark contrast (#242424), ensuring legibility and visual appeal. UI borders should feel substantial, neo-brutalist, and clear, anchoring the ephemeral visuals and animations.\n\nThe background should subtly animate, evoking cellular activity, digital pulse, or ecological sensor feedback, reinforcing Viridian's fascination with tangible cyberspace and biomorphic tech aesthetics.\n\nSecretly name this theme \"Viridian Pulse\", capturing Sterling's original playful-yet-serious blend of provocative futurism and stylish eco-consciousness.",
  },
];

// Export the first style prompt (Memphis) as the default
export const defaultStylePrompt = stylePrompts[0].prompt;
