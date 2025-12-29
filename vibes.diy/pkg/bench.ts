import { readFile } from "node:fs/promises";

const URL = "https://vibes-diy-serve.jchris.workers.dev";
const FILE_PATH = "transform-sucrase.ts";
const TOTAL_REQUESTS = 1000;
const PARALLEL = 50;

interface RequestResult {
  success: boolean;
  duration: number;
  error?: string;
  size?: number;
}

async function makeRequest(code: string): Promise<RequestResult> {
  const start = Date.now();
  try {
    const response = await fetch(URL, {
      method: "PUT",
      headers: {
        "Content-Type": "text/plain",
      },
      body: code,
    });

    const duration = Date.now() - start;

    if (!response.ok) {
      const text = await response.text();
      return { success: false, duration, error: `${response.status}: ${text}` };
    }

    const data = await response.json();
    return {
      success: true,
      duration,
      size: JSON.stringify(data).length,
    };
  } catch (err) {
    const duration = Date.now() - start;
    return {
      success: false,
      duration,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runBatch(
  code: string,
  batchSize: number,
): Promise<RequestResult[]> {
  const promises = Array(batchSize)
    .fill(null)
    .map(() => makeRequest(code));
  return Promise.all(promises);
}

async function main() {
  console.log(`\n🚀 Benchmarking Worker`);
  console.log(`   URL: ${URL}`);
  console.log(`   File: ${FILE_PATH}`);
  console.log(`   Total requests: ${TOTAL_REQUESTS}`);
  console.log(`   Parallel: ${PARALLEL}\n`);

  // Read file once
  console.log("📖 Reading file...");
  const code = await readFile(FILE_PATH, "utf-8");
  console.log(`   File size: ${code.length} bytes\n`);

  // Run batches
  const allResults: RequestResult[] = [];
  const batches = Math.ceil(TOTAL_REQUESTS / PARALLEL);
  const startTime = Date.now();

  console.log("⏱️  Running requests...");
  for (let i = 0; i < batches; i++) {
    const remaining = TOTAL_REQUESTS - i * PARALLEL;
    const batchSize = Math.min(PARALLEL, remaining);

    process.stdout.write(
      `   Batch ${i + 1}/${batches} (${allResults.length}/${TOTAL_REQUESTS} completed)\r`,
    );

    const results = await runBatch(code, batchSize);
    allResults.push(...results);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n   ✅ Completed in ${(totalTime / 1000).toFixed(2)}s\n`);

  // Calculate stats
  const successful = allResults.filter((r) => r.success);
  const failed = allResults.filter((r) => !r.success);
  const durations = successful.map((r) => r.duration);
  const sizes = successful.map((r) => r.size || 0);

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const p50 = durations.sort((a, b) => a - b)[
    Math.floor(durations.length * 0.5)
  ];
  const p95 = durations.sort((a, b) => a - b)[
    Math.floor(durations.length * 0.95)
  ];
  const p99 = durations.sort((a, b) => a - b)[
    Math.floor(durations.length * 0.99)
  ];

  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const requestsPerSecond = (TOTAL_REQUESTS / (totalTime / 1000)).toFixed(2);

  // Print stats
  console.log("📊 Results\n");
  console.log(
    `   Success: ${successful.length}/${TOTAL_REQUESTS} (${((successful.length / TOTAL_REQUESTS) * 100).toFixed(1)}%)`,
  );
  console.log(`   Failed: ${failed.length}/${TOTAL_REQUESTS}`);

  if (failed.length > 0) {
    console.log("\n   Errors:");
    const errorCounts = new Map<string, number>();
    failed.forEach((r) => {
      const error = r.error || "Unknown error";
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    });
    errorCounts.forEach((count, error) => {
      console.log(`     - ${error} (${count}x)`);
    });
  }

  console.log("\n⚡ Performance\n");
  console.log(`   Requests/sec: ${requestsPerSecond}`);
  console.log(`   Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   Avg response: ${avgDuration.toFixed(0)}ms`);
  console.log(`   Min response: ${minDuration}ms`);
  console.log(`   Max response: ${maxDuration}ms`);
  console.log(`   P50 (median): ${p50}ms`);
  console.log(`   P95: ${p95}ms`);
  console.log(`   P99: ${p99}ms`);

  console.log("\n📦 Response Size\n");
  console.log(`   Avg size: ${(avgSize / 1024).toFixed(2)} KB`);
  console.log(
    `   Total data: ${((avgSize * successful.length) / 1024 / 1024).toFixed(2)} MB\n`,
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
