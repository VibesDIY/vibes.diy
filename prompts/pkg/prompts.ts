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
    "Pick skills from this catalog that fit the user's app request, propose 3 title/slug pairs for naming, and propose a one-line icon subject.",
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
    iconDescription: {
      type: "string",
      description:
        "A short, vivid one-line description of what an icon for this app should depict — what it shows, not how it's drawn. Examples: 'a fox on a record player', 'a sailboat on a calm lake', 'a chef whisking eggs'. Don't mention colors, line weights, letters, numbers, or framing — those are added separately by the renderer.",
    },
  },
} as const;

/** arktype validator for parsed pre-alloc responses. Matches preAllocSchema. */
export const preAllocParsed = type({
  skills: type("string").array(),
  pairs: type({ title: "string", slug: "string" }).array(),
  iconDescription: "string",
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
  // Override the package URL used as `loadAsset`'s `fallBackUrl` when the
  // local basePath fails (worker bundles, esm.sh fallback). Defaults to
  // esm.sh; the API worker passes `${WORKSPACE_NPM_URL}/@vibes.diy/prompts/`
  // so assets resolve through the worker's own /vibe-pkg/ endpoint.
  pkgBaseUrl?: string;
}

const DEFAULT_PKG_BASE_URL = "https://esm.sh/@vibes.diy/prompts/";

export async function makeBaseSystemPrompt(
  model: string,
  sessionDoc: Partial<UserSettings> & MakeBaseSystemPromptOptions
): Promise<SystemPromptResult> {
  const userPrompt = sessionDoc?.userPrompt || "";
  const pkgBaseUrl = sessionDoc?.pkgBaseUrl ?? DEFAULT_PKG_BASE_URL;
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
        fallBackUrl: pkgBaseUrl,
        basePath: () => import.meta.url,
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
    ? "\n- If your app has a function that uses callAI with a schema to save data, include a Demo Data button that calls that function with an example prompt. Don't write an extra function, use real app code so the data illustrates what it looks like to use the app.\n- Never have an instance of callAI that is only used to generate demo data, always use the same calls that are triggered by user actions in the app."
    : "";

  const titleSection = sessionDoc?.title
    ? `The app is called "${sessionDoc.title}". Use this exact name in the app's heading and anywhere the app refers to itself.\n\n`
    : "";
  const userPromptSection = userPrompt ? `${userPrompt}\n\n` : "";

  const importStatements = `import React from "react"${generateImportStatements(chosenLlms)}`;

  const template = await getSystemPromptTemplate(pkgBaseUrl, sessionDoc.fetch);
  const systemPrompt = template
    .replaceAll("{{STYLE_PROMPT}}", stylePrompt)
    .replaceAll("{{DEMO_DATA}}", demoDataLines)
    .replaceAll("{{CONCATENATED_LLMS}}", concatenatedLlmsTxt)
    .replaceAll("{{TITLE_SECTION}}", titleSection)
    .replaceAll("{{USER_PROMPT}}", userPromptSection)
    .replaceAll("{{IMPORT_STATEMENTS}}", importStatements);

  return {
    systemPrompt,
    skills: selectedNames,
    demoData: includeDemoData,
    model,
  };
}

async function getSystemPromptTemplate(pkgBaseUrl: string, fetchFn?: typeof fetch): Promise<string> {
  const rText = await keyedLoadAsset.get("system-prompt").once(async () => {
    return loadAsset("./system-prompt.md", {
      fallBackUrl: pkgBaseUrl,
      basePath: () => import.meta.url,
      mock: { fetch: fetchFn },
    });
  });
  if (rText.isErr()) {
    return Promise.reject(rText.Err());
  }
  return rText.Ok();
}

export async function getCliFooter(): Promise<string> {
  const rText = await keyedLoadAsset.get("cli-footer").once(async () => {
    return loadAsset("./cli-footer.md", {
      fallBackUrl: DEFAULT_PKG_BASE_URL,
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
      fallBackUrl: DEFAULT_PKG_BASE_URL,
      basePath: () => import.meta.url,
    });
  });
  if (rText.isErr()) {
    return Promise.reject(rText.Err());
  }
  return rText.Ok();
}
