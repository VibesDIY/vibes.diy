import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DocDBViewer, DocRecord } from "../components/DocDBViewer.js";
import { MobileProvider } from "../components/MobileProvider.js";
import { useFireproofDB } from "../hooks/useFireproofDB.js";
import { useIndexedDBList } from "../hooks/useIndexedDBList.js";

export function Explorer() {
  const { dbname, docId } = useParams<{ dbname: string; docId?: string }>();
  const { databases, loading: discovering } = useIndexedDBList();
  const [selectedDb, setSelectedDb] = useState(dbname);
  const [userSwitched, setUserSwitched] = useState(false);

  useEffect(() => {
    if (!userSwitched && !discovering && databases.length > 0) {
      setSelectedDb(databases[0]);
    }
  }, [discovering, databases, userSwitched]);

  const handleDbChange = (db: string) => {
    setUserSwitched(true);
    setSelectedDb(db);
  };

  if (!selectedDb) {
    return <div>No databases Found</div>;
  }

  return <ExplorerWithDB key={selectedDb} dbname={selectedDb} docId={docId} databases={databases} onDbChange={handleDbChange} />;
}

function ExplorerWithDB({
  dbname,
  docId,
  databases,
  onDbChange,
}: {
  dbname: string;
  docId?: string;
  databases: string[];
  onDbChange: (db: string) => void;
}) {
  const { docs, docById, loading, totalDocs, putDoc, deleteDoc, createDoc, seedData } = useFireproofDB(dbname);
  const navigate = useNavigate();

  return (
    <MobileProvider>
      <DocDBViewer
        docs={docs as DocRecord[]}
        docById={docById as Map<string, DocRecord>}
        loading={loading}
        dbName={dbname}
        docId={docId}
        navigate={navigate}
        onSave={putDoc}
        onDelete={deleteDoc}
        onCreate={createDoc}
        onSeedData={seedData}
        totalDocs={totalDocs}
        databases={databases}
        onDbChange={onDbChange}
      />
    </MobileProvider>
  );
}
