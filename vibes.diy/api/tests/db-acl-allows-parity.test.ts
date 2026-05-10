import { describe, it, expect } from "vitest";
import { aclAllows as hostAcl } from "@vibes.diy/api-svc/public/db-acl-resolver.js";
import { aclAllows as clientAcl } from "@vibes.diy/vibe-runtime";
import type { DocAccessLevel } from "@vibes.diy/vibe-types";
import type { DbAcl } from "@vibes.diy/vibe-runtime";

describe("aclAllows host/client parity", () => {
  const acls: (DbAcl | undefined)[] = [
    undefined,
    { read: ["readers"] },
    { write: ["editors"] },
    { write: ["submitters"] },
    { delete: ["editors"] },
    { read: ["members"], write: ["editors"] },
  ];
  const accesses: DocAccessLevel[] = ["owner", "editor", "viewer", "submitter", "none"];
  const caps = ["read", "write", "delete"] as const;

  it.each(acls.flatMap((acl) => accesses.flatMap((acc) => caps.map((cap) => ({ acl, acc, cap })))))(
    "$cap on $acc with acl=$acl matches",
    ({ acl, acc, cap }) => {
      expect(clientAcl(acl, cap, acc)).toBe(hostAcl(acl, cap, acc));
    }
  );
});
