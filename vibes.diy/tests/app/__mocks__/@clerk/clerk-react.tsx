/**
 * Centralized Clerk mock for testing
 *
 * This mock provides configurable implementations of Clerk hooks and components.
 * Use the exported mock functions to customize behavior in your tests.
 *
 * @example
 * ```typescript
 * import { mockUseAuth } from "../__mocks__/@clerk/clerk-react.js";
 *
 * describe("My Test", () => {
 *   beforeEach(() => {
 *     mockUseAuth.mockReturnValue({
 *       userId: "custom-user-id",
 *       isSignedIn: false,
 *       isLoaded: true,
 *     });
 *   });
 * });
 * ```
 */
import { vi } from "vitest";
import React from "react";

// Configurable mock implementations
export const mockUseAuth = vi.fn(() => ({
  userId: "test-user-id",
  isSignedIn: true,
  isLoaded: true,
  getToken: vi.fn().mockResolvedValue("mock-clerk-token"),
}));

export const mockUseUser = vi.fn(() => ({
  user: {
    id: "test-user-id",
    primaryEmailAddress: { emailAddress: "test@example.com" },
  },
  isLoaded: true,
  isSignedIn: true,
}));

export const mockUseSignIn = vi.fn(() => ({
  signIn: {
    authenticateWithRedirect: vi.fn().mockResolvedValue(undefined),
  },
}));

export const mockClerkProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => <>{children}</>;

export const mockAuthenticateWithRedirectCallback = () => (
  <div>Mock SSO Callback</div>
);

// Default exports for auto-mocking
export const useAuth = mockUseAuth;
export const useUser = mockUseUser;
export const useSignIn = mockUseSignIn;
export const ClerkProvider = mockClerkProvider;
export const AuthenticateWithRedirectCallback =
  mockAuthenticateWithRedirectCallback;
