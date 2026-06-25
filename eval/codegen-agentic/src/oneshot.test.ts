import { describe, it, expect } from "vitest";
import { runOneShot } from "./oneshot.js";

// Minimal fake OpenRouter client: getText() yields `texts[call]`, or throws if it is an Error.
function fakeClient(texts: (string | Error)[]) {
  let call = 0;
  return {
    callModel() {
      const v = texts[call++];
      return {
        async getText() {
          if (v instanceof Error) throw v;
          return v;
        },
        async getResponse() {
          return { totalCost: 0 };
        },
      };
    },
  } as never;
}

const SYS = "system";
const APP = "App.jsx\n```jsx\nimport React from 'react';\nexport default function App(){ return <div/>; }\n```";

describe("runOneShot retry", () => {
  it("retries a transient error then succeeds", async () => {
    const client = fakeClient([new Error("503 Service Unavailable"), APP]);
    const r = await runOneShot(client, "m", SYS, "p", 2);
    expect(r.exitState).toBe("ok");
  });
  it("does not retry a non-transient error and marks it non-transient", async () => {
    const client = fakeClient([new Error("400 Bad Request")]);
    const r = await runOneShot(client, "m", SYS, "p", 2);
    expect(r.exitState).toBe("errored");
    expect(r.transient).toBe(false);
  });
});
