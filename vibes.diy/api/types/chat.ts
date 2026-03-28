import { type } from "arktype";
import { BlockMsgs, CoercedDate, FileSystemRef, LLMRequest, PromptMsgs } from "@vibes.diy/call-ai-v2";
import { dashAuthType, vibeFile } from "./common.js";

export const reqOpenChat = type({
  type: "'vibes.diy.req-open-chat'",
  auth: dashAuthType,
  "appSlug?": "string",
  "userSlug?": "string",
  "chatId?": "string",
  mode: "'creation'|'application'",
});

export type ReqOpenChat = typeof reqOpenChat.infer;

export const resOpenChat = type({
  type: "'vibes.diy.res-open-chat'",
  appSlug: "string",
  userSlug: "string",
  chatId: "string",
  mode: "'creation'|'application'",
});

export type ResOpenChat = typeof resOpenChat.infer;

export function isResOpenChat(obj: unknown): obj is ResOpenChat {
  return !(resOpenChat(obj) instanceof type.errors);
}

export const reqCreationPromptChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'creation'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
});

export function isReqCreationPromptChatSection(obj: unknown): obj is typeof reqCreationPromptChatSection.infer {
  return !(reqCreationPromptChatSection(obj) instanceof type.errors);
}

export const reqPromptApplicationChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'application'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
});

export function isReqPromptApplicationChatSection(obj: unknown): obj is typeof reqPromptApplicationChatSection.infer {
  return !(reqPromptApplicationChatSection(obj) instanceof type.errors);
}

export const reqPromptChatSection = reqCreationPromptChatSection.or(reqPromptApplicationChatSection);

export type ReqPromptChatSection = typeof reqPromptChatSection.infer;

export const resPromptChatSection = type({
  type: "'vibes.diy.res-prompt-chat-section'",
  mode: "'creation'|'application'",
  chatId: "string",
  userSlug: "string",
  appSlug: "string",
  promptId: "string",
  outerTid: "string",
});

export type ResPromptChatSection = typeof resPromptChatSection.infer;
export function isResPromptChatSection(obj: unknown): obj is ResPromptChatSection {
  return !(resPromptChatSection(obj) instanceof type.errors);
}

export const reqAddFS = type({
  type: "'vibes.diy.req-add-fs'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string",
  fs: [vibeFile, "[]"],
});

export type ReqAddFS = typeof reqAddFS.infer;
export function isReqAddFS(obj: unknown): obj is ReqAddFS {
  return !(reqAddFS(obj) instanceof type.errors);
}

export const resAddFS = type({
  type: "'vibes.diy.res-add-fs'",
  chatId: "string",
  outerTid: "string",
}).and(FileSystemRef);

export type ResAddFS = typeof resAddFS.infer;
export function isResAddFS(obj: unknown): obj is ResAddFS {
  return !(resAddFS(obj) instanceof type.errors);
}

export const PromptAndBlockMsgs = PromptMsgs.or(BlockMsgs);
export type PromptAndBlockMsgs = typeof PromptAndBlockMsgs.infer;

export const sectionEvent = type({
  type: "'vibes.diy.section-event'",
  chatId: "string",
  promptId: "string",
  blockSeq: "number",
  timestamp: CoercedDate,
  blocks: [PromptAndBlockMsgs, "[]"],
});

export type SectionEvent = typeof sectionEvent.infer;

export function isSectionEvent(obj: unknown): obj is SectionEvent {
  return !(sectionEvent(obj) instanceof type.errors);
}

export const evtNewFsId = type({
  type: "'vibes.diy.evt-new-fs-id'",
  userSlug: "string",
  appSlug: "string",
  fsId: "string",
  sessionToken: "string",
  vibeUrl: "string",
});
export type EvtNewFsId = typeof evtNewFsId.infer;

export function isEvtNewFsId(obj: unknown): obj is EvtNewFsId {
  return !(evtNewFsId(obj) instanceof type.errors);
}
