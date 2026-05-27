import { exception2Result, Result } from "@adviser/cement";

const enc = new TextEncoder();

export interface VerifyParams {
  readonly body: string;
  readonly svixId: string;
  readonly svixTimestamp: string;
  readonly svixSignature: string;
  readonly secret: string;
}

export interface DiscordEmbedField {
  readonly name: string;
  readonly value: string;
  readonly inline?: boolean;
}

export interface DiscordWebhookBody {
  readonly content?: string;
  readonly embeds?: readonly {
    readonly title?: string;
    readonly color?: number;
    readonly fields?: readonly DiscordEmbedField[];
  }[];
}

export interface ClerkEmailAddress {
  readonly email_address: string;
}

export interface ClerkUserCreatedData {
  readonly id: string;
  readonly username: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly email_addresses: readonly ClerkEmailAddress[];
  readonly created_at: number;
}

const DISCORD_EMBED_COLOR = 11184810;
const SVIX_REPLAY_WINDOW_SECONDS = 300;

function decodeSecret(secret: string): Uint8Array {
  const b64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function verifyClerkWebhookSignature(params: VerifyParams): Promise<Result<unknown>> {
  const { body, svixId, svixTimestamp, svixSignature, secret } = params;

  const ts = Number(svixTimestamp);
  if (Number.isNaN(ts)) {
    return Result.Err(new Error("svix-timestamp is not numeric"));
  }
  const ageSeconds = Math.floor(Date.now() / 1000) - ts;
  if (ageSeconds > SVIX_REPLAY_WINDOW_SECONDS) {
    return Result.Err(new Error(`svix-timestamp is stale: ${ageSeconds}s old`));
  }

  const signatures = svixSignature
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.slice("v1,".length));

  if (signatures.length === 0) {
    return Result.Err(new Error("svix-signature header missing or malformed"));
  }

  const rKey = await exception2Result(async () => {
    const secretBytes = decodeSecret(secret);
    return crypto.subtle.importKey("raw", secretBytes.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  });
  if (rKey.isErr()) return Result.Err(rKey.Err());
  const key = rKey.Ok();

  const toSign = enc.encode(`${svixId}.${svixTimestamp}.${body}`);
  const rSig = await exception2Result(() => crypto.subtle.sign("HMAC", key, toSign));
  if (rSig.isErr()) return Result.Err(rSig.Err());

  const computedB64 = btoa(String.fromCharCode(...new Uint8Array(rSig.Ok())));
  const matched = signatures.some((s) => s === computedB64);
  if (matched === false) {
    return Result.Err(new Error("signature mismatch"));
  }

  const rParsed = exception2Result(() => JSON.parse(body) as unknown);
  if (rParsed.isErr()) return Result.Err(rParsed.Err());
  return Result.Ok(rParsed.Ok());
}

export function buildSignupEmbed(data: ClerkUserCreatedData): DiscordWebhookBody {
  const emails = data.email_addresses.map((e) => e.email_address);
  const emailCount = emails.length;
  const primaryEmail = emails[0] ?? "(no email)";
  const display = data.username ?? primaryEmail;

  const nameParts = [data.first_name, data.last_name].filter((p) => p !== null && p !== "");
  const fullName = nameParts.length > 0 ? nameParts.join(" ") : "(not set)";

  const fields: DiscordEmbedField[] = [
    { name: "User ID", value: data.id, inline: false },
    { name: "Name", value: fullName, inline: true },
    { name: "Username", value: data.username ?? "(not set)", inline: true },
    { name: `Emails (${emailCount})`, value: emails.join("\n") || "(none)", inline: false },
    { name: "Signed up", value: new Date(data.created_at).toISOString(), inline: false },
  ];

  return {
    content: `👤 New signup: **${display}** (${emailCount} email${emailCount === 1 ? "" : "s"})`,
    embeds: [
      {
        title: display,
        color: DISCORD_EMBED_COLOR,
        fields,
      },
    ],
  };
}

export async function postSignupToDiscord(discordWebhookUrl: string, data: ClerkUserCreatedData): Promise<void> {
  const body = buildSignupEmbed(data);
  const rRes = await exception2Result(() =>
    fetch(discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  if (rRes.isErr()) {
    console.error("[clerk-webhook] Discord post failed:", rRes.Err());
    return;
  }
  if (rRes.Ok().ok === false) {
    console.error("[clerk-webhook] Discord post non-ok status:", rRes.Ok().status);
  }
}
