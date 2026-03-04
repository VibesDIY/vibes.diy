import { useState, useCallback, useRef } from "react";
import { S, TC } from "../lib/styles";
import { isTabular, byteSize } from "../lib/utils";
import { Btn } from "../atoms/Btn";
import { ScopeBadge } from "../atoms/ScopeBadge";
import { LiveDocTree, LiveDocTreeHandle } from "./LiveDocTree";
import { DataTable } from "./DataTable";
import { ConfirmDialog } from "./ConfirmDialog";
import { Toast } from "./Toast";
import { useMobile } from "./MobileProvider";

export interface DocRecord {
  _id?: string;
  [key: string]: unknown;
}

interface DocDBViewerProps {
  docs: DocRecord[];
  loading: boolean;
  dbName: string;
  onSave: (doc: DocRecord) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
  onCreate: (doc: Record<string, unknown>) => Promise<string>;
  onSeedData: () => Promise<void>;
  page: number;
  totalDocs: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

interface NavEntry {
  type: "doc" | "nested";
  idx?: number;
  id?: string;
  data?: unknown[];
  label?: string;
}

export function DocDBViewer({
  docs,
  loading,
  dbName,
  onSave,
  onDelete,
  onCreate,
  onSeedData,
  page,
  totalDocs,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DocDBViewerProps) {
  const mob = useMobile();
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [expandDepth] = useState(2);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const treeRef = useRef<LiveDocTreeHandle>(null);
  const [treeState, setTreeState] = useState({
    isDirty: false,
    canUndo: false,
  });

  // Local edit draft for doc view
  const [editDraft, setEditDraft] = useState<DocRecord | null>(null);

  const scope =
    navStack.length === 0
      ? "db"
      : navStack[0].type === "doc"
        ? navStack.length === 1
          ? "doc"
          : "nested"
        : "db";
  const docEntry = navStack.find((n) => n.type === "doc");
  const sourceDoc = docEntry ? docs[docEntry.idx!] : null;
  const doc = editDraft ?? sourceDoc;
  const nestedEntry =
    navStack.length > 1 ? navStack[navStack.length - 1] : null;

  const navigateHome = useCallback(() => {
    setNavStack([]);
    setEditDraft(null);
  }, []);

  const openDoc = useCallback(
    (idx: number) => {
      setNavStack([
        {
          type: "doc",
          idx,
          id: (docs[idx]?._id as string) || `doc_${idx}`,
        },
      ]);
      setEditDraft({ ...docs[idx] });
    },
    [docs]
  );

  const pushNested = useCallback((data: unknown[], label: string) => {
    setNavStack((s) => [
      ...s,
      { type: "nested", data, label: String(label || "nested") },
    ]);
  }, []);

  const navigateBack = useCallback(
    (toIndex: number) => {
      setNavStack((s) => s.slice(0, toIndex));
      if (toIndex === 0) setEditDraft(null);
    },
    []
  );

  const liveUpdateDoc = useCallback(
    (newDoc: Record<string, unknown>) => {
      setEditDraft(newDoc as DocRecord);
      setNavStack((s) =>
        s.map((n) =>
          n.type === "doc" && n.idx === docEntry?.idx
            ? { ...n, id: (newDoc._id as string) || n.id }
            : n
        )
      );
    },
    [docEntry]
  );

  const saveDoc = useCallback(async () => {
    if (!doc) return;
    try {
      await onSave(doc);
      setEditDraft(null);
      setNavStack([]);
      setToast({
        message: `${doc._id || "doc"} saved`,
        type: "success",
      });
    } catch (e) {
      setToast({
        message: `Save failed: ${(e as Error).message}`,
        type: "error",
      });
    }
  }, [doc, onSave]);

  const deleteDoc = useCallback(
    async (idx: number) => {
      const id = docs[idx]?._id;
      if (!id) return;
      try {
        await onDelete(id);
        setNavStack([]);
        setConfirmDelete(false);
        setEditDraft(null);
        setToast({ message: `${id} deleted`, type: "success" });
      } catch (e) {
        setConfirmDelete(false);
        setToast({
          message: `Delete failed: ${(e as Error).message}`,
          type: "error",
        });
      }
    },
    [docs, onDelete]
  );

  const newDoc = useCallback(async () => {
    try {
      const id = await onCreate({});
      setNavStack([{ type: "doc", idx: 0, id }]);
      setEditDraft({ _id: id });
      setToast({ message: "Document created", type: "success" });
    } catch (e) {
      setToast({
        message: `Create failed: ${(e as Error).message}`,
        type: "error",
      });
    }
  }, [onCreate]);

  const scopeColor =
    scope === "db" ? S.accent : scope === "doc" ? S.docAccent : TC.array;

  if (loading && docs.length === 0) {
    return (
      <div
        style={{
          fontFamily: S.sans,
          background: S.bg,
          color: S.text,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textDim }}>
          Loading {dbName}...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: S.sans,
        background: S.bg,
        color: S.text,
        height: "100vh",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <style>{`
        [class="row-actions"]{opacity:0;transition:opacity 0.12s}
        *:hover>[class="row-actions"]{opacity:1!important}
        @media(max-width:639px){
          [class="row-actions"]{opacity:1!important}
          .mob-card:active{background:${S.bgHover}!important}
        }
      `}</style>

      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: mob ? "0 10px" : "0 16px",
          height: mob ? 48 : 44,
          borderBottom: `1px solid ${S.border}`,
          background: S.bgSurface,
          gap: mob ? 6 : 10,
          flexShrink: 0,
        }}
      >
        <div
          onClick={navigateHome}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: `linear-gradient(135deg, ${S.accent}, ${TC.array})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: S.bg,
              fontFamily: S.mono,
            }}
          >
            db
          </div>
          {!mob && (
            <span style={{ fontSize: 13, fontWeight: 600 }}>{dbName}</span>
          )}
        </div>

        {/* Breadcrumb */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            fontFamily: S.mono,
            fontSize: mob ? 12 : 11,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span style={{ color: S.textMuted, margin: "0 4px" }}>/</span>
          <span
            onClick={navigateHome}
            style={{
              color: navStack.length === 0 ? S.text : S.accent,
              cursor: "pointer",
              fontWeight: navStack.length === 0 ? 600 : 400,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (navStack.length > 0)
                e.currentTarget.style.textDecoration = "underline";
            }}
            onMouseLeave={(e) =>
              (e.currentTarget.style.textDecoration = "none")
            }
          >
            all
            <span
              style={{
                color: S.textMuted,
                fontWeight: 400,
                marginLeft: 4,
                fontSize: 9,
              }}
            >
              {totalDocs}
            </span>
          </span>
          {navStack.map((n, i) => (
            <span
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: S.textMuted,
                  margin: "0 4px",
                  flexShrink: 0,
                }}
              >
                /
              </span>
              <span
                onClick={() => navigateBack(i + 1)}
                style={{
                  color:
                    i === navStack.length - 1
                      ? S.text
                      : n.type === "doc"
                        ? S.docAccent
                        : TC.array,
                  cursor: "pointer",
                  fontWeight:
                    i === navStack.length - 1 ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                onMouseEnter={(e) => {
                  if (i < navStack.length - 1)
                    e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.textDecoration = "none")
                }
              >
                {n.type === "doc" ? n.id : n.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      {scope === "doc" && doc ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: mob ? "6px 10px" : "6px 16px",
            borderBottom: `1px solid ${S.border}`,
            background: S.bgSurface,
            gap: mob ? 6 : 8,
            flexShrink: 0,
          }}
        >
          <Btn
            onClick={() => treeRef.current?.undo()}
            border={S.border}
            color={treeState.canUndo ? S.textDim : S.textMuted}
            style={{
              opacity: treeState.canUndo ? 1 : 0.35,
              padding: mob ? "6px 12px" : "4px 10px",
              fontSize: 10,
            }}
            disabled={!treeState.canUndo}
          >
            {"\u21B6"} Undo
          </Btn>
          <Btn
            onClick={() => treeRef.current?.discard()}
            border={S.border}
            color={treeState.isDirty ? S.textDim : S.textMuted}
            style={{
              opacity: treeState.isDirty ? 1 : 0.35,
              padding: mob ? "6px 12px" : "4px 10px",
              fontSize: 10,
            }}
            disabled={!treeState.isDirty}
          >
            Discard
          </Btn>
          <div style={{ flex: 1 }} />
          {treeState.isDirty && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: S.docAccent,
                flexShrink: 0,
              }}
            />
          )}
          <Btn
            onClick={saveDoc}
            bg={S.success + "12"}
            border={S.success + "35"}
            color={S.success}
            style={{
              fontSize: 10,
              padding: mob ? "6px 12px" : "4px 10px",
            }}
          >
            Save
          </Btn>
          <Btn
            onClick={() => setConfirmDelete(true)}
            color={S.danger}
            border={S.danger + "30"}
            bg={S.danger + "08"}
            style={{
              fontSize: 10,
              padding: mob ? "6px 12px" : "4px 10px",
            }}
          >
            Delete
          </Btn>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: mob ? "6px 10px" : "6px 16px",
            borderBottom: `1px solid ${S.border}`,
            background: S.bgSurface,
            gap: mob ? 5 : 8,
            flexShrink: 0,
          }}
        >
          <ScopeBadge
            label={scope === "db" ? "database" : "nested"}
            color={scopeColor}
          />
          {!mob && (
            <>
              {scope === "db" && (
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: S.mono,
                    color: S.textMuted,
                  }}
                >
                  {totalDocs} docs {"\u00B7"} {byteSize(docs)}
                </span>
              )}
              {scope === "nested" && nestedEntry && (
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: S.mono,
                    color: S.textMuted,
                  }}
                >
                  {(nestedEntry.data as unknown[]).length} rows
                </span>
              )}
            </>
          )}
          <div style={{ flex: 1 }} />
          {scope === "db" && (
            <>
              <Btn
                onClick={onSeedData}
                border={S.border}
                color={S.textDim}
                style={{
                  fontSize: 10,
                  padding: mob ? "6px 12px" : "4px 10px",
                }}
              >
                Load 100 docs
              </Btn>
              <Btn
                onClick={newDoc}
                bg={S.accent + "15"}
                border={S.accent + "40"}
                color={S.accent}
                style={{
                  fontSize: 10,
                  padding: mob ? "6px 12px" : "4px 10px",
                  fontWeight: 600,
                }}
              >
                + New Document
              </Btn>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: mob ? 10 : 16,
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {scope === "db" &&
          (docs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: S.textMuted,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  marginBottom: 8,
                  opacity: 0.4,
                }}
              >
                {"\u2261"}
              </div>
              <div style={{ fontSize: 12, fontFamily: S.mono }}>
                No documents yet. Click + New Document to create one.
              </div>
            </div>
          ) : isTabular(docs) ? (
            <DataTable
              data={docs}
              label="All documents"
              onRowClick={openDoc}
              page={page}
              totalDocs={totalDocs}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          ) : (
            <DataTable
              data={docs}
              label="All documents"
              onRowClick={openDoc}
              page={page}
              totalDocs={totalDocs}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          ))}

        {scope === "doc" && doc && (
          <LiveDocTree
            ref={treeRef}
            key={docEntry!.idx}
            doc={doc as Record<string, unknown>}
            expandDepth={expandDepth}
            onTableJump={pushNested}
            onDocChange={liveUpdateDoc}
            onStateChange={setTreeState}
          />
        )}

        {scope === "nested" && nestedEntry && (
          <DataTable
            data={nestedEntry.data as Record<string, unknown>[]}
            label={nestedEntry.label}
          />
        )}
      </div>

      {confirmDelete && doc && (
        <ConfirmDialog
          danger
          title={`Delete ${doc._id}?`}
          message={`Permanently remove "${doc._id}" from the database. This cannot be undone.`}
          onConfirm={() => deleteDoc(docEntry!.idx!)}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
