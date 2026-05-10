import React from "react";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { Result } from "@adviser/cement";

// ---- dependency mocks (must be declared before importing the component) ----

vi.mock("@clerk/react", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useAuth: () => ({ isSignedIn: true, isLoaded: true }),
    useClerk: () => ({
      signOut: vi.fn(),
      addListener: vi.fn(),
      loaded: true,
      isSignedIn: true,
    }),
  };
});

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  };
});

// Stub layout / card components so the test doesn't need the full design system
vi.mock("@vibes.diy/base", () => ({
  BrutalistCard: ({ children }: { children: React.ReactNode }) => <div data-testid="brutalist-card">{children}</div>,
  VibesButton: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("~/vibes.diy/app/components/LoggedOutView.js", () => ({
  default: () => <div>Logged out</div>,
}));

vi.mock("~/vibes.diy/app/components/BrutalistLayout.js", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/vibes.diy/app/components/ModelSettingsCards.js", () => ({
  ModelSettingsCards: () => <div data-testid="model-settings-cards" />,
}));

// Stub react-hot-toast referenced transitively
vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ---- api stub factories ----

function makeOkResult<T>(value: T) {
  return Promise.resolve(Result.Ok(value));
}

function makeErrResult(msg: string) {
  return Promise.resolve(Result.Err(new Error(msg)));
}

type SettingsItem =
  | { type: "profile"; avatarCid?: string; displayName?: string }
  | { type: "defaultUserSlug"; userSlug: string }
  | { type: "sharing"; grants: unknown[] }
  | { type: "modelDefaults" };

function makeVibeDiyApi(overrides?: {
  initialSettings?: SettingsItem[];
  grantCid?: string;
  requestGrantFail?: string;
  ensureSettingsFail?: string;
  userSlugItems?: { userSlug: string; tenant: string; created: string; appSlugCount: number }[];
}) {
  const {
    initialSettings = [{ type: "defaultUserSlug" as const, userSlug: "test-user" }],
    grantCid = "bafy123",
    requestGrantFail,
    ensureSettingsFail,
    userSlugItems = [],
  } = overrides ?? {};

  const ensureUserSettings = vi.fn().mockImplementation((req: { settings: SettingsItem[] }) => {
    if (ensureSettingsFail) return makeErrResult(ensureSettingsFail);
    // merge incoming settings over the initial ones
    const merged = [...initialSettings];
    for (const item of req.settings) {
      const idx = merged.findIndex((s) => s.type === item.type);
      if (idx >= 0) {
        merged[idx] = item;
      } else {
        merged.push(item);
      }
    }
    return makeOkResult({
      userId: "u1",
      settings: merged,
      updated: new Date().toISOString(),
      created: new Date().toISOString(),
    });
  });

  const requestAssetUploadGrant = vi.fn().mockImplementation((_req: unknown) => {
    if (requestGrantFail) return makeErrResult(requestGrantFail);
    // grantCid is only used as a label for the test — the actual cid comes from the fetch response
    void grantCid;
    return makeOkResult({
      type: "vibes.diy.res-asset-upload-grant" as const,
      grant: "mock-jwt-grant",
      uploadUrl: "/assets",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      uploadId: "upl-mock-1",
    });
  });

  const listUserSlugBindings = vi.fn().mockImplementation(() => makeOkResult({ items: userSlugItems }));

  const deleteUserSlugBinding = vi.fn().mockImplementation(() => makeOkResult({ userSlug: "deleted" }));

  const createUserSlugBinding = vi.fn().mockImplementation(() => makeOkResult({ userSlug: "new-slug" }));

  return {
    ensureUserSettings,
    requestAssetUploadGrant,
    listUserSlugBindings,
    deleteUserSlugBinding,
    createUserSlugBinding,
  };
}

// ---- wire the context mock ----

let vibeDiyApiStub = makeVibeDiyApi();

vi.mock("~/vibes.diy/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({ vibeDiyApi: vibeDiyApiStub }),
}));

// Stub global fetch so the HTTP POST doesn't escape the test
let mockFetch = vi.fn();

// Import the component AFTER all vi.mock() calls
import Settings from "~/vibes.diy/app/routes/settings.js";

// ---- tests ----

describe("Settings ProfileCard", () => {
  beforeEach(() => {
    vibeDiyApiStub = makeVibeDiyApi({
      initialSettings: [{ type: "defaultUserSlug", userSlug: "test-user" }],
    });
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cid: "bafy123", getURL: "s3://r2/bafy123", size: 100, uploadId: "upl1" }),
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the Profile section heading", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Profile")).toBeInTheDocument();
    });
  });

  it("renders the avatar upload button", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Upload image")).toBeInTheDocument();
    });
  });

  it("renders the display name input", async () => {
    render(<Settings />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Your display name")).toBeInTheDocument();
    });
  });

  it("calls requestAssetUploadGrant then fetch then ensureUserSettings with avatarCid on file upload", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Your display name")).toBeInTheDocument();
    });

    const fileInput = document.getElementById("avatar-upload") as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File(["(png data)"], "avatar.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(vibeDiyApiStub.requestAssetUploadGrant).toHaveBeenCalledTimes(1);
    });

    expect(vibeDiyApiStub.requestAssetUploadGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        userSlug: "test-user",
        mimeType: "image/png",
      })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const [, fetchInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((fetchInit.headers as Record<string, string>)["X-Asset-Grant"]).toBe("mock-jwt-grant");
    expect(fetchInit.body).toBe(file);

    await waitFor(() => {
      expect(vibeDiyApiStub.ensureUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.arrayContaining([expect.objectContaining({ type: "profile", avatarCid: "bafy123" })]),
        })
      );
    });
  });

  it("shows the avatar img at /u/<slug>/avatar after successful upload", async () => {
    vibeDiyApiStub = makeVibeDiyApi({
      initialSettings: [
        { type: "defaultUserSlug", userSlug: "test-user" },
        { type: "profile", avatarCid: "existing-cid" },
      ],
    });

    render(<Settings />);

    await waitFor(() => {
      const img = screen.getByRole("img", { name: "Current avatar" }) as HTMLImageElement;
      expect(img.src).toContain("/u/test-user/avatar");
    });
  });

  it("calls ensureUserSettings with updated displayName on blur", async () => {
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Your display name")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Your display name");

    await act(async () => {
      fireEvent.change(input, { target: { value: "Alice" } });
    });

    // Reset mock call count after initial load calls
    vibeDiyApiStub.ensureUserSettings.mockClear();

    await act(async () => {
      fireEvent.blur(input);
    });

    await waitFor(() => {
      expect(vibeDiyApiStub.ensureUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.arrayContaining([expect.objectContaining({ type: "profile", displayName: "Alice" })]),
        })
      );
    });
  });

  it("preserves existing avatarCid when saving displayName", async () => {
    vibeDiyApiStub = makeVibeDiyApi({
      initialSettings: [
        { type: "defaultUserSlug", userSlug: "test-user" },
        { type: "profile", avatarCid: "existing-cid", displayName: "Bob" },
      ],
    });

    render(<Settings />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText("Your display name") as HTMLInputElement;
      expect(input.value).toBe("Bob");
    });

    const input = screen.getByPlaceholderText("Your display name");

    await act(async () => {
      fireEvent.change(input, { target: { value: "Bob Updated" } });
    });

    vibeDiyApiStub.ensureUserSettings.mockClear();

    await act(async () => {
      fireEvent.blur(input);
    });

    await waitFor(() => {
      expect(vibeDiyApiStub.ensureUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.arrayContaining([
            expect.objectContaining({
              type: "profile",
              avatarCid: "existing-cid",
              displayName: "Bob Updated",
            }),
          ]),
        })
      );
    });
  });

  it("shows an error message when requestAssetUploadGrant fails", async () => {
    vibeDiyApiStub = makeVibeDiyApi({ requestGrantFail: "network error" });

    render(<Settings />);

    // Wait until the profile section is fully rendered (settings loaded, slug resolved)
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Your display name")).toBeInTheDocument();
    });
    // Also wait for the settings to load so defaultUserSlug is populated
    await waitFor(() => {
      expect(vibeDiyApiStub.ensureUserSettings).toHaveBeenCalled();
    });

    const fileInput = document.getElementById("avatar-upload") as HTMLInputElement;
    const file = new File(["x"], "avatar.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(vibeDiyApiStub.requestAssetUploadGrant).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
    });
  });
});
