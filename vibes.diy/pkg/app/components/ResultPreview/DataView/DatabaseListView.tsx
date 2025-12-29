import React, { useMemo } from "react";
import DatabaseData from "./DatabaseData.js";

// Component to find and display database names from app code
function DatabaseListView({
  appCode,
  sessionId,
}: {
  appCode: string;
  sessionId: string;
}) {
  // Extract first 50 lines using memoization
  const firstFiftyLines = useMemo(() => {
    if (!appCode) return "";
    return appCode.split("\n").slice(0, 50).join("\n");
  }, [appCode]);

  // Extract database names from first 50 lines using memoization
  const databaseName = useMemo(() => {
    if (!firstFiftyLines) return null;

    // Find useFireproof calls in the code
    const regex = /useFireproof\(\s*['"`]([^'"`)]*)['"`]\s*\)/g;
    let match = regex.exec(firstFiftyLines);
    if (match?.[1]) return match[1];

    // Also look for database names defined as variables
    const dbNameRegex =
      /const\s+([a-zA-Z0-9_]+)\s*=\s*['"`]([a-zA-Z0-9_-]+)['"`].*useFireproof\(\s*\1\s*\)/g;
    match = dbNameRegex.exec(firstFiftyLines);
    return match?.[2] || null;
  }, [firstFiftyLines]);

  // Clean view with clear separation of concerns
  return (
    <div>
      {databaseName && (
        <div className="p-2">
          <h2 className="mb-2 text-lg font-medium">
            Data stored in <span className="font-mono">{databaseName}</span>
          </h2>
          {sessionId && (
            <DatabaseData
              dbName={databaseName}
              key={databaseName}
              sessionId={sessionId}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default DatabaseListView;
