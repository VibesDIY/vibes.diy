import React, { useMemo, useState } from "react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { byNewest, inviteDate, stateLabel, fmtDate } from "./shared.js";
import { InviteGrantItem } from "@vibes.diy/api-types";

const columnHelper = createColumnHelper<InviteGrantItem>();

const staticColumns = [
  columnHelper.accessor((inv) => inv.emailKey, {
    id: "email",
    header: "Email",
    cell: (info) => <span className="font-mono truncate text-gray-700 dark:text-gray-300">{info.getValue()}</span>,
  }),
  columnHelper.accessor((inv) => inv.state, {
    id: "state",
    header: "State",
    cell: (info) => stateLabel(info.getValue()),
  }),
  columnHelper.accessor((inv) => fmtDate(inviteDate(inv)), {
    id: "date",
    header: "Date",
    cell: (info) => <span className="text-gray-400">{info.getValue()}</span>,
  }),
];

interface InviteTableProps {
  invites: InviteGrantItem[];
  label: string;
  onDelete: (inv: InviteGrantItem) => Promise<void>;
  onRevoke: (inv: InviteGrantItem) => Promise<void>;
  onChangeRole: (inv: InviteGrantItem, newRole: "editor" | "viewer") => Promise<void>;
}

function InviteTable({ invites, label, onDelete, onRevoke, onChangeRole }: InviteTableProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const columns = useMemo(() => {
    async function handle(key: string, fn: () => Promise<void>) {
      setBusy(key);
      await fn();
      setBusy(null);
    }

    const roleColumn = columnHelper.display({
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const inv = row.original;
        const key = `${inv.emailKey}-${inv.role}-${inv.state}`;
        const isBusy = busy === key;
        return (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handle(key, () => onChangeRole(inv, inv.role === "editor" ? "viewer" : "editor"))}
            className="capitalize rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
            title={`Switch to ${inv.role === "editor" ? "viewer" : "editor"}`}
          >
            {isBusy ? "…" : inv.role}
          </button>
        );
      },
    });

    const actionColumn = columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const inv = row.original;
        const key = `${inv.emailKey}-${inv.role}-${inv.state}`;
        const isBusy = busy === key;
        return (
          <div className="flex items-center gap-1">
            {inv.state === "accepted" && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handle(key, () => onRevoke(inv))}
                className="rounded px-1.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300"
              >
                {isBusy ? "…" : "Revoke"}
              </button>
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
        );
      },
    });

    return [...staticColumns, roleColumn, actionColumn];
  }, [onDelete, onRevoke, onChangeRole, busy]);

  const data = useMemo(() => [...invites].sort(byNewest(inviteDate)), [invites]);
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  if (data.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <table className="w-full text-xs border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="text-left text-gray-400 dark:text-gray-500 font-medium pb-1 pr-3">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-1 pr-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface EmailInvitationsSectionProps {
  inviteEmail: string;
  inviting: boolean;
  invites: InviteGrantItem[];
  onEmailChange: (email: string) => void;
  onSendInvite: (role: "editor" | "viewer") => void;
  onDelete: (inv: InviteGrantItem) => Promise<void>;
  onRevoke: (inv: InviteGrantItem) => Promise<void>;
  onChangeRole: (inv: InviteGrantItem, newRole: "editor" | "viewer") => Promise<void>;
}

export function EmailInvitationsSection({
  inviteEmail,
  inviting,
  invites,
  onEmailChange,
  onSendInvite,
  onDelete,
  onRevoke,
  onChangeRole,
}: EmailInvitationsSectionProps) {
  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Email Invitations</div>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            type="button"
            disabled={inviting || !inviteEmail.trim()}
            onClick={() => onSendInvite("editor")}
            className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 disabled:opacity-50"
          >
            {inviting ? "…" : "Editor"}
          </button>
          <button
            type="button"
            disabled={inviting || !inviteEmail.trim()}
            onClick={() => onSendInvite("viewer")}
            className="rounded px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 disabled:opacity-50"
          >
            {inviting ? "…" : "Viewer"}
          </button>
        </div>
        <InviteTable invites={invites} label="Invites" onDelete={onDelete} onRevoke={onRevoke} onChangeRole={onChangeRole} />
      </div>
    </li>
  );
}
