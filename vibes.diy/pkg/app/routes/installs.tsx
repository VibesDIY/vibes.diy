import React from "react";
import { useNavigate } from "react-router";
import { useAllInstances } from "../hooks/useAllInstances.js";
import PublishedVibeCard from "../components/PublishedVibeCard.js";

export function meta() {
  return [
    { title: "My Installs | Vibes DIY" },
    { name: "description", content: "View all your vibe installations" },
  ];
}

/**
 * Extract the titleId and installId from the full _id (titleId-installId format)
 */
function parseInstanceId(fullId: string): {
  titleId: string;
  installId: string;
} {
  const parts = fullId.split("-");
  if (parts.length < 2) {
    return { titleId: fullId, installId: "" };
  }
  // Find the last hyphen - everything before is titleId, everything after is installId
  const lastHyphenIndex = fullId.lastIndexOf("-");
  const titleId = fullId.slice(0, lastHyphenIndex);
  const installId = fullId.slice(lastHyphenIndex + 1);
  return { titleId, installId };
}

export default function InstallsRoute() {
  const navigate = useNavigate();
  const { instances, isLoading } = useAllInstances();

  const handleInstanceClick = (fullId: string) => {
    const { titleId, installId } = parseInstanceId(fullId);
    navigate(`/vibe/${titleId}/${installId}`);
  };

  return (
    <div className="min-h-screen bg-yellow-50 p-8">
      <div className="max-w-6xl mx-auto bg-white border-8 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="mb-8 border-8 border-black p-6 bg-white">
          <h1 className="text-5xl font-black uppercase tracking-tight">
            MY INSTALLS
          </h1>
          <p className="text-xl font-bold uppercase tracking-wide mt-2">
            ALL YOUR VIBE INSTALLATIONS
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 bg-white border-4 border-black text-center">
            <p className="text-xl font-black uppercase">LOADING...</p>
          </div>
        )}

        {/* Instances List */}
        {!isLoading && (
          <div>
            {instances.length === 0 ? (
              <div className="p-8 bg-white border-4 border-black text-center">
                <p className="text-xl font-black uppercase">
                  NO INSTALLS YET...
                </p>
                <p className="text-sm font-bold uppercase mt-2">
                  Visit a vibe to create your first install
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Sort by most recently updated */}
                {[...instances]
                  .sort((a, b) => {
                    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
                    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
                    if (tb !== ta) return tb - ta;
                    // Fallback to _id
                    return String(b._id).localeCompare(String(a._id));
                  })
                  .map((instance) => {
                    const { titleId } = parseInstanceId(instance._id || "");
                    return (
                      <div
                        key={instance._id}
                        onClick={() =>
                          instance._id && handleInstanceClick(instance._id)
                        }
                        className="cursor-pointer hover:scale-105 transition-transform"
                      >
                        <PublishedVibeCard
                          slug={titleId}
                          name={instance.description || titleId}
                        />
                        <div className="mt-2 px-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
                            Updated{" "}
                            {instance.updatedAt
                              ? new Date(
                                  instance.updatedAt,
                                ).toLocaleDateString()
                              : "—"}
                            {(() => {
                              const shareCount = (instance.sharedWith ?? [])
                                .length;
                              return shareCount > 0 ? (
                                <span className="ml-1">
                                  · Shared with {shareCount}
                                </span>
                              ) : null;
                            })()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
