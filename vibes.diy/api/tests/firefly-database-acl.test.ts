import { beforeAll, describe, expect, it } from "vitest";
import { FireflyDatabase, type FireflyTransport } from "@vibes.diy/vibe-runtime";
import { Result } from "@adviser/cement";
import type { DbAcl } from "@vibes.diy/vibe-types";

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

function makeFakeTransport(setDbAclFn?: (dbName: string, acl: DbAcl) => void): FireflyTransport {
  return {
    svc: { vibeApp: { appSlug: "myapp", ownerHandle: "alice", fsId: "fs1" } },
    putDoc: () => Promise.resolve(Result.Err("not used")),
    getDoc: () => Promise.resolve(Result.Err("not used")),
    queryDocs: () => Promise.resolve(Result.Err("not used")),
    deleteDoc: () => Promise.resolve(Result.Err("not used")),
    subscribeDocs: () => Promise.resolve(Result.Ok({ type: "vibes.diy.res-subscribe-docs" as const, status: "ok" as const })),
    setDbAcl: (dbName, acl) => {
      setDbAclFn?.(dbName, acl);
      return Promise.resolve(
        Result.Ok({
          type: "vibes.diy.res-set-db-acl" as const,
          status: "ok" as const,
          tid: "fake-tid",
        })
      );
    },
    onMsg: () => {
      /* noop */
    },
  };
}

describe("FireflyDatabase acl option", () => {
  it("calls setDbAcl on construction when acl is provided", async () => {
    const calls: { dbName: string; acl: DbAcl }[] = [];
    const transport = makeFakeTransport((dbName, acl) => calls.push({ dbName, acl }));

    const acl: DbAcl = { write: ["editors"], delete: ["editors"] };
    new FireflyDatabase("announcements", transport, acl);

    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ dbName: "announcements", acl });
  });

  it("does NOT call setDbAcl when no acl is provided", async () => {
    const calls: { dbName: string; acl: DbAcl }[] = [];
    const transport = makeFakeTransport((dbName, acl) => calls.push({ dbName, acl }));

    new FireflyDatabase("default", transport);

    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toHaveLength(0);
  });

  it("applyAcl calls setDbAcl with the new acl", async () => {
    const calls: { dbName: string; acl: DbAcl }[] = [];
    const transport = makeFakeTransport((dbName, acl) => calls.push({ dbName, acl }));

    const db = new FireflyDatabase("general", transport);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(0);

    const acl: DbAcl = { write: ["members"] };
    db.applyAcl(acl);
    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ dbName: "general", acl });
  });
});
