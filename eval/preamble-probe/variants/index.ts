import { makePreAllocUserMessage, preAllocSchema } from "@vibes.diy/prompts";

export interface ProbeVariant {
  readonly id: string;
  readonly description: string;
  /** Build the user message sent to the LLM. */
  readonly buildUserMessage: (userPrompt: string) => Promise<string>;
  /** The schema description for `enrichedPrompt`. Default uses the production schema as-is. */
  readonly schemaOverride?: typeof preAllocSchema;
}

// v0 — production baseline. Wraps the live `makePreAllocUserMessage` so any
// drift in main shows up in the probe automatically.
const v0Baseline: ProbeVariant = {
  id: "v0-baseline",
  description: "Production user-message verbatim. Skill catalog one-liners only; no platform brief.",
  buildUserMessage: (userPrompt) => makePreAllocUserMessage(userPrompt),
};

// v1 — prepend a short platform brief naming what each core feature actually
// IS. Hypothesis: the model has been compensating off the schema description;
// giving it the platform vocabulary in the user message itself should yield
// more grounded enrichedPrompts and free the schema description to be terser.
const v1PlatformBrief: ProbeVariant = {
  id: "v1-platform-brief",
  description: "Adds a 6-line 'what our platform is' brief at the top of the user message.",
  buildUserMessage: async (userPrompt) => {
    const baseline = await makePreAllocUserMessage(userPrompt);
    const brief = [
      "Platform brief (what each core feature is, so your preamble can ground in it):",
      "- Fireproof: a live, syncable doc store. `useFireproof(name)` returns `database` + `useLiveQuery(field)`. Every viewer's UI updates in real time when any viewer writes — there's no separate websocket layer.",
      "- callAI: a typed LLM call. `await callAI(prompt, { schema: { properties: {...} } })` returns JSON the schema describes; the app saves it as a Fireproof doc.",
      "- useViewer: a read-only handle on runtime-managed access control. `const { viewer, can } = useViewer();` — `viewer` is identity (userSlug, displayName, avatarUrl), `can('write')` is the runtime's verdict on this viewer. The app doesn't grant access, it reflects it.",
      "- ImgGen: `<ImgGen prompt='…' />` renders a generated illustration tile. Use when imagery is naturally part of the experience (recipes, gifts), not as decoration.",
      "",
    ].join("\n");
    return brief + baseline;
  },
};

// v2 — same as v1 but also includes a worked-example preamble so the model
// has a concrete shape to imitate. Hypothesis: structural priming is what
// actually moves the needle on consistency.
const v2Exemplar: ProbeVariant = {
  id: "v2-exemplar",
  description: "Platform brief + a worked-example enrichedPrompt for a sample app.",
  buildUserMessage: async (userPrompt) => {
    const baseline = await makePreAllocUserMessage(userPrompt);
    const brief = [
      "Platform brief (what each core feature is, so your preamble can ground in it):",
      "- Fireproof: a live, syncable doc store. `useFireproof(name)` returns `database` + `useLiveQuery(field)`. Every viewer's UI updates in real time when any viewer writes.",
      "- callAI: a typed LLM call. `await callAI(prompt, { schema: { properties: {...} } })` returns JSON the schema describes; the app saves it as a Fireproof doc.",
      "- useViewer: a read-only handle on runtime-managed access control. `const { viewer, can } = useViewer();` — the app reflects the runtime's verdict, it doesn't set it.",
      "- ImgGen: `<ImgGen prompt='…' />` renders a generated illustration tile.",
      "",
      "Example enrichedPrompt — for the user request 'Build a comment thread under each post':",
      'The app writes Fireproof docs of shape `{ type: "comment", postId, body, authorUserSlug, authorDisplayName, authorAvatarUrl, createdAt }` to the "comments" database, and every viewer sees new comments stream in live via `useLiveQuery("postId")`. When the user submits a comment, `callAI` is called once on the body with schema `{ properties: { toxic: { type: "boolean" } } }` to flag spam, and the result is saved on the doc; toxic-flagged comments render collapsed. The Submit button and the comment textarea are hidden when `useViewer().can("write")` is false — non-owners see only the live thread and an "Owners can post replies" line in place of the form.',
      "",
    ].join("\n");
    return brief + baseline;
  },
};

// Architecture-only schema description: replaces the production schema's
// enrichedPrompt description with one that *forbids* code symbols and asks
// for feature-level architecture instead. Reused by v3/v4/v5.
const architectureSchemaDescription = [
  "REQUIRED. A 3-sentence preamble that describes — for THIS specific app — what the user does, what gets persisted and shared between viewers, and what runtime-decided access control gates.",
  "Describe the application architecture and the connection from each platform feature (Fireproof live docs, callAI typed AI calls, useViewer access read, ImgGen generated imagery) to a concrete user-visible feature.",
  "Do NOT include code: no function names (no `useLiveQuery`, no `database.put`), no doc-shape objects in braces, no `useViewer().can(...)` syntax, no field-name backticks.",
  "Use plain language. Name what the user sees and does, what carries across viewers, where AI fits, and what changes for non-owners — in narrative form, not as a code spec.",
  'Example shape: "The owner publishes short poems; every visitor sees a live, chronological wall of poems that updates the moment a new one is published. callAI is not used in this app — the writing is entirely the owner\'s own. Read access is open to anyone with the link; the publish form is hidden from non-owners since the runtime decides who can write."',
].join(" ");

function withArchitectureSchema(): typeof preAllocSchema {
  return {
    ...preAllocSchema,
    properties: {
      ...preAllocSchema.properties,
      enrichedPrompt: {
        ...preAllocSchema.properties.enrichedPrompt,
        description: architectureSchemaDescription,
      },
    },
  } as typeof preAllocSchema;
}

// v3 — production user-message + architecture-only schema description.
// Isolates whether the description rewrite alone moves the model off code
// snippets, without adding a platform brief in the user message.
const v3ArchSchemaOnly: ProbeVariant = {
  id: "v3-arch-schema-only",
  description: "Production user-message, schema description forbids code symbols and asks for architecture-level narrative.",
  buildUserMessage: (userPrompt) => makePreAllocUserMessage(userPrompt),
  schemaOverride: withArchitectureSchema(),
};

const platformStackParagraph =
  "Platform stack: a vibe is a single-file React app that runs in the user's browser. Fireproof is a peer-replicated document database — `useFireproof(name)` returns a database handle and `useLiveQuery(field)` keeps every viewer's UI in lockstep with the underlying docs in real time, no separate sync layer. callAI is a typed call to a hosted LLM that returns JSON matching a schema the app declares; the JSON is saved as a Fireproof doc so it persists and shows up live for every viewer. useViewer is a read-only window into runtime-managed access control: the platform owns who can read and who can write, and `useViewer().can('write')` lets the app reflect that verdict in its UI without ever setting it. ImgGen renders a generated illustration tile when imagery is naturally part of the experience, not as decoration.";

// v4 — same architecture-only schema + a paragraph-form platform stack
// description in the user message. The hypothesis from the prior round was
// that platform vocabulary in the user message produced more grounded
// outputs; here it's a single dense paragraph rather than bullet points,
// paired with the no-code schema requirement.
const v4StackParagraph: ProbeVariant = {
  id: "v4-stack-paragraph",
  description: "Single-paragraph platform stack description in the user message + architecture-only schema description.",
  buildUserMessage: async (userPrompt) => {
    const baseline = await makePreAllocUserMessage(userPrompt);
    return `${platformStackParagraph}\n\n${baseline}`;
  },
  schemaOverride: withArchitectureSchema(),
};

// v5 — like v4 but reframes the request explicitly toward the
// "feature ↔ stack" mapping: for each platform piece, what user-visible
// feature it enables in THIS app. Stronger structural prompt.
const v5FeatureMapping: ProbeVariant = {
  id: "v5-feature-mapping",
  description: "Stack paragraph + schema asks model to map each platform feature to a concrete user-visible feature.",
  buildUserMessage: async (userPrompt) => {
    const baseline = await makePreAllocUserMessage(userPrompt);
    return `${platformStackParagraph}\n\n${baseline}`;
  },
  schemaOverride: {
    ...preAllocSchema,
    properties: {
      ...preAllocSchema.properties,
      enrichedPrompt: {
        ...preAllocSchema.properties.enrichedPrompt,
        description: [
          "REQUIRED. A 3-sentence preamble that maps each relevant platform feature to a concrete user-visible feature of THIS app.",
          "Sentence 1: what users see and do — the central activity in the app — and how Fireproof's live-sync makes that activity shared across viewers (e.g. 'every viewer sees the same list in real time').",
          "Sentence 2: where callAI fits OR explicitly state callAI isn't needed for this app (don't force it). If used, name the user-triggered action that calls it and what category of structured response comes back — in plain language, not code.",
          "Sentence 3: which user actions are write actions, and what non-owners see in place of those actions when the runtime's access control hides them (useViewer reflects this; you don't set it). If imagery is natural to the app's domain, add a short clause naming what an ImgGen tile would depict.",
          "Do NOT use code: no function names like `useLiveQuery`, no `{ type: ..., title: ... }` doc shapes, no `can(\"write\")` syntax, no backtick-quoted field names. Plain language, narrative, one sentence per architectural concern.",
        ].join(" "),
      },
    },
  } as typeof preAllocSchema,
};

// v6 — tighten v3: forbid feature fabrication, require platform-features
// be tied to features in THIS prompt only.
const v6NoFabrication: ProbeVariant = {
  id: "v6-no-fabrication",
  description: "v3 + explicit ban on inventing features outside the user prompt; callAI/ImgGen are opt-in not opt-out.",
  buildUserMessage: (userPrompt) => makePreAllocUserMessage(userPrompt),
  schemaOverride: {
    ...preAllocSchema,
    properties: {
      ...preAllocSchema.properties,
      enrichedPrompt: {
        ...preAllocSchema.properties.enrichedPrompt,
        description: [
          "REQUIRED. A 3-sentence preamble that grounds THIS app in our platform.",
          "Describe only features the user prompt actually requested — do NOT invent new features (no AI tagging, no generation buttons, no image tiles) just because the platform supports them. callAI and ImgGen are opt-in: mention them only if the user prompt asks for AI or imagery.",
          "Sentence 1: what users see and do, and how Fireproof's live-sync makes that activity shared across every viewer in real time.",
          "Sentence 2: if the prompt asks for AI, name where it fits in plain language; otherwise say something like 'no AI is used in this app' — do not fabricate an AI feature.",
          "Sentence 3: which user actions are write actions, and what non-owners see in place of those actions when the runtime's access control hides them (useViewer reflects the runtime's verdict, never sets it).",
          "Do NOT include code: no function names like `useLiveQuery` or `database.put`, no doc-shape objects, no `can(\"write\")` syntax, no backtick-quoted fields. Plain narrative, not a code spec.",
        ].join(" "),
      },
    },
  } as typeof preAllocSchema,
};

// v7 — v6's schema + the platform stack paragraph in the user message.
// A/B against v6 on whether the platform brief adds anything when the
// schema description is already strong.
const v7NoFabPlusParagraph: ProbeVariant = {
  id: "v7-no-fab-plus-paragraph",
  description: "v6 schema + platform stack paragraph in user message. A/B against v6 on paragraph utility.",
  buildUserMessage: async (userPrompt) => {
    const baseline = await makePreAllocUserMessage(userPrompt);
    return `${platformStackParagraph}\n\n${baseline}`;
  },
  schemaOverride: v6NoFabrication.schemaOverride,
};

// v8 — v7 + a length budget. Hypothesis: v7's 500-char average has filler;
// asking for ≤350 chars should keep platform naming but drop the
// "with the add and edit controls hidden" trailing flourishes.
const v8Tight: ProbeVariant = {
  id: "v8-tight",
  description: "v7 + tight 200-350 char budget; force density over length.",
  buildUserMessage: v7NoFabPlusParagraph.buildUserMessage,
  schemaOverride: {
    ...preAllocSchema,
    properties: {
      ...preAllocSchema.properties,
      enrichedPrompt: {
        ...preAllocSchema.properties.enrichedPrompt,
        description: [
          "REQUIRED. Exactly 3 short sentences (200-350 characters total) grounding THIS app in our platform — dense, no padding, no flourishes.",
          "Sentence 1: what users see and do, and that Fireproof's live sync shares the activity with every viewer in real time.",
          "Sentence 2: if the prompt asks for AI, name the user action that calls callAI and what category of structured response comes back; otherwise state 'No callAI is used.' If the prompt asks for imagery, name what an ImgGen tile depicts; otherwise omit it. Do NOT invent AI or imagery features.",
          "Sentence 3: name the write actions and that non-owners see a read-only view because the runtime's access control hides the write surfaces (useViewer reflects this; the app never sets it).",
          "Do NOT include code: no function names, no doc-shape objects, no `can(\"write\")` syntax, no backtick fields. Be a narrative spec, not a code spec.",
        ].join(" "),
      },
    },
  } as typeof preAllocSchema,
};

// v9 — drop the negative "no callAI" template. Reframe sentence 2 around
// the positive truth: every vibe has a natural place for callAI. The
// schema names three common patterns the model can draw from, rather than
// asking for opt-in/opt-out.
const v9CallaiPositive: ProbeVariant = {
  id: "v9-callai-positive",
  description: "v8 tight + positive callAI framing: name a useful AI role for this app, don't opt out.",
  buildUserMessage: v7NoFabPlusParagraph.buildUserMessage,
  schemaOverride: {
    ...preAllocSchema,
    properties: {
      ...preAllocSchema.properties,
      enrichedPrompt: {
        ...preAllocSchema.properties.enrichedPrompt,
        description: [
          "REQUIRED. Exactly 3 short sentences (200-400 characters total) grounding THIS app in our platform — dense, no padding, no flourishes.",
          "Sentence 1: what users see and do, and that Fireproof's live sync shares the activity with every viewer in real time.",
          "Sentence 2: name the callAI role in this app — every vibe finds a place for AI. Common roles to pick from based on what fits the app's central activity: (a) AI-suggest / autofill for form fields, where the user taps a button next to a blank input and callAI returns an example value drawn from the app's domain; (b) critique or extend user-authored content, where callAI scores, rewrites, summarizes, or proposes the next thing (next line of a poem, follow-up task, related recipe); (c) categorize, tag, or score content automatically on save (sentiment, topic tags, priority). Pick ONE role that genuinely fits this app — what the user clicks, what kind of structured response callAI returns, and what gets saved.",
          "Sentence 3: name the write actions in this app and that non-owners see a read-only view because the runtime's access control hides the write surfaces (useViewer reflects the verdict; the app never sets it). If imagery is naturally part of the app's domain, add a brief clause naming what an ImgGen tile depicts.",
          "Do NOT include code: no function names, no doc-shape objects, no `can(\"write\")` syntax, no backtick fields. Narrative spec, not code spec. Do not invent imagery features when the app's domain wouldn't naturally include them.",
        ].join(" "),
      },
    },
  } as typeof preAllocSchema,
};

export const allVariants: readonly ProbeVariant[] = [
  v0Baseline,
  v1PlatformBrief,
  v2Exemplar,
  v3ArchSchemaOnly,
  v4StackParagraph,
  v5FeatureMapping,
  v6NoFabrication,
  v7NoFabPlusParagraph,
  v8Tight,
  v9CallaiPositive,
];

export function findVariant(id: string): ProbeVariant | undefined {
  return allVariants.find((v) => v.id === id);
}
