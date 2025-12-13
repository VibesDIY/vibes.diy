/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

type MyEnv = Env & { BACKEND: string };

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const url = new URL(request.url);
    const backendUrl = `${env.BACKEND}${url.pathname}${url.search}`;

    // Forward the request
    const modifiedRequest = new Request(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return await fetch(modifiedRequest);
  },
} satisfies ExportedHandler<MyEnv>;
