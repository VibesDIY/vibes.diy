import React from "react";
import { PublicSharingSection } from "./PublicSharingSection.js";
import { RequestsSection } from "./RequestsSection.js";
import { EmailInvitationsSection } from "./EmailInvitationsSection.js";
import { useSharingPanel } from "./useSharingPanel.js";

interface SharingTabProps {
  userSlug: string;
  appSlug: string;
}

export function SharingTab({ userSlug, appSlug }: SharingTabProps) {
  const panel = useSharingPanel({ userSlug, appSlug });

  if (panel.loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (!panel.settings) return null;

  const { entry } = panel.settings;

  return (
    <ol className="space-y-5 text-sm">
      <PublicSharingSection
        publicAccess={entry.publicAccess}
        toggling={panel.toggling}
        onToggle={() => void panel.togglePublicAccess(!!entry.publicAccess?.enable)}
      />
      <RequestsSection
        enableRequest={entry.enableRequest}
        requests={panel.requests}
        toggling={panel.toggling}
        onToggle={() => void panel.toggleEnableRequest(!!entry.enableRequest?.enable)}
        onToggleAutoAccept={() => void panel.toggleAutoAcceptRole()}
        onApprove={(r, role) => void panel.approveRequest(r, role)}
        onRejectPending={(r) => void panel.revokeRequest(r)}
        onRejectApproved={(r) => void panel.revokeRequest(r)}
        onSwitchRole={(r, role) => void panel.switchRequestRole(r, role)}
        onSwitchRejectedRole={(r, role) => void panel.switchRequestRole(r, role)}
        onReApprove={(r) => void panel.approveRequest(r, (r.role ?? "viewer") as "editor" | "viewer")}
        onRemove={(r) => void panel.removeRequest(r)}
      />
      <EmailInvitationsSection
        inviteEmail={panel.inviteEmail}
        inviting={panel.inviting}
        invites={panel.invites}
        onEmailChange={panel.setInviteEmail}
        onSendInvite={(role) => void panel.sendInvite(role)}
        onDelete={panel.deleteInvite}
        onRevoke={panel.revokeInvite}
        onChangeRole={panel.changeInviteRole}
      />
    </ol>
  );
}
