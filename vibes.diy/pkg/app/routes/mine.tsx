import type { ReactElement } from "react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StarIcon } from "../components/SessionSidebar/StarIcon.js";
import { BrutalistCard } from "../components/vibes/BrutalistCard.js";
import { VibesButton } from "../components/vibes/VibesButton/index.js";
import { VibeCardData } from "../components/VibeCardData.js";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useVibes } from "../hooks/useVibes.js";
import BrutalistLayout from "../components/BrutalistLayout.js";
import LoggedOutView from "../components/LoggedOutView.js";

export function meta() {
  return [
    { title: "My Vibes - Vibes DIY" },
    { name: "description", content: "Your created vibes in Vibes DIY" },
  ];
}

function MyVibesContent(): ReactElement {
  const navigate = useNavigate();
  // Use Clerk's useUser hook
  const { user } = useUser();
  const userId = user?.id;

  // Use our custom hook for vibes state management
  const { vibes, isLoading } = useVibes();
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Filter vibes based on the showOnlyFavorites toggle
  const filteredVibes = useMemo(() => {
    if (showOnlyFavorites) {
      return vibes.filter((vibe) => vibe.favorite);
    }
    return vibes;
  }, [vibes, showOnlyFavorites]);

  // Simple state for how many vibes to show
  const [itemsToShow, setItemsToShow] = useState(9);
  const loadingTriggerRef = useRef<HTMLDivElement>(null);

  // Simple function to load more vibes
  const loadMoreVibes = () => {
    setItemsToShow((prev) => Math.min(prev + 9, filteredVibes.length));
  };

  // Infinite scroll detection
  useEffect(() => {
    if (!loadingTriggerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && itemsToShow < filteredVibes.length) {
          loadMoreVibes();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(loadingTriggerRef.current);
    return () => observer.disconnect();
  }, [itemsToShow, filteredVibes.length]);

  return (
    <BrutalistLayout
      title="My Vibes"
      subtitle={
        userId ? (
          <>
            Published and favorited vibes on your{" "}
            <a
              href={`/~${userId}`}
              className="text-blue-500 hover:text-blue-600 underline"
            >
              vibespace
            </a>
          </>
        ) : (
          "Your created vibes"
        )
      }
      headerActions={
        <button
          onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
          className="flex items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          title={showOnlyFavorites ? "Show all vibes" : "Show favorites only"}
          aria-label={
            showOnlyFavorites ? "Show all vibes" : "Show favorites only"
          }
        >
          <StarIcon
            filled={showOnlyFavorites}
            className={`h-5 w-5 transition-colors duration-300 ${showOnlyFavorites ? "text-yellow-500" : "text-gray-600"} hover:text-yellow-400`}
          />
          <span className="text-sm">
            {showOnlyFavorites ? "Favorites" : "All"}
          </span>
        </button>
      }
    >
      {/* Loading State */}
      {isLoading ? (
        <BrutalistCard size="md">
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </BrutalistCard>
      ) : filteredVibes.length === 0 ? (
        <BrutalistCard size="md">
          <div className="text-center py-8">
            <p className="mb-4 text-lg">
              {showOnlyFavorites
                ? "You don't have any favorite vibes yet"
                : "You don't have any vibes yet"}
            </p>
            <VibesButton variant="blue" onClick={() => navigate("/")}>
              Create a Vibe
            </VibesButton>
          </div>
        </BrutalistCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Render vibes with simple slicing */}
          {filteredVibes.slice(0, itemsToShow).map((vibe) => (
            <BrutalistCard key={vibe.id} size="sm">
              <VibeCardData vibeId={vibe.id} />
            </BrutalistCard>
          ))}

          {/* Invisible loading trigger for infinite scroll */}
          {itemsToShow < filteredVibes.length && (
            <div
              ref={loadingTriggerRef}
              className="col-span-full h-4"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </BrutalistLayout>
  );
}

// Auth wrapper component
export default function MyVibesRoute() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isSignedIn) {
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  return <MyVibesContent />;
}
