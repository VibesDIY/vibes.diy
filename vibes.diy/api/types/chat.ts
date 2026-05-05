import { type } from "arktype";
import { BlockMsgs, CoercedDate, LLMRequest } from "@vibes.diy/call-ai-v2";
import { dashAuthType, vibeFile } from "./common.js";
import { PromptMsgs } from "./prompt.js";

export const PromptLLMStyle = type("'chat' | 'app' | 'img'");
export type PromptLLMStyle = typeof PromptLLMStyle.infer;
export function isPromptLLMStyle(obj: unknown): obj is PromptLLMStyle {
  return !(PromptLLMStyle(obj) instanceof type.errors);
}

export const PromptFSStyle = type("'fs-update' | 'fs-set'");
export type PromptFSStyle = typeof PromptFSStyle.infer;
export function isPromptFSStyle(obj: unknown): obj is PromptFSStyle {
  return !(PromptFSStyle(obj) instanceof type.errors);
}

export const PromptStyle = PromptLLMStyle.or(PromptFSStyle);
export type PromptStyle = typeof PromptStyle.infer;

export const Model = type({
  id: "string",
  name: "string",
  description: "string",
  "featured?": "boolean",
  "preSelected?": PromptStyle.array(),
  "supports?": PromptLLMStyle.array(),
});

export type Model = typeof Model.infer;

export const reqOpenChat = type({
  type: "'vibes.diy.req-open-chat'",
  auth: dashAuthType,
  "appSlug?": "string",
  "userSlug?": "string",
  "chatId?": "string",
  "prompt?": "string", // when present with no appSlug, triggers pre-allocation (LLM-driven title+slug+skills)
  mode: PromptStyle,
});

export type ReqOpenChat = typeof reqOpenChat.infer;

export const resOpenChat = type({
  type: "'vibes.diy.res-open-chat'",
  appSlug: "string",
  userSlug: "string",
  chatId: "string",
  mode: PromptStyle,
});

export type ResOpenChat = typeof resOpenChat.infer;

export function isResOpenChat(obj: unknown): obj is ResOpenChat {
  return !(resOpenChat(obj) instanceof type.errors);
}

export const reqCreationPromptChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'chat'",
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
  mode: "'app'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
});

export function isReqPromptApplicationChatSection(obj: unknown): obj is typeof reqPromptApplicationChatSection.infer {
  return !(reqPromptApplicationChatSection(obj) instanceof type.errors);
}

export const reqPromptImageChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'img'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
  "inputImageBase64?": "string",
});

export function isReqPromptImageChatSection(obj: unknown): obj is typeof reqPromptImageChatSection.infer {
  return !(reqPromptImageChatSection(obj) instanceof type.errors);
}

export const FSUpdate = type({
  // will update the existing by filename or add if filename doesn't exist
  update: vibeFile.array(), // array of fs to add
  // will replace existing filesystem --- if set is update and remove are not respected
  remove: type({ filename: "string" }).array(),
});
export type FSUpdate = typeof FSUpdate.infer;
export function isFSUpdate(obj: unknown): obj is FSUpdate {
  return !(FSUpdate(obj) instanceof type.errors);
}

export const reqPromptFSUpdateChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'fs-update'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  "refFsId?": "string", // if provided, the fsUpdate is merged with existing fs
  fsUpdate: FSUpdate,
});
export type ReqPromptFSUpdateChatSection = typeof reqPromptFSUpdateChatSection.infer;
export function isReqPromptFSUpdateChatSection(obj: unknown): obj is ReqPromptFSUpdateChatSection {
  return !(reqPromptFSUpdateChatSection(obj) instanceof type.errors);
}

export const reqPromptFSSetChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'fs-set'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  fsSet: vibeFile.array(), // array of fs to set - will replace existing filesystem
});
export type ReqPromptFSSetChatSection = typeof reqPromptFSSetChatSection.infer;
export function isReqPromptFSSetChatSection(obj: unknown): obj is ReqPromptFSSetChatSection {
  return !(reqPromptFSSetChatSection(obj) instanceof type.errors);
}

export const reqPromptLLMChatSection = reqCreationPromptChatSection
  .or(reqPromptApplicationChatSection)
  .or(reqPromptImageChatSection);

export type ReqPromptLLMChatSection = typeof reqPromptLLMChatSection.infer;

export function isReqPromptLLMChatSection(obj: unknown): obj is ReqPromptLLMChatSection {
  return !(reqPromptLLMChatSection(obj) instanceof type.errors);
}

export const reqPromptFSChatSection = reqPromptFSUpdateChatSection.or(reqPromptFSSetChatSection);

export type ReqPromptFSChatSection = typeof reqPromptFSChatSection.infer;

export function isReqPromptFSChatSection(obj: unknown): obj is ReqPromptFSChatSection {
  return !(reqPromptFSChatSection(obj) instanceof type.errors);
}

export const reqPromptChatSection = reqPromptLLMChatSection.or(reqPromptFSChatSection);

export type ReqPromptChatSection = typeof reqPromptChatSection.infer;

export const resPromptChatSection = type({
  type: "'vibes.diy.res-prompt-chat-section'",
  mode: PromptStyle,
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

// export const reqAddFS = type({
//   type: "'vibes.diy.req-add-fs'",
//   auth: dashAuthType,
//   // chat controlls if the events are emitted to a chat session or an app session
//   "chat?": type({
//     chatId: "string",
//     outerTid: "string",
//   }),
//   // binding allows to associate fs with an app
//   "binding?": type({
//     userSlug: "string",
//     appSlug: "string",
//   }),
//   // if refFsId is provided, the fs is merged
//   // instead of substituted
//   "refFsId?": "string",
//   fs: [vibeFile, "[]"],
// });

// export type ReqAddFS = typeof reqAddFS.infer;
// export function isReqAddFS(obj: unknown): obj is ReqAddFS {
//   return !(reqAddFS(obj) instanceof type.errors);
// }

// export const resAddFS = type({
//   type: "'vibes.diy.res-add-fs'",
//   chatId: "string",
//   outerTid: "string",
// }).and(FileSystemRef);

// export type ResAddFS = typeof resAddFS.infer;
// export function isResAddFS(obj: unknown): obj is ResAddFS {
//   return !(resAddFS(obj) instanceof type.errors);
// }

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
  // Optional for backward-compat with in-flight messages enqueued before this field existed.
  // "production" identifies a publish; "dev" is a working save.
  "mode?": "'production'|'dev'",
});
export type EvtNewFsId = typeof evtNewFsId.infer;

export function isEvtNewFsId(obj: unknown): obj is EvtNewFsId {
  return !(evtNewFsId(obj) instanceof type.errors);
}

export const evtIconGen = type({
  type: "'vibes.diy.evt-icon-gen'",
  userSlug: "string",
  appSlug: "string",
  "force?": "boolean",
});
export type EvtIconGen = typeof evtIconGen.infer;

export function isEvtIconGen(obj: unknown): obj is EvtIconGen {
  return !(evtIconGen(obj) instanceof type.errors);
}

export const reqListModels = type({
  type: "'vibes.diy.req-list-models'",
});
export type ReqListModels = typeof reqListModels.infer;
export function isReqListModels(obj: unknown): obj is ReqListModels {
  return !(reqListModels(obj) instanceof type.errors);
}

export const resListModels = type({
  type: "'vibes.diy.res-list-models'",
  models: Model.array(),
});
export type ResListModels = typeof resListModels.infer;
export function isResListModels(obj: unknown): obj is ResListModels {
  return !(resListModels(obj) instanceof type.errors);
}
