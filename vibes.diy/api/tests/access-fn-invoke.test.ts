import { describe, it } from "vitest";

describe("invokeAccessFn gate (unit — fake invoker)", { timeout: 15000 }, () => {
  it.todo("authenticated write passes access fn allowing anonymous");
  it.todo("anonymous write rejected when fn returns {}");
  it.todo("anonymous write allowed when fn returns { allowAnonymous: true }");
  it.todo("new CID causes fresh invocation");
});
