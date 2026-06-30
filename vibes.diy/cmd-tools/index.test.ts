import { describe, expect, it, vi } from "vitest";
import { isCmdProgress, isCmdTSMsg, sendProgress, type WrapCmdTSMsg } from "./index.js";

describe("cmd-ts framework primitives", () => {
  const validCmdTSMsg = {
    type: "msg.cmd-ts",
    cmdTs: { raw: { hello: "world" }, outputFormat: "json" },
    result: { ok: true },
  };

  describe("CmdTSMsg / isCmdTSMsg", () => {
    it("accepts a well-formed cmd-ts message", () => {
      expect(isCmdTSMsg(validCmdTSMsg)).toBe(true);
    });

    it("accepts both json and text output formats", () => {
      expect(isCmdTSMsg({ ...validCmdTSMsg, cmdTs: { raw: 1, outputFormat: "text" } })).toBe(true);
    });

    it("rejects a wrong type discriminator", () => {
      expect(isCmdTSMsg({ ...validCmdTSMsg, type: "msg.other" })).toBe(false);
    });

    it("rejects an invalid output format", () => {
      expect(isCmdTSMsg({ ...validCmdTSMsg, cmdTs: { raw: 1, outputFormat: "yaml" } })).toBe(false);
    });

    it("rejects non-objects", () => {
      expect(isCmdTSMsg(undefined)).toBe(false);
      expect(isCmdTSMsg("nope")).toBe(false);
      expect(isCmdTSMsg(null)).toBe(false);
    });
  });

  describe("CmdProgress / isCmdProgress", () => {
    const progress = { type: "core-cli.progress", level: "info", message: "hi" };

    it("accepts a well-formed progress message", () => {
      expect(isCmdProgress(progress)).toBe(true);
    });

    it("accepts every level", () => {
      for (const level of ["info", "warn", "error"] as const) {
        expect(isCmdProgress({ ...progress, level })).toBe(true);
      }
    });

    it("rejects an unknown level", () => {
      expect(isCmdProgress({ ...progress, level: "debug" })).toBe(false);
    });

    it("rejects a non-string message", () => {
      expect(isCmdProgress({ ...progress, message: 42 })).toBe(false);
    });

    it("does not confuse a progress message with a cmd-ts message", () => {
      expect(isCmdTSMsg(progress)).toBe(false);
      expect(isCmdProgress(validCmdTSMsg)).toBe(false);
    });
  });

  describe("sendProgress", () => {
    it("streams a progress message on the request's channel, preserving the envelope", async () => {
      const request: WrapCmdTSMsg<unknown> = validCmdTSMsg as WrapCmdTSMsg<unknown>;
      const send = vi.fn().mockResolvedValue(undefined);
      const ctx = { request, send: { send } } as never;

      await sendProgress(ctx, "warn", "halfway there");

      expect(send).toHaveBeenCalledTimes(1);
      const [passedCtx, payload] = send.mock.calls[0];
      expect(passedCtx).toBe(ctx);
      expect(payload).toEqual({
        ...validCmdTSMsg,
        result: { type: "core-cli.progress", level: "warn", message: "halfway there" },
      });
      expect(isCmdProgress(payload.result)).toBe(true);
    });
  });
});
