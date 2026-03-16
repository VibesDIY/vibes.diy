import { Result } from "@adviser/cement";
import {
  ActiveEntry,
  isEnablePublicAccess,
  isActiveInviteEditorAccepted,
  isActiveInviteEditorRevoked,
  isActiveInviteViewerPending,
  isActiveInviteViewerAccepted,
  isActiveInviteViewerRevoked,
  isActiveInviteEditor,
  isActiveInviteViewer,
  AppSettings,
  EmailOps,
  isActiveInviteEditorPending,
  isActiveRequestApproved,
  isActiveRequestPending,
  isActiveRequestRejected,
  isActiveRequest,
  isEnableRequest,
} from "@vibes.diy/api-types";
import { type } from "arktype";

export interface EnsureEntryArgs {
  activeEntries: ActiveEntry[];
  entry: ActiveEntry;
  crud: "upsert" | "delete";
  appSlug: string;
  userSlug: string;
  token?(): string;
}

export function dbSettings2AppSettings(fromDb: unknown): Result<AppSettings> {
  const settings = ActiveEntry.array()(fromDb);
  if (settings instanceof type.errors) {
    return Result.Err(`error did not found: ${settings.summary}`);
  }
  return Result.Ok(buildEnsureEntryResult(settings));
}

export function buildEnsureEntryResult(entries: ActiveEntry[]): AppSettings {
  // just collect and assign to the right buckets
  const result: AppSettings = {
    entries,
    entry: {
      request: {
        pending: [],
        approved: [],
        rejected: [],
      },
      invite: {
        viewers: {
          pending: [],
          accepted: [],
          revoked: [],
        },
        editors: {
          pending: [],
          accepted: [],
          revoked: [],
        },
      },
    },
  };
  entries.forEach((e) => {
    switch (true) {
      case isEnablePublicAccess(e):
        result.entry.publicAccess = e;
        break;
      case isEnableRequest(e):
        result.entry.enableRequest = e;
        break;
      case isActiveRequestPending(e):
        result.entry.request.pending.push(e);
        break;
      case isActiveRequestApproved(e):
        result.entry.request.approved.push(e);
        break;
      case isActiveRequestRejected(e):
        result.entry.request.rejected.push(e);
        break;

      case isActiveInviteEditorPending(e):
        result.entry.invite.editors.pending.push(e);
        break;
      case isActiveInviteEditorAccepted(e):
        result.entry.invite.editors.accepted.push(e);
        break;
      case isActiveInviteEditorRevoked(e):
        result.entry.invite.editors.revoked.push(e);
        break;

      case isActiveInviteViewerPending(e):
        result.entry.invite.viewers.pending.push(e);
        break;
      case isActiveInviteViewerAccepted(e):
        result.entry.invite.viewers.accepted.push(e);
        break;
      case isActiveInviteViewerRevoked(e):
        result.entry.invite.viewers.revoked.push(e);
        break;
    }
  });
  return result;
}

const GOOGLE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

function cannonicalEmail(email: string): string {
  const [lhs, domain] = email.trim().toLowerCase().split("@");
  const withoutAlias = lhs.replace(/\+.*$/, "");
  const local = GOOGLE_DOMAINS.has(domain) ? withoutAlias.replaceAll(".", "") : withoutAlias;
  return `${local}@${domain}`;
}

function updateTick(prev: ActiveEntry, next: ActiveEntry) {
  const prevTick = type({ tick: type({ count: "number", last: "Date" }) })(prev);
  const nextTick = type({ tick: type({ count: "number", last: "Date" }) })(next);
  if (!(prevTick instanceof type.errors || nextTick instanceof type.errors)) {
    return { ...prev, ...next, tick: { count: prevTick.tick.count + nextTick.tick.count, last: new Date() } };
  }
  return { ...prev, ...next };
}

function upsertEntry(
  entries: ActiveEntry[],
  entry: ActiveEntry,
  crud: "upsert" | "delete",
  pred: (e: ActiveEntry) => boolean
): Result<void> {
  // warning: this is a mutating function
  const idx = entries.findIndex(pred);
  // allow create to be a upsert, but update and delete must find an existing entry
  if (idx >= 0 && (crud === "upsert" || crud === "delete")) {
    if (crud === "delete") {
      entries.splice(idx, 1);
    } else {
      // it's not worth to fix the type here,
      // the pred will guarantee that the entry has an id and is of the right type
      entries[idx] = updateTick(entries[idx], entry);
    }
    return Result.Ok();
  } else if (crud === "upsert") {
    entries.push(entry);
    return Result.Ok();
  }
  return Result.Err("Entry not found for update/delete");
}

export function ensureACLEntry({ activeEntries, entry, crud, appSlug, userSlug, token }: EnsureEntryArgs): Result<{
  emailOps: EmailOps[];
  appSettings: AppSettings;
}> {
  const entries = [...activeEntries];
  let ret!: Result<void>;
  const emailOps: EmailOps[] = [];
  switch (true) {
    case isEnablePublicAccess(entry):
      {
        const idx = entries.findIndex((e) => isEnablePublicAccess(e));
        if (crud === "delete") {
          if (idx >= 0) {
            entries.splice(idx, 1);
          }
        } else {
          if (idx >= 0) entries[idx] = updateTick(entries[idx], entry);
          else entries.push(entry);
        }
      }
      ret = Result.Ok(buildEnsureEntryResult(entries));
      break;

    case isEnableRequest(entry):
      {
        const idx = entries.findIndex((e) => isEnableRequest(e) && e.type === entry.type);
        if (crud === "delete") {
          if (idx >= 0) entries.splice(idx, 1);
        } else {
          if (idx >= 0) entries[idx] = entry;
          else entries.push(entry);
        }
      }
      ret = Result.Ok(buildEnsureEntryResult(entries));
      break;

    case isActiveInviteEditorPending(entry):
    case isActiveInviteViewerPending(entry):
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.invite.email)) {
        ret = Result.Err(`invalid email: ${entry.invite.email}`);
        break;
      }
      if (!token && crud === "upsert") {
        ret = Result.Err(`a token creation method need to be passed`);
        break;
      } else if (token && crud === "upsert") {
        entry.token = token();
      }
      ret = upsertEntry(
        entries,
        entry,
        crud,
        (e) =>
          (isActiveInviteEditor(e) || isActiveInviteViewer(e)) &&
          cannonicalEmail(e.invite.email) === cannonicalEmail(entry.invite.email)
      );
      if (ret.isOk()) {
        emailOps.push({
          dst: entry.invite.email,
          action: "invite",
          role: entry.role,
          appSlug,
          userSlug,
          token: entry.token,
        });
      }
      break;
    case isActiveRequestPending(entry):
      ret = upsertEntry(
        entries,
        entry,
        crud,
        (e) => isActiveRequest(e) && cannonicalEmail(e.request.key) === cannonicalEmail(entry.request.key)
      );
      break;

    case isActiveRequestApproved(entry):
      ret = upsertEntry(entries, entry, crud, (e) => isActiveRequest(e));
      if (ret.isOk()) {
        emailOps.push({
          dst: entry.request.key,
          role: entry.role,
          action: "req-rejected",
          appSlug,
          userSlug,
        });
      }
      break;
    case isActiveRequestRejected(entry):
      ret = upsertEntry(entries, entry, crud, (e) => isActiveRequest(e));
      if (ret.isOk()) {
        emailOps.push({
          dst: entry.request.key,
          role: entry.role,
          action: "req-rejected",
          appSlug,
          userSlug,
        });
      }
      break;

    case isActiveInviteEditorAccepted(entry):
    case isActiveInviteEditorRevoked(entry):
    case isActiveInviteViewerAccepted(entry):
    case isActiveInviteViewerRevoked(entry):
      ret = upsertEntry(entries, entry, crud, (e) => isActiveInviteEditor(e) || isActiveInviteViewer(e));
      break;
  }
  if (ret.isErr()) {
    return Result.Err(ret);
  }
  return Result.Ok({
    emailOps,
    appSettings: buildEnsureEntryResult(entries),
  });
}
