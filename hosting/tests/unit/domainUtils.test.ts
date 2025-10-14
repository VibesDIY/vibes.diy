import { describe, it, expect } from "vitest";
import { isCustomDomain, isFirstPartyApexDomain, isFirstPartySubdomain } from "../src/utils/domainUtils";

describe("Domain Utils", () => {
  describe("isCustomDomain", () => {
    it("should return true for actual custom domains", () => {
      expect(isCustomDomain("example.com")).toBe(true);
      expect(isCustomDomain("mycustomdomain.io")).toBe(true);
      expect(isCustomDomain("subdomain.example.com")).toBe(true);
      expect(isCustomDomain("app.subdomain.example.com")).toBe(true);
    });

    it("should return false for first-party apex domains", () => {
      expect(isCustomDomain("vibesdiy.app")).toBe(false);
      expect(isCustomDomain("vibesdiy.work")).toBe(false);
      expect(isCustomDomain("vibecode.garden")).toBe(false);
    });

    it("should return false for first-party subdomains", () => {
      expect(isCustomDomain("test-app.vibesdiy.app")).toBe(false);
      expect(isCustomDomain("my-app_instance.vibesdiy.work")).toBe(false);
      expect(isCustomDomain("some-app.vibecode.garden")).toBe(false);
    });
  });

  describe("isFirstPartyApexDomain", () => {
    it("should return true for apex domains", () => {
      expect(isFirstPartyApexDomain("vibesdiy.app")).toBe(true);
      expect(isFirstPartyApexDomain("vibesdiy.work")).toBe(true);
      expect(isFirstPartyApexDomain("vibecode.garden")).toBe(true);
    });

    it("should return false for subdomains", () => {
      expect(isFirstPartyApexDomain("test.vibesdiy.app")).toBe(false);
      expect(isFirstPartyApexDomain("app.vibesdiy.work")).toBe(false);
    });

    it("should return false for custom domains", () => {
      expect(isFirstPartyApexDomain("example.com")).toBe(false);
      expect(isFirstPartyApexDomain("mycustomdomain.io")).toBe(false);
    });
  });

  describe("isFirstPartySubdomain", () => {
    it("should return true for first-party subdomains", () => {
      expect(isFirstPartySubdomain("test-app.vibesdiy.app")).toBe(true);
      expect(isFirstPartySubdomain("my-app_instance.vibesdiy.work")).toBe(true);
      expect(isFirstPartySubdomain("some-app.vibecode.garden")).toBe(true);
    });

    it("should return false for apex domains", () => {
      expect(isFirstPartySubdomain("vibesdiy.app")).toBe(false);
      expect(isFirstPartySubdomain("vibesdiy.work")).toBe(false);
      expect(isFirstPartySubdomain("vibecode.garden")).toBe(false);
    });

    it("should return false for custom domains", () => {
      expect(isFirstPartySubdomain("example.com")).toBe(false);
      expect(isFirstPartySubdomain("subdomain.example.com")).toBe(false);
    });
  });
});
