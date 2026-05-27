import { describe, it, expect } from "vitest";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { isResReportCampaignHealth, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";

// Real campaign-health response payload captured from browser WS interception
const SAMPLE_PAYLOAD = {
  type: "vibes.diy.res-report-campaign-health" as const,
  generatedAt: "2026-05-27T19:59:54.786Z",
  dateLabel: "last 7 days",
  ranked: [
    {
      campaign_name: "vibes-diy-block-party-2026-05-25",
      campaign_id: "6998073570752",
      impressions: "9233",
      clicks: "151",
      spend: "23.27",
      ctr: "1.635438",
      cpc: "0.154106",
      reach: "9103",
      actions: [
        { action_type: "link_click", value: "151" },
        { action_type: "landing_page_view", value: "140" },
      ],
      date_start: "2026-05-20",
      date_stop: "2026-05-26",
    },
  ],
  anomalies: {
    duplicateNames: [],
    budgetOutliers: [],
    zeroSpend: [],
    lowLpvRatio: [],
    pixel: { lastFired: "2026-05-25T15:39:51-0700", counts: {} },
  },
};

const SAMPLE_MSG = {
  tid: "z2r4P1pXg1hCSWP4jQ",
  src: "vibes.diy.client.z2oW2n5wAv",
  dst: "wss://vibes.diy/api?shard=reports",
  ttl: 10,
  payload: SAMPLE_PAYLOAD,
};

describe("campaign-health client decode pipeline", () => {
  it("isResReportCampaignHealth accepts payload with date_start/date_stop", () => {
    expect(isResReportCampaignHealth(SAMPLE_PAYLOAD)).toBe(true);
  });

  it("msgBase accepts the full message envelope", () => {
    const result = msgBase(SAMPLE_MSG);
    expect(result instanceof type.errors).toBe(false);
  });

  it("encode returns the parsed message from a Blob", async () => {
    const encoder = new W3CWebSocketEventEventoEnDecoder();
    const blob = new Blob([new TextEncoder().encode(JSON.stringify(SAMPLE_MSG))]);

    const result = await encoder.encode({ type: "MessageEvent", event: { data: blob } });
    expect(result.isOk()).toBe(true);
    const decoded = result.Ok() as Record<string, unknown>;
    expect(decoded.tid).toBe(SAMPLE_MSG.tid);
    expect((decoded.payload as Record<string, unknown>).type).toBe("vibes.diy.res-report-campaign-health");
  });

  it("validate logic resolves: tid match + resMatch", async () => {
    const encoder = new W3CWebSocketEventEventoEnDecoder();
    const blob = new Blob([new TextEncoder().encode(JSON.stringify(SAMPLE_MSG))]);
    const encodeResult = await encoder.encode({ type: "MessageEvent", event: { data: blob } });
    expect(encodeResult.isOk()).toBe(true);

    const decoded = encodeResult.Ok();
    const msg = msgBase(decoded);
    expect(msg instanceof type.errors).toBe(false);
    if (msg instanceof type.errors) return;

    expect(msg.tid).toBe(SAMPLE_MSG.tid);
    expect(isResReportCampaignHealth(msg.payload)).toBe(true);
  });
});
