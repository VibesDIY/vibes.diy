import React from "react";
import { toast } from "react-hot-toast";
import { type AppSettings, type InviteGrantItem, type ResListRequestGrants } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";

export type RequestGrantItem = ResListRequestGrants["items"][number];

export function requestDate(r: RequestGrantItem): Date {
  return new Date(r.created);
}

export function inviteDate(i: InviteGrantItem): Date {
  return new Date(i.created);
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
  // A real switch (state shown by knob position) rather than a status word next
  // to an action pill — the old "disabled [Enable]" pairing read ambiguously as
  // either the current state or the action that flips it (#2235). The explicit
  // action lives in aria-label for assistive tech; sighted users read position.
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
      disabled={toggling}
      onClick={onToggle}
      className="flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className={`relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors ${enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    </button>
  );
}

export function toastError<T>(res: Result<T>, ok: (val: T) => void) {
  if (res.isErr()) {
    toast.error(res.Err().message);
    return;
  }
  ok(res.Ok());
}

export type { AppSettings };
