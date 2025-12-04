import React from "react";
import { StarIcon } from "./SessionSidebar/StarIcon.js";
import PublishedVibeCard from "./PublishedVibeCard.js";
import type { LocalVibe } from "../utils/vibeUtils.js";
import { DocFileMeta } from "use-fireproof";

interface MyVibeCardProps {
  vibe: LocalVibe;
  screenshot?: DocFileMeta;
  confirmDelete: string | null;
  onEditClick: (id: string, encodedTitle: string) => void;
  onToggleFavorite: (vibeId: string, e: React.MouseEvent) => Promise<void>;
  onDeleteClick: (vibeId: string, e: React.MouseEvent) => void;
  onRemixClick: (slug: string, e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function MyVibeCard({
  vibe,
  screenshot,
  confirmDelete,
  onEditClick,
  onToggleFavorite,
  onDeleteClick,
  onRemixClick,
}: MyVibeCardProps) {
  // Determine if published
  const isPublished = !!vibe.publishedUrl;

  // Extract slug from publishedUrl if published, otherwise use vibe.id
  const displaySlug =
    isPublished && vibe.publishedUrl
      ? vibe.publishedUrl.split("/").pop()?.split(".")[0] || vibe.id
      : vibe.id;

  return (
    <div className="relative overflow-hidden">
      {/* Base card - PublishedVibeCard */}
      <PublishedVibeCard
        slug={displaySlug}
        name={vibe.title}
        localScreenshot={!isPublished ? screenshot : undefined}
        disableLink={!isPublished}
      />

      {/* Overlay controls - inside the card bounds */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Favorite star - top right */}
        {isPublished && (
          <button
            onClick={(e) => onToggleFavorite(vibe.id, e)}
            className="text-accent-01 absolute right-2 top-2 pointer-events-auto hover:text-yellow-500 focus:outline-none"
            aria-label={
              vibe.favorite ? "Remove from favorites" : "Add to favorites"
            }
          >
            <StarIcon filled={vibe.favorite} />
          </button>
        )}

        {/* Button bar - bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 flex space-x-2 p-2 pointer-events-auto"
          style={{
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(128, 128, 128, 0.2)",
          }}
        >
          <button
            onClick={(e) => onDeleteClick(vibe.id, e)}
            data-action="delete"
            data-vibe-id={vibe.id}
            className={`${confirmDelete === vibe.id ? "bg-red-500 text-white" : "text-red-500"} rounded-md px-3 py-1 text-sm hover:bg-red-500 hover:text-white`}
          >
            {confirmDelete === vibe.id
              ? "Are you Sure? No undo for this."
              : "Delete"}
          </button>
          <div className="flex-grow"></div>
          {isPublished && (
            <button
              onClick={(e) => onRemixClick(vibe.slug, e)}
              className="text-light-secondary dark:text-dark-secondary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 rounded-md px-3 py-1 text-sm"
            >
              Remix
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onEditClick(vibe.id, vibe.encodedTitle);
            }}
            className="text-light-primary bg-light-decorative-01 dark:text-dark-primary dark:bg-dark-decorative-01 rounded-md px-3 py-1 text-sm hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Click-to-edit overlay for unpublished vibes */}
      {!isPublished && (
        <div
          onClick={() => onEditClick(vibe.id, vibe.encodedTitle)}
          className="absolute inset-0 cursor-pointer"
          style={{ zIndex: 1 }}
        />
      )}
    </div>
  );
}
