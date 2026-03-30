import React, { useState, useEffect, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
} from "@tanstack/react-table";
import type { ApiResponse } from "./types.js";

interface RowData {
  path: string;
  key: string;
  desc: string;
  active: boolean;
}

const columnHelper = createColumnHelper<RowData>();

async function fetchGroups(): Promise<ApiResponse> {
  const res = await fetch("/@stable-entry/api");
  return res.json() as Promise<ApiResponse>;
}

async function selectGroup(path: string, key: string): Promise<ApiResponse> {
  const res = await fetch("/@stable-entry/api", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, key }),
    redirect: "follow",
  });
  return res.json() as Promise<ApiResponse>;
}

function flatten(data: ApiResponse): RowData[] {
  return Object.entries(data.routes).flatMap(([path, groups]) =>
    groups.map((g) => ({ path, key: g.key, desc: g.desc, active: g.active }))
  );
}

export function App() {
  const [apiData, setApiData] = useState<ApiResponse>({ routes: {}, cookie: {} });
  const data = flatten(apiData);

  const load = useCallback(() => fetchGroups().then(setApiData), []);
  useEffect(() => {
    load();
  }, [load]);

  const onSelect = useCallback(async (path: string, key: string) => {
    const newData = await selectGroup(path, key);
    setApiData(newData);
  }, []);

  const columns = [
    columnHelper.accessor("path", { header: "Path" }),
    columnHelper.accessor("desc", { header: "Group" }),
    columnHelper.accessor("active", {
      header: "Active",
      cell: (info) => (info.getValue() ? "✓" : ""),
    }),
    columnHelper.display({
      id: "action",
      header: "",
      cell: (info) => {
        const { path, key, active } = info.row.original;
        return (
          <button disabled={active} onClick={() => onSelect(path, key)}>
            {key === "*" ? "Reset" : "Select"}
          </button>
        );
      },
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    state: { grouping: ["path"], expanded: true },
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div style={{ padding: "2rem", maxWidth: "640px", margin: "0 auto" }}>
      <h1>Stable Entry</h1>
      <p
        style={{
          fontFamily: "monospace",
          background: "var(--vibes-bg-secondary, #f5f5f5)",
          padding: "0.5rem 0.8rem",
          borderRadius: "4px",
        }}
      >
        <strong>Cookie:</strong>{" "}
        {Object.keys(apiData.cookie).length > 0 ? JSON.stringify(apiData.cookie) : "(not set — using * defaults)"}
      </p>
      {Object.keys(apiData.cookie).length > 0 &&
        (() => {
          const cmd = `curl -i -H 'Accept-Encoding: identity' -H 'Cookie: se-group=${encodeURIComponent(JSON.stringify(apiData.cookie))}' ${window.location.origin}/`;
          return (
            <div style={{ position: "relative", margin: "0.5rem 0 0" }}>
              <pre
                style={{
                  fontFamily: "monospace",
                  background: "var(--vibes-bg-secondary, #f5f5f5)",
                  padding: "0.5rem 2.5rem 0.5rem 0.8rem",
                  borderRadius: "4px",
                  overflowX: "auto",
                  margin: 0,
                }}
              >
                {cmd}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(cmd)}
                style={{
                  position: "absolute",
                  top: "0.3rem",
                  right: "0.3rem",
                  padding: "0.1rem 0.4rem",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          );
        })()}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} style={{ textAlign: "left", padding: "0.4rem 0.8rem", borderBottom: "2px solid" }}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} style={{ fontWeight: row.getIsGrouped() ? "bold" : "normal" }}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} style={{ padding: "0.4rem 0.8rem", borderBottom: "1px solid #eee" }}>
                  {cell.getIsGrouped()
                    ? flexRender(cell.column.columnDef.cell, cell.getContext())
                    : cell.getIsAggregated()
                      ? null
                      : cell.getIsPlaceholder()
                        ? null
                        : flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
