import React, { useCallback } from "react";
import { useNavigate } from "react-router";
import { useAllGroups } from "../hooks/useAllGroups.js";
import PublishedVibeCard from "../components/PublishedVibeCard.js";
import { BrutalistCard } from "@vibes.diy/use-vibes-base";
import { useAuth } from "@clerk/clerk-react";
import LoggedOutView from "../components/LoggedOutView.js";
import BrutalistLayout from "../components/BrutalistLayout.js";

export function meta() {
  return [
    { title: "My Groups | Vibes DIY" },
    { name: "description", content: "View all your vibe groups" },
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

const GroupsContent = React.memo(function GroupsContent() {
  console.log("[GroupsContent] Component rendering");
  const navigate = useNavigate();
  console.log("[GroupsContent] Got navigate function");
  console.log("[GroupsContent] Calling useAllGroups");
  const { groups, isLoading } = useAllGroups();
  console.log(
    "[GroupsContent] Got groups:",
    groups.length,
    "isLoading:",
    isLoading,
  );

  // Memoize handleGroupClick to prevent recreation
  const handleGroupClick = useCallback(
    (fullId: string) => {
      const { titleId, installId } = parseInstanceId(fullId);
      navigate(`/vibe/${titleId}/${installId}`);
    },
    [navigate],
  );

  return (
    <BrutalistLayout title="My Groups" subtitle="All your vibe groups">
      {/* Loading State */}
      {isLoading && (
        <BrutalistCard size="md">
          <p className="text-center text-lg">Loading...</p>
        </BrutalistCard>
      )}

      {/* Groups List */}
      {!isLoading && (
        <div>
          {groups.length === 0 ? (
            <BrutalistCard size="md">
              <p className="text-center text-lg">
                No groups yet. Visit a vibe to create your first group!
              </p>
            </BrutalistCard>
          ) : (
            <div className="space-y-4">
              {/* Sort by most recently updated */}
              {[...groups]
                .sort((a, b) => {
                  const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
                  const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
                  if (tb !== ta) return tb - ta;
                  // Fallback to _id
                  return String(b._id).localeCompare(String(a._id));
                })
                .map((group) => {
                  const { titleId } = parseInstanceId(group._id || "");
                  return (
                    <BrutalistCard key={group._id} size="md">
                      <div
                        className="cursor-pointer"
                        onClick={() => group._id && handleGroupClick(group._id)}
                      >
                        <div className="flex gap-4 items-start">
                          <div
                            className="flex-shrink-0"
                            style={{ width: "200px" }}
                          >
                            <PublishedVibeCard
                              slug={titleId}
                              name={group.description || titleId}
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-2xl font-bold mb-2">
                              {group.description || titleId}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Updated{" "}
                              {group.updatedAt
                                ? new Date(group.updatedAt).toLocaleDateString()
                                : "—"}
                              {(() => {
                                const shareCount = (group.sharedWith ?? [])
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
                        </div>
                      </div>
                    </BrutalistCard>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </BrutalistLayout>
  );
});

// Auth wrapper component - only renders content when authenticated
export default function GroupsRoute() {
  console.log("[GroupsRoute] Route component rendering");
  const authResult = useAuth();
  const { isSignedIn, isLoaded } = authResult;
  console.log("[GroupsRoute] useAuth returned new object:", authResult);
  console.log("[GroupsRoute] isSignedIn:", isSignedIn, "isLoaded:", isLoaded);

  if (!isSignedIn) {
    console.log("[GroupsRoute] Not signed in, showing logged out view");
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  // Only render the actual component (which calls useFireproof) when authenticated
  console.log("[GroupsRoute] Rendering GroupsContent");
  return <GroupsContent />;
}
