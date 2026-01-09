/**
 * Cloudflare Worker for serving the React Router SPA
 * Handles client-side routing by falling back to index.html for non-asset requests
 */

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Try to fetch the asset first
    const assetResponse = await env.ASSETS.fetch(request);

    // If asset exists (2xx or 3xx status), return it
    if (assetResponse.ok || (assetResponse.status >= 300 && assetResponse.status < 400)) {
      return assetResponse;
    }

    // For 404s on non-asset paths, serve index.html to support client-side routing
    // Check if the path looks like a static asset
    const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|map)$/i.test(url.pathname);

    if (!isStaticAsset) {
      // Return index.html for SPA routing
      const indexRequest = new Request(new URL("/", url.origin), request);
      return env.ASSETS.fetch(indexRequest);
    }

    // Return the 404 response for actual missing assets
    return assetResponse;
  },
} satisfies ExportedHandler<Env>;
