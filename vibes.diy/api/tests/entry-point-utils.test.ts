import { describe, expect, it } from "vitest";
import {
  calcEntryPointUrl,
  extractFsIdAndGroupIdFromHost,
} from "vibes-diy-api-svc";

describe("entry-point-utils", () => {
  describe("calcEntryPointUrl", () => {
    const fsId = "abc123";
    const groupId = "mygroup";

    it("replaces {fsid} in hostname", () => {
      const result = calcEntryPointUrl({
        urlTemplate: "https://{fsid}.vibes.app/path",
        fsId,
      });
      expect(result).toBe("https://abc123.vibes.app/path");
    });

    it("replaces {fsid} and {.groupid} with dot separator", () => {
      const result = calcEntryPointUrl({
        urlTemplate: "https://{fsid}{.groupid}.vibes.app/path",
        fsId,
        groupId,
      });
      expect(result).toBe("https://abc123.mygroup.vibes.app/path");
    });

    it("replaces {fsid} and {-groupid} with dash separator", () => {
      const result = calcEntryPointUrl({
        urlTemplate: "https://{fsid}{-groupid}.vibes.app/path",
        fsId,
        groupId,
      });
      expect(result).toBe("https://abc123-mygroup.vibes.app/path");
    });

    it("replaces {fsid} and {--groupid} with double dash separator", () => {
      const result = calcEntryPointUrl({
        urlTemplate: "https://{fsid}{--groupid}.vibes.app/path",
        fsId,
        groupId,
      });
      expect(result).toBe("https://abc123--mygroup.vibes.app/path");
    });

    it("leaves groupid placeholder when groupId is empty", () => {
      const result = calcEntryPointUrl({
        urlTemplate: "https://{fsid}{.groupid}.vibes.app/path",
        fsId,
        groupId: "",
      });
      expect(result).toBe("https://abc123.vibes.app/path");
    });

    it("leaves groupid placeholder when groupId is undefined", () => {
      const result = calcEntryPointUrl({
        urlTemplate: "https://{fsid}{-groupid}.vibes.app/path",
        fsId,
      });
      expect(result).toBe("https://abc123.vibes.app/path");
    });
  });

  describe("extractFsIdAndGroupIdFromHost", () => {
    it("extracts fsId from simple hostname", () => {
      const result = extractFsIdAndGroupIdFromHost({
        matchURL: "https://abc123.vibes.app/path/extra",
        urlTemplate: "https://{fsid}.vibes.app/path",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://abc123.vibes.app/path",
        fsId: "abc123",
        groupId: undefined,
        path: "/extra",
      });
    });

    it("extracts fsId and groupId with dot separator", () => {
      const result = extractFsIdAndGroupIdFromHost({
        matchURL: "https://abc123.mygroup.vibes.app/path",
        urlTemplate: "https://{fsid}{.groupid}.vibes.app/path",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://abc123.mygroup.vibes.app/path",
        fsId: "abc123",
        groupId: "mygroup",
        path: "/",
      });
    });

    it("extracts fsId and groupId with dash separator", () => {
      const result = extractFsIdAndGroupIdFromHost({
        matchURL: "https://abc123-mygroup.vibes.app/path/",
        urlTemplate: "https://{fsid}{-groupid}.vibes.app/path",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://abc123-mygroup.vibes.app/path",
        fsId: "abc123",
        groupId: "mygroup",
        path: "/",
      });
    });

    it("extracts fsId and groupId with double dash separator", () => {
      const result = extractFsIdAndGroupIdFromHost({
        matchURL: "https://abc123--mygroup.vibes.app/",
        urlTemplate: "https://{fsid}{--groupid}.vibes.app/path",
      });
      expect(result.Unwrap()).toEqual({
        fsId: "abc123",
        groupId: "mygroup",
        path: "/",
        url: "https://abc123--mygroup.vibes.app/path",
      });
    });

    it("returns None when hostname does not match", () => {
      const result = extractFsIdAndGroupIdFromHost({
        matchURL: "https://invalid.other.domain/path/mmmm",
        urlTemplate: "https://{fsid}.vibes.app/path",
      });
      expect(result.IsNone()).toBe(true);
    });

    it("returns None when hostname partially matches but structure differs", () => {
      const result = extractFsIdAndGroupIdFromHost({
        matchURL: "https://abc123.vibes.app.extra/xxxxx",
        urlTemplate: "https://{fsid}.vibes.app/path",
      });
      expect(result.IsNone()).toBe(true);
    });

    it("roundtrip: calcEntryPointUrl -> extractFsIdAndGroupIdFromHost", () => {
      const fsId = "testfsid";
      const groupId = "testgroup";
      const urlTemplate = "https://{fsid}{--groupid}.vibes.app/path";

      const url = calcEntryPointUrl({ urlTemplate, fsId, groupId });
      const hostname = new URL(url).hostname;

      const extracted = extractFsIdAndGroupIdFromHost({
        matchURL: `http://${hostname}`,
        urlTemplate,
      });

      expect(extracted.Unwrap()).toEqual({
        fsId,
        groupId,
        path: "/",
        url: "https://testfsid--testgroup.vibes.app/path",
      });
    });

    it("roundtrip without groupId", () => {
      const fsId = "singlefsid";
      const urlTemplate = "https://{fsid}.vibes.app/path";

      const url = calcEntryPointUrl({ urlTemplate, fsId });
      const hostname = new URL(url).hostname;

      const extracted = extractFsIdAndGroupIdFromHost({
        matchURL: `https://${hostname}`,
        urlTemplate,
      });

      expect(extracted.Unwrap()).toEqual({
        fsId,
        groupId: undefined,
        path: "/",
        url: "https://singlefsid.vibes.app/path",
      });
    });
  });
});
