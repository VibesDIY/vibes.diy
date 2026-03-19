import React, { useEffect, useState } from "react";
import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { BrutalistCard, VibesButton } from "@vibes.diy/base";
import { Link, useNavigate } from "react-router-dom";
import LoggedOutView from "../components/LoggedOutView.js";
import BrutalistLayout from "../components/BrutalistLayout.js";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { isUserSettingSharing } from "@vibes.diy/api-types";
import type { UserSettingItem } from "@vibes.diy/api-types";
export function meta() {
  return [{ title: "Settings - Vibes DIY" }, { name: "description", content: "Settings for AI App Builder" }];
}

type SharingGrant = UserSettingItem["grants"][number];

function GrantsList() {
  const { vibeDiyApi } = useVibesDiy();
  const [grants, setGrants] = useState<SharingGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    void vibeDiyApi.ensureUserSettings({ settings: [] }).then((res) => {
      setLoading(false);
      if (res.isErr()) {
        setError(`Failed to load grants: ${res.Err()}`);
        return;
      }
      const sharing = res.Ok().settings.find(isUserSettingSharing);
      setGrants(sharing?.grants ?? []);
    });
  }, [vibeDiyApi]);

  const toggleGrant = (index: number) => {
    const updated = grants.map((g, i) =>
      i === index ? { ...g, grant: g.grant === "allow" ? ("deny" as const) : ("allow" as const) } : g
    );
    setGrants(updated);
    setSavingIndex(index);
    void vibeDiyApi.ensureUserSettings({ settings: [{ type: "sharing", grants: updated }] }).then((res) => {
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
                <Link to={`/chat/${g.userSlug}/${g.appSlug}`} className="hover:underline">
                  {g.userSlug}/{g.appSlug}
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

function SettingsContent() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <BrutalistLayout title="Settings" subtitle="Manage your account and data sharing">
      <BrutalistCard size="md">
        <h3 className="text-2xl font-bold mb-4">Data Sharing Grants</h3>
        <p className="mb-4" style={{ color: "var(--vibes-text-secondary)" }}>
          Apps that have been allowed or denied access to share your data
        </p>
        <GrantsList />
      </BrutalistCard>

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
