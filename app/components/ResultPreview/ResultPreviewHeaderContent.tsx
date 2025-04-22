import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSession } from '../../hooks/useSession';
import type { ViewType } from '../../utils/ViewState';
import { useViewState } from '../../utils/ViewState';
import { type TokenPayload, initiateAuthFlow, parseToken, verifyToken } from '../../utils/auth';
import {
  BackArrowIcon,
  CodeIcon,
  DataIcon,
  PreviewIcon,
  PublishIcon,
  UserIcon,
} from '../HeaderContent/SvgIcons';
import { PublishMenu } from '../PublishMenu';
import { UserMenu } from '../UserMenu';
import { publishApp } from '../../utils/publishUtils';
import { trackAuthClick } from '../../utils/analytics';

interface ResultPreviewHeaderContentProps {
  previewReady: boolean;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  isStreaming: boolean;
  code: string;
  setMobilePreviewShown: (shown: boolean) => void;
  setUserClickedBack?: (clicked: boolean) => void;
  sessionId?: string;
  title?: string;
  isIframeFetching?: boolean;
  needsLogin?: boolean;
}

const ResultPreviewHeaderContent: React.FC<ResultPreviewHeaderContentProps> = ({
  previewReady,
  activeView,
  setActiveView,
  isStreaming,
  code,
  setMobilePreviewShown,
  setUserClickedBack,
  sessionId: propSessionId,
  title: propTitle,
  isIframeFetching = false,
  needsLogin = false,
}) => {
  const { sessionId: urlSessionId, view: urlView } = useParams();
  const [userInfo, setUserInfo] = useState<TokenPayload | null>(null);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPublishMenuOpen, setIsPublishMenuOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const publishButtonRef = useRef<HTMLButtonElement>(null);

  // Use props if provided, otherwise use params from the URL
  const sessionId = propSessionId || urlSessionId;
  const title = propTitle || urlView;

  // Use the session hook to get and update session data
  const { session, docs: messages, updatePublishedUrl } = useSession(sessionId);

  // Initialize publishedAppUrl from session data if available
  const [publishedAppUrl, setPublishedAppUrl] = useState<string | undefined>(session.publishedUrl);

  // Update publishedAppUrl when session data changes
  useEffect(() => {
    if (session.publishedUrl) {
      setPublishedAppUrl(session.publishedUrl);
    }
  }, [session.publishedUrl]);

  // Use the new ViewState hook to manage all view-related state and navigation
  const { currentView, displayView, navigateToView, viewControls, showViewControls, encodedTitle } =
    useViewState({
      sessionId,
      title,
      code,
      isStreaming,
      previewReady,
      isIframeFetching,
    });

  // When displayView changes, update activeView to match
  useEffect(() => {
    if (activeView !== displayView) {
      setActiveView(displayView);
    }
  }, [displayView, activeView, setActiveView]);

  useEffect(() => {
    const checkAuth = async () => {
      setIsVerifying(true);
      try {
        const token = localStorage.getItem('auth_token');

        // If we have a token and it's valid, use it
        if (token && (await verifyToken(token))) {
          const payload = parseToken(token);
          if (payload && payload.exp > Date.now()) {
            setUserInfo(payload);
            setIsUserAuthenticated(true);
            setIsVerifying(false);
            return;
          }
        }

        // Token is missing, invalid, or expired - show Connect button

        localStorage.removeItem('auth_token');
        setIsUserAuthenticated(false);
      } catch (error) {
        console.error('Authentication error:', error);
        localStorage.removeItem('auth_token');
        setIsUserAuthenticated(false);
      } finally {
        setIsVerifying(false);
      }
    };

    checkAuth();
  }, []);

  const handleAuthCheck = async () => {
    if (isVerifying) return; // Prevent action while verifying

    // Track Share/Get Credits click
    trackAuthClick({
      label: needsLogin ? 'Get Credits' : 'Share',
      isUserAuthenticated,
      userId: userInfo?.userId,
    });

    if (isUserAuthenticated) {
      setIsMenuOpen((open) => !open);
    } else {
      // Use the dedicated function to initiate auth flow
      initiateAuthFlow();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsUserAuthenticated(false);
    setUserInfo(null);
    setIsMenuOpen(false);
  };

  const handlePublish = async () => {
    // if (!userInfo?.userId) return;
    try {
      if (messages.length === 0) {
        return;
      }
      let prompt = messages[0].text;

      const userMessages = messages.filter((message) => message.type === 'user');

      if (userMessages.length > 1) {
        if (userMessages[0]._id === '0001-user-first') {
          prompt = userMessages[1].text;
        }
      }

      const appUrl = await publishApp({
        sessionId,
        code,
        title,
        prompt,
        userId: userInfo?.userId,
        updatePublishedUrl,
      });

      if (appUrl) {
        setPublishedAppUrl(appUrl);
      }
    } catch (error) {
      console.error('Error in handlePublish:', error);
    }
  };

  return (
    <div className="flex h-full w-full items-center px-2 py-4">
      <div className="flex w-1/4 items-center justify-start">
        <button
          type="button"
          onClick={() => {
            // Tell parent component user explicitly clicked back
            if (isStreaming && setUserClickedBack) {
              setUserClickedBack(true);
            }
            // Force showing the chat panel immediately
            setMobilePreviewShown(false);
          }}
          className="bg-light-decorative-00 dark:bg-dark-decorative-00 text-light-primary dark:text-dark-primary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 flex items-center justify-center rounded-md p-2 transition-colors md:hidden"
          aria-label="Back to chat"
        >
          <BackArrowIcon />
        </button>

        {showViewControls ? null : <div className="h-10" />}
      </div>

      {/* Center buttons */}
      <div className="flex w-2/4 items-center justify-center">
        {showViewControls ? (
          <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 flex justify-center gap-1 rounded-md p-1 shadow-sm">
            {/* Map over view controls to create buttons */}
            {Object.entries(viewControls).map(([view, control]) => {
              const viewType = view as ViewType;
              // Use displayView instead of currentView to determine active state
              // displayView will show code during streaming but respect URL otherwise
              const isActive = displayView === viewType;

              // Handle special case for data view with streaming state
              if (viewType === 'data' && isStreaming) {
                return (
                  <button
                    key={viewType}
                    type="button"
                    disabled={true}
                    className="text-light-primary/50 dark:text-dark-primary/50 !pointer-events-none flex cursor-not-allowed items-center justify-center space-x-1 rounded px-3 py-1.5 text-xs font-medium opacity-50 transition-colors sm:space-x-1.5 sm:px-4 sm:text-sm"
                    aria-label="Data tab unavailable during streaming"
                    title="Data tab available after streaming completes"
                  >
                    <DataIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden min-[480px]:inline">{control.label}</span>
                  </button>
                );
              }

              // For data view when not streaming, use an anchor tag
              if (viewType === 'data' && !isStreaming) {
                return (
                  <a
                    key={viewType}
                    href={
                      sessionId && encodedTitle ? `/chat/${sessionId}/${encodedTitle}/data` : '#'
                    }
                    className={`flex items-center justify-center space-x-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:space-x-1.5 sm:px-4 sm:text-sm ${
                      isActive
                        ? 'bg-light-background-00 dark:bg-dark-background-00 text-light-primary dark:text-dark-primary shadow-sm'
                        : 'text-light-primary/90 dark:text-dark-primary/90 hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 hover:text-light-primary dark:hover:text-dark-primary'
                    }`}
                    aria-label={`Switch to ${control.label} viewer`}
                    title={`View ${control.label.toLowerCase()}`}
                    onClick={() => {
                      if (activeView !== viewType) {
                        setActiveView(viewType);
                        // Ensure the preview is shown on mobile when the data view is clicked
                        setMobilePreviewShown(true);

                        // Reset userClickedBack when a user manually clicks data view during streaming
                        if (isStreaming && setUserClickedBack) {
                          setUserClickedBack(false);
                        }
                      }
                    }}
                  >
                    <DataIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden min-[480px]:inline">{control.label}</span>
                  </a>
                );
              }

              // For all other cases, use a button
              return (
                <button
                  key={viewType}
                  type="button"
                  onClick={() => {
                    // Set the active view and navigate
                    setActiveView(viewType);

                    // During streaming, we should still update the route
                    // but override the display with code view
                    navigateToView(viewType);

                    // Always show the mobile preview when clicking a view button
                    setMobilePreviewShown(true);

                    // Reset userClickedBack when a user manually clicks a view button during streaming
                    // This ensures they can get back to the preview/code even after clicking back
                    if (isStreaming && setUserClickedBack) {
                      setUserClickedBack(false);
                    }
                  }}
                  className={`flex items-center justify-center space-x-1 rounded px-3 py-1.5 text-xs font-medium transition-colors sm:space-x-1.5 sm:px-4 sm:text-sm ${
                    isActive
                      ? 'bg-light-background-00 dark:bg-dark-background-00 text-light-primary dark:text-dark-primary shadow-sm'
                      : `text-light-primary/90 dark:text-dark-primary/90 ${
                          control.enabled
                            ? 'hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 hover:text-light-primary dark:hover:text-dark-primary'
                            : 'opacity-50'
                        }`
                  } ${!control.enabled ? '!pointer-events-none cursor-not-allowed' : ''}`}
                  disabled={!control.enabled}
                  aria-label={`Switch to ${control.label}`}
                >
                  {viewType === 'preview' && (
                    <PreviewIcon
                      className="h-4 w-4"
                      isLoading={!!control.loading}
                      title={control.loading ? 'App is fetching data' : 'Preview icon'}
                    />
                  )}
                  {viewType === 'code' && (
                    <CodeIcon
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                      isLoading={currentView === 'preview' && !!control.loading}
                    />
                  )}
                  {viewType === 'data' && <DataIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  <span className="hidden min-[480px]:inline">{control.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Right side */}
      <div className="flex w-1/4 items-center justify-end">
        <div className="flex items-center gap-2">
          {showViewControls && previewReady && (
            <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 flex justify-center rounded-md p-1 shadow-sm">
              <button
                ref={publishButtonRef}
                type="button"
                onClick={() => setIsPublishMenuOpen(!isPublishMenuOpen)}
                className="text-light-primary dark:text-dark-primary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 flex items-center gap-1 rounded px-2 py-1.5 text-sm font-medium transition-colors"
                aria-label="Publish"
                title="Publish"
              >
                <PublishIcon className="h-5 w-5" />
                <span className="hidden min-[480px]:inline">Publish</span>
              </button>
            </div>
          )}
          
          <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 flex justify-center rounded-md p-1 shadow-sm">
            <button
              ref={buttonRef}
              type="button"
              onClick={handleAuthCheck}
              disabled={isVerifying}
              className={`${needsLogin ? 'text-orange-500' : 'text-light-primary dark:text-dark-primary'} hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 flex items-center gap-1 rounded px-2 py-1.5 text-sm font-medium transition-colors ${isVerifying ? 'cursor-wait opacity-50' : ''}`}
              aria-label={isUserAuthenticated ? `User: ${userInfo?.userId}` : 'Connect Account'}
              title={
                isUserAuthenticated ? `Logged in as ${userInfo?.userId}` : 'Login to keep building'
              }
            >
              <UserIcon isVerifying={isVerifying} isUserAuthenticated={isUserAuthenticated} />
              <span className="hidden min-[480px]:inline">
                {isVerifying
                  ? 'Verifying...'
                  : isUserAuthenticated
                    ? ''
                    : needsLogin
                      ? 'Get Credits'
                      : 'Get Credits'}
              </span>
            </button>
          </div>
          
          {/* Menus rendered at the top level */}
          {isPublishMenuOpen && showViewControls && previewReady && (
            <PublishMenu
              isOpen={isPublishMenuOpen}
              onPublish={handlePublish}
              onClose={() => setIsPublishMenuOpen(false)}
              buttonRef={publishButtonRef}
              publishedAppUrl={publishedAppUrl}
            />
          )}
          
          {isMenuOpen && isUserAuthenticated && (
            <UserMenu
              isOpen={isMenuOpen}
              onLogout={handleLogout}
              onClose={() => setIsMenuOpen(false)}
              buttonRef={buttonRef}
            />
          )}

        </div>
      </div>
    </div>
  );
};

export default ResultPreviewHeaderContent;
