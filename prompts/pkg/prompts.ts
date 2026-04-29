import type { UserSettings } from "./settings.js";
import { loadAsset, KeyedResolvOnce } from "@adviser/cement";
import { getLlmCatalog, getLlmCatalogNames, LlmCatalogEntry } from "./json-docs.js";
import { type } from "arktype";

// import { getTexts } from "./txt-docs.js";
import { defaultStylePrompt } from "./style-prompts.js";

// Single source of truth for the default coding model used across the repo.
export const DEFAULT_CODING_MODEL = "anthropic/claude-opus-4.5" as const;

async function defaultCodingModel() {
  return DEFAULT_CODING_MODEL;
}

function normalizeModelIdInternal(id: unknown): string | undefined {
  if (typeof id !== "string") return undefined;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeModelId(id: unknown): string | undefined {
  return normalizeModelIdInternal(id);
}

export function isPermittedModelId(id: unknown): id is string {
  return typeof normalizeModelIdInternal(id) === "string";
}

export async function resolveEffectiveModel(
  settingsDoc?: { model?: string },
  vibeDoc?: { selectedModel?: string }
): Promise<string> {
  const sessionChoice = normalizeModelIdInternal(vibeDoc?.selectedModel);
  if (sessionChoice) return sessionChoice;
  const globalChoice = normalizeModelIdInternal(settingsDoc?.model);
  if (globalChoice) return globalChoice;
  return defaultCodingModel();
}

export async function getDefaultSkills(): Promise<string[]> {
  return ["fireproof", "callai", "img-vibes", "web-audio"];
}

/**
 * Builds the user-message body for the pre-allocation LLM call. Includes the
 * skill catalog (name + one-line description per entry) so the model can pick
 * valid skill names, plus the user's raw prompt. Invalid names returned by the
 * model are filtered out at read time (`makeBaseSystemPrompt` → catalog guard),
 * so name-misses fail silently.
 */
export async function makePreAllocUserMessage(userPrompt: string): Promise<string> {
  const catalog = await getLlmCatalog();
  const catalogText = catalog.map((l) => `- ${l.name}: ${l.description}`).join("\n");
  return [
    "Pick skills from this catalog that fit the user's app request, and propose 3 title/slug pairs for naming.",
    "",
    "Skill catalog:",
    catalogText,
    "",
    "User request:",
    userPrompt,
  ].join("\n");
}

/**
 * callAI schema for the pre-allocation call — the two halves of the pre-alloc
 * contract (user message + schema) live together here so descriptions stay in
 * sync with the message composition above.
 */
export const preAllocSchema = {
  name: "pre_alloc",
  properties: {
    skills: {
      type: "array",
      description:
        "Selected skill names from the catalog above, appropriate for the app described by the user prompt. Only use names present in the catalog.",
      items: { type: "string" },
    },
    pairs: {
      type: "array",
      description:
        "Exactly 3 title/slug pairs ranked by fit. Title in Title Case, 1-4 words. Slug in kebab-case derived from title.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
        },
      },
    },
  },
} as const;

/** arktype validator for parsed pre-alloc responses. Matches preAllocSchema. */
export const preAllocParsed = type({
  skills: type("string").array(),
  pairs: type({ title: "string", slug: "string" }).array(),
});
export type PreAllocParsed = typeof preAllocParsed.infer;

export interface SystemPromptResult {
  systemPrompt: string;
  skills: string[];
  demoData: boolean;
  model: string;
}

// function escapeRegExp(str: string): string {
//   return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// const llmImportRegexes = Lazy(() => {
//   return getJsonDocs().then((docs) =>
//     Object.values(docs)
//       .map((d) => d.obj)
//       .filter((l) => l.importModule && l.importName)
//       .map((l) => {
//         const mod = escapeRegExp(l.importModule);
//         const name = escapeRegExp(l.importName);
//         const importType = l.importType || "named";

//         return {
//           name: l.name,
//           // Matches: import { ..., <name>, ... } from '<module>'
//           named: new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['\\"]${mod}['\\"]`),
//           // Matches: import <name> from '<module>'
//           def: new RegExp(`import\\s+${name}\\s+from\\s*['\\"]${mod}['\\"]`),
//           // Matches: import * as <name> from '<module>'
//           namespace: new RegExp(`import\\s*\\*\\s*as\\s+${name}\\s+from\\s*['\\"]${mod}['\\"]`),
//           importType,
//         } as const;
//       })
//   );
// });

export function generateImportStatements(llms: LlmCatalogEntry[]) {
  const seen = new Set<string>();
  return llms
    .slice()
    .sort((a, b) => a.importModule.localeCompare(b.importModule))
    .filter((l) => l.importModule && l.importName)
    .filter((l) => {
      const key = `${l.importModule}:${l.importName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((l) => {
      const importType = l.importType || "named";
      switch (importType) {
        case "namespace":
          return `\nimport * as ${l.importName} from "${l.importModule}"`;
        case "default":
          return `\nimport ${l.importName} from "${l.importModule}"`;
        case "named":
        default:
          return `\nimport { ${l.importName} } from "${l.importModule}"`;
      }
    })
    .join("");
}

const keyedLoadAsset = new KeyedResolvOnce();

export interface MakeBaseSystemPromptOptions {
  fetch?: typeof fetch;
}

export async function makeBaseSystemPrompt(
  model: string,
  sessionDoc: Partial<UserSettings> & MakeBaseSystemPromptOptions
): Promise<SystemPromptResult> {
  const userPrompt = sessionDoc?.userPrompt || "";
  const llmsCatalog = await getLlmCatalog();
  const llmsCatalogNames = await getLlmCatalogNames();

  const rawSkills = Array.isArray(sessionDoc?.skills) ? sessionDoc.skills : undefined;
  let selectedNames = rawSkills
    ? rawSkills.filter((v): v is string => typeof v === "string").filter((name) => llmsCatalogNames.has(name))
    : [];
  if (selectedNames.length === 0) {
    selectedNames = [...(await getDefaultSkills())];
  }
  const includeDemoData = sessionDoc?.demoData === true;

  const chosenLlms = llmsCatalog.filter((l) => selectedNames.includes(l.name));

  const concatenatedLlmsTxts: string[] = [];
  for (const llm of chosenLlms) {
    const rText = await keyedLoadAsset.get(llm.name).once(async () => {
      // console.log("Loading text asset for LLM:", llm.name, urlDirname(import.meta.url), import.meta.url);
      return loadAsset(`./llms/${llm.name}.md`, {
        fallBackUrl: "https://esm.sh/@vibes.diy/prompts/",
        basePath: () => {
          const dir = import.meta.url;
          // console.log("Base path for loading LLM text asset:", llm, dir, import.meta);
          return dir;
        },
        mock: {
          fetch: sessionDoc.fetch,
        },
        // mock: {
        //   fetch:
        //     sessionDoc.fetchText &&
        //     (async (): Promise<Response> => {
        //       if (!sessionDoc.fetchText) {
        //         console.warn("No fetchText function provided in sessionDoc for loading LLM text assets");
        //         return new Response(null, { status: 404 });
        //       }
        //       console.log(`pre-Fetched text for LLM ${llm.name} with result:`, r);
        //       const r = await sessionDoc.fetchText("prompts", `./llms/${llm.name}.md`);
        //       console.log(`post-Fetched text for LLM ${llm.name} with result:`, r);
        //       if (r.isErr()) {
        //         return new Response(null, { status: 404 });
        //       }
        //       return new Response(r.Ok(), { status: 200 });
        //     }),
        // },
      });
    });
    if (rText.isErr()) {
      console.warn(`Failed to load text for LLM ${llm.name} at path ${import.meta.dirname}/./llms/${llm.name}.md:`, rText.Err());
      continue;
    }
    // const text = await getTexts(llm.name, sessionDoc.fallBackUrl);
    // if (!text) {
    //   console.warn("Failed to load raw LLM text for:", llm.name, sessionDoc.fallBackUrl);
    //   continue;
    // }
    concatenatedLlmsTxts.push(`<${llm.label}-docs>`);
    concatenatedLlmsTxts.push(rText.Ok() ?? "");
    // console.log(`Loaded text for LLM ${llm.name}, length:`, llm.label, rText.Ok().slice(0, 100), "...");
    concatenatedLlmsTxts.push(`</${llm.label}-docs>`);
  }
  const concatenatedLlmsTxt = concatenatedLlmsTxts.join("\n");

  // defaultStylePrompt is now imported from style-prompts.js

  const stylePrompt = sessionDoc?.stylePrompt || defaultStylePrompt;

  const demoDataLines = includeDemoData
    ? `- If your app has a function that uses callAI with a schema to save data, include a Demo Data button that calls that function with an example prompt. Don't write an extra function, use real app code so the data illustrates what it looks like to use the app.\n- Never have an instance of callAI that is only used to generate demo data, always use the same calls that are triggered by user actions in the app.\n`
    : "";

  const systemPromptLines = [
    "You are an AI assistant tasked with creating React components. You should create components that:",
    "- Use modern React practices and follow the Rules of Hooks: never call hooks (useState, useDocument, useLiveQuery, etc.) inside event handlers, loops, conditions, or nested functions. To update an existing document in a click handler, use `database.put({ ...doc, fieldName: newValue })` instead of useDocument.",
    "- Don't use any TypeScript, just use JavaScript",
    "- Use Tailwind CSS for mobile-first accessible styling with bracket notation for custom colors like bg-[#242424]",
    "- Define a classNames object (e.g. `const c = { bg: 'bg-[#f1f5f9]', ink: 'text-[#0f172a]', border: 'border-[#0f172a]', accent: 'bg-[#0f172a]' }`) just before the JSX return, then use them like `className={c.ink}`. Never put raw bracket colors directly in JSX — always go through the classNames object.",
    `- Don't use words from the style prompt in your copy: ${stylePrompt}`,
    "- For dynamic components, like autocomplete, don't use external libraries, implement your own",
    "- Avoid using external libraries unless they are essential for the component to function",
    '- Always use ES module imports at the top of the file (e.g. `import React, { useState } from "react"`). Never reference React or other libraries as globals.',
    "- Your file MUST use `export default function App()` — the runtime loads it as an ES module and imports the default export.",
    "- Structure your component code in this order: (1) hooks and document shapes, (2) event handlers, (3) classNames object, (4) JSX return. ClassNames go right before JSX so they are close to where they are used.",
    "- Use Fireproof for data persistence",
    "- Use `callAI` to fetch AI, use schema like this: `JSON.parse(await callAI(prompt, { schema: { properties: { todos: { type: 'array', items: { type: 'string' } } } } }))` and save final responses as individual Fireproof documents.",
    "- Always show loading states during any async operation (callAI, fetch, database queries): use a useState boolean (e.g. `isLoading`), set it true before the call and false in .finally(). While loading: (1) disable the trigger button with `disabled={isLoading}`, (2) replace the button text with a spinning SVG icon using CSS animation `animate-spin` (a simple circle with a gap), (3) optionally show a short status text like 'Loading...' near the button. Never leave the user clicking a button with no visual feedback. Pattern: `setIsLoading(true); try { await callAI(...); } finally { setIsLoading(false); }`",
    "- For file uploads use drag and drop and store using the `doc._files` API",
    "- Don't try to generate png or base64 data, use placeholder image APIs instead, like https://picsum.photos/400 where 400 is the square size",
    "- Never use emojis in the UI. Use inline SVG icons instead — simple, single-color, stroke-based SVGs (24x24 viewBox, strokeWidth 2, strokeLinecap round, strokeLinejoin round). Build icons directly in JSX, do not import icon libraries.",
    "- Consider and potentially reuse/extend code from previous responses if relevant",
    "- Build incrementally: start with a minimal working layout, then interleave short prose descriptions with focused edits that grow the app. The user sees the preview update as each edit lands, so each step should leave the app in a working state.",
    "- Each replace edit re-mounts the live preview, so component-local state (form inputs, scroll position) resets between edits. If your app needs persisted UI state during demos, store it in Fireproof rather than React local state.",
    "- Keep your component file as short as possible for fast updates",
    "- IMPORTANT: Never change the database name from what it was in the previous code. Changing the database name loses all existing user data. If the previous code used a specific database name, you MUST use that exact same name.",
    "- The system can send you crash reports, fix them by simplifying the affected code",
    "- List data items on the main page of your app so users don't have to hunt for them",
    "- If you save data, make sure it is browsable in the app, eg lists should be clickable for more details",
    "- Add small AI-powered suggestion buttons next to form field groups and empty states. When tapped, use callAI to generate example ideas and fill them in, so users can see what's possible without typing from scratch. Use the same callAI calls the app already makes for real functionality — don't create separate AI functions just for suggestions.",
    demoDataLines,
  ];

  const titleLines = sessionDoc?.title
    ? [
        `The app is called "${sessionDoc.title}". Use this exact name in the app's heading and anywhere the app refers to itself.`,
        "",
      ]
    : [];

  const systemPrompt = [
    systemPromptLines.join("\n"),
    "",
    concatenatedLlmsTxt,
    "",
    ...titleLines,
    ...(userPrompt ? [userPrompt, ""] : []),
    "IMPORTANT: You are working in one JavaScript file (`App.jsx`). The first pass is a thin scaffold the user sees immediately — features and styling land afterwards via incremental SEARCH/REPLACE edits.",
    "",
    "Before writing code, provide a title and brief description of the app. Then list the top 3 features that are the best fit for a mobile web database with real-time collaboration and describe a short planned workflow showing how those features connect into a coherent user experience.",
    "",
    "## Output format (incremental edits)",
    "",
    "Every code block must be preceded by the file name on its own line. The file is `App.jsx`.",
    "",
    "**After the description prose, emit a thin scaffold as a single fenced block. Target ~40 lines.** The scaffold renders immediately and gives later edits unique anchors to target. It must contain:",
    "- the import statements (react + the libraries listed below)",
    "- a `classNames` object with **short, working Tailwind values for the layout-level keys** (`page`, `header`, the app title, the feature section frame). Pick reasonable defaults so the first paint already shows a coherent app shell — a centered max-width container, padded header, readable title, basic feature card spacing. Keep each value short (one line, ≤80 chars). Detailed component-specific styling still lands via edits.",
    "- a small stub function component per feature (`function FeatureOne() {...}`, etc.) — each is a unique SEARCH target, and replacing one is naturally a 10–20 line edit",
    '- a default-exported `App` function that composes them inside a `<main id="app">` with `<header id="app-header">`',
    '- name the section ids and feature components after the features you just described (e.g. for a kanban board: `id="board"`, `id="add-task"`, `id="ai-expand"`), not literal `feature-one`',
    "- plain JSX placeholders in each stub (e.g. `<h2>Feature</h2>` and a `{/* ... */}` comment) — the placeholders inherit the scaffold's layout styling so the empty state already looks intentional",
    "- NO hooks (no useState, no useFireproof, no useLiveQuery), NO callAI calls, NO event handlers, NO long color/shadow Tailwind chains (those land via edits)",
    "",
    "Scaffold shape (rename `featureOne/Two/Three` and `id` values to match your features; tweak the Tailwind defaults to fit your style prompt):",
    "",
    "```",
    "App.jsx",
    "```jsx",
    `import React from "react"${generateImportStatements(chosenLlms)}`,
    "",
    "const classNames = {",
    '  page: "min-h-screen bg-white p-6",',
    '  header: "max-w-3xl mx-auto mb-6",',
    '  title: "text-2xl font-semibold",',
    '  feature: "max-w-3xl mx-auto mb-4 p-4 border rounded",',
    '  featureTitle: "text-lg font-medium mb-2",',
    "};",
    "",
    "function FeatureOne() {",
    "  return (",
    '    <section id="feature-one" className={classNames.feature}>',
    '      <h2 className={classNames.featureTitle}>Feature One</h2>',
    "      {/* feature one lands here */}",
    "    </section>",
    "  );",
    "}",
    "",
    "function FeatureTwo() {",
    "  return (",
    '    <section id="feature-two" className={classNames.feature}>',
    '      <h2 className={classNames.featureTitle}>Feature Two</h2>',
    "      {/* feature two lands here */}",
    "    </section>",
    "  );",
    "}",
    "",
    "function FeatureThree() {",
    "  return (",
    '    <section id="feature-three" className={classNames.feature}>',
    '      <h2 className={classNames.featureTitle}>Feature Three</h2>',
    "      {/* feature three lands here */}",
    "    </section>",
    "  );",
    "}",
    "",
    "export default function App() {",
    "  return (",
    '    <main id="app" className={classNames.page}>',
    '      <header id="app-header" className={classNames.header}>',
    '        <h1 className={classNames.title}>App Title</h1>',
    "      </header>",
    "      <FeatureOne />",
    "      <FeatureTwo />",
    "      <FeatureThree />",
    "    </main>",
    "  );",
    "}",
    "```",
    "```",
    "",
    "**Then, for each feature, write a short prose paragraph followed by a focused edit using SEARCH/REPLACE markers inside a fenced block.** Each `<<<<<<< SEARCH` snippet must match exactly one place in the current file (the stub `function FeatureN() {...}` is the natural target — include the whole function body for uniqueness). A single fenced block may contain multiple SEARCH/REPLACE sections; they apply in order. Styling (filling in the `classNames` values, color tokens, layout polish) also lands via SEARCH/REPLACE edits — do not put real class strings in the scaffold.",
    "",
    "**Target 10–20 lines per SEARCH/REPLACE edit.** A single feature stub → working component is the natural unit. If a single edit grows beyond ~25 lines, split it into multiple SEARCH/REPLACE sections in the same fenced block.",
    "",
    "```",
    "App.jsx",
    "```jsx",
    "<<<<<<< SEARCH",
    "// existing snippet (must match exactly once)",
    "=======",
    "// new snippet",
    ">>>>>>> REPLACE",
    "```",
    "```",
    "",
    "**Always go feature-by-feature with SEARCH/REPLACE.** Do NOT emit the whole file as a single edit just because the build feels substantial — the user wants to see each feature land incrementally. The only time to emit a fresh full-file block is when the user explicitly requests a complete overhaul or redesign (e.g. \"redo the whole thing\", \"switch to a totally different layout\"). If you find yourself thinking \"this is a substantial build, I'll do it in one pass\", do not — go feature-by-feature instead.",
    "",
    "After your final edit, add a short 1-2 sentence message describing the core workflow the app supports.",
    "",
  ].join("\n");

  return {
    systemPrompt,
    skills: selectedNames,
    demoData: includeDemoData,
    model,
  };
}

export async function getCliFooter(): Promise<string> {
  const rText = await keyedLoadAsset.get("cli-footer").once(async () => {
    return loadAsset("./cli-footer.md", {
      fallBackUrl: "https://esm.sh/@vibes.diy/prompts/",
      basePath: () => import.meta.url,
    });
  });
  if (rText.isErr()) {
    return Promise.reject(rText.Err());
  }
  return rText.Ok();
}

export async function getSkillText(name: string): Promise<string> {
  const rText = await keyedLoadAsset.get(name).once(async () => {
    return loadAsset(`./llms/${name}.md`, {
      fallBackUrl: "https://esm.sh/@vibes.diy/prompts/",
      basePath: () => import.meta.url,
    });
  });
  if (rText.isErr()) {
    return Promise.reject(rText.Err());
  }
  return rText.Ok();
}
