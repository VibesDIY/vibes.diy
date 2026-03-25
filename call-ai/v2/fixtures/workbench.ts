/**
 * Schema prompt workbench — test system prompt variants for structured output.
 *
 * Runs prompt variants × schemas × models × trials via OpenRouter,
 * validates response shapes with arktype, prints a scorecard,
 * and saves raw SSE responses for offline replay.
 *
 * Usage: cd call-ai/v2 && npx tsx fixtures/workbench.ts
 * Requires .env with OPENROUTER_API_KEY
 */
import { dotenv } from "zx";
import { promises as fsP } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type } from "arktype";
import { exception2Result, Result, array2stream, stream2array } from "@adviser/cement";
import {
  createStatsCollector,
  createLineStream,
  createDataStream,
  createSseStream,
  createDeltaStream,
  createSectionsStream,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  isToplevelLine,
} from "../index.js";
import { buildSchemaSystemMessage } from "../build-schema-prompt.js";
import { buildExample } from "../example-builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env ──────────────────────────────────────────────

const env = dotenv.load(join(__dirname, "../.env"));
const apiKey = env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";
if (apiKey.length === 0) {
  process.stderr.write("Error: OPENROUTER_API_KEY not set in .env\n");
  process.exit(1);
}

// ── Config ─────────────────────────────────────────────────

const TRIALS = 3;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-sonnet-4-6",
  "google/gemini-2.5-flash",
] as const;

// ── Schemas + validators ───────────────────────────────────

interface TestSchema {
  readonly name: string;
  readonly schema: Record<string, unknown>;
  readonly userPrompt: string;
  readonly validate: (value: unknown) => Result<unknown>;
}

const sandwichValidator = type({ name: "string", layers: "string[]" });
const tasksValidator = type({
  tasks: type({ title: "string", description: "string", difficulty: "string" }).array(),
});

function arktypeToResult(validator: (v: unknown) => unknown, value: unknown): Result<unknown> {
  const result = validator(value);
  if (result instanceof type.errors) {
    return Result.Err(result.summary);
  }
  return Result.Ok(result);
}

async function loadSchema(filename: string): Promise<Record<string, unknown>> {
  const raw = await fsP.readFile(join(__dirname, filename), "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

const schemas: TestSchema[] = [
  {
    name: "sandwich",
    schema: await loadSchema("sandwich-schema.json"),
    userPrompt: "Describe a sandwich",
    validate: (v) => arktypeToResult(sandwichValidator, v),
  },
  {
    name: "tasks",
    schema: await loadSchema("tasks-schema.json"),
    userPrompt: "Generate 3 programming tasks for a beginner",
    validate: (v) => arktypeToResult(tasksValidator, v),
  },
];

// ── Prompt variants ────────────────────────────────────────

interface PromptVariant {
  readonly name: string;
  readonly buildSystemMessage: (schema: Record<string, unknown>) => string;
}

const variants: readonly PromptVariant[] = [
  {
    name: "current",
    buildSystemMessage: (schema) => buildSchemaSystemMessage(schema),
  },
  {
    name: "no-fence",
    buildSystemMessage: (schema) =>
      `Return a JSON object conforming to this schema: ${JSON.stringify(schema)}`,
  },
  {
    name: "explicit-flat",
    buildSystemMessage: (schema) =>
      `Return a JSON object with these fields at the top level (not nested under "properties"). Schema: ${JSON.stringify(schema)}`,
  },
  {
    name: "with-example",
    buildSystemMessage: (schema) => {
      const example = buildExample(schema);
      return `Return a JSON object conforming to this schema: ${JSON.stringify(schema)}

Example of expected output shape:
${JSON.stringify(example, null, 2)}`;
    },
  },
];

// ── Pipeline: raw SSE bytes → extracted JSON ───────────────

function extractJsonFromPipeline(events: readonly unknown[]): Result<unknown> {
  // Try code block extraction first (for code-fence responses)
  const codeLines: string[] = [];
  let inJsonBlock = false;
  for (const event of events) {
    if (isCodeBegin(event) && event.lang.toUpperCase() === "JSON") {
      inJsonBlock = true;
      codeLines.length = 0;
    } else if (isCodeEnd(event)) {
      inJsonBlock = false;
    } else if (inJsonBlock && isCodeLine(event)) {
      codeLines.push(event.line);
    }
  }

  if (codeLines.length > 0) {
    return exception2Result(() => JSON.parse(codeLines.join("\n")) as unknown);
  }

  // Fall back to toplevel text
  const toplevelText = events
    .filter((e) => isToplevelLine(e))
    .map((e) => (e as { readonly line: string }).line)
    .join("\n");

  if (toplevelText.length === 0) {
    return Result.Err("No code block or toplevel text found");
  }

  return exception2Result(() => JSON.parse(toplevelText) as unknown);
}

async function pipelineFromBytes(raw: Uint8Array): Promise<readonly unknown[]> {
  let id = 1;
  const streamId = `wb-${id++}`;
  const lines = new TextDecoder().decode(raw).split("\n");
  return stream2array(
    array2stream(lines.map((line) => `${line}\n`))
      .pipeThrough(createStatsCollector(streamId, 60000))
      .pipeThrough(createLineStream(streamId))
      .pipeThrough(createDataStream(streamId))
      .pipeThrough(createSseStream(streamId))
      .pipeThrough(createDeltaStream(streamId, () => `wb-${id++}`))
      .pipeThrough(createSectionsStream(streamId, () => `wb-${id++}`))
  );
}

// ── API call ───────────────────────────────────────────────

interface CallParams {
  readonly model: string;
  readonly systemMessage: string;
  readonly userPrompt: string;
}

async function callOpenRouter(params: CallParams): Promise<Result<Uint8Array>> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.systemMessage },
        { role: "user", content: params.userPrompt },
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return Result.Err(`${response.status}: ${text}`);
  }

  if (response.body === null) {
    return Result.Err("No response body");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return Result.Ok(merged);
}

// ── Run ────────────────────────────────────────────────────

interface TrialResult {
  readonly pass: boolean;
  readonly error: string;
}

interface ComboResults {
  readonly results: readonly TrialResult[];
}

const runsDir = join(__dirname, "workbench-runs");
await fsP.mkdir(runsDir, { recursive: true });

const allResults: Record<string, Record<string, Record<string, ComboResults>>> = {};

const totalCalls = variants.length * schemas.length * MODELS.length * TRIALS;
let callNr = 0;

for (const variant of variants) {
  allResults[variant.name] = {};

  for (const testSchema of schemas) {
    allResults[variant.name][testSchema.name] = {};
    const systemMessage = variant.buildSystemMessage(testSchema.schema);

    for (const model of MODELS) {
      const shortModel = model.split("/").pop() ?? model;
      const trialResults: TrialResult[] = [];

      for (let trial = 1; trial <= TRIALS; trial++) {
        callNr++;
        const tag = `[${callNr}/${totalCalls}] ${variant.name} × ${testSchema.name} × ${shortModel} #${trial}`;

        const rRaw = await callOpenRouter({
          model,
          systemMessage,
          userPrompt: testSchema.userPrompt,
        });

        if (rRaw.isErr()) {
          process.stderr.write(`${tag} ... ERROR: ${rRaw.Err()}\n`);
          trialResults.push({ pass: false, error: String(rRaw.Err()) });
          continue;
        }

        const raw = rRaw.Ok();

        // Save raw SSE
        const filename = `${variant.name}-${testSchema.name}-${shortModel}-${trial}.llm.txt`;
        await fsP.writeFile(join(runsDir, filename), raw);

        // Run pipeline
        const events = await pipelineFromBytes(raw);
        const rJson = extractJsonFromPipeline(events);

        if (rJson.isErr()) {
          process.stderr.write(`${tag} ... FAIL: ${rJson.Err()}\n`);
          trialResults.push({ pass: false, error: String(rJson.Err()) });
          continue;
        }

        const rValid = testSchema.validate(rJson.Ok());
        if (rValid.isErr()) {
          process.stderr.write(`${tag} ... FAIL: ${rValid.Err()}\n`);
          trialResults.push({ pass: false, error: String(rValid.Err()) });
          continue;
        }

        process.stderr.write(`${tag} ... pass\n`);
        trialResults.push({ pass: true, error: "" });
      }

      allResults[variant.name][testSchema.name][shortModel] = { results: trialResults };
    }
  }
}

// ── Scorecard ──────────────────────────────────────────────

process.stdout.write("\n");

let bestVariant = "";
let bestScore = -1;

for (const variant of variants) {
  let variantTotal = 0;
  let variantPass = 0;

  process.stdout.write(`=== Prompt: "${variant.name}" ===\n`);

  for (const testSchema of schemas) {
    for (const model of MODELS) {
      const shortModel = model.split("/").pop() ?? model;
      const combo = allResults[variant.name][testSchema.name][shortModel];
      const pass = combo.results.filter((r) => r.pass).length;
      const total = combo.results.length;
      variantTotal += total;
      variantPass += pass;

      const status = pass === total ? "" : "  <<<";
      process.stdout.write(`  ${testSchema.name} × ${shortModel}: ${pass}/${total}${status}\n`);
    }
  }

  process.stdout.write("\n");

  if (variantPass > bestScore) {
    bestScore = variantPass;
    bestVariant = variant.name;
  }
}

const totalPossible = variants.length > 0 ? schemas.length * MODELS.length * TRIALS : 0;
process.stdout.write(`=== BEST: "${bestVariant}" (${bestScore}/${totalPossible}) ===\n`);

// ── Save JSON results ──────────────────────────────────────

const resultsJson = {
  timestamp: new Date().toISOString(),
  trials: TRIALS,
  models: MODELS,
  variants: Object.fromEntries(
    variants.map((v) => [
      v.name,
      Object.fromEntries(
        schemas.map((s) => [
          s.name,
          Object.fromEntries(
            MODELS.map((m) => {
              const shortModel = m.split("/").pop() ?? m;
              const combo = allResults[v.name][s.name][shortModel];
              return [
                shortModel,
                {
                  pass: combo.results.filter((r) => r.pass).length,
                  fail: combo.results.filter((r) => !r.pass).length,
                  errors: combo.results.filter((r) => !r.pass).map((r) => r.error),
                },
              ];
            })
          ),
        ])
      ),
    ])
  ),
};

await fsP.writeFile(join(runsDir, "results.json"), JSON.stringify(resultsJson, null, 2) + "\n");
process.stderr.write(`\nResults saved to fixtures/workbench-runs/results.json\n`);
