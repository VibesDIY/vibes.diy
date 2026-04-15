// import { callAI, type Message, type CallAIOptions, Mocks } from "call-ai";

import type { HistoryMessage, UserSettings } from "./settings.js";
import { exception2Result, loadAsset, Result, KeyedResolvOnce } from "@adviser/cement";
import { getLlmCatalog, getLlmCatalogNames, LlmCatalogEntry } from "./json-docs.js";

// import { getTexts } from "./txt-docs.js";
import { defaultStylePrompt } from "./style-prompts.js";
import { ChatMessage } from "@vibes.diy/call-ai-v2";

// Single source of truth for the default coding model used across the repo.
export const DEFAULT_CODING_MODEL = "anthropic/claude-opus-4.5" as const;

// Model used for RAG decisions (module selection)
const RAG_DECISION_MODEL = "openai/gpt-4o" as const;

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

export async function getDefaultDependencies(): Promise<string[]> {
  return ["fireproof", "callai", "web-audio"];
}

export interface SystemPromptResult {
  systemPrompt: string;
  dependencies: string[];
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

async function detectModulesInHistory(history: HistoryMessage[], _opts: LlmSelectionOptions): Promise<Set<string>> {
  const detected = new Set<string>();
  if (!Array.isArray(history)) return detected;
  for (const msg of history) {
    const content = msg?.content || "";
    if (!content || typeof content !== "string") continue;
    // for (const { name, named, def, namespace } of await llmImportRegexes()) {
    //   if (named.test(content) || def.test(content) || namespace.test(content)) {
    //     detected.add(name);
    //   }
    // }
  }
  return detected;
}

interface LlmSelectionDecisions {
  selected: string[];
  demoData: boolean;
}

interface LlmSelectionOptions {
  readonly appMode?: "test" | "production";
  // readonly callAiEndpoint?: CoerceURI;
  fetch?: typeof fetch;

  readonly callAi: {
    ModuleAndOptionsSelection(msgs: ChatMessage[]): Promise<Result<string>>;
  };

  // readonly getAuthToken?: () => Promise<string>;
  // readonly mock?: Mocks;
}

// type LlmSelectionWithoutGetTextUrl = Omit<LlmSelectionOptions, "getTextUrl" | "callAiEndpoint"> & {
//   readonly fallBackUrl: CoerceURI;
//   // readonly callAiEndpoint?: CoerceURI;
// };

// async function sleepReject<T>(ms: number) {
//   return new Promise<T>((_, rj) => setTimeout(rj, ms));
// }

// move this to the other file along with referenced types
async function selectLlmsAndOptions(
  model: string,
  userPrompt: string,
  history: HistoryMessage[],
  iopts: LlmSelectionOptions
): Promise<LlmSelectionDecisions> {
  const opts = {
    ...iopts,
    mode: iopts.appMode === "test" ? "test" : "production",
  };
  // const opts: LlmSelectionWithoutGetTextUrl = {
  //   appMode: "production",
  //   ...iopts,
  //   callAiEndpoint: iopts.callAiEndpoint ? iopts.callAiEndpoint : undefined,
  //   // fallBackUrl: URI.from(iopts.fallBackUrl ?? "https://esm.sh/use-vibes@0.18.9/prompt-catalog/llms").toString(),
  //   // getAuthToken: iopts.getAuthToken,
  // };
  const llmsCatalog = await getLlmCatalog();
  const catalog = llmsCatalog.map((l) => ({
    name: l.name,
    description: l.description || "",
  }));
  const payload = {
    catalog,
    userPrompt: userPrompt || "",
    history: history || [],
  };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: `You select which library modules from a catalog should 
         be included AND whether to include a demo-data button. 
         First analyze if the user prompt describes specific 
         look & feel requirements. For demo data: include it 
         only when asked for. Read the JSON payload and return 
         JSON with properties: 
         "selected" (array of catalog "name" strings) and "demoData" (boolean). 
         Only choose modules from the catalog. Include any 
         libraries already used in history. Respond with JSON only.`,
        },
      ],
    },
    { role: "user", content: [{ type: "text", text: JSON.stringify(payload) }] },
  ];

  // const options: CallAIOptions = {
  //   chatUrl: opts.callAiEndpoint ? opts.callAiEndpoint.toString().replace(/\/+$/, "") : undefined,
  //   apiKey: (await opts.getAuthToken?.()) || "",
  //   model,
  //   schema: {
  //     name: "module_and_options_selection",
  //     properties: {
  //       selected: { type: "array", items: { type: "string" } },
  //       demoData: { type: "boolean" },
  //     },
  //   },
  //   max_tokens: 2000,
  //   headers: {
  //     "HTTP-Referer": "https://vibes.diy",
  //     "X-Title": "Vibes DIY",
  //   },
  //   mock: opts.mock,
  // };

  const rRaw = await opts.callAi.ModuleAndOptionsSelection(messages);
  if (rRaw.isErr()) {
    console.warn("Module/options selection call failed:", rRaw.Err());
    return { selected: [], demoData: true };
  }

  // try {
  // const withTimeout = <T>(p: Promise<T>, ms = 4000): Promise<T> =>
  //   Promise.race([
  //     sleepReject<T>(ms).then((val) => {
  //       console.warn("Module/options selection: API call timed out after", ms, "ms");
  //       return val;
  //     }),
  //     p
  //       .then((val) => {
  //         return val;
  //       })
  //       .catch((err) => {
  //         console.warn("Module/options selection: API call failed with error:", err);
  //         throw err;
  //       }),
  //   ]);

  // const raw = (await withTimeout((options.mock?.callAI || callAI)(messages, options))) as string;

  // if (raw === undefined || raw === null) {
  //   console.warn("Module/options selection: call-ai returned undefined with schema present");
  //   console.warn("This is a known issue in the prompts package environment");
  //   return { selected: [], demoData: true };
  // }

  const rParsed = exception2Result(() => JSON.parse(rRaw.Ok()) ?? {});
  if (rParsed.isErr()) {
    console.warn("Module/options selection: Failed to parse JSON response:", rRaw.Ok());
    return { selected: [], demoData: true };
  }
  const parsed = rParsed.Ok();
  const selected = Array.isArray(parsed?.selected) ? parsed.selected.filter((v: unknown) => typeof v === "string") : [];
  const demoData = typeof parsed?.demoData === "boolean" ? parsed.demoData : true;

  return { selected, demoData };
  // } catch (err) {
  //   console.warn("Module/options selection call failed:", err);
  //   return { selected: [], demoData: true };
  // }
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

// move this function to its own file along with generateImportStatements and selectLlmsAndOptions, and rexport from here
export async function makeBaseSystemPrompt(
  model: string,
  sessionDoc: Partial<UserSettings> & LlmSelectionOptions
): Promise<SystemPromptResult> {
  const userPrompt = sessionDoc?.userPrompt || "";
  const history: HistoryMessage[] = Array.isArray(sessionDoc?.history) ? sessionDoc.history : [];
  const useOverride = !!sessionDoc?.dependenciesUserOverride;

  let selectedNames: string[] = [];
  let includeDemoData = true;

  const llmsCatalog = await getLlmCatalog();
  const llmsCatalogNames = await getLlmCatalogNames();

  if (useOverride) {
    selectedNames = (sessionDoc.dependencies ?? [])
      .filter((v): v is string => typeof v === "string")
      .filter((name) => llmsCatalogNames.has(name));
  } else {
    const decisions = await selectLlmsAndOptions(RAG_DECISION_MODEL, userPrompt, history, sessionDoc);
    includeDemoData = decisions.demoData;

    const detected = await detectModulesInHistory(history, sessionDoc);
    const finalNames = new Set<string>([...decisions.selected, ...detected]);
    selectedNames = Array.from(finalNames);

    if (selectedNames.length === 0) selectedNames = [...(await getDefaultDependencies())];
  }
  if (typeof sessionDoc?.demoDataOverride === "boolean") {
    includeDemoData = sessionDoc.demoDataOverride;
  }

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
