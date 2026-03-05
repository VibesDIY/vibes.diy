import { S } from "../lib/styles.js";

interface DynamicTableProps {
  headers: string[];
  rows: Record<string, unknown>[];
  onRowClick?: (idx: number) => void;
  page?: number;
  totalDocs?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function DynamicTable({
  headers,
  rows,
  onRowClick,
  page,
  totalDocs,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DynamicTableProps) {
  const totalPages =
    totalDocs !== undefined && pageSize ? Math.ceil(totalDocs / pageSize) : 1;

  return (
    <div style={{ position: "relative" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
          fontFamily: S.mono,
          fontSize: 12,
          color: S.text,
        }}
      >
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                style={{
                  padding: "8px 15px",
                  fontSize: 11,
                  color: S.textMuted,
                  fontWeight: 500,
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: S.bgSurface,
                  borderBottom: `1px solid ${S.border}`,
                }}
              >
                {header === "_id" ? "doc id" : header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((fields, idx) => (
            <tr
              key={(fields._id as string) ?? idx}
              onClick={() => onRowClick?.(idx)}
              style={{ cursor: onRowClick ? "pointer" : "default", borderBottom: `1px solid ${S.border}` }}
              onMouseEnter={(e) => (e.currentTarget.style.background = S.bgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {headers.map((header) =>
                header === "_id" ? (
                  <th
                    key={header}
                    scope="row"
                    style={{ padding: "12px 15px", fontSize: 12, whiteSpace: "nowrap", fontWeight: 600 }}
                  >
                    {formatTableCellContent(fields[header], header)}
                  </th>
                ) : (
                  <td
                    key={header}
                    style={{ padding: "12px 15px", fontSize: 12 }}
                  >
                    {formatTableCellContent(fields[header], header)}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {page !== undefined && totalDocs !== undefined && pageSize !== undefined && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 15px",
            fontFamily: S.mono,
            fontSize: 11,
            color: S.textDim,
            borderTop: `1px solid ${S.border}`,
          }}
        >
          <span>
            {totalDocs} docs · page {page + 1}/{totalPages}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              style={{
                background: S.bgSurface,
                color: S.text,
                border: `1px solid ${S.border}`,
                borderRadius: 3,
                padding: "2px 4px",
                fontFamily: S.mono,
                fontSize: 11,
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/pg
                </option>
              ))}
            </select>
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page === 0}
              style={{
                background: "none",
                border: "none",
                color: page === 0 ? S.textMuted : S.accent,
                cursor: page === 0 ? "default" : "pointer",
                fontFamily: S.mono,
                fontSize: 12,
              }}
            >
              ‹ Prev
            </button>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages - 1}
              style={{
                background: "none",
                border: "none",
                color: page >= totalPages - 1 ? S.textMuted : S.accent,
                cursor: page >= totalPages - 1 ? "default" : "pointer",
                fontFamily: S.mono,
                fontSize: 12,
              }}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTableCellContent(obj: unknown, header: string): string {
  if (obj === null || obj === undefined) return "";
  const str = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  if (header === "_id") return str.substring(0, 4) + ".." + str.substring(str.length - 4);
  return str.length > 30 ? `${str.substring(0, 25).trim()}...` : str;
}
