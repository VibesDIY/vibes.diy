import React, { useMemo, useState } from "react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { FlagToggle, byNewest, requestDate, stateLabel, fmtDate, RequestGrantItem } from "./shared.js";
import { AppSettings, ClerkClaimParams } from "@vibes.diy/api-types";

const columnHelper = createColumnHelper<RequestGrantItem>();

const tailColumns = [
  columnHelper.accessor((r) => r.state, {
    id: "state",
    header: "State",
    cell: (info) => stateLabel(info.getValue()),
  }),
  columnHelper.accessor((r) => fmtDate(requestDate(r)), {
    id: "date",
    header: "Date",
    cell: (info) => <span className="text-gray-400">{info.getValue()}</span>,
  }),
];

interface RequestTableProps {
  requests: RequestGrantItem[];
  label: string;
  renderUser: (r: RequestGrantItem) => React.ReactNode; // injected by RequestsSection
  onApprove?: (r: RequestGrantItem, role: "editor" | "viewer") => void;
  onRejectPending?: (r: RequestGrantItem) => void;
  onRejectApproved?: (r: RequestGrantItem) => void;
  onSwitchRole?: (r: RequestGrantItem, newRole: "editor" | "viewer") => void;
  onReApprove?: (r: RequestGrantItem) => void;
  onRemove?: (r: RequestGrantItem) => void;
}

function RequestTable({
  requests,
  label,
  renderUser,
  onApprove,
  onRejectPending,
  onRejectApproved,
  onSwitchRole,
  onReApprove,
  onRemove,
}: RequestTableProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const columns = useMemo(() => {
    const userColumn = columnHelper.display({
      id: "key",
      header: "User",
      cell: ({ row }) => <span className="font-mono truncate text-gray-700 dark:text-gray-300">{renderUser(row.original)}</span>,
    });
    function act(key: string, fn: () => void) {
      setBusy(key);
      fn();
      setBusy(null);
    }

    const removeBtn = (r: RequestGrantItem, isBusy: boolean, remove: (x: RequestGrantItem) => void) => (
      <button
        type="button"
        disabled={isBusy}
        onClick={() => act(r.foreignUserId, () => remove(r))}
        className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs leading-none disabled:opacity-50"
        title="Remove"
      >
        ✕
      </button>
    );

    const actionColumn = (() => {
      if (onApprove && onRejectPending) {
        return columnHelper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const r = row.original;
            const isBusy = busy === r.foreignUserId;
            return (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.foreignUserId, () => onApprove(r, "editor"))}
                  className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 disabled:opacity-50"
                >
                  {isBusy ? "…" : "Editor"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.foreignUserId, () => onApprove(r, "viewer"))}
                  className="rounded px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 disabled:opacity-50"
                >
                  {isBusy ? "…" : "Viewer"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.foreignUserId, () => onRejectPending(r))}
                  className="rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 disabled:opacity-50"
                >
                  {isBusy ? "…" : "Reject"}
                </button>
                {onRemove && removeBtn(r, isBusy, onRemove)}
              </div>
            );
          },
        });
      }

      if (onRejectApproved) {
        return columnHelper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const r = row.original;
            const isBusy = busy === r.foreignUserId;
            return (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.foreignUserId, () => onRejectApproved(r))}
                  className="rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 disabled:opacity-50"
                >
                  {isBusy ? "…" : "Revoke"}
                </button>
                {onRemove && removeBtn(r, isBusy, onRemove)}
              </div>
            );
          },
        });
      }

      if (onReApprove) {
        return columnHelper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const r = row.original;
            const isBusy = busy === r.foreignUserId;
            return (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.foreignUserId, () => onReApprove(r))}
                  className="rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 disabled:opacity-50"
                >
                  {isBusy ? "…" : "Approve"}
                </button>
                {onRemove && removeBtn(r, isBusy, onRemove)}
              </div>
            );
          },
        });
      }

      if (onRemove) {
        return columnHelper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const r = row.original;
            const isBusy = busy === r.foreignUserId;
            return <div className="flex items-center gap-1">{removeBtn(r, isBusy, onRemove)}</div>;
          },
        });
      }

      return null;
    })();

    const roleColumn = columnHelper.display({
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const r = row.original;
        const isBusy = busy === r.foreignUserId;
        const role = r.role ?? "viewer";
        if (onSwitchRole) {
          return (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => act(r.foreignUserId, () => onSwitchRole(r, role === "editor" ? "viewer" : "editor"))}
              className="capitalize rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
              title={`Switch to ${role === "editor" ? "viewer" : "editor"}`}
            >
              {role}
            </button>
          );
        }
        return <span className="capitalize text-gray-600 dark:text-gray-400">{role}</span>;
      },
    });

    return actionColumn ? [userColumn, ...tailColumns, roleColumn, actionColumn] : [userColumn, ...tailColumns, roleColumn];
  }, [onApprove, onRejectPending, onRejectApproved, onSwitchRole, onRemove, busy]);

  const data = useMemo(() => [...requests].sort(byNewest(requestDate)), [requests]);
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

interface RequestListProps {
  requests: RequestGrantItem[];
  renderUser: (r: RequestGrantItem) => React.ReactNode; // injected by RequestsSection
  onApprove: (r: RequestGrantItem, role: "editor" | "viewer") => void;
  onRejectPending: (r: RequestGrantItem) => void;
  onRejectApproved: (r: RequestGrantItem) => void;
  onSwitchRole: (r: RequestGrantItem, newRole: "editor" | "viewer") => void;
  onSwitchRejectedRole: (r: RequestGrantItem, newRole: "editor" | "viewer") => void;
  onReApprove: (r: RequestGrantItem) => void;
  onRemove: (r: RequestGrantItem) => void;
}

function RequestList({
  requests,
  renderUser,
  onApprove,
  onRejectPending,
  onRejectApproved,
  onSwitchRole,
  onSwitchRejectedRole,
  onReApprove,
  onRemove,
}: RequestListProps) {
  const pending = requests.filter((r) => r.state === "pending");
  const approved = requests.filter((r) => r.state === "approved");
  const revoked = requests.filter((r) => r.state === "revoked");

  if (requests.length === 0) {
    return <p className="text-xs text-gray-400">no requests</p>;
  }

  return (
    <div className="space-y-3 mt-2">
      <RequestTable
        requests={pending}
        label="Pending"
        renderUser={renderUser}
        onApprove={onApprove}
        onRejectPending={onRejectPending}
        onRemove={onRemove}
      />
      <RequestTable
        requests={approved}
        label="Approved"
        renderUser={renderUser}
        onSwitchRole={onSwitchRole}
        onRejectApproved={onRejectApproved}
        onRemove={onRemove}
      />
      <RequestTable
        requests={revoked}
        label="Revoked"
        renderUser={renderUser}
        onSwitchRole={onSwitchRejectedRole}
        onReApprove={onReApprove}
        onRemove={onRemove}
      />
    </div>
  );
}

interface RequestsSectionProps {
  enableRequest: AppSettings["entry"]["enableRequest"];
  requests: RequestGrantItem[];
  toggling: string | null;
  onToggle: () => void;
  onToggleAutoAccept: () => void;
  onApprove: (r: RequestGrantItem, role: "editor" | "viewer") => void;
  onRejectPending: (r: RequestGrantItem) => void;
  onRejectApproved: (r: RequestGrantItem) => void;
  onSwitchRole: (r: RequestGrantItem, newRole: "editor" | "viewer") => void;
  onSwitchRejectedRole: (r: RequestGrantItem, newRole: "editor" | "viewer") => void;
  onReApprove: (r: RequestGrantItem) => void;
  onRemove: (r: RequestGrantItem) => void;
}

function name(params: Partial<ClerkClaimParams>): string | null {
  if (params.name && params.last) {
    return `${params.name} ${params.last}`;
  }
  if (params.first) {
    return params.first;
  }
  if (params.last) {
    return params.last;
  }
  return null;
}

export function RequestsSection({
  enableRequest,
  requests,
  toggling,
  onToggle,
  onToggleAutoAccept,
  onApprove,
  onRejectPending,
  onRejectApproved,
  onSwitchRole,
  onSwitchRejectedRole,
  onReApprove,
  onRemove,
}: RequestsSectionProps) {
  function renderUser(r: RequestGrantItem): React.ReactNode {
    // console.log(`renderUser`, r);
    const params = r.foreignInfo?.claims?.params ?? ({} as Partial<ClerkClaimParams>);
    return (
      <>
        {r.foreignInfo?.claims?.params?.image_url && (
          <img src={r.foreignInfo.claims.params.image_url} alt="avatar" className="w-4 h-4 rounded-full object-cover mr-1" />
        )}
        {params.nick ?? params.name ?? params.email ?? name(params) ?? r.foreignUserId}
      </>
    );
  }

  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Requests</div>
      <div className="space-y-3 mt-1">
        <div className="space-y-2">
          <div className="flex items-center gap-4 flex-wrap">
            <FlagToggle label="requests" enabled={!!enableRequest?.enable} toggling={toggling === "request"} onToggle={onToggle} />
            {enableRequest?.enable && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!enableRequest.autoAcceptRole}
                  disabled={toggling === "autoAcceptRole"}
                  onChange={onToggleAutoAccept}
                  className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-50"
                />
                Auto-accept view requests
              </label>
            )}
          </div>
          {enableRequest?.enable && (
            <RequestList
              requests={requests}
              renderUser={renderUser}
              onApprove={onApprove}
              onRejectPending={onRejectPending}
              onRejectApproved={onRejectApproved}
              onSwitchRole={onSwitchRole}
              onSwitchRejectedRole={onSwitchRejectedRole}
              onReApprove={onReApprove}
              onRemove={onRemove}
            />
          )}
        </div>
      </div>
    </li>
  );
}
