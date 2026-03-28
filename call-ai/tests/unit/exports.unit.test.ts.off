/**
 * Test to verify export aliases for backward compatibility
 */

import { describe, expect, it } from "vitest";
import * as callAi from "call-ai";

describe("Export Aliases", () => {
  it("should export both callAi and callAI for backward compatibility", () => {
    // Both export names should exist
    expect(typeof callAi.callAi).toBe("function");
    expect(typeof callAi.callAI).toBe("function");

    // They should be the same function
    expect(callAi.callAi).toBe(callAi.callAI);
  });
});
