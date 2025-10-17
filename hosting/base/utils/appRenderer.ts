// App rendering utilities for catalog titles and app instances
// Handles the different rendering paths based on subdomain parsing

import { template } from "../apptemplate.js";
import {
  catalogTitleTemplate,
  catalogTitleStyles,
  catalogTitleScript,
} from "../template/catalogTitle.js";
import { libraryImportMap, transformImports } from "./codeTransform.js";
import type { ParsedSubdomain } from "./subdomainParser.js";

// Types for app data structure
interface AppData {
  slug?: string;
  title?: string;
  name?: string;
  code: string;
  raw?: string;
  remixOf?: string;
  hasScreenshot?: boolean;
  userId?: string;
}

// Context interface for Hono requests
interface RenderContext {
  req: {
    url: string;
  };
  html: (content: string, status?: number) => Response | Promise<Response>;
}

/**
 * Render an app instance (subdomain with underscore: app_installId)
 * This uses the existing app template and rendering logic
 *
 * @param c - Hono context
 * @param parsed - Parsed subdomain information
 * @param app - App data from KV store
 * @param customDomain - Custom domain hostname if this is a custom domain request
 * @param originalDomain - The original first-party domain to preserve
 * @returns Response with rendered app instance
 */
export async function renderAppInstance(
  c: RenderContext,
  parsed: ParsedSubdomain,
  app: AppData,
  customDomain?: string,
  originalDomain?: string,
): Promise<Response> {
  // Prepare the remix button if this app is a remix of another app
  let remixButton = "";
  if (app.remixOf) {
    remixButton = `
      <a
        href="https://${app.remixOf}.vibesdiy.app/"
        target="_blank"
        rel="noopener noreferrer"
        class="remix-link text-xs flex-shrink-0"
        title="View original app"
      >
        🧬
      </a>
    `;
  }

  // Extract version parameter from URL for use-vibes override
  const url = new URL(c.req.url);
  const versionParam = (url.searchParams.get("v_vibes") || "").trim();
  const semverPattern =
    /^[0-9]+(?:\.[0-9]+(?:\.[0-9]+)?)?(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/;
  const vibesVersion = semverPattern.test(versionParam) ? versionParam : "";

  // Clone the library import map and update use-vibes version if specified
  const dynamicImportMap = { ...libraryImportMap };
  if (vibesVersion) {
    dynamicImportMap["use-vibes"] = `https://esm.sh/use-vibes@${vibesVersion}`;
    dynamicImportMap["use-fireproof"] =
      `https://esm.sh/use-vibes@${vibesVersion}`;
    dynamicImportMap["https://esm.sh/use-fireproof"] =
      `https://esm.sh/use-vibes@${vibesVersion}`;
    dynamicImportMap["call-ai"] = `https://esm.sh/use-vibes@${vibesVersion}`;
    dynamicImportMap["https://esm.sh/call-ai"] =
      `https://esm.sh/use-vibes@${vibesVersion}`;
  }

  // Transform the app code to handle imports
  const transformedCode = transformImports(app.code);

  // Generate the import map JSON
  const importMapJson = JSON.stringify({ imports: dynamicImportMap }, null, 2);

  // Replace the placeholders and generate templated code on each request
  let templatedCode = template
    .replace("{{APP_CODE}}", transformedCode)
    .replace("{{API_KEY}}", "sk-vibes-proxy-managed")
    .replace(/\{\{APP_SLUG\}\}/g, app.slug || parsed.appSlug)
    .replace("{{REMIX_BUTTON}}", remixButton)
    .replace("{{IMPORT_MAP}}", importMapJson);

  // Set the title and meta tags
  // Title for display
  const displayTitle = app.title
    ? `${app.title}`
    : "Make your app on Vibes DIY";

  // Title for meta tags
  const metaTitle = app.title || "Make your app on Vibes DIY";

  // Description
  const description = app.title
    ? `${app.title} - remix on Vibes DIY`
    : "Create and remix web applications with Vibes DIY";

  // Use the original domain for first-party URLs, fallback to vibesdiy.app
  const actualDomain = originalDomain || "vibesdiy.app";

  // Base URL and image URL - use custom domain if provided, otherwise use actual domain
  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `https://${parsed.fullSubdomain}.${actualDomain}`;
  const imageUrl = customDomain
    ? `https://${customDomain}/screenshot.png`
    : `https://${parsed.appSlug}.${actualDomain}/screenshot.png`;

  // Replace title
  templatedCode = templatedCode.replace(
    "<title>User Generated App</title>",
    `<title>${displayTitle}</title>`,
  );

  // Construct meta tags
  const metaTags = `
    <meta property="og:title" content="${metaTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:url" content="${baseUrl}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${metaTitle}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:url" content="${baseUrl}">
`;

  // Insert meta tags after the viewport meta tag
  templatedCode = templatedCode.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<meta name="viewport" content="width=device-width, initial-scale=1" />${metaTags}`,
  );

  // Return the templated app code
  return c.html(templatedCode, 200);
}

/**
 * Render a catalog title page (subdomain without underscore: app)
 * This shows the app preview page with screenshot and launch button
 *
 * @param c - Hono context
 * @param parsed - Parsed subdomain information
 * @param app - App data from KV store
 * @returns Response with rendered catalog title page
 */
export async function renderCatalogTitle(
  c: RenderContext,
  parsed: ParsedSubdomain,
  app: AppData,
  originalDomain?: string,
): Promise<Response> {
  // Prepare app title and metadata
  const appTitle = app.title || app.name || parsed.appSlug;

  // Use the original domain for first-party URLs, fallback to vibesdiy.app
  const actualDomain = originalDomain || "vibesdiy.app";

  const baseUrl = `https://${parsed.appSlug}.${actualDomain}`;
  const remixUrl = `https://vibes.diy/remix/${parsed.appSlug}`;

  const screenshotUrl = `https://${parsed.appSlug}.${actualDomain}/screenshot.png`;
  // Build the catalog title template
  let renderedTemplate = catalogTitleTemplate
    .replace(/\{\{APP_TITLE\}\}/g, appTitle)
    .replace("{{REMIX_URL}}", remixUrl)
    .replace("{{SCREENSHOT_URL}}", screenshotUrl)
    .replace("${catalogTitleStyles}", catalogTitleStyles)
    .replace("${catalogTitleScript}", catalogTitleScript);

  // Handle screenshot rendering with error fallback - always try to load image
  const screenshotContent = `
    <img 
      src="${screenshotUrl}" 
      alt="${appTitle} Screenshot" 
      style="filter: blur(12px);"
      class="app-screenshot"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    />
    <div class="placeholder-screenshot" style="display: none;">
      <div class="placeholder-icon">📱</div>
      <p>No preview available</p>
    </div>`;

  // Replace the entire conditional block with the error-handling content
  const conditionalRegex = /\{\{#if HAS_SCREENSHOT\}\}[\s\S]*?\{\{\/if\}\}/;
  renderedTemplate = renderedTemplate.replace(
    conditionalRegex,
    screenshotContent,
  );

  // Add meta tags for social sharing
  const description = `${appTitle} - An interactive web app created with Vibes DIY`;
  const imageUrl = `${baseUrl}/screenshot.png`;

  const metaTags = `
    <meta property="og:title" content="${appTitle} - Vibes DIY">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:url" content="${baseUrl}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${appTitle} - Vibes DIY">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">
    <meta name="twitter:url" content="${baseUrl}">
  `;

  // Insert meta tags after viewport
  renderedTemplate = renderedTemplate.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<meta name="viewport" content="width=device-width, initial-scale=1" />${metaTags}`,
  );

  return c.html(renderedTemplate, 200);
}
