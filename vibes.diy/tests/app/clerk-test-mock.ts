// Singleton clerk mock for isolate:false.
//
// Why a single global mock instead of per-file vi.mock("@clerk/react", …):
// under isolate:false the browser context (and module registry) is shared
// across test files on a worker. The FIRST file to import a mocked module wins
// — its factory builds the cached module and later files get that shape. With
// divergent per-file clerk factories (some export only useAuth, others add
// useUser/useClerk) a file that imports `useUser` after a useAuth-only file
// crashes with "does not provide an export named 'useUser'". One global mock =
// one factory = one consistent module shape for every file; per-test behavior
// comes from the mutable state below, reset before each test.
import { beforeEach, vi } from "vitest";

export interface TestAuthState {
  userId: string | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  getToken?: () => Promise<string | null>;
}

export interface TestUser {
  id?: string;
  username?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  primaryEmailAddress?: { emailAddress?: string };
  imageUrl?: string;
}

function defaults() {
  return {
    auth: { userId: null, isSignedIn: false, isLoaded: true } as TestAuthState,
    user: null as TestUser | null,
    clerk: { signOut: vi.fn() } as Record<string, unknown>,
  };
}

const state = { current: defaults() };

/** Override the auth state returned by useAuth()/useUser() for the current test. */
export function setTestAuth(auth: Partial<TestAuthState>): void {
  state.current.auth = { ...state.current.auth, ...auth };
}

/** Set the user object returned by useUser() for the current test. */
export function setTestUser(user: TestUser | null): void {
  state.current.user = user;
}

/** Override fields on the object returned by useClerk() for the current test. */
export function setTestClerk(clerk: Record<string, unknown>): void {
  state.current.clerk = { ...state.current.clerk, ...clerk };
}

vi.mock("@clerk/react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useAuth: () => state.current.auth,
    useUser: () => ({
      user: state.current.user,
      isLoaded: state.current.auth.isLoaded,
      isSignedIn: state.current.auth.isSignedIn,
    }),
    useClerk: () => state.current.clerk,
  };
});

// Runs before each file's own beforeEach, so tests start from a known
// signed-out baseline and then opt into the state they need.
beforeEach(() => {
  state.current = defaults();
});
