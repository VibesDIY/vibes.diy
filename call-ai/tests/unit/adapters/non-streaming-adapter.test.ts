import { describe, it, expect } from "vitest";

import {
  ParserEvento,
  ParserEvent,
  OrMeta,
  OrDelta,
  OrUsage,
  OrDone,
  OrStreamEnd,
} from "@vibes.diy/call-ai-base";
import { NonStreamingAdapter } from "@vibes.diy/call-ai-base";

describe("NonStreamingAdapter", () => {
  // Standard non-streaming response with message (not delta)
  const standardResponse = {
    id: "gen-123",
    provider: "OpenAI",
    model: "gpt-4",
    created: 1234567890,
    system_fingerprint: "fp_test",
    choices: [{
      message: {
        role: "assistant",
        content: "Hello, world!"
      },
      finish_reason: "stop"
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15
    }
  };

  // Response with content array (Claude format)
  const claudeResponse = {
    id: "msg-456",
    provider: "Anthropic",
    model: "claude-3",
    created: 1234567890,
    system_fingerprint: "",
    choices: [{
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Part 1" },
          { type: "text", text: " Part 2" }
        ]
      },
      finish_reason: "end_turn"
    }]
  };

  function collectEvents(evento: ParserEvento) {
    const metas: OrMeta[] = [];
    const deltas: OrDelta[] = [];
    const usages: OrUsage[] = [];
    const dones: OrDone[] = [];
    const streamEnds: OrStreamEnd[] = [];
    const all: ParserEvent[] = [];

    evento.onEvent((event) => {
      all.push(event);
      switch (event.type) {
        case "or.meta": metas.push(event); break;
        case "or.delta": deltas.push(event); break;
        case "or.usage": usages.push(event); break;
        case "or.done": dones.push(event); break;
        case "or.stream-end": streamEnds.push(event); break;
      }
    });

    return { metas, deltas, usages, dones, streamEnds, all };
  }

  it("emits or.json with response transformed to streaming format", () => {
    const evento = new ParserEvento();
    const adapter = new NonStreamingAdapter(evento);
    const { all } = collectEvents(evento);

    adapter.parse(standardResponse);

    const jsonEvents = all.filter(e => e.type === "or.json");
    expect(jsonEvents).toHaveLength(1);
    // Response is transformed: message → delta
    const json = (jsonEvents[0] as { json: { choices: Array<{ delta?: unknown; message?: unknown }> } }).json;
    expect(json.choices[0].delta).toBeDefined();
    expect(json.choices[0].message).toBeUndefined();
  });

  it("emits or.meta from response metadata", () => {
    const evento = new ParserEvento();
    const adapter = new NonStreamingAdapter(evento);
    const { metas } = collectEvents(evento);

    adapter.parse(standardResponse);

    expect(metas).toHaveLength(1);
    expect(metas[0]).toMatchObject({
      type: "or.meta",
      id: "gen-123",
      provider: "OpenAI",
      model: "gpt-4",
      created: 1234567890,
      systemFingerprint: "fp_test",
    });
  });

  it("emits or.delta from message content (string)", () => {
    const evento = new ParserEvento();
    const adapter = new NonStreamingAdapter(evento);
    const { deltas } = collectEvents(evento);

    adapter.parse(standardResponse);

    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({
      type: "or.delta",
      seq: 0,
      content: "Hello, world!",
    });
  });

  it("emits or.delta from message content array", () => {
    const evento = new ParserEvento();
    const adapter = new NonStreamingAdapter(evento);
    const { deltas } = collectEvents(evento);

    adapter.parse(claudeResponse);

    // Should combine text blocks into single delta
    expect(deltas).toHaveLength(1);
    expect(deltas[0].content).toBe("Part 1 Part 2");
  });

  it("emits or.usage from usage data", () => {
    const evento = new ParserEvento();
    const adapter = new NonStreamingAdapter(evento);
    const { usages } = collectEvents(evento);

    adapter.parse(standardResponse);

    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({
      type: "or.usage",
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it("emits or.done with finish reason", () => {
    const evento = new ParserEvento();
    const adapter = new NonStreamingAdapter(evento);
    const { dones } = collectEvents(evento);

    adapter.parse(standardResponse);

    expect(dones).toHaveLength(1);
    expect(dones[0]).toMatchObject({
      type: "or.done",
      finishReason: "stop",
    });
  });

  it("handles null/undefined gracefully", () => {
    const evento = new ParserEvento();
    const adapter = new NonStreamingAdapter(evento);
    const { all } = collectEvents(evento);

    adapter.parse(null);
    adapter.parse(undefined);

    expect(all).toHaveLength(0);
  });

  it("emits or.stream-end after parsing completes", () => {
    const evento = new ParserEvento();
    const adapter = new NonStreamingAdapter(evento);
    const { streamEnds, all } = collectEvents(evento);

    adapter.parse(standardResponse);

    expect(streamEnds).toHaveLength(1);
    expect(streamEnds[0]).toMatchObject({ type: "or.stream-end" });
    // stream-end should be the last event
    expect(all[all.length - 1].type).toBe("or.stream-end");
  });
});
