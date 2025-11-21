import { callAI, type Message, type CallAIOptions, Mocks } from "call-ai";

import type { HistoryMessage, UserSettings } from "./settings.js";
import { CoerceURI, Lazy, runtimeFn, URI } from "@adviser/cement";
import {
  getJsonDocs,
  getLlmCatalog,
  getLlmCatalogNames,
  LlmCatalogEntry,
} from "./json-docs.js";
import { getDefaultDependencies } from "./catalog.js";
import { getTexts } from "./txt-docs.js";
import { defaultStylePrompt } from "./style-prompts.js";

// Single source of truth for the default coding model used across the repo.
export const DEFAULT_CODING_MODEL = "anthropic/claude-sonnet-4.5" as const;

// Model used for RAG decisions (module selection)
export const RAG_DECISION_MODEL = "openai/gpt-4o" as const;

export async function defaultCodingModel() {
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
  vibeDoc?: { selectedModel?: string },
): Promise<string> {
  const sessionChoice = normalizeModelIdInternal(vibeDoc?.selectedModel);
  if (sessionChoice) return sessionChoice;
  const globalChoice = normalizeModelIdInternal(settingsDoc?.model);
  if (globalChoice) return globalChoice;
  return defaultCodingModel();
}

export interface SystemPromptResult {
  systemPrompt: string;
  dependencies: string[];
  instructionalText: boolean;
  demoData: boolean;
  model: string;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const llmImportRegexes = Lazy((fallBackUrl: CoerceURI) => {
  return getJsonDocs(fallBackUrl).then((docs) =>
    Object.values(docs)
      .map((d) => d.obj)
      .filter((l) => l.importModule && l.importName)
      .map((l) => {
        const mod = escapeRegExp(l.importModule);
        const name = escapeRegExp(l.importName);
        const importType = l.importType || "named";

        return {
          name: l.name,
          // Matches: import { ..., <name>, ... } from '<module>'
          named: new RegExp(
            `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['\\"]${mod}['\\"]`,
          ),
          // Matches: import <name> from '<module>'
          def: new RegExp(`import\\s+${name}\\s+from\\s*['\\"]${mod}['\\"]`),
          // Matches: import * as <name> from '<module>'
          namespace: new RegExp(
            `import\\s*\\*\\s*as\\s+${name}\\s+from\\s*['\\"]${mod}['\\"]`,
          ),
          importType,
        } as const;
      }),
  );
});

async function detectModulesInHistory(
  history: HistoryMessage[],
  opts: LlmSelectionOptions,
): Promise<Set<string>> {
  const detected = new Set<string>();
  if (!Array.isArray(history)) return detected;
  for (const msg of history) {
    const content = msg?.content || "";
    if (!content || typeof content !== "string") continue;
    for (const { name, named, def, namespace } of await llmImportRegexes(
      opts.fallBackUrl,
    )) {
      if (named.test(content) || def.test(content) || namespace.test(content)) {
        detected.add(name);
      }
    }
  }
  return detected;
}

export interface LlmSelectionDecisions {
  selected: string[];
  instructionalText: boolean;
  demoData: boolean;
}

const warnOnce = Lazy(() =>
  console.warn("vibes-diy-auth-token is not support on node"),
);
function defaultGetAuthToken(
  fn?: () => Promise<string>,
): () => Promise<string> {
  if (typeof fn === "function") {
    return () => fn();
  }
  const rn = runtimeFn();
  if (rn.isBrowser) {
    return () =>
      Promise.resolve(localStorage.getItem("vibes-diy-auth-token") || "");
  }
  return () => {
    warnOnce();
    return Promise.resolve("Unsupported.JWT-Token");
  };
}

export interface LlmSelectionOptions {
  readonly appMode?: "test" | "production";
  readonly callAiEndpoint?: CoerceURI;
  readonly fallBackUrl?: CoerceURI;

  readonly getAuthToken?: () => Promise<string>;
  readonly mock?: Mocks;
}

export type LlmSelectionWithFallbackUrl = Omit<
  Omit<LlmSelectionOptions, "fallBackUrl">,
  "callAiEndpoint"
> & {
  readonly fallBackUrl: CoerceURI;
  readonly callAiEndpoint?: CoerceURI;
};

async function sleepReject<T>(ms: number) {
  return new Promise<T>((_, rj) => setTimeout(rj, ms));
}

export async function selectLlmsAndOptions(
  model: string,
  userPrompt: string,
  history: HistoryMessage[],
  iopts: LlmSelectionOptions,
): Promise<LlmSelectionDecisions> {
  const opts: LlmSelectionWithFallbackUrl = {
    appMode: "production",
    ...iopts,
    callAiEndpoint: iopts.callAiEndpoint ? iopts.callAiEndpoint : undefined,
    fallBackUrl: URI.from(
      iopts.fallBackUrl ??
        "https://esm.sh/use-vibes@0.17.5/prompt-catalog/llms",
    ).toString(),
    getAuthToken: defaultGetAuthToken(iopts.getAuthToken),
  };
  const llmsCatalog = await getLlmCatalog(opts.fallBackUrl);
  const catalog = llmsCatalog.map((l) => ({
    name: l.name,
    description: l.description || "",
  }));
  const payload = {
    catalog,
    userPrompt: userPrompt || "",
    history: history || [],
  };

  const messages: Message[] = [
    {
      role: "system",
      content:
        'You select which library modules from a catalog should be included AND whether to include instructional UI text and a demo-data button. First analyze if the user prompt describes specific look & feel requirements. For instructional text and demo data: include them only when asked for. Read the JSON payload and return JSON with properties: "selected" (array of catalog "name" strings), "instructionalText" (boolean), and "demoData" (boolean). Only choose modules from the catalog. Include any libraries already used in history. Respond with JSON only.',
    },
    { role: "user", content: JSON.stringify(payload) },
  ];

  const options: CallAIOptions = {
    chatUrl: opts.callAiEndpoint
      ? opts.callAiEndpoint.toString().replace(/\/+$/, "")
      : undefined,
    apiKey: "sk-vibes-proxy-managed",
    model,
    schema: {
      name: "module_and_options_selection",
      properties: {
        selected: { type: "array", items: { type: "string" } },
        instructionalText: { type: "boolean" },
        demoData: { type: "boolean" },
      },
    },
    max_tokens: 2000,
    headers: {
      "HTTP-Referer": "https://vibes.diy",
      "X-Title": "Vibes DIY",
      "X-VIBES-Token": await opts.getAuthToken?.(),
    },
    mock: opts.mock,
  };

  try {
    const withTimeout = <T>(p: Promise<T>, ms = 4000): Promise<T> =>
      Promise.race([
        sleepReject<T>(ms).then((val) => {
          console.warn(
            "Module/options selection: API call timed out after",
            ms,
            "ms",
          );
          return val;
        }),
        p
          .then((val) => {
            return val;
          })
          .catch((err) => {
            console.warn(
              "Module/options selection: API call failed with error:",
              err,
            );
            throw err;
          }),
      ]);

    const raw = (await withTimeout(
      callCallAI(options)(messages, options),
    )) as string;

    if (raw === undefined || raw === null) {
      console.warn(
        "Module/options selection: call-ai returned undefined with schema present",
      );
      console.warn("This is a known issue in the prompts package environment");
      return { selected: [], instructionalText: true, demoData: true };
    }

    const parsed = JSON.parse(raw) ?? {};
    const selected = Array.isArray(parsed?.selected)
      ? parsed.selected.filter((v: unknown) => typeof v === "string")
      : [];
    const instructionalText =
      typeof parsed?.instructionalText === "boolean"
        ? parsed.instructionalText
        : true;
    const demoData =
      typeof parsed?.demoData === "boolean" ? parsed.demoData : true;

    return { selected, instructionalText, demoData };
  } catch (err) {
    console.warn("Module/options selection call failed:", err);
    return { selected: [], instructionalText: true, demoData: true };
  }
}

function callCallAI(option: CallAIOptions) {
  return option.mock?.callAI || callAI;
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

export async function makeBaseSystemPrompt(
  model: string,
  sessionDoc: Partial<UserSettings> & LlmSelectionOptions,
): Promise<SystemPromptResult> {
  const userPrompt = sessionDoc?.userPrompt || "";
  const history: HistoryMessage[] = Array.isArray(sessionDoc?.history)
    ? sessionDoc.history
    : [];
  const useOverride = !!sessionDoc?.dependenciesUserOverride;

  let selectedNames: string[] = [];
  let includeInstructional = true;
  let includeDemoData = true;

  const llmsCatalog = await getLlmCatalog(sessionDoc.fallBackUrl);
  const llmsCatalogNames = await getLlmCatalogNames(sessionDoc.fallBackUrl);

  if (useOverride && Array.isArray(sessionDoc?.dependencies)) {
    selectedNames = (sessionDoc.dependencies as unknown[])
      .filter((v): v is string => typeof v === "string")
      .filter((name) => llmsCatalogNames.has(name));
  } else {
    const decisions = await selectLlmsAndOptions(
      RAG_DECISION_MODEL,
      userPrompt,
      history,
      sessionDoc,
    );
    includeInstructional = decisions.instructionalText;
    includeDemoData = decisions.demoData;

    const detected = await detectModulesInHistory(history, sessionDoc);
    const finalNames = new Set<string>([...decisions.selected, ...detected]);
    selectedNames = Array.from(finalNames);

    if (selectedNames.length === 0)
      selectedNames = [...(await getDefaultDependencies())];
  }

  if (typeof sessionDoc?.instructionalTextOverride === "boolean") {
    includeInstructional = sessionDoc.instructionalTextOverride;
  }
  if (typeof sessionDoc?.demoDataOverride === "boolean") {
    includeDemoData = sessionDoc.demoDataOverride;
  }

  const chosenLlms = llmsCatalog.filter((l) => selectedNames.includes(l.name));

  let concatenatedLlmsTxt = "";
  for (const llm of chosenLlms) {
    const text = await getTexts(llm.name, sessionDoc.fallBackUrl);
    if (!text) {
      console.warn(
        "Failed to load raw LLM text for:",
        llm.name,
        sessionDoc.fallBackUrl,
      );
      continue;
    }

    concatenatedLlmsTxt += `
<${llm.label}-docs>
${text || ""}
</${llm.label}-docs>
`;
  }

  // defaultStylePrompt is now imported from style-prompts.js

  const stylePrompt = sessionDoc?.stylePrompt || defaultStylePrompt;

  const instructionalLine = includeInstructional
    ? "- In the UI, include a vivid description of the app's purpose and detailed instructions how to use it, in italic text.\n"
    : "";
  const demoDataLines = includeDemoData
    ? `- If your app has a function that uses callAI with a schema to save data, include a Demo Data button that calls that function with an example prompt. Don't write an extra function, use real app code so the data illustrates what it looks like to use the app.\n- Never have have an instance of callAI that is only used to generate demo data, always use the same calls that are triggered by user actions in the app.\n`
    : "";

  const systemPrompt = `
You are an AI assistant tasked with creating React components. You should create components that:
- Use modern React practices and follow the rules of hooks
- Don't use any TypeScript, just use JavaScript
- Use Tailwind CSS for mobile-first accessible styling
- Don't use words from the style prompt in your copy: ${stylePrompt}
- For dynamic components, like autocomplete, don't use external libraries, implement your own
- Avoid using external libraries unless they are essential for the component to function
- Always import the libraries you need at the top of the file
- Use Fireproof for data persistence
- Use \`callAI\` to fetch AI (set \`stream: true\` to enable streaming), use Structured JSON Outputs like this: \`callAI(prompt, { schema: { properties: { todos: { type: 'array', items: { type: 'string' } } } } })\` and save final responses as individual Fireproof documents.
- For file uploads use drag and drop and store using the \`doc._files\` API
- Don't try to generate png or base64 data, use placeholder image APIs instead, like https://picsum.photos/400 where 400 is the square size
- Consider and potentially reuse/extend code from previous responses if relevant
- Always output the full component code, keep the explanation short and concise
- Never also output a small snippet to change, just the full component code
- Keep your component file as short as possible for fast updates
- Keep the database name stable as you edit the code
- The system can send you crash reports, fix them by simplifying the affected code
- List data items on the main page of your app so users don't have to hunt for them
- If you save data, make sure it is browseable in the app, eg lists should be clickable for more details
${instructionalLine}${demoDataLines}

${concatenatedLlmsTxt}

## ImgGen Component

You should use this component in all cases where you need to generate or edit images. It is a React component that provides a UI for image generation and editing. Make sure to pass the database prop to the component. If you generate images, use a live query to list them (with type 'image') in the UI. The best usage is to save a document with a string field called \`prompt\` (which is sent to the generator) and an optional \`doc._files.original\` image and pass the \`doc._id\` to the component via the  \`_id\` prop. It will handle the rest.

${
  userPrompt
    ? `${userPrompt}

`
    : ""
}IMPORTANT: You are working in one JavaScript file, use tailwind classes for styling. Remember to use brackets like bg-[#242424] for custom colors.

Provide a title and brief explanation followed by the component code. The component should demonstrate proper Fireproof integration with real-time updates and proper data persistence. Follow it with a brief description of the app's purpose and instructions how to use it (with occasional bold or italic for emphasis). Then suggest some additional features that could be added to the app.

Begin the component with the import statements. Use react and the following libraries:

\`\`\`js
import React, { ... } from "react"${generateImportStatements(chosenLlms)}

// other imports only when requested
\`\`\`

`;

  return {
    systemPrompt,
    dependencies: selectedNames,
    instructionalText: includeInstructional,
    demoData: includeDemoData,
    model,
  };
}

// Response format requirements
export const RESPONSE_FORMAT = {
  structure: [
    "Brief explanation",
    "Component code with proper Fireproof integration",
    "Real-time updates",
    "Data persistence",
  ],
};
