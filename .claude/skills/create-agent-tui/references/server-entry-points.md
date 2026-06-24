# Server Entry Points & Extension Points

Alternative entry points beyond the default CLI REPL, plus guidance for extending the harness.

## Contents

- [HTTP API Server](#http-api-server) — Express/Hono with SSE streaming
- [Extension Points](#extension-points) — MCP, WebSocket, dynamic models, custom stop conditions

---

## HTTP API Server

Replace `src/cli.ts` with an HTTP server when the agent should be accessed via API.

### src/server.ts

```typescript
import { createServer } from 'http';
import { loadConfig } from './config.js';
import { runAgentWithRetry } from './agent.js';

const config = loadConfig();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
const MAX_BODY = 1 * 1024 * 1024; // 1 MB

// WARNING: This server has no authentication. Do not expose on a public
// interface without adding a bearer token check or similar auth gate.
// Set AGENT_API_SECRET and check Authorization header for production use.
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (process.env.AGENT_API_SECRET) {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.AGENT_API_SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  if (req.method !== 'POST' || req.url !== '/chat') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Parse request body with size limit
  const chunks: Buffer[] = [];
  let totalSize = 0;
  for await (const chunk of req) {
    totalSize += (chunk as Buffer).length;
    if (totalSize > MAX_BODY) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large' }));
      return;
    }
    chunks.push(chunk as Buffer);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const { message, messages = [], stream = false } = body as {
    message?: string;
    messages?: Array<{ role: string; content: string }>;
    stream?: boolean;
  };
  const input = messages.length > 0 ? messages : message;

  if (!input) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Provide "message" (string) or "messages" (array)' }));
    return;
  }

  if (stream) {
    // Server-Sent Events streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    try {
      const result = await runAgentWithRetry(config, input, {
        onEvent: (e) => {
          if (e.type === 'text') {
            res.write(`data: ${JSON.stringify({ type: 'text', content: e.delta })}\n\n`);
          }
        },
      });

      res.write(`data: ${JSON.stringify({ type: 'done', usage: result.usage })}\n\n`);
    } catch (err: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    }

    res.end();
  } else {
    // Standard JSON response
    try {
      const result = await runAgentWithRetry(config, input);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: result.text, usage: result.usage }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  console.log(`Agent server listening on port ${PORT}`);
});
```

### Usage

```bash
# Non-streaming
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the capital of France?"}'

# Streaming (SSE)
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a haiku", "stream": true}'
```

Update `package.json` to add the server script:

```json
"scripts": {
  "start": "tsx src/cli.ts",
  "serve": "tsx src/server.ts",
  "dev": "tsx watch src/cli.ts"
}
```

---

## Extension Points

Guidance for where to go next after the base harness is working. These are not generated — they describe patterns for the developer to implement.

### MCP Server Integration

Connect external tools via the Model Context Protocol. Use the `@modelcontextprotocol/sdk` package to create an MCP client that discovers and registers tools from MCP servers dynamically.

Key steps:
1. Install `@modelcontextprotocol/sdk`
2. Create an MCP client that connects to configured servers
3. Convert MCP tool definitions to `@openrouter/agent` tool format
4. Add discovered tools to the `tools` array in `tools/index.ts`

### WebSocket Streaming

For real-time bidirectional communication (e.g., a chat UI), replace SSE with WebSocket:

1. Use the `ws` package for a WebSocket server
2. On connection, create a session and message array
3. On each message, call `runAgent` with streaming, send deltas as WebSocket frames
4. Handle disconnection by cleaning up the session

### Dynamic Model Selection

Use `@openrouter/agent`'s dynamic parameters to change the model based on conversation context:

```typescript
client.callModel({
  model: (ctx) => ctx.numberOfTurns > 5
    ? 'anthropic/claude-sonnet-4'  // upgrade for complex conversations
    : 'openai/gpt-4.1-mini',       // start cheap
  // ...
});
```

### Custom Stop Conditions

Beyond `stepCountIs` and `maxCost`, create domain-specific stop conditions:

```typescript
const hasAnswer = (ctx) =>
  ctx.messages.some(m =>
    m.role === 'assistant' && m.content?.includes('FINAL ANSWER:')
  );

client.callModel({
  stopWhen: [stepCountIs(20), maxCost(2.0), hasAnswer],
  // ...
});
```
