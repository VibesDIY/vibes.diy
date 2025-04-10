import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Layout, ErrorBoundary } from '../app/root';

// Mock React Router components to avoid HTML validation errors
vi.mock('react-router', () => ({
  Meta: ({ 'data-testid': testId }: { 'data-testid'?: string }) => <meta data-testid={testId} />,
  Links: () => <link data-testid="links" />,
  Scripts: ({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <script data-testid={testId} />
  ),
  ScrollRestoration: ({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <div data-testid={testId} />
  ),
  isRouteErrorResponse: vi.fn(),
  useLocation: () => ({ pathname: '/', search: '' }),
}));

// Mock the cookie consent library
vi.mock('react-cookie-consent', () => ({
  default: ({ children, buttonText, onAccept }: any) => (
    <div data-testid="cookie-consent">
      {children}
      <button onClick={onAccept}>{buttonText}</button>
    </div>
  ),
  getCookieConsentValue: vi.fn().mockReturnValue(null),
}));

// Mock the CookieConsentContext
vi.mock('../app/context/CookieConsentContext', () => ({
  useCookieConsent: () => ({
    messageHasBeenSent: false,
    setMessageHasBeenSent: vi.fn(),
  }),
  CookieConsentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Root Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Reset document classes
    document.documentElement.classList.remove('dark');
  });

  it('renders the Layout component with children', () => {
    // Create a mock Layout component test
    // Since Layout renders an HTML document structure with <html> and <body> tags,
    // which causes issues in the test environment, we'll skip checking for specific elements
    // and just verify the component renders without throwing errors
    const { container } = render(
      <Layout>
        <div data-testid="test-content">Test Child Content</div>
      </Layout>
    );

    // Simply check that rendering happened without errors and test content is present
    expect(container.textContent).toContain('Test Child Content');
  });

  it('applies dark mode when system preference is dark', () => {
    // Mock matchMedia to return dark mode preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Use document.createElement to create a container to avoid hydration warnings
    const container = document.createElement('div');
    render(
      <Layout>
        <div>Test</div>
      </Layout>,
      { container }
    );

    // Check that dark class is added to html element
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('renders the ErrorBoundary component with an error', () => {
    const testError = new Error('Test error');

    render(<ErrorBoundary error={testError} params={{}} />);

    // Check that the error message is displayed
    expect(screen.getByText('Oops!')).toBeDefined();
    expect(screen.getByText('Test error')).toBeDefined();
  });
});
