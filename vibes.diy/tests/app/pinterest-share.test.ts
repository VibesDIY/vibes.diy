import { describe, it, expect } from "vitest";
import { buildPinterestShareUrl, vibeScreenshotImageUrl } from "../../pkg/app/utils/vibeUrls.js";

describe("vibeScreenshotImageUrl", () => {
  it("builds the public screenshot URL on the runtime host", () => {
    expect(vibeScreenshotImageUrl({ ownerHandle: "alice", appSlug: "myapp", hostnameBase: "vibes.diy" })).toBe(
      "https://myapp--alice.vibes.diy/screenshot.jpg"
    );
  });

  it("drops a leading dot on the env-supplied host base", () => {
    // VIBES_SVC_HOSTNAME_BASE is commonly stored as ".vibes.diy".
    expect(vibeScreenshotImageUrl({ ownerHandle: "alice", appSlug: "myapp", hostnameBase: ".vibes.diy" })).toBe(
      "https://myapp--alice.vibes.diy/screenshot.jpg"
    );
  });
});

describe("buildPinterestShareUrl", () => {
  const url = buildPinterestShareUrl({
    pageUrl: "https://vibes.diy/vibe/alice/myapp",
    imageUrl: "https://myapp--alice.vibes.diy/screenshot.jpg",
    description: "myapp — made on vibes.diy",
  });

  it("targets Pinterest's pin-create button endpoint", () => {
    expect(url).toContain("https://www.pinterest.com/pin/create/button/");
  });

  it("url-encodes the page, image, and description params", () => {
    const parsed = new URL(url);
    expect(parsed.searchParams.get("url")).toBe("https://vibes.diy/vibe/alice/myapp");
    expect(parsed.searchParams.get("media")).toBe("https://myapp--alice.vibes.diy/screenshot.jpg");
    expect(parsed.searchParams.get("description")).toBe("myapp — made on vibes.diy");
  });
});
