import { describe, it, expect } from "vitest";
import { type } from "arktype";
import {
  reqCreationPromptChatSection,
  reqPromptApplicationChatSection,
  reqPromptLLMChatSection,
  isReqCreationPromptChatSection,
  isReqPromptApplicationChatSection,
  isReqPromptImageChatSection,
  isPromptLLMStyle,
  canonicalModelUsage,
} from "../types/chat.js";

describe("reqCreationPromptChatSection: selected wire shape", () => {
  it("accepts selected: { kind: 'version', fsId }", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [{ role: "user", content: [{ type: "text", text: "go" }] }] },
      selected: { kind: "version", fsId: "z3xyz" },
    });
    expect(r).not.toBeInstanceOf(type.errors);
  });

  it("accepts selected: { kind: 'draft', files }", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [{ role: "user", content: [{ type: "text", text: "go" }] }] },
      selected: {
        kind: "draft",
        files: [
          {
            type: "code-block",
            lang: "jsx",
            content: "export default function App() { return null; }",
            filename: "/App.jsx",
          },
        ],
      },
    });
    expect(r).not.toBeInstanceOf(type.errors);
  });

  it("rejects selected with unknown kind", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [] },
      selected: { kind: "bogus" },
    });
    expect(r).toBeInstanceOf(type.errors);
  });

  it("accepts slots config with per-slot mute flags", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [] },
      slots: { original: "off", selected: "on", last_edit: "on", previous: "on", compaction: "on" },
    });
    expect(r).not.toBeInstanceOf(type.errors);
  });

  it("rejects invalid slot value", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [] },
      slots: { original: "maybe" },
    });
    expect(r).toBeInstanceOf(type.errors);
  });
});

// #2618 expand phase: the wire `mode` accepts both the legacy (chat/app) and
// canonical (codegen/runtime) tokens, and the discriminated union still routes
// each to the right request branch.
describe("wire mode accepts legacy + canonical tokens (#2618)", () => {
  const base = {
    type: "vibes.diy.req-prompt-chat-section" as const,
    auth: { type: "device-id", token: "t" },
    chatId: "c1",
    outerTid: "tid",
    prompt: { messages: [{ role: "user", content: [{ type: "text", text: "go" }] }] },
  };

  it("PromptLLMStyle accepts legacy and canonical tokens", () => {
    for (const m of ["chat", "app", "img", "codegen", "runtime"]) {
      expect(isPromptLLMStyle(m)).toBe(true);
    }
    expect(isPromptLLMStyle("bogus")).toBe(false);
  });

  it("canonicalModelUsage maps legacy aliases and passes canonical through", () => {
    expect(canonicalModelUsage("chat")).toBe("codegen");
    expect(canonicalModelUsage("app")).toBe("runtime");
    expect(canonicalModelUsage("codegen")).toBe("codegen");
    expect(canonicalModelUsage("runtime")).toBe("runtime");
    expect(canonicalModelUsage("img")).toBe("img");
  });

  it("creation request accepts canonical 'codegen' and legacy 'chat'", () => {
    for (const mode of ["codegen", "chat"]) {
      expect(reqCreationPromptChatSection({ ...base, mode })).not.toBeInstanceOf(type.errors);
    }
    // 'app'/'runtime' must NOT validate as a creation request
    expect(reqCreationPromptChatSection({ ...base, mode: "app" })).toBeInstanceOf(type.errors);
  });

  it("application request accepts canonical 'runtime' and legacy 'app'", () => {
    for (const mode of ["runtime", "app"]) {
      expect(reqPromptApplicationChatSection({ ...base, mode })).not.toBeInstanceOf(type.errors);
    }
    expect(reqPromptApplicationChatSection({ ...base, mode: "chat" })).toBeInstanceOf(type.errors);
  });

  it("the LLM union routes each mode token to the correct branch", () => {
    const route = (mode: string) => {
      const r = reqPromptLLMChatSection({ ...base, mode });
      expect(r).not.toBeInstanceOf(type.errors);
      return {
        creation: isReqCreationPromptChatSection(r),
        application: isReqPromptApplicationChatSection(r),
        image: isReqPromptImageChatSection(r),
      };
    };
    expect(route("chat")).toEqual({ creation: true, application: false, image: false });
    expect(route("codegen")).toEqual({ creation: true, application: false, image: false });
    expect(route("app")).toEqual({ creation: false, application: true, image: false });
    expect(route("runtime")).toEqual({ creation: false, application: true, image: false });
    expect(route("img")).toEqual({ creation: false, application: false, image: true });
  });
});
