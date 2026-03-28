import { BuildURI, Result } from "@adviser/cement";
import { EmailOps, isEmailOpsInvite, RawEmailWithoutFrom } from "@vibes.diy/api-types";
import { QueueCtx } from "../queue-ctx.js";

export function sendEmailOpts(vctx: QueueCtx, ops: EmailOps[]): Promise<Result<void>[]> {
  return Promise.all(
    ops.map((op) => {
      let raw!: RawEmailWithoutFrom;

      const buri = BuildURI.from(vctx.params.vibes.env.VIBES_DIY_PUBLIC_BASE_URL)
        .appendRelative("vibe")
        .appendRelative(op.userSlug)
        .appendRelative(op.appSlug);

      if (isEmailOpsInvite(op)) {
        buri.setParam("token", op.token);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(op.dst)) {
        console.warn(`Invalid email address: ${op.dst}, skipping email sending for this operation.`);
        return Result.Ok();
      }

      switch (op.action) {
        case "invite-revoked":
          raw = {
            to: op.dst,
            subject: `Your invitation as ${op.role} to the Vibe App "${op.appSlug}" has been revoked`,
            text: [
              "Hello,",

              `We wanted to inform you that your invitation as ${op.role} to the app "${op.appSlug}" on Vibes DIY has been revoked by ${op.userSlug}.`,

              "If you have any questions or believe this was a mistake, please reach out to the app owner directly.",
            ].join("\n\n"),
          };
          break;
        case "invite":
          raw = {
            to: op.dst,
            subject: `You've been invited as ${op.role} a Vibe App from ${op.userSlug}`,
            text: [
              "Hello,",

              `You have been invited as ${op.role} to the app "${op.appSlug}" on Vibes DIY by ${op.userSlug}.`,

              "To accept the invitation and start collaborating, please click the link below:",
              `${buri.toString()}`,
            ].join("\n"),
          };
          break;
        case "req-accepted":
          raw = {
            to: op.dst,
            subject: `Your request to join "${op.appSlug}" has been approved`,
            text: [
              "Hello,",

              `Great news — ${op.userSlug} has approved your request to access the app "${op.appSlug}" on Vibes DIY as ${op.role}.`,

              "You can open the app here:",
              `${buri.toString()}`,
            ].join("\n\n"),
          };
          break;
        case "req-rejected":
          raw = {
            to: op.dst,
            subject: `Your request to join "${op.appSlug}" was not approved`,
            text: [
              "Hello,",

              `Unfortunately, your request to access the app "${op.appSlug}" on Vibes DIY was not approved by ${op.userSlug}.`,

              "If you think this was a mistake, you can reach out to the app owner directly.",
            ].join("\n\n"),
          };
          break;
        default:
          return Result.Err(new Error(`unsupported email action: ${JSON.stringify(op)}`));
      }
      return vctx.sendEmail(raw);
    })
  );
}
