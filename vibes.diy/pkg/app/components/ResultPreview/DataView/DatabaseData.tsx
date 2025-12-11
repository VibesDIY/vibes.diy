import React, { useEffect, useState } from "react";
import DynamicTable from "./DynamicTable.js";
import { headersForDocs } from "./dynamicTableHelpers.js";
// Import Fireproof for database access
import { DocBase, useFireproof } from "@fireproof/use-fireproof";

// Component for displaying database data
const DatabaseData: React.FC<{ dbName: string; sessionId: string }> = ({
  dbName,
  sessionId,
}) => {
  if (!dbName) {
    throw new Error("No valid database name provided");
  }

  const [availableDbs, setAvailableDbs] = useState<string[]>([]);

  // Function to list available databases with the current session ID
  const listSessionDatabases = async () => {
    try {
      // Check if the databases API is available
      if (typeof window.indexedDB.databases !== "function") {
        setAvailableDbs(["API not supported in this browser"]);
        return;
      }

      // Get all available databases
      const databases = await window.indexedDB.databases();
      const dbNames = databases
        .map((db) => db.name)
        .filter(Boolean) as string[];

      // Filter for databases with this session ID
      const sessionMatches = dbNames.filter((name) =>
        name?.includes(sessionId),
      );
      setAvailableDbs(sessionMatches);
    } catch (err) {
      console.error("Error listing databases:", err);
      setAvailableDbs(["Error: " + (err as Error).message]);
    }
  };

  useEffect(() => {
    // Load the initial database list
    listSessionDatabases();
  }, []);

  const { database } = useFireproof(dbName);

  const [docs, setDocs] = useState<DocBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Fetch documents function - separated so it can be called manually if needed
  const fetchDocs = async () => {
    try {
      setIsLoading(true);

      // Try direct document access
      const result = await database.allDocs();

      // Extract docs from the result based on Fireproof's API
      const extractedDocs = result.rows
        .filter((row) => row && row.value)
        .map((row) => row.value);

      setDocs(extractedDocs);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch is sufficient, users can reload page to refresh

  // Initial fetch when database is ready
  useEffect(() => {
    if (database && database.name) {
      fetchDocs();
    }
  }, [database?.name]); // Only depend on database name to avoid dependency loops

  const headers = docs.length > 0 ? headersForDocs(docs) : [];

  // Create a simple debug display component
  const DbDebugInfo = () => (
    <details className="mb-2 text-sm">
      <summary className="cursor-pointer text-blue-500 hover:text-blue-700">
        Database Inspection Details
      </summary>
      <div className="border-light-decorative-01 mt-1 border-l-2 pl-2">
        <p>
          <strong>Original DB Name:</strong> {dbName}
        </p>
        <p>
          <strong>Session ID:</strong> {sessionId}
        </p>
        <p>
          <strong>Current DB Name:</strong> {database.name}
        </p>
        <div className="mt-1">
          <p>
            <strong>Session Databases ({availableDbs.length}):</strong>
          </p>
          <button
            onClick={() => listSessionDatabases()}
            className="mr-2 mb-2 rounded-sm bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-700"
          >
            Refresh DB List
          </button>
          <span className="text-accent-02 text-xs">
            (Filtered by session ID: {sessionId})
          </span>
          <ul className="mt-1 list-disc pl-4">
            {availableDbs.map((name, idx) => (
              <li key={idx}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );

  // Loading state UI
  if (isLoading) {
    return (
      <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 rounded-md p-4">
        <DbDebugInfo />
        <p>Loading data from {database.name}...</p>
        <p className="mt-2 text-xs text-gray-500">
          Loading state: {String(isLoading)}
        </p>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 rounded-md p-4">
        <DbDebugInfo />
        <p>No data found in database {database.name}</p>
      </div>
    );
  }

  return (
    <div className="">
      <DbDebugInfo />

      <DynamicTable
        headers={headers}
        rows={docs}
        dbName={database.name}
        // hrefFn={() => "#"}
      />
    </div>
  );
};

export default DatabaseData;
