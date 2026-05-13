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

export const allVariants: readonly ProbeVariant[] = [v0Baseline, v1PlatformBrief, v2Exemplar];

export function findVariant(id: string): ProbeVariant | undefined {
  return allVariants.find((v) => v.id === id);
}
