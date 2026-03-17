import { array2stream, loadAsset, stream2array } from "@adviser/cement";
import {
  createDataStream,
  createDeltaStream,
  createLineStream,
  createSectionsStream,
  createSseStream,
  createStatsCollector,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  isToplevelLine,
} from "./index.js";

async function resolveContent(content: string): Promise<string> {
  const match = content.match(/^export default "([^"]+)"/);
  if (match && match[1]) {
    const response = await fetch(match[1]);
    return response.text();
  }
  return content;
}

export async function loadFixtureLines(filename: string): Promise<string[]> {
  const result = await loadAsset(`fixtures/${filename}`, {
    basePath: () => import.meta.url,
    fallBackUrl: import.meta.url,
  });
  const content = await resolveContent(result.Ok());
  return content.split("\n");
}

function streamFromLines(lines: readonly string[]) {
  return array2stream(lines.map((line) => `${line}\n`));
}

function createPipeline(lines: readonly string[]) {
  let id = 1;
  const streamId = `test-${id++}`;
  return {
    streamId,
    nextId: () => `test-${id++}`,
    base: streamFromLines(lines)
      .pipeThrough(createStatsCollector(streamId, 5000))
      .pipeThrough(createLineStream(streamId))
      .pipeThrough(createDataStream(streamId))
      .pipeThrough(createSseStream(streamId)),
  };
}

export function runSsePipeline(lines: readonly string[]) {
  const { base } = createPipeline(lines);
  return stream2array(base);
}

export function runDeltaPipeline(lines: readonly string[]) {
  const { streamId, nextId, base } = createPipeline(lines);
  return stream2array(base.pipeThrough(createDeltaStream(streamId, nextId)));
}

export function runFullPipeline(lines: readonly string[]) {
  const { streamId, nextId, base } = createPipeline(lines);
  return stream2array(
    base
      .pipeThrough(createDeltaStream(streamId, nextId))
      .pipeThrough(createSectionsStream(streamId, nextId))
  );
}

export function parseToplevelJson(events: readonly unknown[]) {
  const text = events
    .filter((event) => isToplevelLine(event))
    .map((event) => event.line)
    .join("\n");
  return JSON.parse(text);
}

// For fixtures where the model wraps its JSON in a ```JSON code block
// (prompt-engineering approach). Mirrors srv-sandbox.ts getCodeBlock logic.
export function parseCodeBlockJson(events: readonly unknown[]) {
  const lines: string[] = [];
  let inJsonBlock = false;
  for (const event of events) {
    if (isCodeBegin(event) && event.lang.toUpperCase() === "JSON") {
      inJsonBlock = true;
      lines.length = 0;
    } else if (isCodeEnd(event)) {
      inJsonBlock = false;
    } else if (inJsonBlock && isCodeLine(event)) {
      lines.push(event.line);
    }
  }
  return JSON.parse(lines.join("\n"));
}
