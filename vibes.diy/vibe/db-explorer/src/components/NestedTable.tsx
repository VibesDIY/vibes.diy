import { useMemo } from "react";
import { S } from "../lib/styles";
import { Val } from "../atoms/Val";

interface NestedTableProps {
  data: Record<string, unknown>[];
}

export function NestedTable({ data }: NestedTableProps) {
  const cols = useMemo(() => {
    const k = new Set<string>();
    data.forEach((r) => Object.keys(r).forEach((c) => k.add(c)));
    return [...k];
  }, [data]);

  return (
    <div
      style={{
        overflowX: "auto",
        border: `1px solid ${S.border}`,
        borderRadius: 4,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 11,
          fontFamily: S.mono,
        }}
      >
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                style={{
                  padding: "5px 8px",
                  background: S.bgDeep,
                  borderBottom: `1px solid ${S.border}`,
                  color: S.textDim,
                  fontSize: 9,
                  fontWeight: 600,
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${S.border}40` }}>
              {cols.map((c) => (
                <td
                  key={c}
                  style={{
                    padding: "4px 8px",
                    maxWidth: 180,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Val value={r[c]} truncate={40} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
