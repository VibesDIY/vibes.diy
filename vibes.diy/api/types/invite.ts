import { type } from "arktype";
import { CoercedDate } from "@vibes.diy/call-ai-v2";
import { Model } from "./chat.js";
import { Role } from "./common.js";
import { ActiveDbAcl } from "./db-acls.js";

export const KVString = type({ key: "string", value: "string" });
export type KVString = typeof KVString.infer;

export function toKVString(record: Record<string, string>): KVString[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

export function fromKVString(entries: KVString[]): Record<string, string> {
  return Object.fromEntries(entries.map(({ key, value }) => [key, value]));
}

export const AIParams = type({
  model: Model,
  "apiKey?": "string",
  // here we could add Endpoint url or backlink information
});

export type AIParams = typeof AIParams.infer;

// export const CoercedDate = type("string.date.iso.parse | Date");
// // export const CoercedDate = type("Date")
// export type CoercedDate = typeof CoercedDate.infer

export const tick = type({
  count: "number", // number of requests with this access level
  last: CoercedDate,
});

export const RawEmailWithoutFrom = type({
  to: "string[]|string",
  subject: "string",
  "text?": "string",
  "html?": "string",
});
export type RawEmailWithoutFrom = typeof RawEmailWithoutFrom.infer;

export const RawEmail = type({
  from: "string",
}).and(RawEmailWithoutFrom);
export type RawEmail = typeof RawEmail.infer;

export const EmailOpsBase = type({
  dst: "string",
  role: Role,
  appSlug: "string",
  userSlug: "string",
  "fsId?": "string",
});

export const EmailOpsInvite = type({
  action: "'invite'",
  token: "string",
}).and(EmailOpsBase);
export type EmailOpsInvite = typeof EmailOpsInvite.infer;

export function isEmailOpsInvite(obj: unknown): obj is EmailOpsInvite {
  return !(EmailOpsInvite(obj) instanceof type.errors);
}

export const EmailOpsInviteRevoked = type({
  action: "'invite-revoked'",
}).and(EmailOpsBase);

export const EmailOpsRequest = type({
  action: "'req-accepted' | 'req-rejected'",
}).and(EmailOpsBase);

export type EmailOpsRequest = typeof EmailOpsRequest.infer;

export function isEmailOpsRequest(obj: unknown): obj is EmailOpsRequest {
  return !(EmailOpsRequest(obj) instanceof type.errors);
}

export const EmailOps = EmailOpsInvite.or(EmailOpsInviteRevoked).or(EmailOpsRequest);
export type EmailOps = typeof EmailOps.infer;

export function isEmailOps(obj: unknown): obj is EmailOps {
  return !(EmailOps(obj) instanceof type.errors);
}

export const EnablePublicAccess = type({
  type: "'app.public.access'",
  enable: "boolean",
  "tick?": tick,
});

export type EnablePublicAccess = typeof EnablePublicAccess.infer;

export function isEnablePublicAccess(obj: unknown): obj is EnablePublicAccess {
  return !(EnablePublicAccess(obj) instanceof type.errors);
}

export const EnableRequest = type({
  type: "'app.request'",
  enable: "boolean",
  "autoAcceptRole?": Role,
});
export type EnableRequest = typeof EnableRequest.infer;
export function isEnableRequest(obj: unknown): obj is EnableRequest {
  return !(EnableRequest(obj) instanceof type.errors);
}

export const requestBase = type({
  key: "string", // email or nick of the requester
  provider: "'github' | 'google' | 'clerk'",
  "msg?": "string",
  userId: "string",
  created: CoercedDate,
});

export const ActiveRequestPending = type({
  type: "'app.acl.active.request'",
  role: "'viewer'",
  state: "'pending'",
  request: requestBase,
});

export type ActiveRequestPending = typeof ActiveRequestPending.infer;

export function isActiveRequestPending(obj: unknown): obj is typeof ActiveRequestPending.infer {
  return !(ActiveRequestPending(obj) instanceof type.errors);
}

const grant = type({
  ownerId: "string",
  "key?": "string",
  on: CoercedDate,
});

export const ActiveRequestApproved = type({
  type: "'app.acl.active.request'",
  role: Role,
  state: "'approved'",
  request: requestBase,
  tick: tick,
  grant: grant,
});

export type ActiveRequestApproved = typeof ActiveRequestApproved.infer;

export function isActiveRequestApproved(obj: unknown): obj is typeof ActiveRequestApproved.infer {
  return !(ActiveRequestApproved(obj) instanceof type.errors);
}

export const ActiveRequestRejected = type({
  type: "'app.acl.active.request'",
  role: Role,
  state: "'rejected'",
  request: requestBase,
  grant: grant,
});

export type ActiveRequestRejected = typeof ActiveRequestRejected.infer;

export function isActiveRequestRejected(obj: unknown): obj is typeof ActiveRequestRejected.infer {
  return !(ActiveRequestRejected(obj) instanceof type.errors);
}

export const ActiveRequest = ActiveRequestPending.or(ActiveRequestApproved).or(ActiveRequestRejected);

export type ActiveRequest = typeof ActiveRequest.infer;

export function isActiveRequest(obj: unknown): obj is typeof ActiveRequest.infer {
  return !(ActiveRequest(obj) instanceof type.errors);
}

const inviteBase = type({
  email: "string",
  created: CoercedDate,
});

export const ActiveInviteEditorPending = type({
  type: "'app.acl.active.invite'",
  role: "'editor'",
  state: "'pending'",
  invite: inviteBase,
  token: "string",
});

export type ActiveInviteEditorPending = typeof ActiveInviteEditorPending.infer;

export function isActiveInviteEditorPending(obj: unknown): obj is typeof ActiveInviteEditorPending.infer {
  return !(ActiveInviteEditorPending(obj) instanceof type.errors);
}

export const ActiveInviteViewerPending = type({
  type: "'app.acl.active.invite'",
  role: "'viewer'",
  state: "'pending'",
  invite: inviteBase,
  token: "string",
});

export type ActiveInviteViewerPending = typeof ActiveInviteViewerPending.infer;

export function isActiveInviteViewerPending(obj: unknown): obj is typeof ActiveInviteViewerPending.infer {
  return !(ActiveInviteViewerPending(obj) instanceof type.errors);
}

export const ActiveInviteEditorAccepted = type({
  type: "'app.acl.active.invite'",
  role: "'editor'",
  state: "'accepted'",
  invite: inviteBase,
  grant: grant,
  tick: tick,
});

export type ActiveInviteEditorAccepted = typeof ActiveInviteEditorAccepted.infer;

export function isActiveInviteEditorAccepted(obj: unknown): obj is typeof ActiveInviteEditorAccepted.infer {
  return !(ActiveInviteEditorAccepted(obj) instanceof type.errors);
}

export const ActiveInviteViewerAccepted = type({
  type: "'app.acl.active.invite'",
  role: "'viewer'",
  state: "'accepted'",
  invite: inviteBase,
  grant: grant,
  tick: tick,
});

export type ActiveInviteViewerAccepted = typeof ActiveInviteViewerAccepted.infer;

export function isActiveInviteViewerAccepted(obj: unknown): obj is typeof ActiveInviteViewerAccepted.infer {
  return !(ActiveInviteViewerAccepted(obj) instanceof type.errors);
}

export const ActiveInviteEditorRevoked = type({
  type: "'app.acl.active.invite'",
  role: "'editor'",
  state: "'revoked'",
  invite: inviteBase,
  grant: grant,
  tick: tick,
});

export type ActiveInviteEditorRevoked = typeof ActiveInviteEditorRevoked.infer;

export function isActiveInviteEditorRevoked(obj: unknown): obj is typeof ActiveInviteEditorRevoked.infer {
  return !(ActiveInviteEditorRevoked(obj) instanceof type.errors);
}

export const ActiveInviteViewerRevoked = type({
  type: "'app.acl.active.invite'",
  role: "'viewer'",
  state: "'revoked'",
  invite: inviteBase,
  grant: grant,
  tick: tick,
});

export type ActiveInviteViewerRevoked = typeof ActiveInviteViewerRevoked.infer;

export function isActiveInviteViewerRevoked(obj: unknown): obj is typeof ActiveInviteViewerRevoked.infer {
  return !(ActiveInviteViewerRevoked(obj) instanceof type.errors);
}

export const ActiveInvite = ActiveInviteEditorPending.or(ActiveInviteViewerPending)
  .or(ActiveInviteEditorAccepted)
  .or(ActiveInviteViewerAccepted)
  .or(ActiveInviteEditorRevoked)
  .or(ActiveInviteViewerRevoked);

export type ActiveInvite = typeof ActiveInvite.infer;

export function isActiveInvite(obj: unknown): obj is typeof ActiveInvite.infer {
  return !(ActiveInvite(obj) instanceof type.errors);
}

export const ActiveACL = ActiveInvite.or(ActiveRequest);
export type ActiveACL = typeof ActiveACL.infer;

// export const ActiveEnableFlag = EnableRequest;
// export type ActiveEnableFlag = typeof ActiveEnableFlag.infer;
// export function isActiveEnableFlag(obj: unknown): obj is ActiveEnableFlag {
//   return !(ActiveEnableFlag(obj) instanceof type.errors);
// }

export const ActiveTitle = type({
  type: "'active.title'",
  title: "string",
});
export type ActiveTitle = typeof ActiveTitle.infer;
export function isActiveTitle(obj: unknown): obj is ActiveTitle {
  return !(ActiveTitle(obj) instanceof type.errors);
}

export const ActiveSkills = type({
  type: "'active.skills'",
  skills: type("string").array(),
});
export type ActiveSkills = typeof ActiveSkills.infer;
export function isActiveSkills(obj: unknown): obj is ActiveSkills {
  return !(ActiveSkills(obj) instanceof type.errors);
}

export const ActiveModelSettingBase = type({
  type: "'active.model'",
  param: AIParams,
});

export const ActiveModelSettingChat = type({
  usage: "'chat'",
}).and(ActiveModelSettingBase);

export type ActiveModelSettingChat = typeof ActiveModelSettingChat.infer;

export function isActiveModelSettingChat(obj: unknown): obj is typeof ActiveModelSettingChat.infer {
  return !(ActiveModelSettingChat(obj) instanceof type.errors);
}

export const ActiveModelSettingApp = type({
  usage: "'app'",
}).and(ActiveModelSettingBase);

export type ActiveModelSettingApp = typeof ActiveModelSettingApp.infer;
export function isActiveModelSettingApp(obj: unknown): obj is typeof ActiveModelSettingApp.infer {
  return !(ActiveModelSettingApp(obj) instanceof type.errors);
}

export const ActiveModelSettingImg = type({
  usage: "'img'",
}).and(ActiveModelSettingBase);

export type ActiveModelSettingImg = typeof ActiveModelSettingImg.infer;
export function isActiveModelSettingImg(obj: unknown): obj is ActiveModelSettingImg {
  return !(ActiveModelSettingImg(obj) instanceof type.errors);
}

export const ActiveModelSetting = ActiveModelSettingChat.or(ActiveModelSettingApp).or(ActiveModelSettingImg);

export type ActiveModelSetting = typeof ActiveModelSetting.infer;
export function isActiveModelSetting(obj: unknown): obj is ActiveModelSetting {
  return !(ActiveModelSetting(obj) instanceof type.errors);
}

export const ActiveEnv = type({
  type: "'active.env'",
  env: KVString.array(),
});
export type ActiveEnv = typeof ActiveEnv.infer;
export function isActiveEnv(obj: unknown): obj is ActiveEnv {
  return !(ActiveEnv(obj) instanceof type.errors);
}

export const ActiveEntry = EnablePublicAccess.or(ActiveRequest)
  .or(ActiveInvite)
  .or(EnableRequest)
  .or(ActiveTitle)
  .or(ActiveSkills)
  .or(ActiveModelSetting)
  .or(ActiveEnv)
  .or(ActiveDbAcl);

export function isActiveAcl(obj: unknown): obj is typeof ActiveACL.infer {
  return !(ActiveACL(obj) instanceof type.errors);
}
// export function isActiveIdAclEntry(obj: unknown): obj is typeof ActiveIdAclEntry.infer {
//   const res = ActiveIdAclEntry(obj);
//   if (res instanceof type.errors) {
//     console.log("Not an ActiveIdAclEntry:", res.summary);
//     return false;
//   }
//   return !(ActiveIdAclEntry(obj) instanceof type.errors);
// }

export type ActiveEntry = typeof ActiveEntry.infer;

export const ActiveInviteEditor = ActiveInviteEditorPending.or(ActiveInviteEditorAccepted).or(ActiveInviteEditorRevoked);
export const ActiveInviteViewer = ActiveInviteViewerPending.or(ActiveInviteViewerAccepted).or(ActiveInviteViewerRevoked);

export type ActiveInviteEditor = typeof ActiveInviteEditor.infer;
export type ActiveInviteViewer = typeof ActiveInviteViewer.infer;

export function isActiveInviteEditor(obj: unknown): obj is typeof ActiveInviteEditor.infer {
  return !(ActiveInviteEditor(obj) instanceof type.errors);
}

export function isActiveInviteViewer(obj: unknown): obj is typeof ActiveInviteViewer.infer {
  return !(ActiveInviteViewer(obj) instanceof type.errors);
}

// export function isActivePendingWithoutId(obj: ActiveAclEntry): obj is
//   ActiveRequestEditorPending
//   | ActiveRequestViewerPending
//   | ActiveInviteEditorPending
//   | ActiveInviteViewerPending
// {
//   const x = { id: "dummy-id", ...obj }
//   return isActiveRequestEditorPending(x)
//   || isActiveRequestViewerPending(x)
//   || isActiveInviteEditorPending(x)
//   || isActiveInviteViewerPending(x)
// }
