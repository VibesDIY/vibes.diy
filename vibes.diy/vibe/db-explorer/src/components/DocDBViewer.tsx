import { useState, useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";
import { S, TC } from "../lib/styles.js";
import { Btn } from "./Btn.js";
import { JsonEditor } from "./JsonEditor.js";
import { DynamicTable } from "./DynamicTable.js";
import { headersForDocs } from "./dynamicTableHelpers.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { Toast } from "./Toast.js";
import { useMobile } from "./MobileProvider.js";

export interface DocRecord {
  _id?: string;
  [key: string]: unknown;
}

interface DocDBViewerProps {
  docs: DocRecord[];
  docById: Map<string, DocRecord>;
  loading: boolean;
  dbName: string;
  docId?: string;
  navigate: NavigateFunction;
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

export function DocDBViewer({
  docs,
  docById,
  loading,
  dbName,
  docId,
  navigate,
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Only used for newly created docs before live query catches up
  const [editDraft, setEditDraft] = useState<DocRecord | null>(null);

  const scope = docId ? "doc" : "db";
  const doc = docId
    ? (editDraft && editDraft._id === docId ? editDraft : docById.get(docId) ?? null)
    : null;

  const dbPath = `/dbexplore/${encodeURIComponent(dbName)}`;

  const navigateHome = useCallback(() => {
    setEditDraft(null);
    navigate(dbPath);
  }, [navigate, dbPath]);

  const openDoc = useCallback(
    (idx: number) => {
      const id = docs[idx]?._id as string | undefined;
      if (!id) return;
      navigate(`${dbPath}/${encodeURIComponent(id)}`);
    },
    [docs, navigate, dbPath]
  );

  const saveDoc = useCallback(
    async (docToSave: Record<string, unknown>) => {
      try {
        await onSave(docToSave as DocRecord);
        setEditDraft(null);
        navigate(dbPath);
        setToast({
          message: `${docToSave._id || "doc"} saved`,
          type: "success",
        });
      } catch (e) {
        setToast({
          message: `Save failed: ${(e as Error).message}`,
          type: "error",
        });
      }
    },
    [onSave, navigate, dbPath]
  );

  const deleteDoc = useCallback(
    async (id: string) => {
      try {
        await onDelete(id);
        setConfirmDelete(false);
        setEditDraft(null);
        navigate(dbPath);
        setToast({ message: `${id} deleted`, type: "success" });
      } catch (e) {
        setConfirmDelete(false);
        setToast({
          message: `Delete failed: ${(e as Error).message}`,
          type: "error",
        });
      }
    },
    [onDelete, navigate, dbPath]
  );

  const newDoc = useCallback(async () => {
    try {
      const id = await onCreate({});
      setEditDraft({ _id: id });
      navigate(`${dbPath}/${encodeURIComponent(id)}`);
      setToast({ message: "Document created", type: "success" });
    } catch (e) {
      setToast({
        message: `Create failed: ${(e as Error).message}`,
        type: "error",
      });
    }
  }, [onCreate, navigate, dbPath]);

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
            fontFamily: S.sans,
            fontSize: mob ? 13 : 13,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span style={{ color: S.textMuted, margin: "0 4px" }}>/</span>
          <span
            onClick={navigateHome}
            style={{
              color: scope === "db" ? S.text : S.accent,
              cursor: "pointer",
              fontWeight: scope === "db" ? 600 : 400,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (scope === "doc")
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
          {docId && (
            <span
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
                style={{
                  color: S.text,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {docId}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {scope === "doc" ? (
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
          <div style={{ flex: 1 }} />
          {doc && (
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
          )}
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
          {!mob && (
            <span
              style={{
                fontSize: 11,
                fontFamily: S.sans,
                color: S.textMuted,
              }}
            >
              {totalDocs} docs
            </span>
          )}
          <div style={{ flex: 1 }} />
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
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: scope === "doc" ? (mob ? 10 : 16) : 0,
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
          ) : (
            <DynamicTable
              headers={headersForDocs(docs)}
              rows={docs}
              onRowClick={openDoc}
              page={page}
              totalDocs={totalDocs}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          ))}

        {scope === "doc" && doc && (
          <JsonEditor
            key={docId}
            doc={doc as Record<string, unknown>}
            onSave={saveDoc}
            onDiscard={navigateHome}
          />
        )}

        {scope === "doc" && !doc && loading && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: S.textMuted,
              fontFamily: S.mono,
              fontSize: 12,
            }}
          >
            Loading document...
          </div>
        )}

        {scope === "doc" && !doc && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: S.textMuted,
            }}
          >
            <div style={{ fontSize: 12, fontFamily: S.mono, marginBottom: 12 }}>
              Document not found
            </div>
            <Btn
              onClick={navigateHome}
              border={S.border}
              color={S.accent}
              style={{ display: "inline-flex" }}
            >
              Back to table
            </Btn>
          </div>
        )}
      </div>

      {confirmDelete && doc && (
        <ConfirmDialog
          danger
          title={`Delete ${doc._id}?`}
          message={`Permanently remove "${doc._id}" from the database. This cannot be undone.`}
          onConfirm={() => {
            if (docId) {
              deleteDoc(docId);
            }
          }}
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
