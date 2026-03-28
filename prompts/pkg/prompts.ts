import type { HistoryMessage } from "./settings.js";
import { loadAsset, KeyedResolvOnce } from "@adviser/cement";
import { getLlmCatalog, getLlmCatalogNames, LlmCatalogEntry } from "./json-docs.js";

import { defaultStylePrompt } from "./style-prompts.js";

const DEFAULT_DEPENDENCIES = ["fireproof", "callai", "web-audio"] as const;

export interface SystemPromptResult {
  systemPrompt: string;
  dependencies: string[];
  demoData: boolean;
  model: string;
}

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

export interface MakeBaseSystemPromptOpts {
  userPrompt?: string;
  stylePrompt?: string;
  history?: HistoryMessage[];
  dependencies?: string[];
  demoDataOverride?: boolean;
  fetch?: typeof fetch;
}

export async function makeBaseSystemPrompt(model: string, opts: MakeBaseSystemPromptOpts): Promise<SystemPromptResult> {
  const userPrompt = opts.userPrompt || "";
  let includeDemoData = true;

  const llmsCatalog = await getLlmCatalog();
  const llmsCatalogNames = await getLlmCatalogNames();

  const requestedDependencies = opts.dependencies && opts.dependencies.length > 0 ? opts.dependencies : [...DEFAULT_DEPENDENCIES];

  const selectedNames = requestedDependencies
    .filter((v): v is string => typeof v === "string")
    .filter((name) => llmsCatalogNames.has(name));

  if (typeof opts.demoDataOverride === "boolean") {
    includeDemoData = opts.demoDataOverride;
  }

  const chosenLlms = llmsCatalog.filter((l) => selectedNames.includes(l.name));

  const concatenatedLlmsTxts: string[] = [];
  for (const llm of chosenLlms) {
    const rText = await keyedLoadAsset.get(llm.name).once(async () => {
      return loadAsset(`./llms/${llm.name}.txt`, {
        fallBackUrl: "https://esm.sh/@vibes.diy/prompts/",
        basePath: () => {
          const dir = import.meta.url;
          console.log("Base path for loading LLM text asset:", llm.name, dir);
          return dir;
        },
        mock: {
          fetch: opts.fetch,
        },
      });
    });
    if (rText.isErr()) {
      console.warn(`Failed to load text for LLM ${llm.name} at path ${import.meta.dirname}/./llms/${llm.name}.txt:`, rText.Err());
      continue;
    }
    concatenatedLlmsTxts.push(`<${llm.label}-docs>`);
    concatenatedLlmsTxts.push(rText.Ok() ?? "");
    concatenatedLlmsTxts.push(`</${llm.label}-docs>`);
  }
  const concatenatedLlmsTxt = concatenatedLlmsTxts.join("\n");

  const stylePrompt = opts.stylePrompt || defaultStylePrompt;

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
    "- Always import the libraries you need at the top of the file",
    "- Structure your component code in this order: (1) hooks and document shapes, (2) event handlers, (3) classNames object, (4) JSX return. ClassNames go right before JSX so they are close to where they are used.",
    "- Use Fireproof for data persistence",
    "- Use `callAI` to fetch AI, use schema like this: `JSON.parse(await callAI(prompt, { schema: { properties: { todos: { type: 'array', items: { type: 'string' } } } } }))` and save final responses as individual Fireproof documents.",
    "- For file uploads use drag and drop and store using the `doc._files` API",
    "- Don't try to generate png or base64 data, use placeholder image APIs instead, like https://picsum.photos/400 where 400 is the square size",
    "- Consider and potentially reuse/extend code from previous responses if relevant",
    "- Always output the full component code, keep the explanation short and concise",
    "- Never also output a small snippet to change, just the full component code",
    "- Keep your component file as short as possible for fast updates",
    "- Keep the database name stable as you edit the code",
    "- The system can send you crash reports, fix them by simplifying the affected code",
    "- List data items on the main page of your app so users don't have to hunt for them",
    "- If you save data, make sure it is browsable in the app, eg lists should be clickable for more details",
    demoDataLines,
  ];

  const systemPrompt = [
    systemPromptLines.join("\n"),
    "",
    concatenatedLlmsTxt,
    "",
    ...(userPrompt ? [userPrompt, ""] : []),
    "IMPORTANT: You are working in one JavaScript file. Define a classNames object just before the JSX return for colors and repeated styles, then reference it in your JSX.",
    "",
    "Before writing code, provide a title and brief description of the app. Then list the top 3 features that are the best fit for a mobile web database with real-time collaboration and describe a short planned workflow showing how those features connect into a coherent user experience.",
    "",
    "Then write the full component code block. After the code block, add a short message (1-2 sentences) describing the core workflow the app supports.",
    "",
    "Begin the component with the import statements. Use react and the following libraries:",
    "",
    "```js",
    `import React, { ... } from "react"${generateImportStatements(chosenLlms)}`,
    "",
    "// other imports only when requested",
    "```",
    "",
  ].join("\n");

  return {
    systemPrompt,
    dependencies: selectedNames,
    demoData: includeDemoData,
    model,
  };
}
