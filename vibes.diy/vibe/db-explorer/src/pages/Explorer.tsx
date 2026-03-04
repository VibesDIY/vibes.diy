import { useParams } from "react-router-dom";
import { useFireproofDB } from "../hooks/useFireproofDB";
import { DocDBViewer, DocRecord } from "../components/DocDBViewer";
import { MobileProvider } from "../components/MobileProvider";

export function Explorer() {
  const { dbname } = useParams<{ dbname: string }>();
  const name = dbname || "default";

  const {
    docs,
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
        loading={loading}
        dbName={name}
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
