import React, { useEffect, useState } from "react";
import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import { Link, useNavigate } from "react-router-dom";
import LoggedOutView from "../components/LoggedOutView.js";
import BrutalistLayout from "../components/BrutalistLayout.js";
import { useVibesDiy } from "../vibes-diy-provider.js";
// To restore GrantsList: re-add `isUserSettingSharing` to the named import and `SharingGrantItem` to the type import below.
import {
  isUserSettingDefaultHandle,
  isUserSettingProfile,
  isResAssetUploadGrant,
  isUserSettingNotifications,
  parseArray,
  userSettingModelDefaults,
} from "@vibes.diy/api-types";
import type { AIParams, UserSettingProfile, UserSettingNotifications } from "@vibes.diy/api-types";
import { exception2Result } from "@adviser/cement";
import { ModelSettingsCards } from "../components/ModelSettingsCards.js";

export function meta() {
  return [{ title: "Settings - Vibes DIY" }, { name: "description", content: "Settings for AI App Builder" }];
}

/* Hidden per VibesDIY/vibes.diy#1692 — restore alongside the JSX block in SettingsContent and the imports above.
function GrantsList() {
  const { chatApi } = useVibesDiy();
  const [grants, setGrants] = useState<SharingGrantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    void chatApi.ensureUserSettings({ settings: [] }).then((res) => {
      setLoading(false);
      if (res.isErr()) {
        setError(`Failed to load grants: ${res.Err()}`);
        return;
      }
      const sharing = res.Ok().settings.find(isUserSettingSharing);
      setGrants(sharing?.grants ?? []);
    });
  }, [chatApi]);

  const toggleGrant = (index: number) => {
    const updated = grants.map((g, i) =>
      i === index ? { ...g, grant: g.grant === "allow" ? ("deny" as const) : ("allow" as const) } : g
    );
    setGrants(updated);
    setSavingIndex(index);
    void chatApi.ensureUserSettings({ settings: [{ type: "sharing", grants: updated }] }).then((res) => {
      setSavingIndex(null);
      if (res.isErr()) {
        setError(`Failed to save: ${res.Err()}`);
        setGrants(grants); // revert on error
      }
    });
  };

  if (loading) {
    return <p style={{ color: "var(--vibes-text-secondary)" }}>Loading grants...</p>;
  }

  if (error) {
    return <p className="text-red-600 font-medium">{error}</p>;
  }

  if (grants.length === 0) {
    return <p style={{ color: "var(--vibes-text-secondary)" }}>No sharing grants yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b-2" style={{ borderColor: "var(--vibes-border-primary)" }}>
            <th className="pb-2 pr-4 font-semibold">Status</th>
            <th className="pb-2 pr-4 font-semibold">User / App</th>
            <th className="pb-2 font-semibold">Database</th>
          </tr>
        </thead>
        <tbody>
          {grants.map((g, i) => (
            <tr key={i} className="border-b" style={{ borderColor: "var(--vibes-border-primary)" }}>
              <td className="py-2 pr-4">
                <button
                  type="button"
                  disabled={savingIndex !== null}
                  onClick={() => toggleGrant(i)}
                  title={`Click to ${g.grant === "allow" ? "deny" : "allow"}`}
                  className={`inline-block rounded px-2 py-0.5 text-xs font-bold transition-opacity cursor-pointer hover:opacity-70 disabled:cursor-wait disabled:opacity-50 ${
                    g.grant === "allow"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  }`}
                >
                  {savingIndex === i ? "…" : g.grant}
                </button>
              </td>
              <td className="py-2 pr-4 font-mono">
                <Link to={`/chat/${g.ownerHandle}/${g.appSlug}`} className="hover:underline">
                  {g.ownerHandle}/{g.appSlug}
                </Link>
              </td>
              <td className="py-2 font-mono">{g.dbName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
*/

function UserSlugsCard() {
  const { chatApi } = useVibesDiy();
  const [items, setItems] = useState<{ ownerHandle: string; tenant: string; created: string; appSlugCount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [defaultSlug, setDefaultSlug] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);
  // modal state: which slug is pending deletion, and user's typed confirmation
  const [pendingDelete, setPendingDelete] = useState<{ ownerHandle: string; appSlugCount: number } | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    void Promise.all([chatApi.listHandleBindings({}), chatApi.ensureUserSettings({ settings: [] })]).then(
      ([slugRes, settingsRes]) => {
        setLoading(false);
        if (slugRes.isErr()) {
          setError(`Failed to load: ${slugRes.Err()}`);
          return;
        }
        const slugItems = slugRes.Ok().items;
        setItems(slugItems);
        if (settingsRes.isOk()) {
          const def = settingsRes.Ok().settings.filter(isUserSettingDefaultHandle)[0];
          if (def) {
            setDefaultSlug(def.ownerHandle);
          } else if (slugItems.length > 0) {
            const firstSlug = slugItems[0].ownerHandle;
            setSettingDefault(true);
            void chatApi.ensureUserSettings({ settings: [{ type: "defaultHandle", ownerHandle: firstSlug }] }).then((res) => {
              setSettingDefault(false);
              if (res.isOk()) setDefaultSlug(firstSlug);
            });
          }
        }
      }
    );
  };

  const handleSetDefault = (ownerHandle: string) => {
    setSettingDefault(true);
    void chatApi.ensureUserSettings({ settings: [{ type: "defaultHandle", ownerHandle }] }).then((res) => {
      setSettingDefault(false);
      if (res.isErr()) {
        setError(`Failed to set default: ${res.Err()}`);
        return;
      }
      setDefaultSlug(ownerHandle);
    });
  };

  useEffect(load, [chatApi]);

  const handleCreate = () => {
    setSaving(true);
    void chatApi.createHandleBinding({ ownerHandle: newSlug || undefined }).then((res) => {
      setSaving(false);
      if (res.isErr()) {
        setError(`Failed to create: ${res.Err()}`);
        return;
      }
      setNewSlug("");
      load();
    });
  };

  const handleDeleteConfirm = () => {
    if (!pendingDelete) return;
    setDeleting(true);
    void chatApi.deleteHandleBinding({ ownerHandle: pendingDelete.ownerHandle }).then((res) => {
      setDeleting(false);
      setPendingDelete(null);
      setConfirmInput("");
      if (res.isErr()) {
        setError(`Failed to delete: ${res.Err()}`);
        return;
      }
      load();
    });
  };

  return (
    <BrutalistCard size="md">
      <h3 className="text-2xl font-bold mb-4">User Slugs</h3>
      <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
        Human-readable identifiers linked to your account.
      </p>
      {error && <p className="text-red-600 font-medium mb-3">{error}</p>}

      {/* Confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="bg-white dark:bg-gray-900 border-2 rounded-lg p-6 max-w-sm w-full mx-4"
            style={{ borderColor: "var(--vibes-border-primary)" }}
          >
            <h4 className="text-lg font-bold mb-2">Delete user slug?</h4>
            <p className="text-sm mb-1" style={{ color: "var(--vibes-text-secondary)" }}>
              This will delete <span className="font-mono font-bold">{pendingDelete.ownerHandle}</span> and its{" "}
              <strong>{pendingDelete.appSlugCount}</strong> connected app slug{pendingDelete.appSlugCount !== 1 ? "s" : ""}. This
              cannot be undone.
            </p>
            <p className="text-sm mb-3" style={{ color: "var(--vibes-text-secondary)" }}>
              Type <span className="font-mono font-bold">{pendingDelete.ownerHandle}</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full border rounded px-3 py-1.5 text-sm font-mono mb-4"
              style={{ borderColor: "var(--vibes-border-primary)" }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <VibesButton
                variant="blue"
                onClick={() => {
                  setPendingDelete(null);
                  setConfirmInput("");
                }}
                disabled={deleting}
              >
                Cancel
              </VibesButton>
              <VibesButton
                variant="red"
                onClick={handleDeleteConfirm}
                disabled={confirmInput !== pendingDelete.ownerHandle || deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </VibesButton>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--vibes-text-secondary)" }}>Loading...</p>
      ) : (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b-2" style={{ borderColor: "var(--vibes-border-primary)" }}>
                <th className="pb-2 pr-4 font-semibold">Slug</th>
                <th className="pb-2 pr-4 font-semibold">Apps</th>
                <th className="pb-2 pr-4 font-semibold">Created</th>
                <th className="pb-2 pr-4 font-semibold">Default</th>
                <th className="pb-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.ownerHandle} className="border-b" style={{ borderColor: "var(--vibes-border-primary)" }}>
                  <td className="py-2 pr-4 font-mono">{item.ownerHandle}</td>
                  <td className="py-2 pr-4" style={{ color: "var(--vibes-text-secondary)" }}>
                    {item.appSlugCount}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--vibes-text-secondary)" }}>
                    {new Date(item.created).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="radio"
                      name="defaultHandle"
                      checked={defaultSlug === item.ownerHandle}
                      disabled={settingDefault}
                      onChange={() => handleSetDefault(item.ownerHandle)}
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDelete({ ownerHandle: item.ownerHandle, appSlugCount: item.appSlugCount });
                        setConfirmInput("");
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2" style={{ color: "var(--vibes-text-secondary)" }}>
                    No slugs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2 items-center mt-4">
        <input
          type="text"
          placeholder="my-slug (leave blank to generate)"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          className="flex-1 border rounded px-3 py-1.5 text-sm font-mono"
          style={{ borderColor: "var(--vibes-border-primary)" }}
        />
        <VibesButton variant="blue" onClick={handleCreate} disabled={saving}>
          {saving ? "…" : "Add"}
        </VibesButton>
      </div>
    </BrutalistCard>
  );
}

function ModelDefaultsCard() {
  const { chatApi } = useVibesDiy();
  const [chatConfig, setChatConfig] = useState<Partial<AIParams>>({});
  const [appConfig, setAppConfig] = useState<Partial<AIParams>>({});
  const [imgConfig, setImgConfig] = useState<Partial<AIParams>>({});
  const [savingChat, setSavingChat] = useState(false);
  const [savingApp, setSavingApp] = useState(false);
  const [savingImg, setSavingImg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void chatApi.ensureUserSettings({ settings: [] }).then((res) => {
      if (res.isErr()) {
        setError(`Failed to load: ${res.Err()}`);
        return;
      }
      const def = parseArray(res.Ok().settings, userSettingModelDefaults)[0];
      console.log("Loaded user settings:", res.Ok().settings, def);
      if (def) {
        setChatConfig(def.chat ?? {});
        setAppConfig(def.app ?? {});
        setImgConfig(def.img ?? {});
      }
    });
  }, [chatApi]);

  const save = (patch: Partial<{ chat: AIParams; app: AIParams; img: AIParams }>, setSaving: (v: boolean) => void) => {
    setSaving(true);
    const merged = { chat: chatConfig, app: appConfig, img: imgConfig, ...patch };
    const setting = {
      type: "modelDefaults" as const,
      ...(merged.chat?.model ? { chat: merged.chat } : {}),
      ...(merged.app?.model ? { app: merged.app } : {}),
      ...(merged.img?.model ? { img: merged.img } : {}),
    };
    void chatApi.ensureUserSettings({ settings: [setting] }).then((res) => {
      setSaving(false);
      if (res.isErr()) {
        setError(`Failed to save: ${res.Err()}`);
      }
    });
  };

  return (
    <BrutalistCard size="md">
      <h3 className="text-2xl font-bold mb-4">Default Models</h3>
      <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
        Default model settings applied when creating new apps.
      </p>
      {error && <p className="text-red-600 font-medium mb-3">{error}</p>}
      <ol className="space-y-5 text-sm">
        <ModelSettingsCards
          chatConfig={chatConfig}
          appConfig={appConfig}
          imgConfig={imgConfig}
          savingChat={savingChat}
          savingApp={savingApp}
          savingImg={savingImg}
          onSaveChat={(cfg) => {
            setChatConfig(cfg);
            save({ chat: cfg }, setSavingChat);
          }}
          onSaveApp={(cfg) => {
            setAppConfig(cfg);
            save({ app: cfg }, setSavingApp);
          }}
          onSaveImg={(cfg) => {
            setImgConfig(cfg);
            save({ img: cfg }, setSavingImg);
          }}
        />
      </ol>
    </BrutalistCard>
  );
}

function ProfileCard() {
  const { chatApi } = useVibesDiy();
  const [profile, setProfile] = useState<Omit<UserSettingProfile, "type">>({});
  const [defaultHandle, setDefaultHandle] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void chatApi.ensureUserSettings({ settings: [] }).then((res) => {
      if (res.isErr()) {
        setError(`Failed to load profile: ${res.Err()}`);
        return;
      }
      const prof = res.Ok().settings.find(isUserSettingProfile);
      if (prof) {
        setProfile({ avatarCid: prof.avatarCid, displayName: prof.displayName });
      }
      const def = res.Ok().settings.find(isUserSettingDefaultHandle);
      if (def) {
        setDefaultHandle(def.ownerHandle);
      }
    });
  }, [chatApi]);

  const handleAvatarUpload = async (file: File) => {
    if (!defaultHandle) {
      setError("No user slug set — create one in User Slugs first.");
      return;
    }
    setUploading(true);
    setError(null);

    // Step 1: mint a short-lived upload grant via WS
    const rGrant = await chatApi.requestAssetUploadGrant({
      ownerHandle: defaultHandle,
      appSlug: "_profile",
      mimeType: file.type || "application/octet-stream",
    });
    if (rGrant.isErr()) {
      setUploading(false);
      setError(`Upload failed: ${rGrant.Err().message}`);
      return;
    }
    const grantRes = rGrant.Ok();
    if (!isResAssetUploadGrant(grantRes)) {
      setUploading(false);
      setError("Upload failed: unexpected grant response shape");
      return;
    }

    // Step 2: POST the file bytes using the grant
    const uploadUrl = /^https?:\/\//i.test(grantRes.uploadUrl)
      ? grantRes.uploadUrl
      : `${window.location.origin}${grantRes.uploadUrl}`;

    const rUpload = await exception2Result(() =>
      fetch(uploadUrl, {
        method: "POST",
        headers: {
          "X-Asset-Grant": grantRes.grant,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      })
    );
    setUploading(false);
    if (rUpload.isErr()) {
      setError(`Upload failed: ${rUpload.Err().message}`);
      return;
    }
    const res = rUpload.Ok();
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      setError(`Upload failed: POST /assets returned ${res.status}: ${text}`);
      return;
    }
    const body = (await res.json()) as { cid: string; getURL: string; size: number; uploadId: string };
    const cid = body.cid;

    const next = { ...profile, avatarCid: cid };
    setProfile(next);
    const rSave = await chatApi.ensureUserSettings({ settings: [{ type: "profile", ...next }] });
    if (rSave.isErr()) {
      setError(`Failed to save avatar: ${rSave.Err()}`);
    }
  };

  const handleDisplayNameBlur = async () => {
    setSavingName(true);
    setError(null);
    const rSave = await chatApi.ensureUserSettings({ settings: [{ type: "profile", ...profile }] });
    setSavingName(false);
    if (rSave.isErr()) {
      setError(`Failed to save display name: ${rSave.Err()}`);
    }
  };

  return (
    <BrutalistCard size="md">
      <h3 className="text-2xl font-bold mb-4">Profile</h3>
      <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
        Customize how you appear to others.
      </p>
      {error && <p className="text-red-600 font-medium mb-3">{error}</p>}

      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-2">Avatar</h4>
        <div className="flex items-center gap-4">
          {profile.avatarCid && defaultHandle ? (
            <img
              src={`/u/${defaultHandle}/avatar`}
              alt="Current avatar"
              className="h-16 w-16 rounded-full object-cover border-2"
              style={{ borderColor: "var(--vibes-border-primary)" }}
            />
          ) : (
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center text-xs border-2"
              style={{
                borderColor: "var(--vibes-border-primary)",
                color: "var(--vibes-text-secondary)",
                background: "var(--vibes-bg-secondary, #f3f4f6)",
              }}
            >
              None
            </div>
          )}
          <div>
            <label className="cursor-pointer inline-block" htmlFor="avatar-upload">
              <VibesButton variant="blue" disabled={uploading} onClick={() => document.getElementById("avatar-upload")?.click()}>
                {uploading ? "Uploading…" : "Upload image"}
              </VibesButton>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleAvatarUpload(f);
              }}
            />
            <p className="text-xs mt-3" style={{ color: "var(--vibes-text-secondary)" }}>
              PNG, JPG, or WebP. Displayed at /u/
              {defaultHandle ?? "your-slug"}/avatar
            </p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Display name</h4>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={profile.displayName ?? ""}
            placeholder="Your display name"
            onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
            onBlur={() => void handleDisplayNameBlur()}
            className="flex-1 border rounded px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--vibes-border-primary)" }}
          />
          {savingName && (
            <span className="text-xs" style={{ color: "var(--vibes-text-secondary)" }}>
              Saving…
            </span>
          )}
        </div>
      </div>
    </BrutalistCard>
  );
}

function NotificationSettingsCard() {
  const { chatApi } = useVibesDiy();
  const [prefs, setPrefs] = useState<UserSettingNotifications>({
    type: "notifications",
    buildComplete: true,
    buildFailed: true,
    vibePublished: true,
    commentPosted: true,
    requestApproved: true,
    requestRevoked: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void chatApi.ensureUserSettings({ settings: [] }).then((res) => {
      if (res.isOk()) {
        const saved = res.Ok().settings.find(isUserSettingNotifications);
        if (saved) setPrefs(saved);
      }
      setLoaded(true);
    });
  }, [chatApi]);

  function toggle(key: keyof Omit<UserSettingNotifications, "type">) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    void chatApi.ensureUserSettings({ settings: [updated] }).then((res) => {
      if (res.isErr()) {
        setError(`Failed to save: ${res.Err()}`);
      }
    });
  }

  if (!loaded) return null;

  const items: { key: keyof Omit<UserSettingNotifications, "type">; label: string }[] = [
    { key: "buildComplete", label: "Build completed" },
    { key: "buildFailed", label: "Build failed" },
    { key: "vibePublished", label: "Vibe published" },
    { key: "commentPosted", label: "New comment on my vibe" },
    { key: "requestApproved", label: "Access request approved" },
    { key: "requestRevoked", label: "Access request revoked" },
  ];

  return (
    <BrutalistCard size="md">
      <h3 className="text-2xl font-bold mb-4">Browser Notifications</h3>
      <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
        Choose which events trigger browser notifications.
      </p>
      {error && <p className="text-red-600 font-medium mb-3">{error}</p>}
      <div className="space-y-3 text-sm">
        {items.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={prefs[key] !== false} onChange={() => toggle(key)} className="w-4 h-4" />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </BrutalistCard>
  );
}

function SettingsContent() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <BrutalistLayout title="Settings" subtitle="Manage your account">
      <UserSlugsCard />

      <ProfileCard />

      <ModelDefaultsCard />

      <NotificationSettingsCard />

      {/* Hidden per VibesDIY/vibes.diy#1692 — restore by uncommenting and reinstating the GrantsList function and imports.
      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Data Sharing Grants</h3>
        <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
          Apps that have been allowed or denied access to share your data
        </p>
        <GrantsList />
      </BrutalistCard>
      */}

      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Security</h3>
        <div className="flex items-center justify-between">
          <p style={{ color: "var(--vibes-text-secondary)" }}>
            Convert a Certificate Signing Request (CSR) to a signed certificate.
          </p>
          <Link to="/settings/csr-to-cert">
            <VibesButton variant="blue">CSR to Certificate</VibesButton>
          </Link>
        </div>
      </BrutalistCard>

      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Account</h3>
        <div className="flex items-center justify-between">
          <p style={{ color: "var(--vibes-text-secondary)" }}>
            Sign out from your account. Your vibes will still be in browser storage.
          </p>
          <VibesButton variant="red" onClick={handleLogout}>
            Logout
          </VibesButton>
        </div>
      </BrutalistCard>
    </BrutalistLayout>
  );
}

export default function Settings() {
  const { isSignedIn, isLoaded } = useClerkAuth();

  if (!isSignedIn) {
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  return <SettingsContent />;
}
