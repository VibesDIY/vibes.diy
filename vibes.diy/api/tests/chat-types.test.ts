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
      mode: "codegen",
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
      mode: "codegen",
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
      mode: "codegen",
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
      mode: "codegen",
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
      mode: "codegen",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [] },
      slots: { original: "maybe" },
    });
    expect(r).toBeInstanceOf(type.errors);
  });
});

// #2618 (contract step): the wire now accepts ONLY canonical tokens. Legacy
// chat/app are rejected by PromptLLMStyle and by both request discriminators —
// old CLI builds that still send them have aged out. canonicalModelUsage still
// maps the legacy aliases, but only to normalize persisted *catalog* tags
// (ModelCapability) at rest, which is independent of the wire mode.
describe("wire mode is canonical-only (#2618 contract step)", () => {
  const base = {
    type: "vibes.diy.req-prompt-chat-section" as const,
    auth: { type: "device-id", token: "t" },
    chatId: "c1",
    outerTid: "tid",
    prompt: { messages: [{ role: "user", content: [{ type: "text", text: "go" }] }] },
  };

  it("PromptLLMStyle accepts canonical tokens and rejects legacy", () => {
    for (const m of ["codegen", "runtime", "img"]) {
      expect(isPromptLLMStyle(m)).toBe(true);
    }
    for (const m of ["chat", "app", "bogus"]) {
      expect(isPromptLLMStyle(m)).toBe(false);
    }
  });

  it("canonicalModelUsage still maps legacy catalog aliases (data-at-rest)", () => {
    expect(canonicalModelUsage("chat")).toBe("codegen");
    expect(canonicalModelUsage("app")).toBe("runtime");
    expect(canonicalModelUsage("codegen")).toBe("codegen");
    expect(canonicalModelUsage("runtime")).toBe("runtime");
    expect(canonicalModelUsage("img")).toBe("img");
  });

  it("creation request accepts canonical 'codegen' and rejects legacy 'chat'/'app'", () => {
    expect(reqCreationPromptChatSection({ ...base, mode: "codegen" })).not.toBeInstanceOf(type.errors);
    expect(reqCreationPromptChatSection({ ...base, mode: "chat" })).toBeInstanceOf(type.errors);
    expect(reqCreationPromptChatSection({ ...base, mode: "app" })).toBeInstanceOf(type.errors);
  });

  it("application request accepts canonical 'runtime' and rejects legacy 'app'/'chat'", () => {
    expect(reqPromptApplicationChatSection({ ...base, mode: "runtime" })).not.toBeInstanceOf(type.errors);
    expect(reqPromptApplicationChatSection({ ...base, mode: "app" })).toBeInstanceOf(type.errors);
    expect(reqPromptApplicationChatSection({ ...base, mode: "chat" })).toBeInstanceOf(type.errors);
  });

  it("the LLM union routes each canonical mode to the correct branch and rejects legacy", () => {
    const route = (mode: string) => {
      const r = reqPromptLLMChatSection({ ...base, mode });
      expect(r).not.toBeInstanceOf(type.errors);
      return {
        creation: isReqCreationPromptChatSection(r),
        application: isReqPromptApplicationChatSection(r),
        image: isReqPromptImageChatSection(r),
      };
    };
    expect(route("codegen")).toEqual({ creation: true, application: false, image: false });
    expect(route("runtime")).toEqual({ creation: false, application: true, image: false });
    expect(route("img")).toEqual({ creation: false, application: false, image: true });
    // Legacy tokens no longer validate as any LLM chat-section request.
    expect(reqPromptLLMChatSection({ ...base, mode: "chat" })).toBeInstanceOf(type.errors);
    expect(reqPromptLLMChatSection({ ...base, mode: "app" })).toBeInstanceOf(type.errors);
  });
});
