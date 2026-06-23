import { describe, it, expect } from "vitest";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { GrantReduce, extractContribution, seedOwnerGrants, RESERVED_OWNER_ROLE } from "../svc/public/grant-reduce.js";

describe("extractContribution", () => {
  it("extracts members from AccessDescriptor", () => {
    const desc: AccessDescriptor = {
      members: { admin: ["alice", "bob"] },
    };
    const contrib = extractContribution(desc);
    expect(contrib.members.get("admin")).toEqual(new Set(["alice", "bob"]));
    expect(contrib.grantRoles.size).toBe(0);
    expect(contrib.grantUsers.size).toBe(0);
    expect(contrib.grantPublic.size).toBe(0);
  });

  it("extracts grant.users from AccessDescriptor", () => {
    const desc: AccessDescriptor = {
      grant: { users: { alice: ["chan-a", "chan-b"] } },
    };
    const contrib = extractContribution(desc);
    expect(contrib.grantUsers.get("alice")).toEqual(new Set(["chan-a", "chan-b"]));
  });

  it("extracts grant.roles from AccessDescriptor", () => {
    const desc: AccessDescriptor = {
      grant: { roles: { admin: ["chan-x"] } },
    };
    const contrib = extractContribution(desc);
    expect(contrib.grantRoles.get("admin")).toEqual(new Set(["chan-x"]));
  });

  it("extracts grant.public from AccessDescriptor", () => {
    const desc: AccessDescriptor = {
      grant: { public: ["public-chan"] },
    };
    const contrib = extractContribution(desc);
    expect(contrib.grantPublic).toEqual(new Set(["public-chan"]));
  });
});

describe("GrantReduce", () => {
  it("union: two docs granting same channel to different users — both have access, third does not", () => {
    const gr = new GrantReduce();
    gr.addDoc("doc1", extractContribution({ grant: { users: { alice: ["chan-a"] } } }));
    gr.addDoc("doc2", extractContribution({ grant: { users: { bob: ["chan-a"] } } }));

    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set(["chan-a"]));
    expect(gr.resolveEffectiveChannels("bob")).toEqual(new Set(["chan-a"]));
    expect(gr.resolveEffectiveChannels("carol")).toEqual(new Set());
  });

  it("subtract/rebuild: delete one doc — that doc's grants removed, other doc's grants survive", () => {
    const gr = new GrantReduce();
    gr.addDoc("doc1", extractContribution({ grant: { users: { alice: ["chan-a"] } } }));
    gr.addDoc("doc2", extractContribution({ grant: { users: { bob: ["chan-b"] } } }));

    gr.removeDoc("doc1");

    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set());
    expect(gr.resolveEffectiveChannels("bob")).toEqual(new Set(["chan-b"]));
  });

  it("two-pass: role-channels doc + membership doc — user gets channels via role expansion", () => {
    const gr = new GrantReduce();
    // Doc that grants channels to a role
    gr.addDoc("role-doc", extractContribution({ grant: { roles: { admin: ["chan-admin"] } } }));
    // Doc that gives alice the admin role
    gr.addDoc("member-doc", extractContribution({ members: { admin: ["alice"] } }));

    const channels = gr.resolveEffectiveChannels("alice");
    expect(channels).toEqual(new Set(["chan-admin"]));
  });

  it("role removal: delete membership doc — user loses role-expanded channels", () => {
    const gr = new GrantReduce();
    gr.addDoc("role-doc", extractContribution({ grant: { roles: { admin: ["chan-admin"] } } }));
    gr.addDoc("member-doc", extractContribution({ members: { admin: ["alice"] } }));

    gr.removeDoc("member-doc");

    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set());
  });

  it("direct + role overlap: removing direct grant does not remove role-expanded channel", () => {
    const gr = new GrantReduce();
    gr.addDoc("role-doc", extractContribution({ grant: { roles: { admin: ["chan-shared"] } } }));
    gr.addDoc("member-doc", extractContribution({ members: { admin: ["alice"] } }));
    gr.addDoc("direct-doc", extractContribution({ grant: { users: { alice: ["chan-shared"] } } }));

    // alice has access via both direct grant and role expansion
    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set(["chan-shared"]));

    // Remove the direct grant
    gr.removeDoc("direct-doc");

    // alice still has access via role
    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set(["chan-shared"]));
  });

  it("update to no-grant clears stale grants", () => {
    const gr = new GrantReduce();
    gr.addDoc("meta1", extractContribution({ grant: { users: { alice: ["chan-general"] } } }));
    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set(["chan-general"]));

    // Update the same doc to have no grants
    gr.addDoc("meta1", extractContribution({ channels: ["chan-general"] }));
    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set());
  });

  it("empty reduce: no docs — resolveEffectiveChannels returns empty set", () => {
    const gr = new GrantReduce();
    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set());
    expect(gr.resolveEffectiveChannels("anyone")).toEqual(new Set());
  });

  it("isHydrated: tracks state correctly (false initially, true after markHydrated)", () => {
    const gr = new GrantReduce();
    expect(gr.isHydrated).toBe(false);
    gr.markHydrated();
    expect(gr.isHydrated).toBe(true);
  });

  it("hasRole: checks effective members correctly", () => {
    const gr = new GrantReduce();
    gr.addDoc("member-doc", extractContribution({ members: { admin: ["alice", "bob"] } }));

    expect(gr.hasRole("alice", "admin")).toBe(true);
    expect(gr.hasRole("bob", "admin")).toBe(true);
    expect(gr.hasRole("carol", "admin")).toBe(false);
    expect(gr.hasRole("alice", "editor")).toBe(false);
  });
});

describe("seedOwnerGrants", () => {
  it("always seeds the reserved owner role, even with no declared ownerRoles", () => {
    const gr = new GrantReduce();
    seedOwnerGrants(gr, "garden-gnome");

    expect(gr.hasRole("garden-gnome", RESERVED_OWNER_ROLE)).toBe(true);
    expect(gr.hasRole("someone-else", RESERVED_OWNER_ROLE)).toBe(false);
  });

  it("seeds every declared ownerRole plus the reserved owner role", () => {
    const gr = new GrantReduce();
    seedOwnerGrants(gr, "garden-gnome", ["editor", "admin"]);

    expect(gr.hasRole("garden-gnome", "editor")).toBe(true);
    expect(gr.hasRole("garden-gnome", "admin")).toBe(true);
    expect(gr.hasRole("garden-gnome", RESERVED_OWNER_ROLE)).toBe(true);
  });

  it("survives a rebuild triggered by a later real doc (stored as a contribution, not mutated)", () => {
    const gr = new GrantReduce();
    seedOwnerGrants(gr, "garden-gnome", ["editor"]);
    // A later doc UPDATE forces a full rebuild from docContributions.
    gr.addDoc("doc1", extractContribution({ grant: { users: { alice: ["list"] } } }));
    gr.addDoc("doc1", extractContribution({ grant: { users: { alice: ["list", "extra"] } } }));

    // Seed must still be present after the rebuild.
    expect(gr.hasRole("garden-gnome", "editor")).toBe(true);
    expect(gr.hasRole("garden-gnome", RESERVED_OWNER_ROLE)).toBe(true);
    expect(gr.resolveEffectiveChannels("alice")).toEqual(new Set(["list", "extra"]));
  });

  it("unions with role-channel grants so the owner resolves the role's channels", () => {
    const gr = new GrantReduce();
    // App doc grants the editor role a channel; owner is seeded into editor.
    gr.addDoc("role-doc", extractContribution({ grant: { roles: { editor: ["list"] } } }));
    seedOwnerGrants(gr, "garden-gnome", ["editor"]);

    expect(gr.resolveEffectiveChannels("garden-gnome")).toEqual(new Set(["list"]));
  });

  it("is a no-op when ownerHandle is falsy", () => {
    const gr = new GrantReduce();
    seedOwnerGrants(gr, undefined, ["editor"]);
    expect(gr.effectiveMembers.size).toBe(0);
  });
});
