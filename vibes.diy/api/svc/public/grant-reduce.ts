/**
 * Grant reduce — pure logic module.
 *
 * Materializes channel/role membership state from access function outputs.
 * Each document may contribute member declarations and channel grants.
 * GrantReduce accumulates contributions and produces effective channel sets
 * for individual users via two-pass role expansion.
 *
 * Subtraction uses full rebuild (re-scan all docs) rather than reference
 * counting — simpler, correct, fast enough for expected doc counts.
 *
 * See docs/superpowers/specs/2026-05-31-firefly-access-function.html
 */

import type { AccessDescriptor } from "@vibes.diy/api-types";

export type { AccessDescriptor };

/**
 * Per-document extracted grant data from a single AccessDescriptor result.
 */
export interface DocContribution {
  /** roleName → Set<userSlug> from result.members */
  members: Map<string, Set<string>>;
  /** roleName → Set<channelId> from result.grant.roles */
  grantRoles: Map<string, Set<string>>;
  /** userSlug → Set<channelId> from result.grant.users */
  grantUsers: Map<string, Set<string>>;
  /** Set<channelId> from result.grant.public */
  grantPublic: Set<string>;
}

function hasContent(c: DocContribution): boolean {
  return c.members.size > 0 || c.grantRoles.size > 0 || c.grantUsers.size > 0 || c.grantPublic.size > 0;
}

/**
 * Converts an AccessDescriptor into a DocContribution.
 */
export function extractContribution(desc: AccessDescriptor): DocContribution {
  const members = new Map<string, Set<string>>();
  if (desc.members) {
    for (const [role, users] of Object.entries(desc.members)) {
      members.set(role, new Set(users));
    }
  }

  const grantRoles = new Map<string, Set<string>>();
  if (desc.grant?.roles) {
    for (const [role, channels] of Object.entries(desc.grant.roles)) {
      grantRoles.set(role, new Set(channels));
    }
  }

  const grantUsers = new Map<string, Set<string>>();
  if (desc.grant?.users) {
    for (const [user, channels] of Object.entries(desc.grant.users)) {
      grantUsers.set(user, new Set(channels));
    }
  }

  const grantPublic = new Set<string>(desc.grant?.public ?? []);

  return { members, grantRoles, grantUsers, grantPublic };
}

/**
 * Accumulates DocContributions and materializes effective grants.
 *
 * Maintains per-doc contributions so that removing a document's contribution
 * can be handled by rebuilding (re-unioning all remaining docs).
 */
export class GrantReduce {
  /** Per-doc contributions stored for incremental updates */
  readonly docContributions = new Map<string, DocContribution>();

  /** Reduced state: roleName → Set<userSlug> */
  effectiveMembers = new Map<string, Set<string>>();
  /** Reduced state: roleName → Set<channelId> */
  roleGrants = new Map<string, Set<string>>();
  /** Reduced state: userSlug → Set<channelId> */
  userGrants = new Map<string, Set<string>>();
  /** Reduced state: Set<channelId> accessible to all users */
  publicChannels = new Set<string>();

  _hydrated = false;

  get isHydrated(): boolean {
    return this._hydrated;
  }

  markHydrated(): void {
    this._hydrated = true;
  }

  /**
   * Adds or updates a document's contribution.
   * If the docId already exists, triggers a full rebuild.
   * Contributions with no grants are skipped (not stored).
   */
  addDoc(docId: string, contribution: DocContribution): void {
    if (!hasContent(contribution)) {
      return;
    }
    const existed = this.docContributions.has(docId);
    this.docContributions.set(docId, contribution);
    if (existed) {
      this.rebuild();
    } else {
      this.unionContribution(contribution);
    }
  }

  /**
   * Removes a document's contribution and rebuilds the reduced state.
   */
  removeDoc(docId: string): void {
    const existed = this.docContributions.delete(docId);
    if (existed) {
      this.rebuild();
    }
  }

  /**
   * Returns the effective set of channel IDs accessible to a user.
   * Two-pass: union of direct user grants + role-expanded grants.
   */
  resolveEffectiveChannels(userSlug: string): Set<string> {
    const result = new Set<string>();

    // Pass 1: direct user grants
    const direct = this.userGrants.get(userSlug);
    if (direct) {
      for (const ch of direct) {
        result.add(ch);
      }
    }

    // Pass 2: role-expanded grants
    for (const [roleName, members] of this.effectiveMembers) {
      if (members.has(userSlug)) {
        const roleChannels = this.roleGrants.get(roleName);
        if (roleChannels) {
          for (const ch of roleChannels) {
            result.add(ch);
          }
        }
      }
    }

    return result;
  }

  /**
   * Checks whether a user has a given role in the effective member state.
   */
  hasRole(userSlug: string, roleName: string): boolean {
    return this.effectiveMembers.get(roleName)?.has(userSlug) ?? false;
  }

  /**
   * Clears all reduced state and rebuilds from docContributions.
   */
  private rebuild(): void {
    this.effectiveMembers = new Map();
    this.roleGrants = new Map();
    this.userGrants = new Map();
    this.publicChannels = new Set();

    for (const contribution of this.docContributions.values()) {
      this.unionContribution(contribution);
    }
  }

  /**
   * Merges a single contribution's data into the reduced maps.
   */
  private unionContribution(c: DocContribution): void {
    for (const [role, users] of c.members) {
      let set = this.effectiveMembers.get(role);
      if (!set) {
        set = new Set();
        this.effectiveMembers.set(role, set);
      }
      for (const u of users) {
        set.add(u);
      }
    }

    for (const [role, channels] of c.grantRoles) {
      let set = this.roleGrants.get(role);
      if (!set) {
        set = new Set();
        this.roleGrants.set(role, set);
      }
      for (const ch of channels) {
        set.add(ch);
      }
    }

    for (const [user, channels] of c.grantUsers) {
      let set = this.userGrants.get(user);
      if (!set) {
        set = new Set();
        this.userGrants.set(user, set);
      }
      for (const ch of channels) {
        set.add(ch);
      }
    }

    for (const ch of c.grantPublic) {
      this.publicChannels.add(ch);
    }
  }
}
