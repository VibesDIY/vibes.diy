import type { UserSettings } from "./settings.js";
import { loadAsset, KeyedResolvOnce, envFactory } from "@adviser/cement";
import { getLlmCatalog, getLlmCatalogNames, LlmCatalogEntry } from "./json-docs.js";
import { composeDesignMd, getColorsetCatalogNames, getThemeCatalogNames, parseColorsetYaml, vibesThemes } from "./themes/index.js";
import { type } from "arktype";

import { defaultStylePrompt } from "./style-prompts.js";

// Single source of truth for the default coding model used across the repo.
// Hardcoded fallback (keeps the narrowed literal type for consumers that need it).
export const DEFAULT_CODING_MODEL_FALLBACK = "anthropic/claude-opus-4.5" as const;
// Resolved default — overridable via the DEFAULT_CODING_MODEL env var (see #1474).
export const DEFAULT_CODING_MODEL: string =
  envFactory({ symbol: "prompts" }).get("DEFAULT_CODING_MODEL") ?? DEFAULT_CODING_MODEL_FALLBACK;

async function defaultCodingModel() {
  return DEFAULT_CODING_MODEL;
}

function normalizeModelIdInternal(id: unknown): string | undefined {
  if (typeof id !== "string") return undefined;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
  return ["fireproof", "callai", "image-gen", "web-audio", "use-vibe"];
}

/**
 * Single-paragraph description of the platform's capabilities — in plain,
 * user-facing feature language rather than API names — so the pre-allocation
 * LLM has the right vocabulary in hand when it writes the enrichedPrompt
 * preamble. The preamble is meant to read like a product description for a
 * non-technical person, so this paragraph deliberately avoids developer terms
 * (library names, function names); the technical "how" is taught separately by
 * the skill docs in the generation system prompt.
 */
const PRE_ALLOC_PLATFORM_PARAGRAPH =
  "Platform capabilities: every app is a small web app that anyone can open in a browser. Its data is saved automatically in the cloud and stays in sync for everyone at once, so when one person adds or changes something, everyone else viewing the app sees it update right away. Apps can call on a built-in AI assistant that returns a structured result the app saves and displays — for example suggesting or filling in a value, rewriting or extending something someone wrote, or tagging and scoring content as it's added. Apps know who is signed in, so they can show people's names and avatars next to their contributions. By default only the app's owner can make changes; everyone else sees a read-only view, and any editing controls are hidden automatically for people who aren't allowed to use them. When pictures are a natural part of the experience, an app can show a generated illustration instead of requiring an upload.";

/**
 * Builds the user-message body for the pre-allocation LLM call. Includes a
 * platform-stack paragraph (so the model has core-feature vocabulary), the
 * skill catalog (name + one-line description per entry) so the model can pick
 * valid skill names, plus the user's raw prompt. Invalid names returned by the
 * model are filtered out at read time (`makeBaseSystemPrompt` → catalog guard),
 * so name-misses fail silently.
 */
export async function makePreAllocUserMessage(userPrompt: string): Promise<string> {
  const catalog = await getLlmCatalog();
  const catalogText = catalog.map((l) => `- ${l.name}: ${l.description}`).join("\n");
  const themeText = vibesThemes
    .map((t) => `- ${t.slug}: ${t.name}${t.bodyFont ? ` (${t.bodyFont.replace(/['"]/g, "").split(",")[0].trim()})` : ""}`)
    .join("\n");
  return [
    PRE_ALLOC_PLATFORM_PARAGRAPH,
    "",
    "Pick skills from this catalog that fit the user's app request, propose 3 title/slug pairs for naming, propose a one-line icon subject, pick a theme that matches the app's mood, and write a 3-sentence enriched-prompt preamble that shapes THIS specific app around our platform's capabilities, described in plain user-friendly language.",
    "",
    "Skill catalog:",
    catalogText,
    "",
    "Theme catalog:",
    themeText,
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
  required: ["skills", "pairs", "iconDescription", "enrichedPrompt"],
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
    theme: {
      type: "string",
      description:
        "Theme slug from the theme catalog above. Pick the one whose mood best fits the app — playful apps lean playful themes, focus/utility apps lean clean themes, retro apps lean retro themes, etc. Always pick something rather than leaving empty; the catalog is broad enough to cover most app moods. Only omit if the request is so abstract that every theme would feel arbitrary.",
    },
    enrichedPrompt: {
      type: "string",
      description: [
        "REQUIRED. A 3-sentence preamble that shapes THIS app around our platform's capabilities, written in plain user-friendly language a non-technical person would understand — dense narrative, no padding, no flourishes.",
        "Sentence 1: what users see and do in this app, and that what they add or change is saved and shared so everyone viewing the app sees the updates right away.",
        "Sentence 2: name the AI role that fits this app's central activity. Common roles to pick from: (a) suggest or autofill a field — the user taps a button next to an input and the built-in AI returns an example value drawn from the app's subject, ready to accept or edit; (b) critique or extend what someone wrote — the AI scores, rewrites, summarizes, or proposes the next thing (next line of a poem, follow-up task, related recipe); (c) tag, categorize, or score content as it's added — sentiment, topical tags, priority. Pick ONE role that genuinely fits this app. Name the user action that triggers it and what kind of result comes back.",
        "Sentence 3: name the things people can add or change in this app, and that only the owner (and anyone they allow) can make those changes while everyone else sees a read-only view, with the editing controls hidden automatically for people who aren't allowed to use them. If generated pictures are naturally part of the app, add a brief clause naming what a generated illustration would depict.",
        "Do NOT include developer language: no library names, no function or feature names, no field names in backticks, no code or data-shape objects. Write it the way you'd describe the finished product to someone who will use it, not build it.",
        "Do NOT invent imagery features when the app's subject wouldn't naturally include them.",
      ].join(" "),
    },
  },
} as const;

/** arktype validator for parsed pre-alloc responses. Matches preAllocSchema.
 *
 * `enrichedPrompt` is marked required in the JSON schema (so the LLM is
 * pressured to fill it) but optional here. Under Claude `tool_mode` the
 * schema's `required` array isn't strictly enforced, so the model occasionally
 * omits enrichedPrompt. When it does, we'd rather accept the response with
 * just skills + pairs + iconDescription than reject the whole turn — losing
 * `active.skills` no longer needs to carry `use-viewer`/`use-vibe` — both are
 * force-injected into every prompt (see makeBaseSystemPrompt) so the generated
 * app always has identity (`useViewer`) and write gating (`useVibe().can`). */
export const preAllocParsed = type({
  skills: type("string").array(),
  pairs: type({ title: "string", slug: "string" }).array(),
  iconDescription: "string",
  "theme?": "string",
  "colorTheme?": "string",
  "enrichedPrompt?": "string",
});
export type PreAllocParsed = typeof preAllocParsed.infer;

export interface SystemPromptResult {
  systemPrompt: string;
  skills: string[];
  theme?: string;
  colorTheme?: string;
  demoData: boolean;
  model: string;
}

export function generateImportStatements(llms: LlmCatalogEntry[]) {
  const seen = new Set<string>();
  return llms
    .filter((l): l is LlmCatalogEntry & { importModule: string; importName: string } => Boolean(l.importModule && l.importName))
    .slice()
    .sort((a, b) => a.importModule.localeCompare(b.importModule))
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
  // "initial" selects the three-pass first-turn template; "continuation"
  // (default) selects the small-chunk SEARCH/REPLACE template used for
  // every subsequent turn; "agentic-whole-file" selects the tool-loop
  // template that instructs the model to write whole files via write_file.
  variant?: "initial" | "continuation" | "agentic-whole-file";
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
  // Gating + identity are universal, so both docs must reach EVERY assembled
  // prompt — including when a caller supplies a skills list that omits them
  // (a provided list bypasses the defaults above). Force-add and dedup.
  for (const required of ["use-vibe", "use-viewer"]) {
    if (llmsCatalogNames.has(required) && !selectedNames.includes(required)) {
      selectedNames.push(required);
    }
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
    concatenatedLlmsTxts.push(`<${llm.label}-docs>`);
    concatenatedLlmsTxts.push(rText.Ok() ?? "");
    // console.log(`Loaded text for LLM ${llm.name}, length:`, llm.label, rText.Ok().slice(0, 100), "...");
    concatenatedLlmsTxts.push(`</${llm.label}-docs>`);
  }
  const concatenatedLlmsTxt = concatenatedLlmsTxts.join("\n");

  // Theme + colorset: both optional, both validated against their catalogs.
  // The structural theme markdown lives at themes/<theme>.md; the colorset
  // (light + dark token values) lives at themes/colors/<colorTheme>.yaml.
  // Default colorTheme is the same slug as theme — preserving today's
  // behavior when only `theme` is supplied. The two are composed at codegen
  // time into a complete design.md, wrapped in <theme-design-md>.
  const themeCatalogNames = getThemeCatalogNames();
  const colorsetCatalogNames = getColorsetCatalogNames();
  const requestedTheme = typeof sessionDoc?.theme === "string" ? sessionDoc.theme : undefined;
  const validatedTheme = requestedTheme && themeCatalogNames.has(requestedTheme) ? requestedTheme : undefined;
  const requestedColorTheme = typeof sessionDoc?.colorTheme === "string" ? sessionDoc.colorTheme : undefined;
  const validatedColorTheme =
    requestedColorTheme && colorsetCatalogNames.has(requestedColorTheme)
      ? requestedColorTheme
      : validatedTheme && colorsetCatalogNames.has(validatedTheme)
        ? validatedTheme
        : undefined;
  let themeDesignSection = "";
  if (validatedTheme) {
    const rTheme = await keyedLoadAsset.get(`theme:${validatedTheme}`).once(async () => {
      return loadAsset(`./themes/${validatedTheme}.md`, {
        fallBackUrl: pkgBaseUrl,
        basePath: () => import.meta.url,
        mock: { fetch: sessionDoc.fetch },
      });
    });
    if (rTheme.isErr()) {
      console.warn(`Failed to load theme ${validatedTheme}:`, rTheme.Err());
    } else {
      let designMd = rTheme.Ok() ?? "";
      if (validatedColorTheme) {
        const rColorset = await keyedLoadAsset.get(`colorset:${validatedColorTheme}`).once(async () => {
          return loadAsset(`./themes/colors/${validatedColorTheme}.yaml`, {
            fallBackUrl: pkgBaseUrl,
            basePath: () => import.meta.url,
            mock: { fetch: sessionDoc.fetch },
          });
        });
        if (rColorset.isErr()) {
          console.warn(`Failed to load colorset ${validatedColorTheme}:`, rColorset.Err());
        } else {
          designMd = composeDesignMd(designMd, parseColorsetYaml(rColorset.Ok() ?? ""));
        }
      }
      themeDesignSection =
        `<theme-design-md>\n${designMd}\n</theme-design-md>\n\n` +
        "The theme above defines ONLY visual styling — colors, typography, spacing, borders, and other appearance. " +
        "Applying or switching a theme restyles the app; it must NEVER rewrite it. Change only styling (the classNames/`c` object, " +
        "the `:root` token block, and CSS) and leave the app's copy, wording, labels, headings, feature set, and behavior exactly as they are. " +
        "NEVER write the theme's name — or any design-system, palette, or color-scheme name from the frontmatter or headings above " +
        '(e.g. "Atlas Reference", "Matrix Status") — into the app\'s UI, headings, labels, content, or comments. ' +
        "Theme names are designer vocabulary, not user-facing copy.";
    }
  }

  // Style-prompt precedence: user-supplied wins. Otherwise, if a theme was
  // validated and loaded, the theme markdown governs and we omit the default
  // (the bundled defaultStylePrompt is itself an opinionated style and
  // would contradict any picked theme). Fall back to defaultStylePrompt
  // only when neither is in play.
  const stylePrompt = sessionDoc?.stylePrompt || (themeDesignSection ? "" : defaultStylePrompt);

  const demoDataLines = includeDemoData
    ? "\n- If your app has a function that uses callAI with a schema to save data, include a Demo Data button that calls that function with an example prompt. Don't write an extra function, use real app code so the data illustrates what it looks like to use the app.\n- Never have an instance of callAI that is only used to generate demo data, always use the same calls that are triggered by user actions in the app."
    : "";

  const titleSection = sessionDoc?.title
    ? `The app is called "${sessionDoc.title}". Use this exact name in the app's heading and anywhere the app refers to itself.\n\n`
    : "";
  const userPromptSection = userPrompt ? `${userPrompt}\n\n` : "";

  const enrichedPromptRaw = typeof sessionDoc?.enrichedPrompt === "string" ? sessionDoc.enrichedPrompt.trim() : "";
  const enrichedPromptSection = enrichedPromptRaw ? `<app-workflow>\n${enrichedPromptRaw}\n</app-workflow>\n\n` : "";

  const importStatements = `import React from "react"${generateImportStatements(chosenLlms)}`;

  const templateFilename =
    sessionDoc?.variant === "agentic-whole-file"
      ? "system-prompt-agentic.md"
      : sessionDoc?.variant === "initial"
        ? "system-prompt-initial.md"
        : "system-prompt.md";
  const template = await getSystemPromptTemplate(pkgBaseUrl, templateFilename, sessionDoc.fetch);
  const systemPrompt = template
    .replaceAll("{{STYLE_PROMPT}}", stylePrompt)
    .replaceAll("{{DEMO_DATA}}", demoDataLines)
    .replaceAll("{{CONCATENATED_LLMS}}", concatenatedLlmsTxt)
    .replaceAll("{{THEME_DESIGN}}", themeDesignSection)
    .replaceAll("{{TITLE_SECTION}}", titleSection)
    .replaceAll("{{ENRICHED_PROMPT}}", enrichedPromptSection)
    .replaceAll("{{USER_PROMPT}}", userPromptSection)
    .replaceAll("{{IMPORT_STATEMENTS}}", importStatements);

  return {
    systemPrompt,
    skills: selectedNames,
    theme: validatedTheme,
    colorTheme: validatedColorTheme,
    demoData: includeDemoData,
    model,
  };
}

async function getSystemPromptTemplate(pkgBaseUrl: string, filename: string, fetchFn?: typeof fetch): Promise<string> {
  const rText = await keyedLoadAsset.get(`system-prompt:${filename}`).once(async () => {
    return loadAsset(`./${filename}`, {
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

export async function getRecoveryAddendum(pkgBaseUrl?: string, fetchFn?: typeof fetch): Promise<string> {
  const rText = await keyedLoadAsset.get("recovery-addendum").once(async () => {
    return loadAsset("./recovery-addendum.md", {
      fallBackUrl: pkgBaseUrl ?? DEFAULT_PKG_BASE_URL,
      basePath: () => import.meta.url,
      mock: { fetch: fetchFn },
    });
  });
  if (rText.isErr()) {
    return Promise.reject(rText.Err());
  }
  return rText.Ok();
}

export async function getRecoveryStitchAddendum(pkgBaseUrl?: string, fetchFn?: typeof fetch): Promise<string> {
  const rText = await keyedLoadAsset.get("recovery-stitch-addendum").once(async () => {
    return loadAsset("./recovery-stitch-addendum.md", {
      fallBackUrl: pkgBaseUrl ?? DEFAULT_PKG_BASE_URL,
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

export async function getMcpFooter(): Promise<string> {
  const rText = await keyedLoadAsset.get("mcp-footer").once(async () => {
    return loadAsset("./mcp-footer.md", {
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

export async function getThemeText(slug: string): Promise<string> {
  const rText = await keyedLoadAsset.get(`theme:${slug}`).once(async () => {
    return loadAsset(`./themes/${slug}.md`, {
      fallBackUrl: DEFAULT_PKG_BASE_URL,
      basePath: () => import.meta.url,
    });
  });
  if (rText.isErr()) {
    return Promise.reject(rText.Err());
  }
  return rText.Ok();
}
