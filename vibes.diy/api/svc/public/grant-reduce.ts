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
  /** roleName → Set<userHandle> from result.members */
  members: Map<string, Set<string>>;
  /** roleName → Set<channelId> from result.grant.roles */
  grantRoles: Map<string, Set<string>>;
  /** userHandle → Set<channelId> from result.grant.users */
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

  /** Reduced state: roleName → Set<userHandle> */
  effectiveMembers = new Map<string, Set<string>>();
  /** Reduced state: roleName → Set<channelId> */
  roleGrants = new Map<string, Set<string>>();
  /** Reduced state: userHandle → Set<channelId> */
  userGrants = new Map<string, Set<string>>();
  /** Reduced state: Set<channelId> accessible to all users */
  publicChannels = new Set<string>();

  _hydrated = false;

  /**
   * A synthetic contribution kept OUTSIDE `docContributions` so its reserved
   * identity cannot collide with a user document `_id` (docIds are caller-
   * supplied and may be any string). Unioned on every (re)build. See `setSeed`.
   */
  private seedContribution: DocContribution | undefined;

  get isHydrated(): boolean {
    return this._hydrated;
  }

  markHydrated(): void {
    this._hydrated = true;
  }

  /**
   * Installs (or clears) the synthetic seed contribution — e.g. the deploy-time
   * owner-role seed (see `seedOwnerGrants`). Stored separately from
   * `docContributions` so it can never share a Map key with a real document,
   * and re-applied on every `rebuild()` so a later doc update can't drop it.
   */
  setSeed(contribution: DocContribution | undefined): void {
    this.seedContribution = contribution && hasContent(contribution) ? contribution : undefined;
    this.rebuild();
  }

  /**
   * Adds or updates a document's contribution.
   * If the docId already exists, triggers a full rebuild.
   * Contributions with no grants are skipped (not stored).
   */
  addDoc(docId: string, contribution: DocContribution): void {
    if (!hasContent(contribution)) {
      if (this.docContributions.has(docId)) {
        this.docContributions.delete(docId);
        this.rebuild();
      }
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
  resolveEffectiveChannels(userHandle: string): Set<string> {
    const result = new Set<string>();

    // Pass 1: direct user grants
    const direct = this.userGrants.get(userHandle);
    if (direct) {
      for (const ch of direct) {
        result.add(ch);
      }
    }

    // Pass 2: role-expanded grants
    for (const [roleName, members] of this.effectiveMembers) {
      if (members.has(userHandle)) {
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
  hasRole(userHandle: string, roleName: string): boolean {
    return this.effectiveMembers.get(roleName)?.has(userHandle) ?? false;
  }

  /**
   * Clears all reduced state and rebuilds from docContributions.
   */
  private rebuild(): void {
    this.effectiveMembers = new Map();
    this.roleGrants = new Map();
    this.userGrants = new Map();
    this.publicChannels = new Set();

    if (this.seedContribution) {
      this.unionContribution(this.seedContribution);
    }
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

/**
 * Reserved role the vibe owner is ALWAYS seeded into at deploy time.
 *
 * This is the backstop for the owner-role-seeding design (spec
 * docs/superpowers/specs/2026-06-23-owner-role-seeding-design.md §3): even when
 * a vibe declares no `ownerRoles`, the owner holds `owner`, so an `access.js`
 * that gates management docs on `ctx.requireRole("owner")` can never be a
 * forgotten brick. It is a NORMAL members entry — visible in computed grants,
 * revocable, transferable — never a special-case bypass in auth evaluation.
 */
export const RESERVED_OWNER_ROLE = "owner";

/**
 * Inject the deploy-time owner seed into a reduce: the owner handle becomes a
 * member of the reserved `owner` role plus every declared `ownerRoles` role.
 *
 * This is the single shared helper every grant-reduce site calls (write gate,
 * the read reduces, and who-am-i's resolveGrants) so server enforcement and the
 * client `can.*` predictor agree on the owner's roles. The seed is the ONLY
 * thing that knows "owner" — it expresses that purely as grant state, keeping
 * enforcement roles-only (no `user.isOwner` branch).
 *
 * The seed is installed via `setSeed` (a dedicated slot OUTSIDE
 * `docContributions`), so its reserved identity can never collide with a user
 * document `_id`, and it is re-unioned on every `rebuild()` so a later doc
 * update can't drop it.
 *
 * No-op when `ownerHandle` is falsy. `ownerRoles` defaults to empty (reserved
 * role only).
 */
export function seedOwnerGrants(reduce: GrantReduce, ownerHandle: string | undefined, ownerRoles: readonly string[] = []): void {
  if (!ownerHandle) return;
  const members = new Map<string, Set<string>>();
  members.set(RESERVED_OWNER_ROLE, new Set([ownerHandle]));
  for (const role of ownerRoles) {
    let set = members.get(role);
    if (!set) {
      set = new Set();
      members.set(role, set);
    }
    set.add(ownerHandle);
  }
  reduce.setSeed({
    members,
    grantRoles: new Map(),
    grantUsers: new Map(),
    grantPublic: new Set(),
  });
}

/**
 * Parse the JSON `ownerRoles` column off an AccessFunctionBindings row into a
 * string[]. Tolerant: null/undefined/malformed → []. (The reserved `owner` role
 * is seeded regardless, so [] still seeds the owner into `owner`.)
 */
export function parseOwnerRoles(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Construct a GrantReduce pre-seeded with the owner's roles. This is the single
 * entry point every reduce site uses (write gate, read reduces, who-am-i, and
 * the write-delta clone) so server enforcement and the client `can.*` predictor
 * agree on the owner's roles. Add stored access-fn outputs afterward with
 * `addDoc` — the seed lives outside `docContributions` and survives rebuilds.
 */
export function newSeededReduce(ownerHandle: string | undefined, ownerRoles: readonly string[] = []): GrantReduce {
  const reduce = new GrantReduce();
  seedOwnerGrants(reduce, ownerHandle, ownerRoles);
  return reduce;
}
