export const meta = {
  name: "eval-access-fn",
  description: "Run home-page prompts through vibes-diy generate, pull results, score app quality 1-5",
  phases: [
    { title: "Generate", detail: "Fan out npx vibes-diy generate for each prompt" },
    { title: "Pull + Score", detail: "Pull generated files and score each app 1-5" },
    { title: "Report", detail: "Synthesize scores into a summary report" },
  ],
};

const PROMPTS_PATH = "docs/superpowers/specs/eval-access-fn-prompts.json";

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    runIndex: { type: "integer" },
    score: { type: "integer", minimum: 1, maximum: 5 },
    scoreReason: { type: "string" },
    appSlug: { type: "string" },
    url: { type: "string" },
    hasAccessJs: { type: "boolean" },
    usesHasChannel: { type: "boolean" },
    usesHasRole: { type: "boolean" },
    usesIsOwner: { type: "boolean" },
    usesViewerTag: { type: "boolean" },
    usesAllowAnonymous: { type: "boolean" },
    featureNotes: { type: "string" },
  },
  required: ["id", "runIndex", "score", "scoreReason", "appSlug", "hasAccessJs"],
};

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    setAverages: {
      type: "object",
      properties: {
        asIs: { type: "number" },
        enhanced: { type: "number" },
        newCapabilities: { type: "number" },
      },
    },
    tripleRunVariance: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          scores: { type: "array", items: { type: "integer" } },
          mean: { type: "number" },
          range: { type: "integer" },
        },
      },
    },
    accessFnAdoption: {
      type: "object",
      properties: {
        asIsPercent: { type: "number" },
        enhancedPercent: { type: "number" },
        newPercent: { type: "number" },
      },
    },
    topFindings: { type: "array", items: { type: "string" } },
    bottomFindings: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "setAverages", "tripleRunVariance", "topFindings"],
};

const PROMPT_LIST_SCHEMA = {
  type: "object",
  properties: {
    prompts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          set: { type: "string" },
          category: { type: "string" },
          triple: { type: "boolean" },
          prompt: { type: "string" },
        },
        required: ["id", "set", "triple", "prompt"],
      },
    },
  },
  required: ["prompts"],
};

// Build the run list: each prompt once, plus triple-run prompts get 2 extra
const promptData = await agent(
  `Read the file at ${PROMPTS_PATH} and return its contents. The file is a JSON object with a "prompts" array. Return every prompt entry exactly as-is — do not summarize, truncate, or omit any entries.`,
  {
    label: "read-prompts",
    phase: "Generate",
    schema: PROMPT_LIST_SCHEMA,
  }
);

const prompts = promptData.prompts;
const runs = [];
for (const p of prompts) {
  const count = p.triple ? 3 : 1;
  for (let i = 0; i < count; i++) {
    runs.push({ ...p, runIndex: i });
  }
}

log(`${runs.length} total runs across ${prompts.length} prompts`);

// Generate + Pull + Score as a pipeline: each prompt flows through all 3 stages independently
phase("Generate");
const results = await pipeline(
  runs,

  // Stage 1: generate the app
  (run) =>
    agent(
      `Run the following shell command and report what happened. Return the app-slug and URL if successful, or the error message if it failed.

Command:
npx vibes-diy@latest generate "${run.prompt.replace(/"/g, '\\"')}" --app-slug eval-${run.id}${run.runIndex > 0 ? "-r" + run.runIndex : ""} --verbose 2>&1

Report the app-slug you used and the URL from the output (or the error). Keep your response under 100 words.`,
      { label: `gen:${run.id}${run.runIndex > 0 ? ":r" + run.runIndex : ""}`, phase: "Generate" }
    ),

  // Stage 2: pull files and score
  (genResult, run) => {
    const slug = `eval-${run.id}${run.runIndex > 0 ? "-r" + run.runIndex : ""}`;
    return agent(
      `You are scoring a generated vibes.diy app for quality.

The app was generated from this user prompt:
"${run.prompt.replace(/"/g, '\\"')}"

Prompt category: ${run.set === "A" ? "as-is (original home page prompt)" : run.set === "B" ? "enhanced (natural sharing language added)" : "new capability (business app, previously impossible)"}

Generation result: ${genResult}

Step 1: Pull the generated files. Run:
npx vibes-diy@latest pull ${slug}

Step 2: Read the files in the ${slug}/ directory — at minimum App.jsx, and access.js if it exists.

Step 3: Score the app 1-5:
- 5: Renders, all described features work, UI is coherent, workflow connects
- 4: Renders, most features work, minor UI/UX gap
- 3: Renders but a key feature is broken or missing
- 2: Renders with errors or crashes on basic interaction
- 1: Fails to render or fundamentally broken

Score based on whether the CODE looks correct and complete — does it implement what the user asked for? Are hooks used correctly? Are there obvious runtime errors?

Also note (without affecting the score):
- Does access.js exist?
- Does App.jsx reference access.hasChannel() or access.hasRole()?
- Does it use isOwner for management gates?
- Does it use ViewerTag?
- Does access.js use allowAnonymous?

Use id "${run.id}" and runIndex ${run.runIndex} in your response.`,
      {
        label: `score:${run.id}${run.runIndex > 0 ? ":r" + run.runIndex : ""}`,
        phase: "Pull + Score",
        schema: SCORE_SCHEMA,
      }
    );
  }
);

const scores = results.filter(Boolean);
log(`Scored ${scores.length} of ${runs.length} runs`);

// Synthesize report
phase("Report");
const report = await agent(
  `You have ${scores.length} scored eval results from a vibes.diy system prompt evaluation. Synthesize a report.

Raw scores (JSON):
${JSON.stringify(scores, null, 2)}

Compute:
1. Average score per set: A (as-is), B (enhanced), C (new capabilities)
2. For triple-run prompts, show each run's score, mean, and range (max - min)
3. What % of each set emitted access.js?
4. Top 3 findings (best patterns, pleasant surprises)
5. Bottom 3 findings (worst scores, recurring problems)
6. A 2-3 sentence executive summary

Be specific — name prompt IDs, quote score reasons. This report goes to the product team.`,
  { label: "report", phase: "Report", schema: REPORT_SCHEMA }
);

return report;
