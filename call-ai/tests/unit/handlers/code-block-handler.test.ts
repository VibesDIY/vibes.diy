import { describe, it, expect } from "vitest";

import {
  ParserEvento,
  TextFragment,
  CodeStart,
  CodeFragment,
  CodeEnd,
  OrDelta,
} from "../../../pkg/parser/parser-evento.js";
import { createCodeBlockHandler } from "../../../pkg/parser/handlers/code-block-handler.js";

describe("codeBlockHandler", () => {
  function createEvento() {
    const evento = new ParserEvento();
    evento.push(createCodeBlockHandler());
    return evento;
  }

  function collectEvents(evento: ParserEvento) {
    const texts: TextFragment[] = [];
    const starts: CodeStart[] = [];
    const frags: CodeFragment[] = [];
    const ends: CodeEnd[] = [];

    evento.onEvent((event) => {
      switch (event.type) {
        case "text.fragment": texts.push(event as TextFragment); break;
        case "code.start": starts.push(event as CodeStart); break;
        case "code.fragment": frags.push(event as CodeFragment); break;
        case "code.end": ends.push(event as CodeEnd); break;
      }
    });

    return { texts, starts, frags, ends };
  }

  it("emits text.fragment for plain text", () => {
    const evento = createEvento();
    const { texts } = collectEvents(evento);

    evento.trigger({ type: "or.delta", seq: 0, content: "Hello world" } as OrDelta);

    expect(texts).toHaveLength(1);
    expect(texts[0].fragment).toBe("Hello world");
  });

  it("detects code block start", () => {
    const evento = createEvento();
    const { starts, texts } = collectEvents(evento);

    evento.trigger({ type: "or.delta", seq: 0, content: "Start\n```typescript\n" } as OrDelta);

    expect(texts).toHaveLength(1);
    expect(texts[0].fragment).toBe("Start\n");

    expect(starts).toHaveLength(1);
    expect(starts[0].language).toBe("typescript");
  });

  it("handles code content", () => {
    const evento = createEvento();
    const { starts, frags } = collectEvents(evento);

    evento.trigger({ type: "or.delta", seq: 0, content: "```\nconst x = 1;" } as OrDelta);

    expect(starts).toHaveLength(1);
    expect(frags).toHaveLength(1);
    expect(frags[0].fragment).toBe("const x = 1;");
  });

  it("detects code block end", () => {
    const evento = createEvento();
    const { starts, ends } = collectEvents(evento);

    evento.trigger({ type: "or.delta", seq: 0, content: "```\ncode\n```\n" } as OrDelta);

    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect(starts[0].blockId).toBe(ends[0].blockId);
  });

  it("handles split tokens", () => {
    const evento = createEvento();
    const { starts, frags, ends } = collectEvents(evento);

    // Split opening fence
    evento.trigger({ type: "or.delta", seq: 0, content: "`" } as OrDelta);
    evento.trigger({ type: "or.delta", seq: 1, content: "`" } as OrDelta);
    evento.trigger({ type: "or.delta", seq: 2, content: "`\n" } as OrDelta);

    expect(starts).toHaveLength(1);

    // Code content
    evento.trigger({ type: "or.delta", seq: 3, content: "co" } as OrDelta);
    evento.trigger({ type: "or.delta", seq: 4, content: "de" } as OrDelta);
    
    expect(frags).toHaveLength(2);
    expect(frags[0].fragment).toBe("co");
    expect(frags[1].fragment).toBe("de");

    // Split closing fence
    evento.trigger({ type: "or.delta", seq: 5, content: "\n`" } as OrDelta);
    evento.trigger({ type: "or.delta", seq: 6, content: "`" } as OrDelta);
    evento.trigger({ type: "or.delta", seq: 7, content: "`\n" } as OrDelta);

    expect(ends).toHaveLength(1);
  });

  it("finalizes on stream end", () => {
    const evento = createEvento();
    const { ends, frags } = collectEvents(evento);

    evento.trigger({ type: "or.delta", seq: 0, content: "```\ncode" } as OrDelta);
    evento.trigger({ type: "or.stream-end" });

    // Should flush code fragment and close block
    expect(frags).toHaveLength(1);
    expect(frags[0].fragment).toBe("code");
    
    expect(ends).toHaveLength(1);
  });
});
