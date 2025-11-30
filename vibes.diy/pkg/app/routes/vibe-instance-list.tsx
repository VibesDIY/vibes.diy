import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { VibesDiyEnv } from "../config/env.js";
import { useAuth } from "@clerk/clerk-react";
import LoggedOutView from "../components/LoggedOutView.js";
import PublishedVibeCard from "../components/PublishedVibeCard.js";
import { BrutalistCard, VibesButton } from "@vibes.diy/use-vibes-base";

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
    <div className="page-grid-background grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full">
      <div className="flex-1 px-8 py-8">
        <div
          style={{
            maxWidth: "1000px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Header with vibe preview card */}
          <div className="flex gap-6 items-start">
            <div className="flex-shrink-0" style={{ width: "280px" }}>
              <PublishedVibeCard slug={titleId} name={titleId} />
            </div>
            <div className="flex-1">
              <BrutalistCard size="lg">
                <h1 className="text-4xl font-bold mb-2">{titleId}</h1>
                <p className="text-lg">Manage your instances</p>
              </BrutalistCard>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <BrutalistCard size="md">
              <p className="text-red-600 font-medium">{error.message}</p>
            </BrutalistCard>
          )}

          {/* Create Button */}
          <div>
            <VibesButton
              variant="blue"
              onClick={() => setShowCreateDialog(true)}
            >
              + Create New Instance
            </VibesButton>
          </div>

          {/* Create Dialog */}
          {showCreateDialog && (
            <BrutalistCard size="md">
              <h3 className="text-2xl font-bold mb-4">New Instance</h3>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter description..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setShowCreateDialog(false);
                }}
                autoFocus
              />
              <div className="flex gap-3">
                <VibesButton
                  variant="blue"
                  onClick={handleCreate}
                  disabled={isCreating || !newDescription.trim()}
                >
                  {isCreating ? "Creating..." : "Create"}
                </VibesButton>
                <VibesButton
                  variant="gray"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setNewDescription("");
                  }}
                >
                  Cancel
                </VibesButton>
              </div>
            </BrutalistCard>
          )}

          {/* Instances List */}
          {instances.length === 0 ? (
            <BrutalistCard size="md">
              <p className="text-center text-lg">
                No instances yet. Create one to get started!
              </p>
            </BrutalistCard>
          ) : (
            <div className="space-y-4">
              {/* Newest first by createdAt; fallback to _id lexical when createdAt missing */}
              {[...instances]
                .sort((a, b) => {
                  const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
                  const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
                  if (tb !== ta) return tb - ta;
                  return String(b._id).localeCompare(String(a._id));
                })
                .map((instance) => (
                  <BrutalistCard key={instance._id} size="md">
                    {editingId === instance._id ? (
                      <div>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && instance._id)
                              handleUpdate(instance._id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                        <div className="flex gap-3">
                          <VibesButton
                            variant="blue"
                            onClick={() =>
                              instance._id && handleUpdate(instance._id)
                            }
                          >
                            Save
                          </VibesButton>
                          <VibesButton
                            variant="gray"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </VibesButton>
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
                          <h3 className="text-2xl font-bold mb-2">
                            {instance.description}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Created{" "}
                            {instance.createdAt
                              ? new Date(
                                  instance.createdAt,
                                ).toLocaleDateString()
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
                                  · Shared with {shareCount}{" "}
                                  {shareCount === 1 ? "person" : "people"}
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
                            className="px-3 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors font-medium"
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
                  </BrutalistCard>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Auth wrapper component - only renders content when authenticated
export default function VibeInstancesList() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isSignedIn) {
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  // Only render the actual component (which calls useFireproof) when authenticated
  return <VibeInstancesListContent />;
}
