import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { VibesDiyEnv } from "../config/env.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useAuthPopup } from "../hooks/useAuthPopup.js";
import LoggedOutView from "../components/LoggedOutView.js";

export function meta({ params }: { params: { titleId: string } }) {
  return [
    { title: `${params.titleId} - Instances | Vibes DIY` },
    { name: "description", content: `Manage instances of ${params.titleId}` },
  ];
}

/**
 * Extract the short installId from the full _id (titleId-installId format)
 */
function extractInstallId(fullId: string, titleId: string): string {
  // _id format: ${titleId}-${installId}
  // Remove the titleId prefix and the hyphen
  const prefix = `${titleId}-`;
  return fullId.startsWith(prefix) ? fullId.slice(prefix.length) : fullId;
}

function VibeInstancesListContent() {
  const { titleId } = useParams<{ titleId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");

  if (!titleId) {
    return (
      <div className="p-8">
        <p className="text-red-600">No title ID provided</p>
      </div>
    );
  }

  const {
    instances,
    isCreating,
    error,
    createInstance,
    updateInstance,
    deleteInstance,
  } = useVibeInstances(titleId);

  // Auto-navigate based on instance count
  const hasAutoNavigated = useRef(false);
  const lastTitleId = useRef(titleId);

  // Reset auto-navigation flag when titleId changes
  if (lastTitleId.current !== titleId) {
    hasAutoNavigated.current = false;
    lastTitleId.current = titleId;
  }

  useEffect(() => {
    // Only auto-navigate once, and only after instances have loaded
    if (hasAutoNavigated.current || isCreating) return;

    // Wait 200ms for database to load before checking instance count
    const timeoutId = setTimeout(() => {
      const search = searchParams.toString();
      const searchSuffix = search ? `?${search}` : "";

      if (instances.length === 0) {
        // No instances: create one called "Begin" and navigate to it
        hasAutoNavigated.current = true;
        createInstance("Begin").then((fullId) => {
          const installId = extractInstallId(fullId, titleId);
          navigate(`/vibe/${titleId}/${installId}${searchSuffix}`);
        });
      } else if (instances.length === 1) {
        // Exactly 1 instance: navigate directly to it
        hasAutoNavigated.current = true;
        const instance = instances[0];
        const installId = extractInstallId(instance._id || "", titleId);
        navigate(`/vibe/${titleId}/${installId}${searchSuffix}`);
      }
      // If 2+ instances: do nothing, show the list
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [instances, isCreating, titleId, navigate, searchParams, createInstance]);

  const handleCreate = async () => {
    if (!newDescription.trim()) return;

    const fullId = await createInstance(newDescription.trim());
    setNewDescription("");
    setShowCreateDialog(false);
    // Navigate to the new instance (extract short ID and preserve query params)
    const installId = extractInstallId(fullId, titleId);
    const search = searchParams.toString();
    navigate(`/vibe/${titleId}/${installId}${search ? `?${search}` : ""}`);
  };

  const handleUpdate = async (fullId: string) => {
    if (!editDescription.trim()) return;

    await updateInstance(fullId, { description: editDescription.trim() });
    setEditingId(null);
    setEditDescription("");
  };

  const handleDelete = async (fullId: string) => {
    if (!confirm("Are you sure you want to delete this instance?")) return;

    await deleteInstance(fullId);
  };

  const startEditing = (fullId: string, currentDescription: string) => {
    setEditingId(fullId);
    setEditDescription(currentDescription);
  };

  // Get hosting domain for screenshot URL
  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return "vibesdiy.app";
    }
  };
  const hostname = getHostname(VibesDiyEnv.APP_HOST_BASE_URL());
  const screenshotUrl = `https://${titleId}.${hostname}/screenshot.png`;

  return (
    <div className="min-h-screen bg-yellow-50 p-8">
      <div className="max-w-6xl mx-auto bg-white border-8 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        {/* Header with Screenshot - BRUTALIST */}
        <div className="mb-6 border-8 border-black p-6 bg-white">
          <div className="flex gap-8 items-start">
            <div className="flex-shrink-0 w-64 border-4 border-black">
              <img
                src={screenshotUrl}
                alt={`${titleId} screenshot`}
                className="w-full block"
                onError={(e) => {
                  // Hide image on error
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex-1">
              <h1 className="text-5xl font-black uppercase mb-4 tracking-tight">
                {titleId}
              </h1>
              <p className="text-xl font-bold uppercase tracking-wide">
                MANAGE YOUR INSTANCES
              </p>
            </div>
          </div>
        </div>

        {/* Error Display - BRUTALIST */}
        {error && (
          <div className="mb-6 border-4 border-black bg-white p-6">
            <p className="text-xl font-black uppercase">{error.message}</p>
          </div>
        )}

        {/* Create Button - BRUTALIST */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-8 py-4 bg-black text-white font-black uppercase text-lg border-4 border-black hover:bg-white hover:text-black transition-colors"
          >
            + CREATE NEW INSTANCE
          </button>
        </div>

        {/* Create Dialog - BRUTALIST */}
        {showCreateDialog && (
          <div className="mb-6 p-6 bg-white border-8 border-black">
            <h3 className="text-2xl font-black uppercase mb-4 tracking-tight">
              NEW INSTANCE
            </h3>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="ENTER DESCRIPTION"
              className="w-full px-4 py-3 border-4 border-black mb-4 font-bold uppercase focus:outline-none focus:ring-0 focus:border-black"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreateDialog(false);
              }}
              autoFocus
            />
            <div className="flex gap-4">
              <button
                onClick={handleCreate}
                disabled={isCreating || !newDescription.trim()}
                className="px-6 py-3 bg-black text-white font-black uppercase border-4 border-black hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? "CREATING..." : "CREATE"}
              </button>
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewDescription("");
                }}
                className="px-6 py-3 bg-white text-black font-black uppercase border-4 border-black hover:bg-black hover:text-white transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Instances List - BRUTALIST */}
        <div className="space-y-4">
          {instances.length === 0 ? (
            <div className="p-8 bg-white border-4 border-black text-center">
              <p className="text-xl font-black uppercase">
                NO INSTANCES YET. CREATE ONE TO GET STARTED!
              </p>
            </div>
          ) : (
            // Newest first by createdAt; fallback to _id lexical when createdAt missing
            [...instances]
              .sort((a, b) => {
                const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
                const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
                if (tb !== ta) return tb - ta;
                return String(b._id).localeCompare(String(a._id));
              })
              .map((instance) => (
                <div
                  key={instance._id}
                  className="p-6 bg-white border-4 border-black hover:border-8 transition-all"
                >
                  {editingId === instance._id ? (
                    <div>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-4 py-3 border-4 border-black mb-4 font-bold uppercase focus:outline-none focus:ring-0"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && instance._id)
                            handleUpdate(instance._id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() =>
                            instance._id && handleUpdate(instance._id)
                          }
                          className="px-6 py-2 bg-black text-white font-black uppercase border-4 border-black hover:bg-white hover:text-black transition-colors"
                        >
                          SAVE
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-6 py-2 bg-white text-black font-black uppercase border-4 border-black hover:bg-black hover:text-white transition-colors"
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => {
                          const installId = extractInstallId(
                            instance._id || "",
                            titleId,
                          );
                          const search = searchParams.toString();
                          navigate(
                            `/vibe/${titleId}/${installId}${search ? `?${search}` : ""}`,
                          );
                        }}
                      >
                        <h3 className="text-2xl font-black uppercase mb-2 tracking-tight">
                          {instance.description}
                        </h3>
                        <p className="text-sm font-bold uppercase tracking-wider">
                          CREATED{" "}
                          {instance.createdAt
                            ? new Date(instance.createdAt).toLocaleDateString()
                            : instance.updatedAt
                              ? new Date(
                                  instance.updatedAt,
                                ).toLocaleDateString()
                              : "—"}
                          {(() => {
                            const shareCount = (instance.sharedWith ?? [])
                              .length;
                            return shareCount > 0 ? (
                              <span className="ml-2">
                                · SHARED WITH {shareCount}{" "}
                                {shareCount === 1 ? "PERSON" : "PEOPLE"}
                              </span>
                            ) : null;
                          })()}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() =>
                            instance._id &&
                            startEditing(instance._id, instance.description)
                          }
                          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            const installId = extractInstallId(
                              instance._id || "",
                              titleId,
                            );
                            const search = searchParams.toString();
                            navigate(
                              `/vibe/${titleId}/${installId}${search ? `?${search}` : ""}`,
                            );
                          }}
                          className="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded transition-colors"
                        >
                          Open
                        </button>
                        <button
                          onClick={() =>
                            instance._id && handleDelete(instance._id)
                          }
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

// Auth wrapper component - only renders content when authenticated
export default function VibeInstancesList() {
  const { isAuthenticated, isLoading, setNeedsLogin } = useAuth();
  const { initiateLogin } = useAuthPopup();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setNeedsLogin(true);
    }
  }, [isAuthenticated, isLoading, setNeedsLogin]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-700 text-lg">Checking authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoggedOutView
        onLogin={initiateLogin}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
      />
    );
  }

  // Only render the actual component (which calls useFireproof) when authenticated
  return <VibeInstancesListContent />;
}
