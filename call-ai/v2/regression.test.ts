import { array2stream, stream2array } from "@adviser/cement";
import { describe, it, expect } from "vitest";
import { createSectionsStream, isBlockEnd, isBlockStats } from "./block-stream.js";
import { createDataStream } from "./data-stream.js";
import { createDeltaStream } from "./delta-stream.js";
import { createLineStream } from "./line-stream.js";
import { createSseStream } from "./sse-stream.js";
import { createStatsCollector } from "./stats-stream.js";

describe("regression tests", () => {
  it("losses usage stats", async () => {
    let id = 1;
    const streamId = `test-${id++}`;
    const statsInterval = 1000;
    const res = await stream2array(
      array2stream(
        [
          ": OPENROUTER PROCESSING",
          "",
          ": OPENROUTER PROCESSING",
          "",
          ": OPENROUTER PROCESSING",
          "",
          'data: {"id":"gen-1770374220-waB6IE974ZVvrs5NHN8a","provider":"Google","model":"anthropic/claude-sonnet-4","object":"chat.completion.chunk","created":1770374220,"choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning":null,"reasoning_details":[]},"finish_reason":null,"native_finish_reason":null,"logprobs":null}]}',
          "",
          'data: {"id":"gen-1770374220-waB6IE974ZVvrs5NHN8a","provider":"Google","model":"anthropic/claude-sonnet-4","object":"chat.completion.chunk","created":1770374220,"choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning":null,"reasoning_details":[]},"finish_reason":null,"native_finish_reason":null,"logprobs":null}]}',
          "",
          'data: {"id":"gen-1770374220-waB6IE974ZVvrs5NHN8a","provider":"Google","model":"anthropic/claude-sonnet-4","object":"chat.completion.chunk","created":1770374220,"choices":[{"index":0,"delta":{"role":"assistant","content":"Hello! How are you doing today?","reasoning":null,"reasoning_details":[]},"finish_reason":null,"native_finish_reason":null,"logprobs":null}]}',
          "",
          'data: {"id":"gen-1770374220-waB6IE974ZVvrs5NHN8a","provider":"Google","model":"anthropic/claude-sonnet-4","object":"chat.completion.chunk","created":1770374220,"choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning":null,"reasoning_details":[]},"finish_reason":null,"native_finish_reason":null,"logprobs":null}]}',
          "",
          'data: {"id":"gen-1770374220-waB6IE974ZVvrs5NHN8a","provider":"Google","model":"anthropic/claude-sonnet-4","object":"chat.completion.chunk","created":1770374220,"choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning":null,"reasoning_details":[]},"finish_reason":"stop","native_finish_reason":"stop","logprobs":null}]}',
          "",
          'data: {"id":"gen-1770374220-waB6IE974ZVvrs5NHN8a","provider":"Google","model":"anthropic/claude-sonnet-4","object":"chat.completion.chunk","created":1770374220,"choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null,"native_finish_reason":null,"logprobs":null}],"usage":{"prompt_tokens":10,"completion_tokens":11,"total_tokens":21,"cost":0.000195,"is_byok":false,"prompt_tokens_details":{"cached_tokens":0,"cache_write_tokens":0},"cost_details":{"upstream_inference_cost":0.000195,"upstream_inference_prompt_cost":0.00003,"upstream_inference_completions_cost":0.000165},"completion_tokens_details":{"reasoning_tokens":0}}}',
          "",
          "data: [DONE]",
        ].map((i) => i + "\n")
      )
        .pipeThrough(createStatsCollector(streamId, statsInterval))
        .pipeThrough(createLineStream(streamId))
        .pipeThrough(createDataStream(streamId))
        .pipeThrough(createSseStream(streamId))
        .pipeThrough(createDeltaStream(streamId, () => `test-${id++}`))
        .pipeThrough(createSectionsStream(streamId, () => `test-${id++}`))
    );

    const usageStats = {
      completion_tokens: 11,
      completion_tokens_details: {
        reasoning_tokens: 0,
      },
      cost: 0.000195,
      cost_details: {
        upstream_inference_completions_cost: 0.000165,
        upstream_inference_cost: 0.000195,
        upstream_inference_prompt_cost: 0.00003,
      },
      is_byok: false,
      prompt_tokens: 10,
      prompt_tokens_details: {
        cache_write_tokens: 0,
        cached_tokens: 0,
      },
      total_tokens: 21,
    };
    expect(res.filter((i) => isBlockStats(i))[0].usage).toEqual(usageStats);
    expect(res.filter((i) => isBlockEnd(i))[0].usage).toEqual({
      calculated: {
        completion_tokens: 11,
        prompt_tokens: 10,
        total_tokens: 21,
      },
      given: [usageStats],
    });
  });
});
