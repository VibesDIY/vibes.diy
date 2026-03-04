import { useState, useMemo } from "react";
import { S, TC } from "../lib/styles";
import { getType, flattenRow, smartPreview } from "../lib/utils";
import { TypeBadge } from "./TypeBadge";
import { Val } from "./Val";
import { ExpandableCell } from "./ExpandableCell";
import { CellDrawer } from "./CellDrawer";
import { useMobile } from "./MobileProvider";

interface DataTableProps {
  data: Record<string, unknown>[];
  label?: string;
  onRowClick?: (idx: number) => void;
  page?: number;
  totalDocs?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function DataTable({
  data,
  label,
  onRowClick,
  page,
  totalDocs,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DataTableProps) {
  const mob = useMobile();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<{ col: string | null; val: string }>({
    col: null,
    val: "",
  });
  const [flattenDepth, setFlattenDepth] = useState(0);
  const [pinnedCols, setPinnedCols] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{
    value: unknown;
    path: string;
  } | null>(null);

  const flattened = useMemo(
    () =>
      flattenDepth === 0
        ? data
        : data.map((r) => flattenRow(r, flattenDepth)),
    [data, flattenDepth]
  );

  const cols = useMemo(() => {
    const k = new Set<string>();
    flattened.forEach((r) => Object.keys(r).forEach((c) => k.add(c)));
    const all = [...k];
    return [
      ...all.filter((c) => pinnedCols.has(c)),
      ...all.filter((c) => !pinnedCols.has(c)),
    ];
  }, [flattened, pinnedCols]);

  const rows = useMemo(() => {
    let a = flattened.map((r, i) => ({ row: r, origIdx: i }));
    if (filter.col && filter.val) {
      const lc = filter.val.toLowerCase();
      a = a.filter(({ row }) => {
        const v = row[filter.col!];
        if (v == null) return false;
        return (typeof v === "object" ? JSON.stringify(v) : String(v))
          .toLowerCase()
          .includes(lc);
      });
    }
    if (sortKey) {
      a.sort((x, y) => {
        let a2: unknown = x.row[sortKey];
        let b2: unknown = y.row[sortKey];
        if (a2 === b2) return 0;
        if (a2 == null) return 1;
        if (b2 == null) return -1;
        if (typeof a2 === "object")
          a2 = smartPreview(a2) || "";
        if (typeof b2 === "object")
          b2 = smartPreview(b2) || "";
        const c =
          typeof a2 === "number" && typeof b2 === "number"
            ? a2 - b2
            : String(a2).localeCompare(String(b2));
        return sortDir === "asc" ? c : -c;
      });
    }
    return a;
  }, [flattened, sortKey, sortDir, filter]);

  const colTypes = useMemo(() => {
    const map: Record<string, string[]> = {};
    cols.forEach((c) => {
      const types = new Set<string>();
      flattened.forEach((r) => {
        if (r[c] !== undefined) types.add(getType(r[c]));
      });
      map[c] = [...types];
    });
    return map;
  }, [cols, flattened]);

  const cardCols = useMemo(() => {
    const freq: Record<string, number> = {};
    const primRate: Record<string, { prim: number; total: number }> = {};
    flattened.forEach((r) => {
      for (const [k, v] of Object.entries(r)) {
        freq[k] = (freq[k] || 0) + 1;
        if (!primRate[k]) primRate[k] = { prim: 0, total: 0 };
        primRate[k].total++;
        const t = getType(v);
        if (t !== "object" && t !== "array") primRate[k].prim++;
      }
    });
    const meta = new Set(["_id", "_createdAt", "_updatedAt"]);
    const candidates = Object.keys(freq).filter((k) => !meta.has(k));
    candidates.sort((a, b) => {
      const sa =
        (freq[a] / flattened.length) *
        (primRate[a].prim / primRate[a].total + 0.1);
      const sb =
        (freq[b] / flattened.length) *
        (primRate[b].prim / primRate[b].total + 0.1);
      return sb - sa;
    });
    return candidates.slice(0, 5);
  }, [flattened]);

  const hasPagination =
    page !== undefined &&
    totalDocs !== undefined &&
    pageSize !== undefined &&
    onPageChange;
  const totalPages = hasPagination
    ? Math.max(1, Math.ceil(totalDocs! / pageSize!))
    : 1;

  return (
    <div>
      {/* Controls bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        {label && (
          <div
            style={{
              fontSize: 11,
              color: S.textDim,
              fontFamily: S.mono,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <TypeBadge type="array" />
            <span>{label}</span>
            <span style={{ color: S.textMuted }}>
              {totalDocs ?? data.length} rows
            </span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {!mob && (
          <>
            <span
              style={{
                fontSize: 9,
                color: S.textMuted,
                fontFamily: S.mono,
              }}
            >
              flatten:
            </span>
            {[0, 1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => setFlattenDepth(d)}
                style={{
                  background:
                    flattenDepth === d
                      ? S.accent + "20"
                      : "transparent",
                  border: `1px solid ${flattenDepth === d ? S.accent + "40" : "transparent"}`,
                  color:
                    flattenDepth === d ? S.accent : S.textDim,
                  borderRadius: 3,
                  padding: "1px 6px",
                  fontSize: 9,
                  cursor: "pointer",
                  fontFamily: S.mono,
                }}
              >
                {d === 0 ? "off" : d}
              </button>
            ))}
          </>
        )}
      </div>

      {filter.col && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
            padding: mob ? "8px 10px" : "5px 8px",
            background: S.bgDeep,
            borderRadius: 4,
            border: `1px solid ${S.border}`,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: S.textDim,
              fontFamily: S.mono,
            }}
          >
            filter {filter.col}:
          </span>
          <input
            value={filter.val}
            onChange={(e) =>
              setFilter((f) => ({ ...f, val: e.target.value }))
            }
            autoFocus
            style={{
              background: S.bgSurface,
              border: `1px solid ${S.border}`,
              borderRadius: 3,
              color: S.text,
              padding: mob ? "6px 8px" : "2px 6px",
              fontSize: 11,
              fontFamily: S.mono,
              outline: "none",
              flex: 1,
            }}
          />
          <span
            onClick={() => setFilter({ col: null, val: "" })}
            style={{
              color: S.textDim,
              cursor: "pointer",
              fontSize: 14,
              padding: "4px",
            }}
          >
            {"\u2715"}
          </span>
        </div>
      )}

      {/* MOBILE: Card layout */}
      {mob
        ? (() => {
            const idCandidates = [
              "_id",
              "id",
              "key",
              "name",
              "title",
              "label",
              "email",
              "slug",
            ];
            const idKey = idCandidates.find((k) =>
              rows.some(({ row }) => row[k] !== undefined)
            );
            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {rows.map(({ row: r, origIdx }, i) => {
                  const idVal = idKey ? r[idKey] : null;
                  return (
                    <div
                      key={i}
                      className="mob-card"
                      onClick={() => onRowClick?.(origIdx)}
                      style={{
                        background: S.bgSurface,
                        border: `1px solid ${S.border}`,
                        borderRadius: 8,
                        padding: "12px 14px",
                        cursor: onRowClick ? "pointer" : "default",
                        transition: "background 0.1s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: onRowClick
                              ? S.docAccent
                              : S.textMuted,
                            fontFamily: S.mono,
                            fontWeight: 600,
                          }}
                        >
                          #{i + 1}
                        </span>
                        {idVal != null ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: S.mono,
                              color: S.docAccent,
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}
                          >
                            {String(idVal)}
                          </span>
                        ) : (
                          <span style={{ flex: 1 }} />
                        )}
                        {onRowClick && (
                          <span
                            style={{
                              color: S.accent,
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          >
                            {"\u203A"}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {cardCols
                          .filter(
                            (c) =>
                              c !== idKey && r[c] !== undefined
                          )
                          .map((c) => {
                            const t2 = getType(r[c]);
                            return (
                              <div
                                key={c}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 6,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontFamily: S.mono,
                                    color: S.textDim,
                                    minWidth: 60,
                                    flexShrink: 0,
                                    paddingTop: 1,
                                  }}
                                >
                                  {c}
                                </span>
                                <div
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                  }}
                                >
                                  {t2 === "object" ||
                                  t2 === "array" ? (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontFamily: S.mono,
                                        color: TC[t2],
                                        opacity: 0.7,
                                      }}
                                    >
                                      {smartPreview(r[c]) ||
                                        (t2 === "array"
                                          ? `[${(r[c] as unknown[]).length}]`
                                          : `{${Object.keys(r[c] as Record<string, unknown>).length}}`)}
                                    </span>
                                  ) : (
                                    <Val
                                      value={r[c]}
                                      truncate={50}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
                {rows.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 30,
                      color: S.textMuted,
                      fontFamily: S.mono,
                      fontSize: 12,
                    }}
                  >
                    No rows
                  </div>
                )}
              </div>
            );
          })()
        : /* DESKTOP: Table layout */
          (
          <div
            style={{
              overflowX: "auto",
              border: `1px solid ${S.border}`,
              borderRadius: 6,
              maxHeight: "calc(100vh - 240px)",
              overflow: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                fontFamily: S.mono,
              }}
            >
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr>
                  <th
                    style={{
                      padding: "7px 8px",
                      background: S.bgDeep,
                      borderBottom: `2px solid ${S.border}`,
                      color: S.textMuted,
                      fontSize: 9,
                      fontWeight: 600,
                      textAlign: "center",
                      width: 32,
                    }}
                  >
                    #
                  </th>
                  {cols.map((c) => (
                    <th
                      key={c}
                      style={{
                        padding: "4px 10px",
                        background: S.bgDeep,
                        borderBottom: `2px solid ${S.border}`,
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        minWidth: 80,
                        borderLeft: pinnedCols.has(c)
                          ? `2px solid ${S.accent}40`
                          : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginBottom: 2,
                        }}
                      >
                        <span
                          onClick={() => {
                            const n = new Set(pinnedCols);
                            n.has(c) ? n.delete(c) : n.add(c);
                            setPinnedCols(n);
                          }}
                          style={{
                            fontSize: 9,
                            cursor: "pointer",
                            color: pinnedCols.has(c)
                              ? S.accent
                              : S.textMuted,
                            opacity: pinnedCols.has(c) ? 1 : 0.3,
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = "1")
                          }
                          onMouseLeave={(e) => {
                            if (!pinnedCols.has(c))
                              e.currentTarget.style.opacity = "0.3";
                          }}
                        >
                          {"\u25C6"}
                        </span>
                        <span
                          style={{
                            color: S.textDim,
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            sortKey === c
                              ? setSortDir((d) =>
                                  d === "asc" ? "desc" : "asc"
                                )
                              : (setSortKey(c), setSortDir("asc"));
                          }}
                        >
                          {c}{" "}
                          {sortKey === c
                            ? sortDir === "asc"
                              ? "\u2191"
                              : "\u2193"
                            : ""}
                        </span>
                        <span
                          onClick={() =>
                            setFilter((f) =>
                              f.col === c
                                ? { col: null, val: "" }
                                : { col: c, val: "" }
                            )
                          }
                          style={{
                            fontSize: 9,
                            opacity: filter.col === c ? 1 : 0.25,
                            cursor: "pointer",
                            color:
                              filter.col === c
                                ? S.accent
                                : S.textDim,
                          }}
                        >
                          {"\u2AE7"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        {(colTypes[c] || []).map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ row: r, origIdx }, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: `1px solid ${S.border}`,
                      cursor: onRowClick ? "pointer" : "default",
                    }}
                    onClick={() => onRowClick?.(origIdx)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        S.bgHover + "50")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        "transparent")
                    }
                  >
                    <td
                      style={{
                        padding: "6px 8px",
                        color: onRowClick
                          ? S.docAccent
                          : S.textMuted,
                        fontSize: 9,
                        textAlign: "center",
                        verticalAlign: "top",
                        fontWeight: onRowClick ? 600 : 400,
                      }}
                    >
                      {(page !== undefined ? page * (pageSize ?? data.length) : 0) + i + 1}
                    </td>
                    {cols.map((c) => (
                      <td
                        key={c}
                        onClick={(e) => {
                          const t2 = getType(r[c]);
                          if (
                            t2 === "object" ||
                            t2 === "array"
                          )
                            e.stopPropagation();
                        }}
                        style={{
                          padding: "6px 10px",
                          verticalAlign: "top",
                          maxWidth: 360,
                          borderLeft: pinnedCols.has(c)
                            ? `2px solid ${S.accent}15`
                            : "none",
                        }}
                      >
                        <ExpandableCell
                          value={r[c]}
                          colKey={c}
                          onDrawer={(val, path) =>
                            setDrawer({
                              value: val,
                              path: `[${origIdx}].${path}`,
                            })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Footer */}
      <div
        style={{
          fontSize: 9,
          color: S.textMuted,
          marginTop: 6,
          fontFamily: S.mono,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span>
          {rows.length}/{totalDocs ?? data.length} rows
        </span>
        <span>{cols.length} cols</span>
        {flattenDepth > 0 && (
          <span style={{ color: S.accent }}>flatten:{flattenDepth}</span>
        )}
        {onRowClick && !mob && (
          <span style={{ color: S.docAccent }}>click row to open</span>
        )}

        {hasPagination && totalPages > 1 && (
          <>
            <div style={{ flex: 1 }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>rows/page:</span>
              {[25, 50, 100].map((s) => (
                <button
                  key={s}
                  onClick={() => onPageSizeChange?.(s)}
                  style={{
                    background:
                      pageSize === s
                        ? S.accent + "20"
                        : "transparent",
                    border: `1px solid ${pageSize === s ? S.accent + "40" : "transparent"}`,
                    color:
                      pageSize === s ? S.accent : S.textDim,
                    borderRadius: 3,
                    padding: "1px 6px",
                    fontSize: 9,
                    cursor: "pointer",
                    fontFamily: S.mono,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <button
                onClick={() => onPageChange!(page! - 1)}
                disabled={page === 0}
                style={{
                  background: "transparent",
                  border: `1px solid ${S.border}`,
                  color:
                    page === 0 ? S.textMuted : S.textDim,
                  borderRadius: 3,
                  padding: "1px 8px",
                  fontSize: 9,
                  cursor: page === 0 ? "default" : "pointer",
                  fontFamily: S.mono,
                  opacity: page === 0 ? 0.4 : 1,
                }}
              >
                prev
              </button>
              <span>
                {page! + 1}/{totalPages}
              </span>
              <button
                onClick={() => onPageChange!(page! + 1)}
                disabled={page === totalPages - 1}
                style={{
                  background: "transparent",
                  border: `1px solid ${S.border}`,
                  color:
                    page === totalPages - 1
                      ? S.textMuted
                      : S.textDim,
                  borderRadius: 3,
                  padding: "1px 8px",
                  fontSize: 9,
                  cursor:
                    page === totalPages - 1
                      ? "default"
                      : "pointer",
                  fontFamily: S.mono,
                  opacity:
                    page === totalPages - 1 ? 0.4 : 1,
                }}
              >
                next
              </button>
            </div>
          </>
        )}
      </div>

      {drawer && (
        <>
          <div
            onClick={() => setDrawer(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "#00000040",
              zIndex: 99,
            }}
          />
          <CellDrawer
            value={drawer.value}
            path={drawer.path}
            onClose={() => setDrawer(null)}
          />
        </>
      )}
    </div>
  );
}
