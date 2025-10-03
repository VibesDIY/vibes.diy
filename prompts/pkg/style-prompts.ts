export interface StylePrompt {
  name: string;
  prompt: string;
}

export const stylePrompts: StylePrompt[] = [
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
    name: "brutalist web",
    prompt:
      'Create a UI theme in a neo-brutalist style: blocky geometry, oversized controls, thick 4-12px outlines, and big bold offsets (hard shadow plates offset 6-12px bottom-right; active press reduces offset by 2-4px). Use grid/blueprint cues—graph lines, micro-dots, hatch/stipple textures—on flat matte surfaces; reserve subtle gloss only for CTAs. Background (only skeuomorphic element): grey-blue graph paper via CSS—base #f1f5f9, grid from repeating-linear-gradients in #cbd5e1/#94a3b8 at 16-24px; add a fullscreen grain layer (SVG turbulence or 1px noise PNG) at 3-6% opacity with filter: blur(0.4-0.8px) contrast(102%) brightness(101%); lock to viewport. Corner rule: components are either square (0px radius) or very rounded (50% of component height)—no in-between. Mobile-first layout: single-column flow on phones, 4/8/16/24 spacing scale, tap targets >= 48x48, sticky header + bottom nav; expand to 2-4 columns at sm >= 640 / md >= 768 / lg >= 1024 with asymmetric stacks. Maintain high contrast on light backgrounds. Secret name "Neobrute Blueprint." Use these colors: #f1f5f9 #cbd5e1 #94a3b8 #64748b #0f172a #242424 #ffffff. Never use white text; #ffffff is for surfaces only.',
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
