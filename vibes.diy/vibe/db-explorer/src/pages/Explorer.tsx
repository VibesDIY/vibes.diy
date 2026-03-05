import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFireproofDB } from "../hooks/useFireproofDB.js";
import { DocDBViewer, DocRecord } from "../components/DocDBViewer.js";
import { MobileProvider } from "../components/MobileProvider.js";

export function Explorer() {
  const { dbname, docId } = useParams<{ dbname: string; docId?: string }>();
  const navigate = useNavigate();
  const name = dbname || "default";

  const {
    docs,
    docById,
    loading,
    totalDocs,
    page,
    pageSize,
    setPage,
    setPageSize,
    putDoc,
    deleteDoc,
    createDoc,
    seedData,
  } = useFireproofDB(name);

  return (
    <MobileProvider>
      <DocDBViewer
        docs={docs as DocRecord[]}
        docById={docById as Map<string, DocRecord>}
        loading={loading}
        dbName={name}
        docId={docId}
        navigate={navigate}
        onSave={putDoc}
        onDelete={deleteDoc}
        onCreate={createDoc}
        onSeedData={seedData}
        page={page}
        totalDocs={totalDocs}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </MobileProvider>
  );
}
