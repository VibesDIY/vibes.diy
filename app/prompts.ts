import { callAI, type Message, type CallAIOptions } from 'call-ai';
import { CALLAI_ENDPOINT } from './config/env';
// Import all LLM text files statically
import callaiTxt from './llms/callai.txt?raw';
import fireproofTxt from './llms/fireproof.txt?raw';
import imageGenTxt from './llms/image-gen.txt?raw';
import webAudioTxt from './llms/web-audio.txt?raw';
import threeJsTxt from './llms/three-js.md?raw';
import d3Txt from './llms/d3.md?raw';
import {
  DEFAULT_DEPENDENCIES,
  llmsCatalog,
  type LlmsCatalogEntry,
  CATALOG_DEPENDENCY_NAMES,
} from './llms/catalog';

// Static mapping of LLM text content
const llmsTextContent: Record<string, string> = {
  callai: callaiTxt,
  fireproof: fireproofTxt,
  'image-gen': imageGenTxt,
  'web-audio': webAudioTxt,
  'three-js': threeJsTxt,
  d3: d3Txt,
};

// Cache for LLM text documents to prevent redundant fetches/imports
const llmsTextCache: Record<string, string> = {};

// Load raw text for a single LLM by name using static imports
function loadLlmsTextByName(name: string): string | undefined {
  try {
    const text = llmsTextContent[name] || '';
    return text || undefined;
  } catch (_err) {
    console.warn('Failed to load raw LLM text for:', name, _err);
    return undefined;
  }
}

// Escape for RegExp construction
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type HistoryMessage = { role: 'user' | 'assistant' | 'system'; content: string };

// Precompile import-detection regexes once per module entry
const llmImportRegexes = llmsCatalog
  .filter((l) => l.importModule && l.importName)
  .map((l) => {
    const mod = escapeRegExp(l.importModule);
    const name = escapeRegExp(l.importName);
    const importType = l.importType || 'named';

    return {
      name: l.name,
      // Matches: import { ..., <name>, ... } from '<module>'
      named: new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['\\\"]${mod}['\\\"]`),
      // Matches: import <name> from '<module>'
      def: new RegExp(`import\\s+${name}\\s+from\\s*['\\\"]${mod}['\\\"]`),
      // Matches: import * as <name> from '<module>'
      namespace: new RegExp(`import\\s*\\*\\s*as\\s+${name}\\s+from\\s*['\\\"]${mod}['\\\"]`),
      importType,
    } as const;
  });

// Detect modules already referenced in history imports
function detectModulesInHistory(history: HistoryMessage[]): Set<string> {
  const detected = new Set<string>();
  if (!Array.isArray(history)) return detected;
  for (const msg of history) {
    const content = msg?.content || '';
    if (!content || typeof content !== 'string') continue;
    for (const { name, named, def, namespace } of llmImportRegexes) {
      if (named.test(content) || def.test(content) || namespace.test(content)) {
        detected.add(name);
      }
    }
  }
  return detected;
}

export type LlmSelectionDecisions = {
  selected: string[]; // names from catalog
  instructionalText: boolean; // whether to include usage instructions in prompt
  demoData: boolean; // whether to instruct adding Demo Data button/flow
};

// Ask LLM which modules and options to include based on catalog + user prompt + history
export async function selectLlmsAndOptions(
  model: string,
  userPrompt: string,
  history: HistoryMessage[]
): Promise<LlmSelectionDecisions> {
  const catalog = llmsCatalog.map((l) => ({ name: l.name, description: l.description || '' }));
  const payload = { catalog, userPrompt: userPrompt || '', history: history || [] };

  const messages: Message[] = [
    {
      role: 'system',
      content:
        'You select which library modules from a catalog should be included AND whether to include instructional UI text and a demo-data button. First analyze if the user prompt describes specific look & feel requirements. For instructional text and demo data: include them only when asked for. Read the JSON payload and return JSON with properties: "selected" (array of catalog "name" strings), "instructionalText" (boolean), and "demoData" (boolean). Only choose modules from the catalog. Include any libraries already used in history. Respond with JSON only.',
    },
    { role: 'user', content: JSON.stringify(payload) },
  ];

  const options: CallAIOptions = {
    chatUrl: CALLAI_ENDPOINT,
    apiKey: 'sk-vibes-proxy-managed',
    model,
    schema: {
      name: 'module_and_options_selection',
      properties: {
        selected: { type: 'array', items: { type: 'string' } },
        instructionalText: { type: 'boolean' },
        demoData: { type: 'boolean' },
      },
    },
    max_tokens: 2000,
    headers: {
      'HTTP-Referer': 'https://vibes.diy',
      'X-Title': 'Vibes DIY',
      'X-VIBES-Token': localStorage.getItem('auth_token') || '',
    },
  };

  try {
    const raw = (await callAI(messages, options)) as string;
    const parsed = JSON.parse(raw) ?? {};
    const selected = Array.isArray(parsed?.selected)
      ? parsed.selected.filter((v: unknown) => typeof v === 'string')
      : [];
    const instructionalText =
      typeof parsed?.instructionalText === 'boolean' ? parsed.instructionalText : true;
    const demoData = typeof parsed?.demoData === 'boolean' ? parsed.demoData : true;
    return { selected, instructionalText, demoData };
  } catch (err) {
    console.warn('Module/options selection call failed:', err);
    return { selected: [], instructionalText: true, demoData: true };
  }
}

// Public: preload all llms text files (triggered on form focus)
export async function preloadLlmsText(): Promise<void> {
  llmsCatalog.forEach((llm) => {
    if (llmsTextCache[llm.name] || (llm.llmsTxtUrl && llmsTextCache[llm.llmsTxtUrl])) return;
    const text = loadLlmsTextByName(llm.name);
    if (text) {
      llmsTextCache[llm.name] = text;
      if (llm.llmsTxtUrl) {
        llmsTextCache[llm.llmsTxtUrl] = text;
      }
    }
  });
}

// Generate dynamic import statements from LLM configuration
export function generateImportStatements(llms: LlmsCatalogEntry[]) {
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
      const importType = l.importType || 'named';
      switch (importType) {
        case 'namespace':
          return `\nimport * as ${l.importName} from "${l.importModule}"`;
        case 'default':
          return `\nimport ${l.importName} from "${l.importModule}"`;
        case 'named':
        default:
          return `\nimport { ${l.importName} } from "${l.importModule}"`;
      }
    })
    .join('');
}

// Base system prompt for the AI
export async function makeBaseSystemPrompt(
  model: string,
  sessionDoc?: any,
  onAiDecisions?: (decisions: { selected: string[] }) => void
) {
  // Inputs for module selection
  const userPrompt = sessionDoc?.userPrompt || '';
  const history: HistoryMessage[] = Array.isArray(sessionDoc?.history) ? sessionDoc.history : [];
  // Selection path with per‑vibe override preserved
  const useOverride = !!sessionDoc?.dependenciesUserOverride;

  let selectedNames: string[] = [];
  let includeInstructional = true;
  let includeDemoData = true;

  if (useOverride && Array.isArray(sessionDoc?.dependencies)) {
    selectedNames = (sessionDoc.dependencies as unknown[])
      .filter((v): v is string => typeof v === 'string')
      .filter((name) => CATALOG_DEPENDENCY_NAMES.has(name));
  } else {
    // Non‑override path: schema‑driven LLM selection (plus history retention)
    const decisions = await selectLlmsAndOptions(model, userPrompt, history);
    includeInstructional = decisions.instructionalText;
    includeDemoData = decisions.demoData;

    const detected = detectModulesInHistory(history);
    const finalNames = new Set<string>([...decisions.selected, ...detected]);
    selectedNames = Array.from(finalNames);

    // Fallback if empty: use deterministic DEFAULT_DEPENDENCIES
    if (selectedNames.length === 0) selectedNames = [...DEFAULT_DEPENDENCIES];

    // Store AI decisions for UI display
    onAiDecisions?.({ selected: selectedNames });
  }

  // Apply per-vibe overrides for instructional text and demo data
  if (sessionDoc?.instructionalTextOverride !== undefined) {
    includeInstructional = sessionDoc.instructionalTextOverride;
  }
  if (sessionDoc?.demoDataOverride !== undefined) {
    includeDemoData = sessionDoc.demoDataOverride;
  }

  const chosenLlms = llmsCatalog.filter((l) => selectedNames.includes(l.name));

  // 3) Concatenate docs for chosen modules
  let concatenatedLlmsTxt = '';
  for (const llm of chosenLlms) {
    // Prefer cached content (preloaded on focus). If missing, try static import as a fallback.
    let text =
      llmsTextCache[llm.name] || (llm.llmsTxtUrl ? llmsTextCache[llm.llmsTxtUrl] : undefined);
    if (!text) {
      text = loadLlmsTextByName(llm.name) || '';
      if (text) {
        llmsTextCache[llm.name] = text;
        if (llm.llmsTxtUrl) {
          llmsTextCache[llm.llmsTxtUrl] = text;
        }
      }
    }

    concatenatedLlmsTxt += `
<${llm.label}-docs>
${text || ''}
</${llm.label}-docs>
`;
  }

  const defaultStylePrompt = `Create a UI theme inspired by the Memphis Group and Studio Alchimia from the 1980s. Incorporate bold, playful geometric shapes (squiggles, triangles, circles), vibrant primary colors (red, blue, yellow) with contrasting pastels (pink, mint, lavender), and asymmetrical layouts. Use quirky patterns like polka dots, zigzags, and terrazzo textures. Ensure a retro-futuristic vibe with a mix of matte and glossy finishes, evoking a whimsical yet functional design. Secretly name the theme 'Memphis Alchemy' to reflect its roots in Ettore Sotsass’s vision and global 1980s influences. Make sure the app background has some kind of charming patterned background using memphis styled dots or squiggly lines. Use thick "neo-brutalism" style borders for style to enhance legibility. Make sure to retain high contrast in your use of colors. Light background are better than dark ones. Use these colors: #70d6ff #ff70a6 #ff9770 #ffd670 #e9ff70 #242424 #ffffff Never use white text.`;

  // Get style prompt from session document if available
  const stylePrompt = sessionDoc?.stylePrompt || defaultStylePrompt;

  // Optionally include instructional/demo-data guidance based on decisions
  const instructionalLine = includeInstructional
    ? "- In the UI, include a vivid description of the app's purpose and detailed instructions how to use it, in italic text.\n"
    : '';
  const demoDataLines = includeDemoData
    ? `- If your app has a function that uses callAI with a schema to save data, include a Demo Data button that calls that function with an example prompt. Don't write an extra function, use real app code so the data illustrates what it looks like to use the app.\n- Never have have an instance of callAI that is only used to generate demo data, always use the same calls that are triggered by user actions in the app.\n`
    : '';

  return `
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
- If you get missing block errors, change the database name to a new name
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
    : ''
}IMPORTANT: You are working in one JavaScript file, use tailwind classes for styling. Remember to use brackets like bg-[#242424] for custom colors.

Provide a title and brief explanation followed by the component code. The component should demonstrate proper Fireproof integration with real-time updates and proper data persistence. Follow it with a short description of the app's purpose and instructions how to use it (with occasional bold or italic for emphasis). Then suggest some additional features that could be added to the app.

Begin the component with the import statements. Use react and the following libraries:

\`\`\`js
import React, { ... } from "react"${generateImportStatements(chosenLlms)}

// other imports only when requested
\`\`\`

`;
}

// Response format requirements
export const RESPONSE_FORMAT = {
  structure: [
    'Brief explanation',
    'Component code with proper Fireproof integration',
    'Real-time updates',
    'Data persistence',
  ],
};
