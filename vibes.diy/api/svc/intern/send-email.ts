import { BuildURI, Result } from "@adviser/cement";
import { EmailOps, RawEmailWithoutFrom } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

export function sendEmailOpts(vctx: VibesApiSQLCtx, ops: EmailOps[]): Promise<Result<void>[]> {
  return Promise.all(
    ops.map((op) => {
      let raw!: RawEmailWithoutFrom;

      const buri = BuildURI.from(vctx.params.vibes.env.VIBES_DIY_PUBLIC_BASE_URL)
        .appendRelative("vibe")
        .appendRelative(op.userSlug)
        .appendRelative(op.appSlug)
        .setParam("token", op.token);

      switch (op.action) {
        case "invite-editor":
          raw = {
            to: op.dst,
            subject: `You've been invited as Editor a Vibe App from ${op.userSlug}`,
            text: [
              "Hello,",

              `You have been invited as Editor to the app "${op.appSlug}" on Vibes DIY by ${op.userSlug}.`,

              "To accept the invitation and start collaborating, please click the link below:",
              `${buri.toString()}`,
            ].join("\n"),
          };
          break;
        case "invite-viewer":
          raw = {
            to: op.dst,
            subject: `You've been invited as Viewer to a Vibe App from ${op.userSlug}`,
            text: [
              "Hello,",

              `You have been invited as Viewer to the app "${op.appSlug}" on Vibes DIY by ${op.userSlug}.`,

              "To accept the invitation and view the app, please click the link below:",
              `${buri.toString()}`,
            ].join("\n"),
          };
          break;
        default:
          return Result.Err(new Error(`unsupported email action: ${op.action}`));
      }
      return vctx.sendEmail(raw);
    })
  );
}
