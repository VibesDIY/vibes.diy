import { describe, it, expect } from "vitest";
import { ParserEvento, ToolComplete, OrJson } from "@vibes.diy/call-ai-base";
import { toolHandler } from "@vibes.diy/call-ai-base";

describe("toolHandler - Legacy Formats", () => {
  function createEvento() {
    const evento = new ParserEvento();
    evento.push(toolHandler);
    return evento;
  }

  function collectToolEvents(evento: ParserEvento) {
    const completes: ToolComplete[] = [];
    evento.onEvent((event) => {
      if (event.type === "tool.complete") completes.push(event as ToolComplete);
    });
    return completes;
  }

  describe("Format 1: Direct tool_use", () => {
    it("handles direct tool_use object", () => {
      const evento = createEvento();
      const completes = collectToolEvents(evento);

      const payload = {
        type: "tool_use",
        id: "call_1",
        name: "test_tool",
        input: { foo: "bar" }
      };

      evento.trigger({ type: "or.json", json: payload });

      expect(completes).toHaveLength(1);
      expect(completes[0]).toMatchObject({
        callId: "call_1",
        functionName: "test_tool",
        arguments: '{"foo":"bar"}'
      });
    });
  });

  describe("Format 2: stop_reason with content array", () => {
    it("handles stop_reason: tool_use", () => {
      const evento = createEvento();
      const completes = collectToolEvents(evento);

      const payload = {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Thinking..." },
          { 
            type: "tool_use",
            id: "call_2",
            name: "calc",
            input: { expr: "1+1" }
          }
        ]
      };

      evento.trigger({ type: "or.json", json: payload });

      expect(completes).toHaveLength(1);
      expect(completes[0]).toMatchObject({
        callId: "call_2",
        functionName: "calc",
        arguments: '{"expr":"1+1"}'
      });
    });
  });

  describe("Format 3: choices with content array", () => {
    it("handles tool_use in message.content", () => {
      const evento = createEvento();
      const completes = collectToolEvents(evento);

      const payload = {
        choices: [{
          message: {
            content: [
              { type: "text", text: "Hi" },
              { 
                type: "tool_use",
                id: "call_3",
                name: "greet",
                input: { name: "User" }
              }
            ]
          }
        }]
      };

      evento.trigger({ type: "or.json", json: payload });

      expect(completes).toHaveLength(1);
      expect(completes[0]).toMatchObject({
        callId: "call_3",
        functionName: "greet",
        arguments: '{"name":"User"}'
      });
    });

    it("handles tool_use in delta.content", () => {
      const evento = createEvento();
      const completes = collectToolEvents(evento);

      const payload = {
        choices: [{
          delta: {
            content: [
              { 
                type: "tool_use",
                id: "call_4",
                name: "delta_tool",
                input: { x: 1 }
              }
            ]
          }
        }]
      };

      evento.trigger({ type: "or.json", json: payload });

      expect(completes).toHaveLength(1);
      expect(completes[0]).toMatchObject({
        callId: "call_4",
        functionName: "delta_tool",
        arguments: '{"x":1}'
      });
    });
  });
});
