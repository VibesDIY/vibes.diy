import { type } from "arktype";

const CoercedDate = type("Date | string | number").pipe((v) => (v instanceof Date ? v : new Date(v)));

const tick = type({
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

export const EmailOps = type({
  dst: "string",
  action: "'invite-editor' | 'invite-viewer'",
  appSlug: "string",
  userSlug: "string",
  "fsId?": "string",
  token: "string",
});
export type EmailOps = typeof EmailOps.infer;

export const EnablePublicAccess = type({
  type: "'app.acl.enable.public.access'",
  // acl: readonlyPublicAccess,
  "tick?": tick,
});

export type EnablePublicAccess = typeof EnablePublicAccess.infer;

export function isEnablePublicAccess(obj: unknown): obj is EnablePublicAccess {
  return !(EnablePublicAccess(obj) instanceof type.errors);
}

export const EnableRequest = type({
  type: "'app.acl.enable.request'",
});
export type EnableRequestEditor = typeof EnableRequest.infer;
export function isEnableRequest(obj: unknown): obj is EnableRequestEditor {
  return !(EnableRequest(obj) instanceof type.errors);
}

const requestBase = type({
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
  on: CoercedDate,
});

export const ActiveRequestApproved = type({
  type: "'app.acl.active.request'",
  role: "'editor'|'viewer'",
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
  role: "'editor'|'viewer'",
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

export const ActiveEnableFlag = EnableRequest;
export type ActiveEnableFlag = typeof ActiveEnableFlag.infer;
export function isActiveEnableFlag(obj: unknown): obj is ActiveEnableFlag {
  return !(ActiveEnableFlag(obj) instanceof type.errors);
}

export const ActiveAclEntry = EnablePublicAccess.or(ActiveRequest).or(ActiveInvite).or(ActiveEnableFlag);
export const ActiveIdAclEntry = ActiveRequest.or(ActiveInvite);
export type ActiveIdAclEntry = typeof ActiveIdAclEntry.infer;
export function isActiveAclEntry(obj: unknown): obj is typeof ActiveAclEntry.infer {
  return !(ActiveAclEntry(obj) instanceof type.errors);
}
// export function isActiveIdAclEntry(obj: unknown): obj is typeof ActiveIdAclEntry.infer {
//   const res = ActiveIdAclEntry(obj);
//   if (res instanceof type.errors) {
//     console.log("Not an ActiveIdAclEntry:", res.summary);
//     return false;
//   }
//   return !(ActiveIdAclEntry(obj) instanceof type.errors);
// }

export type ActiveAclEntry = typeof ActiveAclEntry.infer;

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
