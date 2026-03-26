// import { Result } from "@adviser/cement";
// import {
//   ActiveEntry,
//   isEnablePublicAccess,
//   isActiveInviteEditorAccepted,
//   isActiveInviteEditorRevoked,
//   isActiveInviteViewerPending,
//   isActiveInviteViewerAccepted,
//   isActiveInviteViewerRevoked,
//   AppSettings,
//   EmailOps,
//   isActiveInviteEditorPending,
//   isActiveRequestApproved,
//   isActiveRequestPending,
//   isActiveRequestRejected,
//   isActiveRequest,
//   isEnableRequest,
//   isActiveTitle,
//   isActiveModelSettingChat,
//   isActiveModelSettingApp,
//   isActiveEnv,
//   isActiveInvite,
//   ActiveACL,
//   isActiveAcl,
// } from "@vibes.diy/api-types";
// import { type } from "arktype";
// import { VibesApiSQLCtx } from "../index.ts";
// import { eq, and } from "drizzle-orm/sql/expressions";

// export interface EnsureEntryArgs {
//   vctx: VibesApiSQLCtx,
//   activeEntries: ActiveACL[];
//   // entry: ActiveEntry;
//   crud: "upsert" | "delete";
//   userId: string;
//   appSlug: string;
//   userSlug: string;
//   token(): string;
// }

// export function dbSettings2AppSettings(fromDb: unknown): Result<AppSettings> {
//   const settings = ActiveEntry.array()(fromDb);
//   if (settings instanceof type.errors) {
//     return Result.Err(`error did not found: ${settings.summary}`);
//   }
//   return Result.Ok(buildEnsureEntryResult(settings));
// }

// const GOOGLE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

// function cannonicalEmail(email: string): string {
//   const [lhs, domain] = email.trim().toLowerCase().split("@");
//   const withoutAlias = lhs.replace(/\+.*$/, "");
//   const local = GOOGLE_DOMAINS.has(domain) ? withoutAlias.replaceAll(".", "") : withoutAlias;
//   return `${local}@${domain}`;
// }

// function updateTick(prev: ActiveACL, next: ActiveACL) {
//   const prevTick = type({ tick: type({ count: "number", last: "Date" }) })(prev);
//   const nextTick = type({ tick: type({ count: "number", last: "Date" }) })(next);
//   if (!(prevTick instanceof type.errors || nextTick instanceof type.errors)) {
//     return { ...prev, ...next, tick: { count: prevTick.tick.count + nextTick.tick.count, last: new Date() } };
//   }
//   return { ...prev, ...next };
// }

// function upsertEntry(
//   entries: ActiveEntry[],
//   entry: ActiveEntry,
//   crud: "upsert" | "delete",
//   pred: (e: ActiveEntry) => boolean
// ): Result<void> {
//   // warning: this is a mutating function
//   const idx = entries.findIndex(pred);
//   // allow create to be a upsert, but update and delete must find an existing entry
//   if (idx >= 0 && (crud === "upsert" || crud === "delete")) {
//     if (crud === "delete") {
//       entries.splice(idx, 1);
//     } else {
//       // it's not worth to fix the type here,
//       // the pred will guarantee that the entry has an id and is of the right type
//       entries[idx] = updateTick(entries[idx], entry);
//     }
//     return Result.Ok();
//   } else if (crud === "upsert") {
//     entries.push(entry);
//     return Result.Ok();
//   }
//   return Result.Err("Entry not found for update/delete");
// }

// export async function ensureACLEntry({ vctx, activeEntries, userId, crud, appSlug, userSlug, token: tokenFn }: EnsureEntryArgs): Promise<Result<{
//   emailOps: EmailOps[];
//   aclEntries: ActiveACL[];
// }>> {
//   const entries = [...activeEntries];
//   // let ret!: Result<void>;
//   const emailOps: EmailOps[] = [];

//   for (const entry of entries) {
//     let key: string
//     // let role: "editor" | "viewer" | "requester";
//     let token: string | undefined;
//     switch (true) {
//       case isActiveInvite(entry):
//         key = cannonicalEmail(entry.invite.email);
//         if (entry.state === 'pending') {
//           token = tokenFn()
//         }
//         // role = isActiveInviteEditor(e) ? "editor" : "viewer";
//         break;
//       case isActiveRequest(entry):
//         key = cannonicalEmail(entry.request.userId);
//         // role = "requester";
//         break;
//       default:
//         return Result.Err("Invalid ACL entry type");
//     }
//     if (crud === "delete") {
//       await vctx.sql.db.delete(vctx.sql.tables.keyGrants).where(
//         and(
//           eq(vctx.sql.tables.keyGrants.userId, userId),
//           eq(vctx.sql.tables.keyGrants.appSlug, appSlug),
//           eq(vctx.sql.tables.keyGrants.userSlug, userSlug),
//           eq(vctx.sql.tables.keyGrants.key, key)
//         )).run();
//     } else {
//       const prev = await vctx.sql.db.select().from(vctx.sql.tables.keyGrants).where(
//         and(
//           eq(vctx.sql.tables.keyGrants.userId, userId),
//           eq(vctx.sql.tables.keyGrants.appSlug, appSlug),
//           eq(vctx.sql.tables.keyGrants.userSlug, userSlug),
//           eq(vctx.sql.tables.keyGrants.key, key)
//         )).then((res) => res[0] || null)
//       let tickEntry = entry
//       if (prev && isActiveAcl(prev.entry)) {
//         tickEntry = updateTick(prev.entry, entry);
//       }
//       const merged =  {...prev ?? {}, ...tickEntry  }
//       // entries[idx] = updateTick(entries[idx], entry);
//       if (token && isActiveInviteEditorPending(merged)) {
//         merged.token = token;
//       } else if (token && isActiveInviteViewerPending(merged)) {
//         merged.token = token;
//       }
//       await vctx.sql.db.insert(vctx.sql.tables.keyGrants).values({
//         userId,
//         appSlug,
//         userSlug,
//         key,
//         entry: merged,
//         created: new Date().toISOString(),
//       }).onConflictDoUpdate({
//         target: [
//           vctx.sql.tables.keyGrants.userId,
//           vctx.sql.tables.keyGrants.appSlug,
//           vctx.sql.tables.keyGrants.userSlug,
//           vctx.sql.tables.keyGrants.key],
//         set: {
//           entry: merged,
//           created: new Date().toISOString(),
//         }
//       }).run();
//     }

//     if (isActiveInvite(entry) && entry.state === 'pending') {
//         emailOps.push({
//           dst: entry.invite.email,
//           action: "invite",
//           role: entry.role,
//           appSlug,
//           userSlug,
//           token: entry.token,
//         });
//     }
//     if (isActiveRequest(entry) && (entry.state === 'approved' || entry.state === 'rejected')) {
//       emailOps.push({
//         dst: entry.request.userId,
//         role: entry.role,
//         action: entry.state === 'approved' ? "req-accepted" : "req-rejected",
//         appSlug,
//         userSlug,
//       });
//     }
//   }
//     const sqlAclEntries = await vctx.sql.db.select().from(vctx.sql.tables.keyGrants).where(
//       and(
//         eq(vctx.sql.tables.keyGrants.userId, userId),
//         eq(vctx.sql.tables.keyGrants.appSlug, appSlug),
//         eq(vctx.sql.tables.keyGrants.userSlug, userSlug)
//       ))
//     const aclEntries = ActiveACL.array()(sqlAclEntries.map(e => e.entry));
//     if (aclEntries instanceof type.errors) {
//       return Result.Err(`Failed to parse ACL entries from DB: ${aclEntries.summary}`);
//     }
//     return Result.Ok({
//       emailOps,
//       aclEntries
//     });

//   }

// switch (true) {

//   case isActiveInviteEditorPending(entry):
//   case isActiveInviteViewerPending(entry):
//     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.invite.email)) {
//       ret = Result.Err(`invalid email: ${entry.invite.email}`);
//       break;
//     }
//     if (!token && crud === "upsert") {
//       ret = Result.Err(`a token creation method need to be passed`);
//       break;
//     } else if (token && crud === "upsert") {
//       entry.token = token();
//     }
//     ret = upsertEntry(
//       entries,
//       entry,
//       crud,
//       (e) =>
//         (isActiveInviteEditor(e) || isActiveInviteViewer(e)) &&
//         cannonicalEmail(e.invite.email) === cannonicalEmail(entry.invite.email)
//     );
//     if (ret.isOk()) {
//       emailOps.push({
//         dst: entry.invite.email,
//         action: "invite",
//         role: entry.role,
//         appSlug,
//         userSlug,
//         token: entry.token,
//       });
//     }
//     break;
//   case isActiveRequestPending(entry):
//     ret = upsertEntry(
//       entries,
//       entry,
//       crud,
//       (e) => isActiveRequest(e) && cannonicalEmail(e.request.key) === cannonicalEmail(entry.request.key)
//     );
//     break;

//   case isActiveRequestApproved(entry):
//     ret = upsertEntry(entries, entry, crud, (e) => isActiveRequest(e));
//     if (ret.isOk()) {
//       emailOps.push({
//         dst: entry.request.key,
//         role: entry.role,
//         action: "req-rejected",
//         appSlug,
//         userSlug,
//       });
//     }
//     break;
//   case isActiveRequestRejected(entry):
//     ret = upsertEntry(entries, entry, crud, (e) => isActiveRequest(e));
//     if (ret.isOk()) {
//       emailOps.push({
//         dst: entry.request.key,
//         role: entry.role,
//         action: "req-rejected",
//         appSlug,
//         userSlug,
//       });
//     }
//     break;

//   case isActiveInviteEditorAccepted(entry):
//   case isActiveInviteEditorRevoked(entry):
//   case isActiveInviteViewerAccepted(entry):
//   case isActiveInviteViewerRevoked(entry):
//     ret = upsertEntry(entries, entry, crud, (e) => isActiveInviteEditor(e) || isActiveInviteViewer(e));
//     break;
// }
// if (ret.isErr()) {
//   return Result.Err(ret);
// }
// return Result.Ok({
//   emailOps,
//   appSettings: buildEnsureEntryResult(entries),
// });
