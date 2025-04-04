import { useEffect, useRef, memo, useState } from 'react';
import { useSessionList } from '../hooks/sidebar/useSessionList';
import { ImgFile } from './SessionSidebar/ImgFile';
import { StarIcon } from './SessionSidebar/StarIcon';
import { GearIcon } from './SessionSidebar/GearIcon';
import { encodeTitle } from './SessionSidebar/utils';
import type { SessionSidebarProps } from '../types/chat';
import { incrementDatabaseVersion } from '../config/env';

/**
 * Component that displays a collapsible sidebar with chat session history
 */
function SessionSidebar({ isVisible, onClose }: SessionSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const [justFavorites, setJustFavorites] = useState(false);

  // Use the custom hook instead of direct database queries
  const { database, groupedSessions } = useSessionList(justFavorites);

  // Handle clicks outside the sidebar to close it
  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Toggle favorite status for a session
  const toggleFavorite = async (session: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const updatedSession = {
        ...session,
        favorite: !session.favorite,
      };
      await database.put(updatedSession);
    } catch (error) {
      console.error('Error toggling favorite status:', error);
    }
  };

  // Render session items with Link components
  const renderSessionItems = () => {
    return groupedSessions.map(({ session, screenshots }) => {
      // Skip if this isn't a session document
      if (!session || !('_id' in session)) {
        return null;
      }

      const title = session.title || 'Untitled Chat';
      const encodedTitle = encodeTitle(title);

      // first and last screenshots, if they exist, and unique
      const shownScreenshots = [screenshots[0], screenshots[screenshots.length - 1]]
        .filter((screenshot) => screenshot !== undefined)
        .filter(
          (screenshot, index, self) => self.findIndex((t) => t._id === screenshot._id) === index
        );

      return (
        <li
          key={session._id}
          className="cursor-pointer border-b border-gray-200 p-3 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <a
            href={`/chat/${session._id}/${encodedTitle}`}
            className="block"
            onClick={() => onClose()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{title}</div>
              <button
                onClick={(e) => toggleFavorite(session, e)}
                className="ml-2 text-gray-400 hover:text-yellow-500 focus:outline-none"
                aria-label={session.favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <StarIcon filled={session.favorite} />
              </button>
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {new Date(session.created_at).toLocaleString()}
            </div>
            {shownScreenshots.map(
              (screenshot) =>
                screenshot._files?.screenshot && (
                  <ImgFile
                    key={screenshot._id}
                    file={screenshot._files.screenshot}
                    alt={`Screenshot from ${title}`}
                    className="mt-2"
                  />
                )
            )}
          </a>
        </li>
      );
    });
  };

  // Conditionally render content but keep animation classes
  return (
    <div
      ref={sidebarRef}
      className={`bg-light-background-00 dark:bg-dark-background-00 fixed top-0 left-0 z-10 h-full shadow-lg transition-all duration-300 ${
        isVisible ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'
      }`}
    >
      <div className="flex h-full flex-col overflow-scroll">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2
            className="text-light-primary dark:text-dark-primary cursor-pointer text-lg font-semibold"
            onClick={() => {
              const now = Date.now();
              const timeSinceLastTap = now - lastTapRef.current;

              // Check if it's a double tap (within 300ms)
              if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
                const newVersion = incrementDatabaseVersion();
                console.log(`Database version incremented to: ${newVersion}`);
                window.location.reload();
              }

              // Update last tap time
              lastTapRef.current = now;
            }}
          >
            My Vibes
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setJustFavorites(!justFavorites)}
              className="focus:outline-none"
              title={justFavorites ? 'Show all sessions' : 'Show favorites only'}
              aria-label={justFavorites ? 'Show all sessions' : 'Show favorites only'}
            >
              <StarIcon
                filled={justFavorites}
                className={`h-5 w-5 transition-colors duration-300 ${justFavorites ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-400`}
              />
            </button>
            <a
              href="/settings"
              onClick={() => onClose()}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              title="Settings"
              aria-label="Settings"
            >
              <GearIcon className="h-5 w-5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-light-primary dark:text-dark-primary hover:text-accent-02-light dark:hover:text-accent-02-dark"
              aria-label="Close sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-2">
          {groupedSessions.length === 0 ? (
            <p className="text-light-secondary dark:text-dark-secondary p-2 text-sm">
              No saved sessions yet
            </p>
          ) : (
            <ul className="space-y-2">{renderSessionItems()}</ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export default memo(SessionSidebar, (prevProps, nextProps) => {
  // Only re-render if isVisible changes
  // Note: Functions should be memoized by parent components
  return prevProps.isVisible === nextProps.isVisible && prevProps.onClose === nextProps.onClose;
});
