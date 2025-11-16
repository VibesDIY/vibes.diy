import type { ReactElement } from "react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StarIcon } from "../components/SessionSidebar/StarIcon.js";
import { EditIcon } from "../components/ChatHeaderIcons.js";
import SimpleAppLayout from "../components/SimpleAppLayout.js";
import { VibeCardData } from "../components/VibeCardData.js";
import VibesDIYLogo from "../components/VibesDIYLogo.js";
import { useUser } from "@clerk/clerk-react";
import { useVibes } from "../hooks/useVibes.js";

export function meta() {
  return [
    { title: "My Vibes - Vibes DIY" },
    { name: "description", content: "Your created vibes in Vibes DIY" },
  ];
}

export default function MyVibesRoute(): ReactElement {
  const navigate = useNavigate();
  // Removed useSession() call since this route doesn't need session context

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
    <>
      {/* New Vibe button positioned independently at top right */}
      <div className="fixed top-4 right-4 z-50">
        <a
          href="/"
          className="peer bg-accent-02-light dark:bg-accent-02-dark hover:bg-accent-03-light dark:hover:bg-accent-03-dark flex cursor-pointer items-center justify-center rounded-full p-2.5 text-white transition-colors"
          aria-label="New Vibe"
          title="New Vibe"
        >
          <span className="sr-only">New Vibe</span>
          <EditIcon />
        </a>
        <span className="bg-dark-background-01 pointer-events-none absolute top-full right-0 z-100 mt-1 rounded-sm px-2 py-1 text-sm whitespace-nowrap text-white opacity-0 transition-opacity peer-hover:opacity-100">
          New Vibe
        </span>
      </div>

      <SimpleAppLayout
        headerLeft={
          <div className="flex items-center">
            <a
              href="/"
              className="flex items-center px-2 py-1 hover:opacity-80"
              title="Home"
            >
              <VibesDIYLogo width={100} className="pointer-events-none" />
            </a>
          </div>
        }
      >
        {/* Content goes here */}
        <div className="container mx-auto p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="mb-4 text-2xl font-bold">My Vibes</h2>
                {userId && (
                  <p className="text-accent-01 dark:text-accent-01 mb-6">
                    Published and favorited vibes are listed on your{" "}
                    <a
                      href={`/~${userId}`}
                      className="text-light-primary dark:text-dark-primary hover:text-blue-500"
                    >
                      vibespace
                    </a>
                  </p>
                )}
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 focus:outline-none"
                  title={
                    showOnlyFavorites ? "Show all vibes" : "Show favorites only"
                  }
                  aria-label={
                    showOnlyFavorites ? "Show all vibes" : "Show favorites only"
                  }
                >
                  <StarIcon
                    filled={showOnlyFavorites}
                    className={`h-5 w-5 transition-colors duration-300 ${showOnlyFavorites ? "text-yellow-500" : "text-accent-01"} hover:text-yellow-400`}
                  />
                  <span>
                    {!showOnlyFavorites
                      ? "Showing All Vibes"
                      : "Showing Favorites Only"}
                  </span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : filteredVibes.length === 0 ? (
              <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-md border py-8 text-center">
                <p className="mb-4 text-lg">
                  {showOnlyFavorites
                    ? "You don't have any favorite vibes yet"
                    : "You don't have any vibes yet"}
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
                >
                  Create a Vibe
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Render vibes with simple slicing */}
                {filteredVibes.slice(0, itemsToShow).map((vibe) => (
                  <VibeCardData key={vibe.id} vibeId={vibe.id} />
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
          </div>
        </div>
      </SimpleAppLayout>
    </>
  );
}
