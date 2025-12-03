# Implement Proper Invites for Vibe Collaboration

## Overview

Add full invite functionality to vibes.diy to enable real-time collaboration on shared vibe groups. Users can invite others to collaborate on their group, and when browsing restricted groups, users can either create their own instance or request access.

## Current Architecture

### URL-to-Ledger Mapping

- URL format: `/vibe/:titleId/:groupId` (e.g., `/vibe/my-app/abc123`)
- Ledger name: `vf-default-{titleId}-{groupId}` (e.g., `vf-default-my-app-abc123`)
- **First-come first-serve**: First visitor to `/vibe/:titleId` auto-creates "Begin" group
- **Documents are local-only**: Stored in browser IndexedDB by default
- **Cloud sync**: Available via `toCloud()` when in VibeContext with Clerk auth

### Group Document Structure

```typescript
// Database: "vibes-groups"
interface VibeGroupDocument {
  _id: string; // "${titleId}-${groupId}"
  titleId: string; // vibe template name
  groupId: string; // unique group/instance ID
  description: string;
  userId: string; // owner
  createdAt: string;
  updatedAt: string;
  sharedWith?: string[]; // Array of Dashboard userIds with access
  options?: Record<string, unknown>;
}
```

### Hosting/Publishing

- Published vibes use subdomain: `v-{appSlug}--{groupId}.vibesdiy.app`
- Parsed via subdomain utilities in `hosting/base/utils/`

## Collaboration Model

### Invited Collaboration (Option A)

When you invite someone:

- They get **full access** to your group's ledger
- You're both working on the **same documents** in real-time
- Documents sync via Fireproof cloud with the shared ledger

### Access Control Flow

```
User navigates to /vibe/:titleId/:groupId
  ↓
1. Check if user has access:
   - User is owner (userId === currentUserId)
   - User is in sharedWith array
   ↓
2. If NO access:
   Show modal with options:
   ┌─────────────────────────────────────┐
   │ This group is private               │
   │                                     │
   │ [Create Your Own Copy]              │
   │   → Creates new groupId with empty  │
   │      data, navigates to it          │
   │                                     │
   │ [Request to Join]                   │
   │   → Sends invite request to owner   │
   └─────────────────────────────────────┘
   ↓
3. If YES access:
   - Enable cloud sync for ledger
   - Load documents from shared ledger
   - Show collaboration indicator
```

## Implementation Plan

### Phase 1: Cloud Sync Integration

**Goal**: Enable cloud sync when accessing shared groups

**Files to modify:**

- `vibes.diy/pkg/app/routes/vibe.$titleId.$groupId.tsx`
- `use-vibes/base/contexts/VibeContext.tsx`

**Changes:**

1. When loading a group with `sharedWith` array, automatically enable cloud sync:

```typescript
const { user } = useClerkAuth();
const isShared = vibeGroup.sharedWith?.includes(user?.id);

// Auto-enable cloud sync for shared groups
useEffect(() => {
  if (isShared && vibeMetadata) {
    const cloudAttachable = toCloud({
      tenant: defaultTenantId, // from listTenantsByUser
      ledger: ledgerName, // vf-default-{titleId}-{groupId}
    });

    database.attach(cloudAttachable);
  }
}, [isShared, vibeMetadata, database]);
```

2. Add sync status indicator to UI showing "Syncing with N collaborators"

### Phase 2: Dashboard API Integration Hook

**File**: `vibes.diy/pkg/app/hooks/useDashboardApi.ts` (NEW)

```typescript
import { DashboardApi } from "@fireproof/core-protocols-dashboard";
import { useClerkAuth } from "./useClerkAuth";
import { useMemo } from "react";

export function useDashboardApi() {
  const { getToken } = useClerkAuth();

  const dashApi = useMemo(() => {
    const apiUrl =
      (window as any).__VIBES_CONNECT_API_URL__ ||
      "https://connect.fireproof.direct/api";

    return new DashboardApi({
      apiUrl,
      getToken: async () => ({
        type: "clerk",
        token: (await getToken()) || "",
      }),
      fetch: fetch.bind(window),
    });
  }, [getToken]);

  return dashApi;
}
```

### Phase 3: Ledger Management Hook

**File**: `vibes.diy/pkg/app/hooks/useLedgerForGroup.ts` (NEW)

```typescript
interface UseLedgerForGroupResult {
  ledgerId: string | null;
  tenantId: string | null;
  ensureLedger: () => Promise<{ ledgerId: string; tenantId: string }>;
  isLoading: boolean;
}

export function useLedgerForGroup(
  titleId: string,
  groupId: string,
): UseLedgerForGroupResult {
  const dashApi = useDashboardApi();
  const { getToken } = useClerkAuth();
  const [ledgerInfo, setLedgerInfo] = useState<{
    ledgerId: string;
    tenantId: string;
  } | null>(null);

  // Check if ledger already exists
  useEffect(() => {
    const checkLedger = async () => {
      const token = await getToken();
      if (!token) return;

      const tenantsResult = await dashApi.listTenantsByUser({
        type: "reqListTenantsByUser",
        auth: { type: "clerk", token },
      });

      if (tenantsResult.isErr()) return;
      const tenantId = tenantsResult.Ok().tenants[0]?.tenantId;
      if (!tenantId) return;

      const ledgersResult = await dashApi.listLedgersByUser({
        type: "reqListLedgersByUser",
        auth: { type: "clerk", token },
        tenantIds: [tenantId],
      });

      if (ledgersResult.isErr()) return;

      // Find ledger matching our group
      const ledgerName = `vf-default-${titleId}-${groupId}`;
      const matchingLedger = ledgersResult
        .Ok()
        .ledgers.find((l) => l.name === ledgerName);

      if (matchingLedger) {
        setLedgerInfo({
          ledgerId: matchingLedger.ledgerId,
          tenantId,
        });
      }
    };

    checkLedger();
  }, [dashApi, getToken, titleId, groupId]);

  const ensureLedger = useCallback(async () => {
    if (ledgerInfo) return ledgerInfo;

    const token = await getToken();
    if (!token) throw new Error("Not authenticated");

    // Get default tenant
    const tenantsResult = await dashApi.listTenantsByUser({
      type: "reqListTenantsByUser",
      auth: { type: "clerk", token },
    });

    if (tenantsResult.isErr()) throw tenantsResult.Err();
    const tenantId = tenantsResult.Ok().tenants[0]?.tenantId;
    if (!tenantId) throw new Error("No tenant found");

    // Create ledger
    const ledgerName = `vf-default-${titleId}-${groupId}`;
    const createResult = await dashApi.createLedger({
      type: "reqCreateLedger",
      auth: { type: "clerk", token },
      ledger: { tenantId, name: ledgerName },
    });

    if (createResult.isErr()) throw createResult.Err();

    const newLedgerInfo = {
      ledgerId: createResult.Ok().ledger.ledgerId,
      tenantId,
    };

    setLedgerInfo(newLedgerInfo);
    return newLedgerInfo;
  }, [ledgerInfo, dashApi, getToken, titleId, groupId]);

  return {
    ledgerId: ledgerInfo?.ledgerId || null,
    tenantId: ledgerInfo?.tenantId || null,
    ensureLedger,
    isLoading: false,
  };
}
```

### Phase 4: Invite Management Hook

**File**: `vibes.diy/pkg/app/hooks/useGroupInvites.ts` (NEW)

```typescript
export function useGroupInvites(ledgerId: string | null) {
  const dashApi = useDashboardApi();
  const { getToken } = useClerkAuth();

  const sendInvite = useCallback(
    async (
      email: string,
      role: "admin" | "member" = "member",
      right: "read" | "write" = "write",
    ) => {
      if (!ledgerId) throw new Error("No ledger ID");

      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      return await dashApi.inviteUser({
        type: "reqInviteUser",
        auth: { type: "clerk", token },
        ticket: {
          query: { byEmail: email },
          invitedParams: {
            ledger: { id: ledgerId, role, right },
          },
        },
      });
    },
    [dashApi, getToken, ledgerId],
  );

  const listPendingInvites = useCallback(async () => {
    if (!ledgerId) return [];

    const token = await getToken();
    if (!token) return [];

    const result = await dashApi.listInvites({
      type: "reqListInvites",
      auth: { type: "clerk", token },
      ledgerIds: [ledgerId],
    });

    return result.isOk() ? result.Ok().tickets : [];
  }, [dashApi, getToken, ledgerId]);

  const deleteInvite = useCallback(
    async (inviteId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      return await dashApi.deleteInvite({
        type: "reqDeleteInvite",
        auth: { type: "clerk", token },
        inviteId,
      });
    },
    [dashApi, getToken],
  );

  return { sendInvite, listPendingInvites, deleteInvite };
}
```

### Phase 5: Invite Modal Component

**File**: `vibes.diy/pkg/app/components/InviteModal.tsx` (NEW)

```typescript
interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  groupId: string;
  ledgerId: string | null;
}

export function InviteModal({
  isOpen,
  onClose,
  titleId,
  groupId,
  ledgerId
}: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'edit' | 'view'>('edit');
  const [isInviting, setIsInviting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);

  const { sendInvite, listPendingInvites, deleteInvite } = useGroupInvites(ledgerId);

  useEffect(() => {
    if (isOpen && ledgerId) {
      listPendingInvites().then(setPendingInvites);
    }
  }, [isOpen, ledgerId, listPendingInvites]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ledgerId) {
      alert('Ledger not initialized. Try again.');
      return;
    }

    setIsInviting(true);
    try {
      const result = await sendInvite(
        email,
        'member',
        permission === 'edit' ? 'write' : 'read'
      );

      if (result.isOk()) {
        setEmail('');
        const invites = await listPendingInvites();
        setPendingInvites(invites);
        // Show success toast
      } else {
        alert(`Failed to send invite: ${result.Err()}`);
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    await deleteInvite(inviteId);
    const invites = await listPendingInvites();
    setPendingInvites(invites);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="invite-modal">
        <h2>Invite Collaborators</h2>
        <p>Share this group with others to collaborate in real-time</p>

        <form onSubmit={handleSubmit}>
          <label>
            Email or GitHub Username:
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com or @username"
              required
            />
          </label>

          <label>
            Permission:
            <select value={permission} onChange={e => setPermission(e.target.value)}>
              <option value="edit">Can Edit</option>
              <option value="view">View Only</option>
            </select>
          </label>

          <VibesButton type="submit" disabled={isInviting || !ledgerId}>
            {isInviting ? 'Sending...' : 'Send Invite'}
          </VibesButton>
        </form>

        {pendingInvites.length > 0 && (
          <section className="pending-invites">
            <h3>Pending Invites</h3>
            {pendingInvites.map(invite => (
              <div key={invite.inviteId} className="invite-item">
                <span>{invite.query.byEmail || invite.query.byNick}</span>
                <span className="status">{invite.status}</span>
                <span>Expires: {new Date(invite.expiresAfter).toLocaleDateString()}</span>
                {invite.status === 'pending' && (
                  <button onClick={() => handleDeleteInvite(invite.inviteId)}>
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </Modal>
  );
}
```

### Phase 6: Add Invite Button to Group List

**File**: `vibes.diy/pkg/app/routes/vibe.$titleId.tsx` (MODIFY)

Add invite functionality to the group list page:

```typescript
export default function VibeInstanceList() {
  const { titleId } = useParams();
  const { groups, createGroup, updateGroup, deleteGroup } = useVibeGroups(titleId);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const { ledgerId, ensureLedger } = useLedgerForGroup(
    titleId,
    selectedGroup?.groupId
  );

  const handleInviteClick = async (group) => {
    setSelectedGroup(group);

    // Ensure ledger exists before showing modal
    await ensureLedger();
    setShowInviteModal(true);
  };

  return (
    <BrutalistLayout title={`${titleId} Groups`}>
      {groups.map(group => (
        <div key={group._id} className="group-item">
          <h3>{group.description}</h3>
          <div className="actions">
            <VibesButton onClick={() => navigate(`/vibe/${titleId}/${group.groupId}`)}>
              Open
            </VibesButton>
            <VibesButton onClick={() => handleInviteClick(group)}>
              Invite
            </VibesButton>
            <VibesButton onClick={() => deleteGroup(group.groupId)}>
              Delete
            </VibesButton>
          </div>
          {group.sharedWith?.length > 0 && (
            <div className="collaborators">
              Shared with {group.sharedWith.length} user(s)
            </div>
          )}
        </div>
      ))}

      {showInviteModal && selectedGroup && (
        <InviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          titleId={titleId}
          groupId={selectedGroup.groupId}
          ledgerId={ledgerId}
        />
      )}
    </BrutalistLayout>
  );
}
```

### Phase 7: Access Control Modal

**File**: `vibes.diy/pkg/app/components/AccessDeniedModal.tsx` (NEW)

```typescript
interface AccessDeniedModalProps {
  titleId: string;
  groupId: string;
  onCreateOwn: () => void;
  onRequestAccess: () => void;
}

export function AccessDeniedModal({
  titleId,
  groupId,
  onCreateOwn,
  onRequestAccess
}: AccessDeniedModalProps) {
  return (
    <Modal isOpen={true} canClose={false}>
      <div className="access-denied">
        <h2>This group is private</h2>
        <p>You don't have access to <strong>{titleId}/{groupId}</strong></p>

        <div className="options">
          <VibesButton onClick={onCreateOwn} variant="blue">
            <div className="option-content">
              <strong>Create Your Own</strong>
              <small>Start a new group with empty data</small>
            </div>
          </VibesButton>

          <VibesButton onClick={onRequestAccess} variant="gray">
            <div className="option-content">
              <strong>Request to Join</strong>
              <small>Ask the owner for access</small>
            </div>
          </VibesButton>
        </div>
      </div>
    </Modal>
  );
}
```

### Phase 8: Integrate Access Control in Viewer

**File**: `vibes.diy/pkg/app/routes/vibe.$titleId.$groupId.tsx` (MODIFY)

Add access checking when loading a group:

```typescript
export default function VibeViewer() {
  const { titleId, groupId } = useParams();
  const { user } = useClerkAuth();
  const navigate = useNavigate();

  const { groups } = useVibeGroups(titleId);
  const currentGroup = groups.find(g => g.groupId === groupId);

  const hasAccess = useMemo(() => {
    if (!currentGroup) return false;
    if (currentGroup.userId === user?.id) return true;
    if (currentGroup.sharedWith?.includes(user?.id)) return true;
    return false;
  }, [currentGroup, user?.id]);

  const [showAccessDenied, setShowAccessDenied] = useState(false);

  useEffect(() => {
    if (currentGroup && !hasAccess) {
      setShowAccessDenied(true);
    }
  }, [currentGroup, hasAccess]);

  const handleCreateOwn = () => {
    // Generate new groupId and navigate
    const newGroupId = generateGroupId();
    navigate(`/vibe/${titleId}/${newGroupId}`);
  };

  const handleRequestAccess = async () => {
    // Send invite request to owner
    // This could either:
    // 1. Send email notification
    // 2. Create a "request" type invite that owner sees
    // 3. Open email client with pre-filled message

    const ownerEmail = await getOwnerEmail(currentGroup.userId);
    window.location.href = `mailto:${ownerEmail}?subject=Request to join ${titleId}&body=Please invite me to collaborate on ${titleId}/${groupId}`;
  };

  if (showAccessDenied) {
    return (
      <AccessDeniedModal
        titleId={titleId}
        groupId={groupId}
        onCreateOwn={handleCreateOwn}
        onRequestAccess={handleRequestAccess}
      />
    );
  }

  // ... rest of viewer component
}
```

### Phase 9: Auto-Accept Invites on Login

**File**: `vibes.diy/pkg/app/hooks/useAutoAcceptInvites.ts` (NEW)

```typescript
export function useAutoAcceptInvites() {
  const dashApi = useDashboardApi();
  const { getToken, user } = useClerkAuth();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!user || hasChecked.current) return;

    const acceptInvites = async () => {
      const token = await getToken();
      if (!token) return;

      const result = await dashApi.redeemInvite({
        type: "reqRedeemInvite",
        auth: { type: "clerk", token },
      });

      if (result.isOk() && result.Ok().invites.length > 0) {
        // Show notification
        console.log(`Accepted ${result.Ok().invites.length} invite(s)`);

        // Refresh groups to show newly accessible groups
        // (handled by groups hook reactivity)
      }
    };

    acceptInvites();
    hasChecked.current = true;
  }, [dashApi, getToken, user]);
}

// Call in root layout or app entry point
```

### Phase 10: Update Groups Page Filtering

**File**: `vibes.diy/pkg/app/routes/groups.tsx` (MODIFY)

Show owned vs shared groups:

```typescript
export default function Groups() {
  const { user } = useClerkAuth();
  const { groups, isLoading } = useAllGroups();

  const myGroups = groups.filter(g => g.userId === user?.id);
  const sharedGroups = groups.filter(
    g => g.sharedWith?.includes(user?.id) && g.userId !== user?.id
  );

  return (
    <BrutalistLayout title="Groups">
      <section className="my-groups">
        <h2>My Groups ({myGroups.length})</h2>
        {myGroups.map(group => (
          <GroupCard key={group._id} group={group} showInviteButton />
        ))}
      </section>

      {sharedGroups.length > 0 && (
        <section className="shared-groups">
          <h2>Shared With Me ({sharedGroups.length})</h2>
          {sharedGroups.map(group => (
            <GroupCard
              key={group._id}
              group={group}
              badge="Shared"
              showInviteButton={false}
            />
          ))}
        </section>
      )}
    </BrutalistLayout>
  );
}
```

## Testing Plan

1. **Create and Send Invite**
   - Create a group
   - Click "Invite" button
   - Enter email address
   - Verify invite shows in pending list
   - Check ledger created in Dashboard

2. **Accept Invite**
   - Log in with invited account
   - Verify auto-acceptance
   - Navigate to shared group
   - Verify documents sync
   - Make changes, verify they appear for owner

3. **Access Denied Flow**
   - Log out
   - Navigate to private group URL
   - Verify access denied modal appears
   - Test "Create Your Own" → creates new groupId
   - Test "Request Access" → opens email/shows owner contact

4. **Groups Page**
   - Verify "My Groups" shows owned groups
   - Verify "Shared With Me" shows invited groups
   - Verify collaborator count displays

5. **Real-time Sync**
   - Open same group in two browsers (owner + invited)
   - Create document in one browser
   - Verify appears in other browser
   - Test concurrent edits

## Open Questions

1. **Request Access Implementation**: How should "Request to Join" work?
   - **Option A**: Open `mailto:` link (simple, works now)
   - **Option B**: Create reverse invite (requires Dashboard API changes)
   - **Option C**: In-app notification system (future feature)

2. **Collaborator Display**: Should we show names/avatars of collaborators?
   - Need to query Dashboard user info by userId
   - Could cache in `vibes-groups` document

3. **Permission Granularity**: Should we support admin role for groups?
   - Admin = can invite others
   - Member = can edit
   - Viewer = read-only

4. **Group Discovery**: Should there be a way to browse public groups?
   - Would require Dashboard ledger query by status
   - Could add `public: boolean` field to groups

## Success Criteria

- [ ] Users can invite collaborators via email
- [ ] Invited users auto-accept on login
- [ ] Shared groups sync in real-time via Fireproof cloud
- [ ] Access denied modal works for unauthorized groups
- [ ] Groups page shows owned vs shared sections
- [ ] Pending invites display with cancel option
- [ ] Collaborator count shows on group cards
- [ ] No regressions in existing group creation/editing

## Dependencies

- ✅ `@fireproof/core-protocols-dashboard` - Dashboard API types
- ✅ `DashboardApi` class - Available via core
- ✅ Clerk authentication - Integrated
- ✅ Cloud sync (`toCloud()`) - Available in use-vibes
- ⚠️ May need toast/notification library for feedback

## References

- Dashboard API: `fireproof/core/protocols/dashboard/`
- SQL Schema: `fireproof/dashboard/backend/`
- URL Mapping: `use-vibes/base/index.ts` (constructDatabaseName)
- Group Management: `vibes.diy/pkg/app/hooks/useVibeGroups.ts`
- Clerk Integration: `use-vibes/base/clerk-token-strategy.ts`
