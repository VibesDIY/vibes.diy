import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
import { AuthContext } from '../app/contexts/AuthContext';
import UnifiedSession from '../app/routes/home';
import { MockThemeProvider } from './utils/MockThemeProvider';

// Mock the CookieConsentContext
vi.mock('../app/contexts/CookieConsentContext', () => ({
  useCookieConsent: () => ({
    messageHasBeenSent: false,
    setMessageHasBeenSent: vi.fn(),
  }),
  CookieConsentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock dependencies
vi.mock('../app/hooks/useSimpleChat', () => ({
  useSimpleChat: () => ({
    docs: [],
    input: '',
    setInput: vi.fn(),
    isStreaming: false,
    inputRef: { current: null },
    sendMessage: vi.fn(),
    selectedSegments: [],
    selectedCode: null,
    title: '',
    sessionId: null,
    selectedResponseDoc: undefined,
    codeReady: false,
    addScreenshot: vi.fn(),
  }),
}));

// Mock the useSession hook
vi.mock('../app/hooks/useSession', () => ({
  useSession: () => ({
    session: null,
    loading: false,
    error: null,
    loadSession: vi.fn(),
    updateTitle: vi.fn().mockResolvedValue(undefined),
    updateMetadata: vi.fn(),
    addScreenshot: vi.fn(),
    createSession: vi.fn().mockResolvedValue('new-session-id'),
    database: {
      put: vi.fn().mockResolvedValue({ ok: true }),
    },
    mergeSession: vi.fn(),
  }),
}));

// Using centralized mock from __mocks__/use-fireproof.ts

// Create mock implementations for react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useLocation: () => ({ search: '', pathname: '/' }),
  };
});

// Mock for the utility functions
vi.mock('../app/utils/sharing', () => ({
  decodeStateFromUrl: () => ({ code: '', dependencies: {} }),
}));

vi.mock('../app/components/SessionSidebar/utils', () => ({
  encodeTitle: (title: string) => title,
}));

// Mock AppLayout component to make testing easier
vi.mock('../app/components/AppLayout', () => {
  return {
    __esModule: true,
    default: ({
      chatPanel,
      previewPanel,
      chatInput,
      suggestionsComponent,
    }: {
      chatPanel: React.ReactNode;
      previewPanel: React.ReactNode;
      chatInput?: React.ReactNode;
      suggestionsComponent?: React.ReactNode;
    }) => {
      return (
        <div data-testid="app-layout">
          <div data-testid="chat-panel">{chatPanel}</div>
          <div data-testid="preview-panel">{previewPanel}</div>
          {chatInput && <div data-testid="chat-input-container">{chatInput}</div>}
          {suggestionsComponent && (
            <div data-testid="suggestions-container">{suggestionsComponent}</div>
          )}
        </div>
      );
    },
  };
});

// Mock our ChatInterface
vi.mock('../app/components/ChatInterface', () => {
  return {
    __esModule: true,
    default: (props: unknown) => {
      return <div data-testid="chat-interface">Chat Interface</div>;
    },
    getChatInputComponent: (props: unknown) => {
      return <div data-testid="chat-input">Chat Input</div>;
    },
    getSuggestionsComponent: (props: unknown) => {
      return <div data-testid="suggestions">Suggestions</div>;
    },
  };
});

// Mock ResultPreview
vi.mock('../app/components/ResultPreview/ResultPreview', () => {
  return {
    __esModule: true,
    default: (props: unknown) => {
      return <div data-testid="result-preview">Result Preview</div>;
    },
  };
});

describe('Home Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the chat interface and result preview', async () => {
    render(
      <MockThemeProvider>
        <MemoryRouter>
          <AuthContext.Provider
            value={{
              token: 'mock-token',
              isAuthenticated: true,
              isLoading: false,
              userPayload: {
                userId: 'test',
                exp: 9999999999,
                tenants: [],
                ledgers: [],
                iat: 1234567890,
                iss: 'FP_CLOUD',
                aud: 'PUBLIC',
              },
              needsLogin: false,
              setNeedsLogin: vi.fn(),
              checkAuthStatus: vi.fn(),
              processToken: vi.fn(),
            }}
          >
            <UnifiedSession />
          </AuthContext.Provider>
        </MemoryRouter>
      </MockThemeProvider>
    );

    await waitFor(() => {
      // Check for our components which should be visible
      expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
      expect(screen.getByTestId('result-preview')).toBeInTheDocument();
    });
  });
});
