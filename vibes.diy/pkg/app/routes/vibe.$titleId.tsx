import React, { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { useVibeInstances } from "../hooks/useVibeInstances.js";

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

export default function VibeInstancesList() {
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

  const handleCreate = async () => {
    if (!newDescription.trim()) return;

    try {
      const uuid = await createInstance(newDescription.trim());
      setNewDescription("");
      setShowCreateDialog(false);
      // Navigate to the new instance (extract short ID and preserve query params)
      const installId = extractInstallId(uuid, titleId);
      const search = searchParams.toString();
      navigate(`/vibe/${titleId}/${installId}${search ? `?${search}` : ""}`);
    } catch (err) {
      console.error("Failed to create instance:", err);
    }
  };

  const handleUpdate = async (uuid: string) => {
    if (!editDescription.trim()) return;

    try {
      await updateInstance(uuid, { description: editDescription.trim() });
      setEditingId(null);
      setEditDescription("");
    } catch (err) {
      console.error("Failed to update instance:", err);
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm("Are you sure you want to delete this instance?")) return;

    try {
      await deleteInstance(uuid);
    } catch (err) {
      console.error("Failed to delete instance:", err);
    }
  };

  const startEditing = (uuid: string, currentDescription: string) => {
    setEditingId(uuid);
    setEditDescription(currentDescription);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{titleId}</h1>
          <p className="text-gray-600">Manage your instances of this vibe</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error.message}</p>
          </div>
        )}

        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create New Instance
          </button>
        </div>

        {/* Create Dialog */}
        {showCreateDialog && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-3">New Instance</h3>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Enter a description (e.g., 'My work board')"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreateDialog(false);
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={isCreating || !newDescription.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewDescription("");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Instances List */}
        <div className="space-y-3">
          {instances.length === 0 ? (
            <div className="p-8 bg-white border border-gray-200 rounded-lg text-center">
              <p className="text-gray-500">
                No instances yet. Create one to get started!
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
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  {editingId === instance._id ? (
                    <div>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && instance._id)
                            handleUpdate(instance._id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            instance._id && handleUpdate(instance._id)
                          }
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                        >
                          Cancel
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
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {instance.description}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Created{" "}
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
