import React, { useMemo, useCallback } from "react";
import { themeQuartz, colorSchemeDark, ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import type { ColDef, RowClickedEvent, CellStyle } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { GridOptions } from "./GridFeatures.js";

ModuleRegistry.registerModules([AllCommunityModule]);

const darkTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  backgroundColor: "var(--vibes-bg-primary)",
  foregroundColor: "var(--vibes-text-primary)",
  headerBackgroundColor: "var(--vibes-bg-secondary)",
  headerTextColor: "var(--vibes-text-muted)",
  borderColor: "var(--vibes-border-primary)",
  rowHoverColor: "var(--vibes-bg-light)",
  headerFontWeight: 700,
  headerFontSize: 12,
  fontSize: 14,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  oddRowBackgroundColor: "transparent",
  selectedRowBackgroundColor: "var(--vibes-bg-light)",
  rowBorder: { style: "solid", width: 1, color: "var(--vibes-border-primary)" },
  columnBorder: false,
  headerColumnBorder: false,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  spacing: 8,
});

interface DynamicTableProps {
  headers: string[];
  rows: Record<string, unknown>[];
  onRowClick?: (id: string) => void;
  totalDocs: number;
  gridOptions: GridOptions;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function formatIdValue(value: unknown): string {
  const str = typeof value === "string" ? value : String(value ?? "");
  if (str.length <= 10) return str;
  return str.substring(0, 4) + ".." + str.substring(str.length - 4);
}

export function DynamicTable({ headers, rows, onRowClick, gridOptions: opts }: DynamicTableProps) {
  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [];

    if (opts.rowNumbers) {
      cols.push({
        headerName: "#",
        valueGetter: "node.rowIndex + 1",
        width: 60,
        minWidth: 50,
        maxWidth: 80,
        sortable: false,
        filter: false,
        resizable: false,
        pinned: "left" as const,
        cellStyle: { color: "var(--vibes-text-muted)", fontSize: 11 } as CellStyle,
      });
    }

    for (const header of headers) {
      const isId = header === "_id";
      cols.push({
        field: header,
        headerName: isId ? "doc id" : header,
        valueFormatter: (params: { value: unknown }) => (isId ? formatIdValue(params.value) : formatCellValue(params.value)),
        cellStyle: isId
          ? ({ color: "var(--vibes-blue)", fontWeight: 600, textDecoration: "underline", cursor: "pointer" } as CellStyle)
          : undefined,
        minWidth: isId ? 120 : 100,
        maxWidth: isId ? 140 : undefined,
        resizable: opts.columnResizing,
        sortable: true,
        filter: true,
        floatingFilter: opts.floatingFilters,
        pinned: isId ? ("left" as const) : undefined,
        rowDrag: opts.rowDrag && isId ? true : undefined,
      });
    }

    return cols;
  }, [headers, opts.columnResizing, opts.floatingFilters, opts.rowDrag, opts.rowNumbers]);

  const handleRowClicked = useCallback(
    (event: RowClickedEvent) => {
      const id = event.data?._id as string | undefined;
      if (id) onRowClick?.(id);
    },
    [onRowClick]
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      filter: true,
    }),
    []
  );

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <AgGridReact
        theme={darkTheme}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rows}
        pagination={opts.pagination}
        paginationPageSize={25}
        paginationPageSizeSelector={[25, 50, 100]}
        onRowClicked={handleRowClicked}
        animateRows={false}
        suppressCellFocus={true}
        rowDragManaged={opts.rowDrag}
        columnHoverHighlight={opts.columnHover}
        rowSelection={opts.rowSelection ? { mode: "multiRow" as const } : undefined}
        getRowId={(params) => params.data._id ?? String(params.data)}
        autoSizeStrategy={{ type: "fitCellContents" }}
      />
    </div>
  );
}
