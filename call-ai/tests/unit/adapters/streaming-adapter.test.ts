import { describe, it, expect } from "vitest";

import {
  ParserEvento,
  OrMeta,
  OrDelta,
  OrUsage,
  OrDone,
} from "../../../pkg/parser/parser-evento.js";
import { StreamingAdapter } from "../../../pkg/parser/adapters/streaming-adapter.js";

describe("StreamingAdapter", () => {
  function collectEvents(evento: ParserEvento) {
    const metas: OrMeta[] = [];
    const deltas: OrDelta[] = [];
    const usages: OrUsage[] = [];
    const dones: OrDone[] = [];

    evento.onEvent((event) => {
      switch (event.type) {
        case "or.meta": metas.push(event); break;
        case "or.delta": deltas.push(event); break;
        case "or.usage": usages.push(event); break;
        case "or.done": dones.push(event); break;
      }
    });

    return { metas, deltas, usages, dones };
  }

  it("emits or.delta for content chunks", () => {
    const evento = new ParserEvento();
    const adapter = new StreamingAdapter(evento);
    const { deltas } = collectEvents(evento);

    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}\n'
    );

    expect(deltas).toHaveLength(1);
    expect(deltas[0].content).toBe("Hello");
    expect(deltas[0].seq).toBe(0);
  });

  it("emits or.meta on first chunk with id", () => {
    const evento = new ParserEvento();
    const adapter = new StreamingAdapter(evento);
    const { metas } = collectEvents(evento);

    adapter.processChunk(
      'data: {"id":"gen-123","provider":"OpenAI","model":"openai/gpt-4o","created":1742583676,"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n'
    );

    expect(metas).toHaveLength(1);
    expect(metas[0]).toMatchObject({
      type: "or.meta",
      id: "gen-123",
      provider: "OpenAI",
      model: "openai/gpt-4o",
      created: 1742583676,
      systemFingerprint: "fp_test",
    });
  });

  it("emits or.meta only once", () => {
    const evento = new ParserEvento();
    const adapter = new StreamingAdapter(evento);
    const { metas } = collectEvents(evento);

    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"A"}}]}\n'
    );
    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"B"}}]}\n'
    );

    expect(metas).toHaveLength(1);
  });

  it("emits or.usage on chunk with usage", () => {
    const evento = new ParserEvento();
    const adapter = new StreamingAdapter(evento);
    const { usages } = collectEvents(evento);

    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":""}}],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30,"cost":0.001}}\n'
    );

    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({
      type: "or.usage",
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cost: 0.001,
    });
  });

  it("emits or.done with finish_reason", () => {
    const evento = new ParserEvento();
    const adapter = new StreamingAdapter(evento);
    const { dones } = collectEvents(evento);

    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":""},"finish_reason":"stop"}]}\n'
    );

    expect(dones).toHaveLength(1);
    expect(dones[0]).toMatchObject({
      type: "or.done",
      finishReason: "stop",
    });
  });

  it("increments seq for each delta", () => {
    const evento = new ParserEvento();
    const adapter = new StreamingAdapter(evento);
    const { deltas } = collectEvents(evento);

    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"A"}}]}\n'
    );
    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"B"}}]}\n'
    );
    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"C"}}]}\n'
    );

    expect(deltas.map(d => d.seq)).toEqual([0, 1, 2]);
    expect(deltas.map(d => d.content)).toEqual(["A", "B", "C"]);
  });

  it("handles empty content deltas (no event)", () => {
    const evento = new ParserEvento();
    const adapter = new StreamingAdapter(evento);
    const { deltas } = collectEvents(evento);

    adapter.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"role":"assistant","content":""}}]}\n'
    );

    expect(deltas).toHaveLength(0);
  });

  it("handles chunks split across multiple processChunk calls", () => {
    const evento = new ParserEvento();
    const adapter = new StreamingAdapter(evento);
    const { deltas } = collectEvents(evento);

    // Split the SSE message across calls
    adapter.processChunk('data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,');
    adapter.processChunk('"system_fingerprint":"fp","choices":[{"delta":{"content":"Hello"}}]}\n');

    expect(deltas).toHaveLength(1);
    expect(deltas[0].content).toBe("Hello");
  });
});
