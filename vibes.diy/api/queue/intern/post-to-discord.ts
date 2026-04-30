import { BuildURI, Result } from "@adviser/cement";
import { EvtCommentPosted, EvtInviteGrant, EvtNewFsId, EvtRequestGrant, ForeignInfo, Role } from "@vibes.diy/api-types";
import { DiscordWebhookBody, QueueCtx } from "../queue-ctx.js";

const DISCORD_EMBED_COLOR = 11184810;

function vibeUrl(vctx: QueueCtx, userSlug: string, appSlug: string): string {
  return BuildURI.from(vctx.params.vibes.env.VIBES_DIY_PUBLIC_BASE_URL)
    .appendRelative("vibe")
    .appendRelative(userSlug)
    .appendRelative(appSlug)
    .toString();
}

function foreignLabel(foreignInfo: ForeignInfo | undefined): string {
  return foreignInfo?.claims?.params.email ?? foreignInfo?.givenEmail ?? "(unknown)";
}

export function buildPublishEmbed(vctx: QueueCtx, payload: EvtNewFsId): DiscordWebhookBody {
  const url = vibeUrl(vctx, payload.userSlug, payload.appSlug);
  return {
    content: `🎉 New Vibe published: **[${payload.userSlug}/${payload.appSlug}](${url})**`,
    embeds: [
      {
        title: `${payload.userSlug}/${payload.appSlug}`,
        url,
        color: DISCORD_EMBED_COLOR,
        fields: [
          { name: "User", value: payload.userSlug, inline: true },
          { name: "App", value: payload.appSlug, inline: true },
          { name: "fsId", value: payload.fsId, inline: false },
        ],
      },
    ],
  };
}

export function buildCommentEmbed(vctx: QueueCtx, payload: EvtCommentPosted): DiscordWebhookBody {
  const url = vibeUrl(vctx, payload.userSlug, payload.appSlug);
  return {
    content: `🗨️ New comment on **[${payload.userSlug}/${payload.appSlug}](${url})**`,
    embeds: [
      {
        title: `${payload.userSlug}/${payload.appSlug}`,
        url,
        color: DISCORD_EMBED_COLOR,
        fields: [
          { name: "Commenter", value: payload.userId, inline: true },
          { name: "Doc", value: payload.docId, inline: true },
        ],
      },
    ],
  };
}

export function buildInviteAcceptedEmbed(vctx: QueueCtx, payload: EvtInviteGrant): DiscordWebhookBody {
  const url = vibeUrl(vctx, payload.grant.userSlug, payload.grant.appSlug);
  return {
    content: `🎟️ Invite accepted on **[${payload.grant.userSlug}/${payload.grant.appSlug}](${url})**`,
    embeds: [
      {
        title: `${payload.grant.userSlug}/${payload.grant.appSlug}`,
        url,
        color: DISCORD_EMBED_COLOR,
        fields: [
          { name: "Member", value: foreignLabel(payload.grant.foreignInfo), inline: true },
          { name: "Role", value: payload.grant.role, inline: true },
        ],
      },
    ],
  };
}

export function buildRequestPendingEmbed(vctx: QueueCtx, payload: EvtRequestGrant): DiscordWebhookBody {
  const url = vibeUrl(vctx, payload.grant.userSlug, payload.grant.appSlug);
  return {
    content: `🙋 Access requested on **[${payload.grant.userSlug}/${payload.grant.appSlug}](${url})**`,
    embeds: [
      {
        title: `${payload.grant.userSlug}/${payload.grant.appSlug}`,
        url,
        color: DISCORD_EMBED_COLOR,
        fields: [{ name: "Requester", value: foreignLabel(payload.grant.foreignInfo), inline: true }],
      },
    ],
  };
}

export function buildRequestApprovedEmbed(vctx: QueueCtx, payload: EvtRequestGrant, role: Role): DiscordWebhookBody {
  const url = vibeUrl(vctx, payload.grant.userSlug, payload.grant.appSlug);
  return {
    content: `✅ Access granted on **[${payload.grant.userSlug}/${payload.grant.appSlug}](${url})**`,
    embeds: [
      {
        title: `${payload.grant.userSlug}/${payload.grant.appSlug}`,
        url,
        color: DISCORD_EMBED_COLOR,
        fields: [
          { name: "Member", value: foreignLabel(payload.grant.foreignInfo), inline: true },
          { name: "Role", value: role, inline: true },
        ],
      },
    ],
  };
}

export async function postEmbed(vctx: QueueCtx, body: DiscordWebhookBody): Promise<Result<void>> {
  const r = await vctx.postToDiscord(body);
  if (r.isErr()) {
    console.error("Discord post failed:", r.Err());
  }
  return r;
}
