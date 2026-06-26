import type { PromptSectionTheme } from "../../../types/prompt.js";

export function buildSectionThemeEvent(args: {
  theme: string;
  colorTheme?: string;
  streamId: string;
  chatId: string;
  seq: number;
  timestamp: Date;
}): PromptSectionTheme {
  const evt: PromptSectionTheme = {
    type: "prompt.section-theme",
    theme: args.theme,
    streamId: args.streamId,
    chatId: args.chatId,
    seq: args.seq,
    timestamp: args.timestamp,
  };
  if (typeof args.colorTheme === "string" && args.colorTheme.length > 0) {
    evt.colorTheme = args.colorTheme;
  }
  return evt;
}
