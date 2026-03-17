import React from "react";
import { toast } from "react-hot-toast";
import type { ResEnsureAppSettings, ActiveRequest, ActiveInvite } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";

// export type AnyRequest = ActiveRequestPending | ActiveRequestApproved | ActiveRequestRejected;

// export type AnyInvite =
//   | ActiveInviteEditorPending
//   | ActiveInviteEditorAccepted
//   | ActiveInviteEditorRevoked
//   | ActiveInviteViewerPending
//   | ActiveInviteViewerAccepted
//   | ActiveInviteViewerRevoked;

export function requestDate(r: ActiveRequest): Date {
  if (r.state === "pending") return new Date(r.request.created);
  return new Date(r.grant.on);
}

export function inviteDate(i: ActiveInvite): Date {
  if (i.state === "pending") return new Date(i.invite.created);
  return new Date(i.tick.last);
}

export function byNewest<T>(dateFn: (item: T) => Date) {
  return (a: T, b: T) => dateFn(b).getTime() - dateFn(a).getTime();
}

export function stateLabel(state: string) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    revoked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors[state] ?? ""}`}>{state}</span>;
}

export function fmtDate(d: Date) {
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function FlagToggle({
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

export function toastError(res: Result<ResEnsureAppSettings>, ok: () => void) {
  if (res.isErr()) {
    toast.error(res.Err().message);
  }
  if (res.Ok().error) {
    toast.error(res.Ok().error ?? "");
  }
  ok();
}
