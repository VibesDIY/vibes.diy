import { describe, expect, it } from "vitest";
import { appMsgEvento } from "../svc/app-msg-evento.js";

// Stopgap (#2350): img-gen rides vibeApi → AppSessions (the warm per-vibe
// session), so that evento must serve the chat-streaming open-chat + prompt
// ops or `req-open-chat {mode:img}` falls through to the WildCard "Not
// Implemented" handler. Remove once img streaming moves to the heavy/chat
// session per docs/superpowers/specs/2026-06-16-heavy-light-session-design.md.
describe("AppSessions evento serves chat-open + prompt (img-gen stopgap #2350)", () => {
  it("registers open-chat-handler and prompt-chat-section-handler", () => {
    const actions = new Set(
      appMsgEvento()
        .handlers()
        .actions.map((h) => h.hash)
    );
    expect(actions.has("open-chat-handler"), "open-chat must be served on AppSessions").toBe(true);
    expect(actions.has("prompt-chat-section-handler"), "prompt must be served on AppSessions").toBe(true);
  });
});
