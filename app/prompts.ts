import { callAI, type Message, type CallAIOptions } from 'call-ai';
import { APP_MODE, CALLAI_ENDPOINT } from './config/env';

// Load module metadata from app/llms/*.json
const llmsModules = import.meta.glob('./llms/*.json', { eager: true });
const llmsList = Object.values(llmsModules).map(
  (mod) =>
    (
      mod as {
        default: {
          name: string;
          label: string;
          llmsTxtUrl: string;
          module: string;
          importModule: string;
          importName: string;
          description?: string;
        };
      }
    ).default
);

// Cache for LLM text documents to prevent redundant fetches/imports
const llmsTextCache: Record<string, string> = {};

// Lazily load and cache raw text for a single LLM by name using Vite raw imports
async function loadLlmsTextByName(name: string): Promise<string | undefined> {
  try {
    const mod = (await import(/* @vite-ignore */ `./llms/${name}.txt?raw`)) as { default: string };
    const text = mod?.default ?? '';
    return text || undefined;
  } catch (_err) {
    // In dev or test, the .txt may be missing until script runs. Swallow and let caller decide.
    console.warn('Failed to load raw LLM text for:', name, _err);
    return undefined;
  }
}

// Escape for RegExp construction
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type HistoryMessage = { role: 'user' | 'assistant' | 'system'; content: string };

// Detect modules already referenced in history imports
function detectModulesInHistory(history: HistoryMessage[]): Set<string> {
  const detected = new Set<string>();
  if (!Array.isArray(history)) return detected;
  for (const msg of history) {
    const content = msg?.content || '';
    if (!content || typeof content !== 'string') continue;
    for (const llm of llmsList) {
      if (!llm.importModule || !llm.importName) continue;
      const mod = escapeRegExp(llm.importModule);
      const name = escapeRegExp(llm.importName);
      const named = new RegExp(
        `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['\\\"]${mod}['\\\"]`
      );
      const def = new RegExp(`import\\s+${name}\\s+from\\s*['\\\"]${mod}['\\\"]`);
      if (named.test(content) || def.test(content)) detected.add(llm.name);
    }
  }
  return detected;
}

// Ask LLM which modules to include based on catalog + user prompt + history
async function selectLlmsModules(
  model: string,
  userPrompt: string,
  history: HistoryMessage[]
): Promise<string[]> {
  if (APP_MODE === 'test') return llmsList.map((l) => l.name);

  const catalog = llmsList.map((l) => ({ name: l.name, description: l.description || '' }));
  const payload = { catalog, userPrompt: userPrompt || '', history: history || [] };

  const messages: Message[] = [
    {
      role: 'system',
      content:
        'You select which library modules from a catalog should be included. Read the JSON payload and return JSON with a single property "selected": an array of module identifiers using the catalog "name" values. Only choose from the catalog. Include any libraries already used in history. Respond with JSON only.',
    },
    { role: 'user', content: JSON.stringify(payload) },
  ];

  const options: CallAIOptions = {
    chatUrl: CALLAI_ENDPOINT,
    apiKey: 'sk-vibes-proxy-managed',
    model,
    schema: {
      name: 'module_selection',
      properties: { selected: { type: 'array', items: { type: 'string' } } },
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
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed?.selected) ? parsed.selected : [];
    return arr.filter((v: unknown) => typeof v === 'string');
  } catch (err) {
    console.warn('Module selection call failed:', err);
    return [];
  }
}

// Public: preload all llms text files (triggered on form focus)
export async function preloadLlmsText(): Promise<void> {
  await Promise.all(
    llmsList.map(async (llm) => {
      if (llmsTextCache[llm.name] || llmsTextCache[llm.llmsTxtUrl]) return;
      const text = await loadLlmsTextByName(llm.name);
      if (text) {
        llmsTextCache[llm.name] = text;
        llmsTextCache[llm.llmsTxtUrl] = text;
      }
    })
  );
}

// Generate dynamic import statements from LLM configuration
export function generateImportStatements(llms: typeof llmsList) {
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
    .map((l) => `\nimport { ${l.importName} } from "${l.importModule}"`)
    .join('');
}

// Base system prompt for the AI
export async function makeBaseSystemPrompt(model: string, sessionDoc?: any) {
  // Inputs for module selection
  const userPrompt = sessionDoc?.userPrompt || '';
  const history: HistoryMessage[] = Array.isArray(sessionDoc?.history) ? sessionDoc.history : [];

  // 1) Ask AI which modules to include
  const aiSelected = await selectLlmsModules(model, userPrompt, history);

  // 2) Ensure we retain any modules already used in history
  const detected = detectModulesInHistory(history);
  const finalNames = new Set<string>([...aiSelected, ...detected]);
  const chosenLlms = llmsList.filter((l) => finalNames.has(l.name));

  // 3) Concatenate docs for chosen modules
  let concatenatedLlmsTxt = '';
  for (const llm of chosenLlms) {
    // Prefer cached content (preloaded on focus). If missing, try dynamic raw import as a fallback.
    let text = llmsTextCache[llm.name] || llmsTextCache[llm.llmsTxtUrl];
    if (!text) {
      text = (await loadLlmsTextByName(llm.name)) || '';
      if (text) {
        llmsTextCache[llm.name] = text;
        llmsTextCache[llm.llmsTxtUrl] = text;
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
- In the UI, include a vivid description of the app's purpose and detailed instructions how to use it, in italic text.
- If your app has a function that uses callAI with a schema to save data, include a Demo Data button that calls that function with an example prompt. Don't write an extra function, use real app code so the data illustrates what it looks like to use the app.
- Never have have an instance of callAI that is only used to generate demo data, always use the same calls that are triggered by user actions in the app.

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
