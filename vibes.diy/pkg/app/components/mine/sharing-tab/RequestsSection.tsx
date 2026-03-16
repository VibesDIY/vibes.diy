import React, { useMemo, useState } from "react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from "@tanstack/react-table";
import { FlagToggle, byNewest, requestDate, stateLabel, fmtDate } from "./shared.js";
import { ActiveRequest, ActiveRequestPending, AppSettings } from "@vibes.diy/api-types";

const columnHelper = createColumnHelper<ActiveRequest>();

const staticColumns = [
  columnHelper.accessor((r) => r.request.key, {
    id: "key",
    header: "Key",
    cell: (info) => <span className="font-mono truncate text-gray-700 dark:text-gray-300">{info.getValue()}</span>,
  }),
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
  requests: ActiveRequest[];
  label: string;
  // pending actions
  onApprove?: (r: ActiveRequestPending, role: "editor" | "viewer") => void;
  onRejectPending?: (r: ActiveRequestPending) => void;
  // approved actions
  onRejectApproved?: (r: ActiveRequest) => void;
  onSwitchRole?: (r: ActiveRequest, newRole: "editor" | "viewer") => void;
  // rejected actions
  onReApprove?: (r: ActiveRequest) => void;
  onRemove?: (r: ActiveRequest) => void;
}

function RequestTable({
  requests,
  label,
  onApprove,
  onRejectPending,
  onRejectApproved,
  onSwitchRole,
  onReApprove,
  onRemove,
}: RequestTableProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const columns = useMemo(() => {
    function act(key: string, fn: () => void) {
      setBusy(key);
      fn();
      setBusy(null);
    }

    const removeBtn = (r: ActiveRequest, isBusy: boolean, remove: (x: ActiveRequest) => void) => (
      <button
        type="button"
        disabled={isBusy}
        onClick={() => act(r.request.key, () => remove(r))}
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
            const r = row.original as ActiveRequestPending;
            const isBusy = busy === r.request.key;
            return (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.request.key, () => onApprove(r, "editor"))}
                  className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 disabled:opacity-50"
                >
                  {isBusy ? "…" : "Editor"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.request.key, () => onApprove(r, "viewer"))}
                  className="rounded px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 disabled:opacity-50"
                >
                  {isBusy ? "…" : "Viewer"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.request.key, () => onRejectPending(r))}
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
            const isBusy = busy === r.request.key;
            return (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.request.key, () => onRejectApproved(r))}
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

      if (onReApprove) {
        return columnHelper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const r = row.original;
            const isBusy = busy === r.request.key;
            return (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => act(r.request.key, () => onReApprove(r))}
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
            const isBusy = busy === r.request.key;
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
        const isBusy = busy === r.request.key;
        if (onSwitchRole) {
          return (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => act(r.request.key, () => onSwitchRole(r, r.role === "editor" ? "viewer" : "editor"))}
              className="capitalize rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
              title={`Switch to ${r.role === "editor" ? "viewer" : "editor"}`}
            >
              {r.role}
            </button>
          );
        }
        return <span className="capitalize text-gray-600 dark:text-gray-400">{r.role}</span>;
      },
    });

    return actionColumn ? [...staticColumns, roleColumn, actionColumn] : [...staticColumns, roleColumn];
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
  requests: ActiveRequest[];
  onApprove: (r: ActiveRequestPending, role: "editor" | "viewer") => void;
  onRejectPending: (r: ActiveRequestPending) => void;
  onRejectApproved: (r: ActiveRequest) => void;
  onSwitchRole: (r: ActiveRequest, newRole: "editor" | "viewer") => void;
  onSwitchRejectedRole: (r: ActiveRequest, newRole: "editor" | "viewer") => void;
  onReApprove: (r: ActiveRequest) => void;
  onRemove: (r: ActiveRequest) => void;
}

function RequestList({
  requests,
  onApprove,
  onRejectPending,
  onRejectApproved,
  onSwitchRole,
  onSwitchRejectedRole,
  onReApprove,
  onRemove,
}: RequestListProps) {
  const pending = requests.filter((r): r is ActiveRequestPending => r.state === "pending");
  const approved = requests.filter((r) => r.state === "approved");
  const rejected = requests.filter((r) => r.state === "rejected");

  if (requests.length === 0) {
    return <p className="text-xs text-gray-400">no requests</p>;
  }

  return (
    <div className="space-y-3 mt-2">
      <RequestTable
        requests={pending}
        label="Pending"
        onApprove={onApprove}
        onRejectPending={onRejectPending}
        onRemove={onRemove}
      />
      <RequestTable
        requests={approved}
        label="Approved"
        onSwitchRole={onSwitchRole}
        onRejectApproved={onRejectApproved}
        onRemove={onRemove}
      />
      <RequestTable
        requests={rejected}
        label="Rejected"
        onSwitchRole={onSwitchRejectedRole}
        onReApprove={onReApprove}
        onRemove={onRemove}
      />
    </div>
  );
}

interface RequestsSectionProps {
  enableRequest: AppSettings["entry"]["enableRequest"];
  requests: ActiveRequest[];
  toggling: string | null;
  onToggle: () => void;
  onToggleAutoAccept: () => void;
  onApprove: (r: ActiveRequestPending, role: "editor" | "viewer") => void;
  onRejectPending: (r: ActiveRequestPending) => void;
  onRejectApproved: (r: ActiveRequest) => void;
  onSwitchRole: (r: ActiveRequest, newRole: "editor" | "viewer") => void;
  onSwitchRejectedRole: (r: ActiveRequest, newRole: "editor" | "viewer") => void;
  onReApprove: (r: ActiveRequest) => void;
  onRemove: (r: ActiveRequest) => void;
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
  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">Requests</div>
      <div className="space-y-3 mt-1">
        <div className="space-y-2">
          <div className="flex items-center gap-4 flex-wrap">
            <FlagToggle label="requests" enabled={!!enableRequest} toggling={toggling === "request"} onToggle={onToggle} />
            {enableRequest && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!enableRequest.autoAcceptViewRequest}
                  disabled={toggling === "autoAcceptViewRequest"}
                  onChange={onToggleAutoAccept}
                  className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-50"
                />
                Auto-accept view requests
              </label>
            )}
          </div>
          {enableRequest && (
            <RequestList
              requests={requests}
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
