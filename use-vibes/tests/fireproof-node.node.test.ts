import { describe, it, expect, beforeEach } from "vitest";
import { __resetFireproofForTesting, fireproof, type FireproofOpts } from "../base/fireproof-node.js";

function fakeGetToken() {
  return async () => ({ isOk: () => true, Ok: () => ({ type: "device-id" as const, token: "tkn" }), isErr: () => false });
}

function makeOpts(overrides: Partial<FireproofOpts> = {}): FireproofOpts {
  return {
    apiUrl: "ws://test.invalid",
    appSlug: "my-app",
    userSlug: "alice",
    getToken: fakeGetToken() as FireproofOpts["getToken"],
    ...overrides,
  };
}

beforeEach(() => {
  __resetFireproofForTesting();
});

describe("fireproof() factory", () => {
  it("returns a database synchronously when called with explicit opts", () => {
    const db = fireproof("todos", makeOpts());
    expect(db.name).toBe("todos");
    expect(typeof db.put).toBe("function");
  });

  it("repeated calls with the same name return the same instance (KeyedResolvOnce cache)", () => {
    const a = fireproof("todos", makeOpts());
    const b = fireproof("todos", makeOpts());
    expect(a).toBe(b);
  });

  it("calls with different names return different instances", () => {
    const a = fireproof("a", makeOpts());
    const b = fireproof("b", makeOpts());
    expect(a).not.toBe(b);
    expect(a.name).toBe("a");
    expect(b.name).toBe("b");
  });

  it("__resetFireproofForTesting clears the cache so a new instance is created", () => {
    const before = fireproof("todos", makeOpts());
    __resetFireproofForTesting();
    const after = fireproof("todos", makeOpts());
    expect(before).not.toBe(after);
  });
});
