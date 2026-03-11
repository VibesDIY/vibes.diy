import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useVibeDiy } from "../../vibe-diy-provider.js";
import type {
  AppSettings,
  ActiveRequestPending,
  ActiveRequestApproved,
  ActiveRequestRejected,
  ActiveInviteEditorPending,
  ActiveInviteEditorAccepted,
  ActiveInviteEditorRevoked,
  ActiveInviteViewerPending,
  ActiveInviteViewerAccepted,
  ActiveInviteViewerRevoked,
  ResEnsureAppSettings,
} from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";

interface SharingTabProps {
  userSlug: string;
  appSlug: string;
}

type AnyRequest = ActiveRequestPending | ActiveRequestApproved | ActiveRequestRejected;

type AnyInvite =
  | ActiveInviteEditorPending
  | ActiveInviteEditorAccepted
  | ActiveInviteEditorRevoked
  | ActiveInviteViewerPending
  | ActiveInviteViewerAccepted
  | ActiveInviteViewerRevoked;

function requestDate(r: AnyRequest): Date {
  if (r.state === "pending") return new Date(r.request.created);
  return new Date(r.grant.on);
}

function inviteDate(i: AnyInvite): Date {
  if (i.state === "pending") return new Date(i.invite.created);
  return new Date(i.tick.last);
}

function byNewest<T>(dateFn: (item: T) => Date) {
  return (a: T, b: T) => dateFn(b).getTime() - dateFn(a).getTime();
}

function stateLabel(state: string) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    revoked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[state] ?? ""}`}>{state}</span>;
}

function fmtDate(d: Date) {
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function FlagToggle({
  label,
  enabled,
  toggling,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`text-xs ${enabled ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
        {enabled ? "enabled" : "disabled"}
      </span>
      <button
        type="button"
        disabled={toggling}
        onClick={onToggle}
        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${enabled ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300" : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300"}`}
      >
        {toggling ? "…" : enabled ? "Disable" : "Enable"}
      </button>
    </div>
  );
}

function RequestList({ requests, label }: { requests: AnyRequest[]; label: string }) {
  const sorted = [...requests].sort(byNewest(requestDate));
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400">no requests</p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono truncate text-gray-700 dark:text-gray-300">{r.request.key}</span>
              {stateLabel(r.state)}
              <span className="ml-auto text-gray-400 flex-shrink-0">{fmtDate(requestDate(r))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface InviteListProps {
  invites: AnyInvite[];
  label: string;
  onDelete: (inv: AnyInvite) => Promise<void>;
  onChangeState: (inv: AnyInvite, newState: "accepted" | "revoked") => Promise<void>;
  onChangeRole: (inv: AnyInvite, newRole: "editor" | "viewer") => Promise<void>;
}

function InviteList({ invites, label, onDelete, onChangeState, onChangeRole }: InviteListProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const sorted = [...invites].sort(byNewest(inviteDate));

  async function handle(key: string, fn: () => Promise<void>) {
    setBusy(key);
    await fn();
    setBusy(null);
  }

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400">no invites</p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((inv, i) => {
            const key = `${inv.invite.email}-${inv.role}-${inv.state}-${i}`;
            const isBusy = busy === key;
            return (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="font-mono truncate text-gray-700 dark:text-gray-300">{inv.invite.email}</span>
                {stateLabel(inv.state)}
                <span className="text-gray-400 flex-shrink-0">{fmtDate(inviteDate(inv))}</span>
                <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                  {inv.state !== "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handle(key, () => onChangeState(inv, inv.state === "accepted" ? "revoked" : "accepted"))
                        }
                        className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${inv.state === "accepted" ? "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300" : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300"}`}
                      >
                        {isBusy ? "…" : inv.state === "accepted" ? "Revoke" : "Accept"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handle(key, () => onChangeRole(inv, inv.role === "editor" ? "viewer" : "editor"))}
                        className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 disabled:opacity-50 transition-colors"
                      >
                        {isBusy ? "…" : `→ ${inv.role === "editor" ? "Viewer" : "Editor"}`}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handle(key, () => onDelete(inv))}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs leading-none disabled:opacity-50"
                    title="Delete invite"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function toastError(res: Result<ResEnsureAppSettings>, ok: () => void) {
  if (res.isErr()) {
    toast.error(String(res.Err()));
  }
  if (res.Ok().error) {
    toast.error(res.Ok().error ?? "");
  }
  ok();
}

export function SharingTab({ userSlug, appSlug }: SharingTabProps) {
  const { vibeDiyApi } = useVibeDiy();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  function loadSettings() {
    setLoading(true);
    setSettings(null);
    void vibeDiyApi
      .ensureAppSettings({ appSlug, userSlug })
      .then((res) => {
        toastError(res, () => {
          setSettings(res.Ok().settings);
        });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSettings();
  }, [vibeDiyApi, appSlug, userSlug]);

  async function sendInvite(role: "editor" | "viewer") {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: {
          type: "app.acl.active.invite",
          role,
          state: "pending",
          invite: { email, created: new Date() },
          token: "just-a-dummy",
        },
        op: "upsert",
      },
    });
    setInviting(false);
    toastError(res, () => {
      setInviteEmail("");
      setSettings(res.Ok().settings);
    });
  }

  async function deleteInvite(inv: AnyInvite) {
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: { entry: inv, op: "delete" },
    });
    toastError(res, () => {
      setSettings(res.Ok().settings);
    });
  }

  async function changeInviteState(inv: AnyInvite, newState: "accepted" | "revoked") {
    if (inv.state === "pending") return;
    const entry = { ...inv, state: newState } as AnyInvite;
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: { entry, op: "upsert" },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function changeInviteRole(inv: AnyInvite, newRole: "editor" | "viewer") {
    if (inv.role === newRole || inv.state === "pending") return;
    const entry = { ...inv, role: newRole } as AnyInvite;
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: { entry, op: "upsert" },
    });
    toastError(res, () => setSettings(res.Ok().settings));
  }

  async function toggleFlag(key: string, entryType: string, enabled: boolean) {
    if (!settings) return;
    setToggling(key);
    const op = enabled ? "delete" : "upsert";
    const res = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      aclEntry: {
        entry: { type: entryType as "app.acl.enable.public.access", tick: { count: 0, last: new Date() } },
        op,
      },
    });
    setToggling(null);
    toastError(res, () => {
      setSettings(res.Ok().settings);
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (!settings) return null;

  const { entry } = settings;
  const allRequests: AnyRequest[] = [...entry.request.pending, ...entry.request.approved, ...entry.request.rejected];
  const allEditorInvites: AnyInvite[] = [
    ...entry.invite.editors.pending,
    ...entry.invite.editors.accepted,
    ...entry.invite.editors.revoked,
  ];
  const allViewerInvites: AnyInvite[] = [
    ...entry.invite.viewers.pending,
    ...entry.invite.viewers.accepted,
    ...entry.invite.viewers.revoked,
  ];

  return (
    <ol className="space-y-5 text-sm">
      <li>
        <FlagToggle
          label="Public Sharing"
          enabled={!!entry.publicAccess}
          toggling={toggling === "public"}
          onToggle={() => void toggleFlag("public", "app.acl.enable.public.access", !!entry.publicAccess)}
        />
      </li>

      <li>
        <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Requests</div>
        <div className="space-y-3 mt-1">
          <div className="space-y-2">
            <FlagToggle
              label="requests"
              enabled={!!entry.enableRequest}
              toggling={toggling === "request"}
              onToggle={() => void toggleFlag("request", "app.acl.enable.request", !!entry.enableRequest)}
            />
            {entry.enableRequest && <RequestList requests={allRequests} label="" />}
          </div>
        </div>
      </li>

      <li>
        <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Email Invitations</div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              type="button"
              disabled={inviting || !inviteEmail.trim()}
              onClick={() => void sendInvite("editor")}
              className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 disabled:opacity-50"
            >
              {inviting ? "…" : "Editor"}
            </button>
            <button
              type="button"
              disabled={inviting || !inviteEmail.trim()}
              onClick={() => void sendInvite("viewer")}
              className="rounded px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 disabled:opacity-50"
            >
              {inviting ? "…" : "Viewer"}
            </button>
          </div>
          <InviteList
            invites={allEditorInvites}
            label="Editor"
            onDelete={deleteInvite}
            onChangeState={changeInviteState}
            onChangeRole={changeInviteRole}
          />
          <InviteList
            invites={allViewerInvites}
            label="Viewer"
            onDelete={deleteInvite}
            onChangeState={changeInviteState}
            onChangeRole={changeInviteRole}
          />
        </div>
      </li>
    </ol>
  );
}
