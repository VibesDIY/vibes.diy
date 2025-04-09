import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useSession } from '../../hooks/useSession';
import type { ViewType } from '../../utils/ViewState';
import { useViewState } from '../../utils/ViewState';
import { type TokenPayload, initiateAuthFlow, parseToken, verifyToken } from '../../utils/auth';
import {
    BackArrowIcon,
    CodeIcon,
    DataIcon,
    PreviewIcon,
} from '../HeaderContent/SvgIcons';
import { PublishMenu } from '../PublishMenu';
import { UserMenu } from '../UserMenu';

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
}) => {
  const navigate = useNavigate();
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
  const { session, updatePublishedUrl } = useSession(sessionId);
  
  // Initialize publishedAppUrl from session data if available
  const [publishedAppUrl, setPublishedAppUrl] = useState<string | undefined>(
    session.publishedUrl
  );

  // Update publishedAppUrl when session data changes
  useEffect(() => {
    if (session.publishedUrl) {
      setPublishedAppUrl(session.publishedUrl);
    }
  }, [session.publishedUrl]);

  // Use the new ViewState hook to manage all view-related state and navigation
  const {
    currentView,
    displayView,
    navigateToView,
    viewControls,
    showViewControls,
    encodedTitle,
  } = useViewState({
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
        if (token && await verifyToken(token)) {
          const payload = parseToken(token);
          if (payload && payload.exp * 1000 > Date.now()) {
            setUserInfo(payload);
            setIsUserAuthenticated(true);
            setIsVerifying(false);
            return;
          }
        }
        
        // Token is missing, invalid, or expired - show Connect button
        console.log('No valid token found or token expired');
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
    
    if (isUserAuthenticated) {
      setIsMenuOpen(!isMenuOpen);
    } else {
      // Use the dedicated function to initiate auth flow
      initiateAuthFlow();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsUserAuthenticated(false);
    setIsMenuOpen(false);
  };

  const handlePublish = async () => {
    try {
      // Normalize the default export function name to "App"
      const normalizedCode = code.replace(
        /export\s+default\s+function\s+(\w+)/,
        'export default function App'
      );

      // Transform bare import statements to use esm.sh URLs
      const transformImports = (code: string): string => {
        // This regex matches import statements with bare module specifiers
        // It specifically looks for import statements that don't start with /, ./, or ../
        return code.replace(
          /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"\/][^'"]*)['"];?/g,
          (match, importPath) => {
            // Skip transforming imports that are already handled in the importmap
            // Only skip the core libraries we have in our importmap
            if (
              ['react', 'react-dom', 'react-dom/client', 'use-fireproof', 'call-ai'].includes(
                importPath
              )
            ) {
              return match;
            }
            // Transform the import to use basic esm.sh URL
            return match.replace(`"${importPath}"`, `"https://esm.sh/${importPath}"`);
          }
        );
      };

      const transformedCode = transformImports(normalizedCode);

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
      
      const response = await fetch(`${API_BASE_URL}/api/apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: sessionId,
          code: transformedCode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.app?.slug) {
        const appUrl = `${API_BASE_URL.replace(/^https?:\/\//, 'http://')}`.endsWith('/')
          ? `http://${data.app.slug}.${API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}/`
          : `http://${data.app.slug}.${API_BASE_URL.replace(/^https?:\/\//, '')}/`;
        setPublishedAppUrl(appUrl);
        
        // Update the session with the published URL
        if (sessionId) {
          await updatePublishedUrl(appUrl);
        }
      }

      console.log('App published successfully');
    } catch (error) {
      console.error('Error publishing app:', error);
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
          className="bg-light-decorative-00 dark:bg-dark-decorative-00 text-light-primary dark:text-dark-primary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 flex items-center justify-center rounded-lg p-2 transition-colors md:hidden"
          aria-label="Back to chat"
        >
          <BackArrowIcon />
        </button>

        {showViewControls ? null : <div className="h-10" />}
      </div>

      {/* Center buttons */}
      <div className="flex w-2/4 items-center justify-center">
        {showViewControls ? (
          <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 flex justify-center gap-1 rounded-lg p-1 shadow-sm">
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
                    className="text-light-primary/50 dark:text-dark-primary/50 flex cursor-not-allowed items-center justify-center space-x-1 rounded-md px-3 py-1.5 text-xs font-medium opacity-50 transition-colors sm:space-x-1.5 sm:px-4 sm:text-sm"
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
                    className={`flex items-center justify-center space-x-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:space-x-1.5 sm:px-4 sm:text-sm ${
                      isActive
                        ? 'bg-light-background-00 dark:bg-dark-background-00 text-light-primary dark:text-dark-primary shadow-sm'
                        : 'text-light-primary dark:text-dark-primary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01'
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
                  className={`flex items-center justify-center space-x-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:space-x-1.5 sm:px-4 sm:text-sm ${
                    isActive
                      ? 'bg-light-background-00 dark:bg-dark-background-00 text-light-primary dark:text-dark-primary shadow-sm'
                      : `text-light-primary dark:text-dark-primary${
                          control.enabled
                            ? ' hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01'
                            : ' cursor-not-allowed opacity-50'
                        }`
                  }`}
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
      <div className="flex w-1/4 justify-end">
        <div className="flex items-center gap-2">
          {isUserAuthenticated && showViewControls && (
            <div className="relative">
              <button
                ref={publishButtonRef}
                type="button"
                onClick={() => setIsPublishMenuOpen(!isPublishMenuOpen)}
                className="bg-light-decorative-00 dark:bg-dark-decorative-00 text-light-primary dark:text-dark-primary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 flex items-center justify-center rounded-lg p-2 transition-colors"
                aria-label="Share"
                title="Share"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-labelledby="publishSvgTitle"
                >
                  <title id="publishSvgTitle">Publish</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              </button>
              <PublishMenu
                isOpen={isPublishMenuOpen}
                onPublish={handlePublish}
                onClose={() => setIsPublishMenuOpen(false)}
                buttonRef={publishButtonRef}
                publishedAppUrl={publishedAppUrl}
              />
            </div>
          )}
          <div className="relative">
            <div className="bg-light-decorative-00 dark:bg-dark-decorative-00 flex justify-center gap-1 rounded-lg p-1 shadow-sm">
              <button
                ref={buttonRef}
                type="button"
                onClick={handleAuthCheck}
                disabled={isVerifying}
                className={`text-light-primary dark:text-dark-primary hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 flex items-center justify-center space-x-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:space-x-1.5 sm:px-4 sm:text-sm ${isVerifying ? 'opacity-50 cursor-wait' : ''}`}
                aria-label={isUserAuthenticated ? `User: ${userInfo?.userId}` : 'Connect Account'}
                title={isUserAuthenticated ? `Logged in as ${userInfo?.userId}` : 'Connect Fireproof Account'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isVerifying ? 'animate-pulse' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-labelledby="authSvgTitle"
                >
                  <title id="authSvgTitle">{isUserAuthenticated ? 'User Account' : 'Connect Account'}</title>
                  {isUserAuthenticated ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  )}
                </svg>
                <span className="hidden min-[480px]:inline">
                  {isVerifying 
                    ? 'Verifying...' 
                    : isUserAuthenticated 
                      ? `${userInfo?.userId?.substring(0, 8) ?? 'User'}...` 
                      : 'Connect'}
                </span>
              </button>
            </div>
            
            <UserMenu
              isOpen={isMenuOpen && isUserAuthenticated}
              onLogout={handleLogout}
              onClose={() => setIsMenuOpen(false)}
              buttonRef={buttonRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultPreviewHeaderContent;
