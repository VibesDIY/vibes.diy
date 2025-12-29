import { transformString, extractImports } from "./transform-sucrase.js";

// Helper function to create a hash of the code for cache key
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request: Request): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    // Only allow PUT requests
    if (request.method !== "PUT") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use PUT." }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    try {
      // Get code from request body
      const code = await request.text();

      if (!code) {
        return new Response(
          JSON.stringify({ error: "Request body is empty" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      // Create cache key based on code content
      const codeHash = await hashCode(code);
      const cacheUrl = new URL(request.url);
      cacheUrl.pathname = `/transform/${codeHash}`;
      const cacheKey = new Request(cacheUrl.toString());

      const cache = await caches.open("v1");
      let response = await cache.match(cacheKey);

      if (response) {
        console.log("Cache HIT for hash:", codeHash);
        // Add CORS headers to cached response
        const cachedResponse = new Response(response.body, response);
        Object.keys(corsHeaders).forEach((key) => {
          cachedResponse.headers.set(
            key,
            corsHeaders[key as keyof typeof corsHeaders],
          );
        });
        cachedResponse.headers.set("X-Cache-Status", "HIT");
        return cachedResponse;
      }

      console.log("Cache MISS for hash:", codeHash);

      // Debug: log code length
      console.log("Received code length:", code.length);
      console.log("First 100 chars:", code.substring(0, 100));
      console.log("Last 100 chars:", code.substring(code.length - 100));

      // Extract dependencies
      const depList = extractImports(code);

      // Transform code
      const transformed = transformString(code);

      // Create response with cache headers (1 minute TTL)
      response = new Response(JSON.stringify({ depList, transformed }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
          "X-Cache-Status": "MISS",
          ...corsHeaders,
        },
      });

      // Store in cache
      await cache.put(cacheKey, response.clone());

      return response;
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }
  },
};
