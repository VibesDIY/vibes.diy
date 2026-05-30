import type { ResGetAppByFsId } from "@vibes.diy/api-types";

export type VibeCardVariant = "request" | "invite" | "pending" | "revoked" | "not-found" | "iframe" | "loading";

export function computeCardVariant(grant: ResGetAppByFsId["grant"] | undefined): VibeCardVariant {
  switch (grant) {
    case "req-login.request":
      return "request";
    case "req-login.invite":
      return "invite";
    case "pending-request":
      return "pending";
    case "revoked-access":
      return "revoked";
    case "not-found":
    case "not-grant":
      return "not-found";
    case "accepted-email-invite":
    case "granted-access.editor":
    case "granted-access.viewer":
    case "granted-access.submitter":
    case "public-access":
    case "owner":
      return "iframe";
    default:
      return "loading";
  }
}
