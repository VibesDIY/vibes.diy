const FIREHOSE_SLUG = "satie-trumpet-8293";

interface VibeMetadata {
  title: string;
  description: string;
  vibeSlug: string;
  canonicalUrl: string;
}

async function fetchVibeMetadata(
  vibeSlug: string,
  searchParams?: string,
): Promise<VibeMetadata> {
  const sourceUrl = `https://${vibeSlug}.vibesdiy.app/${searchParams || ""}`;
  const sourceResponse = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; VibesDIY-Bot/1.0)",
    },
  });

  if (!sourceResponse.ok) {
    throw new Error(`Failed to fetch vibe metadata: ${sourceResponse.status}`);
  }

  const sourceHtml = await sourceResponse.text();

  // Extract title and description from source HTML
  const titleMatch = sourceHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
  const descMatch = sourceHtml.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );

  const title = titleMatch ? titleMatch[1] : `${vibeSlug} - Vibes DIY`;
  const description = descMatch
    ? descMatch[1]
    : `Check out ${vibeSlug} - an AI-generated app created with Vibes DIY`;

  return {
    title,
    description,
    vibeSlug,
    canonicalUrl: `https://vibes.diy/vibe/${vibeSlug}`,
  };
}

function generateMetaHTML(
  metadata: VibeMetadata,
  searchParams?: string,
): string {
  const { title, description, vibeSlug, canonicalUrl } = metadata;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://${vibeSlug}.vibesdiy.app/screenshot.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Vibes DIY">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="https://${vibeSlug}.vibesdiy.app/screenshot.png">
  <meta name="twitter:site" content="@vibesdiy">
  
  <style>
    body, html { margin: 0; padding: 0; }
    iframe { width: 100%; height: 100vh; height: 100svh; border: none; }
  </style>
</head>
<body>
  <iframe
    src="https://${vibeSlug}.vibesdiy.app/${searchParams || ""}"
    title="${escapeHtml(title)}"
    allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad; geolocation; gyroscope; hid; microphone; midi; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; serial; usb; web-share; xr-spatial-tracking"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-orientation-lock allow-pointer-lock allow-downloads allow-top-navigation"
    allowfullscreen>
  </iframe>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async (request: Request) => {
  const url = new URL(request.url);
  let vibeSlug: string;

  // Only handle /firehose route - let React Router handle /vibe/* routes
  if (url.pathname === "/firehose") {
    vibeSlug = FIREHOSE_SLUG;
  } else {
    return; // Let other handlers deal with it
  }

  // Generate metadata HTML for firehose
  try {
    const searchParams = url.search;
    const metadata = await fetchVibeMetadata(vibeSlug, searchParams);

    // Override canonical URL for firehose route
    if (url.pathname === "/firehose") {
      metadata.canonicalUrl = "https://vibes.diy/firehose";
    }

    const html = generateMetaHTML(metadata, searchParams);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error fetching vibe metadata:", error);
    return; // Fall back to normal routing
  }
};

export const config = {
  path: ["/vibe/*", "/firehose"],
};
