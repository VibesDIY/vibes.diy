# SSE API Differences by Provider

Documented from captured fixtures in `call-ai/v2/fixtures/`.

## Three SSE formats

The v2 pipeline handles three distinct SSE wire formats. Detection is duck-typed in `sse-stream.ts`.

### 1. OpenRouter (wraps any model)

- Starts with `: OPENROUTER PROCESSING` comment line
- No `event:` lines — data-only SSE
- Ends with `data: [DONE]`
- Top-level keys: `id, object, created, model, provider, system_fingerprint, choices`
- Choice delta: `{ content, role, finish_reason, native_finish_reason }`
- OpenRouter-only fields: `provider`, `native_finish_reason`
- Final chunk has `choices: []` with `usage` (tokens, cost)

### 2. OpenAI Direct

- No comment or `event:` lines — data-only SSE
- Ends with `data: [DONE]`
- Top-level keys: `id, object, created, model, service_tier, system_fingerprint, choices, obfuscation`
- Choice delta: `{ content, logprobs, finish_reason }`
- OpenAI-only fields: `service_tier`, `obfuscation`, `logprobs`
- No `provider` or `native_finish_reason`

### 3. Anthropic Direct

- Uses paired `event:` + `data:` lines (standard SSE with named events)
- No `data: [DONE]` — ends with `event: message_stop`
- Completely different JSON structure (not OpenAI-compatible)
- Event types: `message_start`, `content_block_start`, `ping`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`
- Content arrives as `input_json_delta` (for tool_use) or `text_delta` (for text)
- Delta shape: `{ type: "input_json_delta", partial_json: "..." }`

## Key differences table

| Feature | OpenRouter | OpenAI Direct | Anthropic Direct |
|---------|-----------|---------------|-----------------|
| SSE event names | no | no | yes (`event:` lines) |
| Stream termination | `data: [DONE]` | `data: [DONE]` | `event: message_stop` |
| JSON schema support | `response_format` | `response_format` | `tool_use` + `tool_choice` |
| Content field | `choices[0].delta.content` | `choices[0].delta.content` | `delta.partial_json` or `delta.text` |
| `provider` field | yes | no | no |
| `logprobs` field | no | yes (nullable) | no |
| `native_finish_reason` | yes | no | no |
| Usage/cost info | final chunk with empty choices | not in stream | `message_delta` event |

## Detection order in sse-stream.ts

1. Try OpenRouter (has `provider` or `native_finish_reason` in choice)
2. Try OpenAI direct (has `choices` array but no provider fields)
3. Try Anthropic (has `type` field like `message_start`, `content_block_delta`)
4. Error — unknown format

## Schema/structured output

- **OpenRouter**: Pass `response_format: { type: "json_schema", json_schema: { ... } }` — works for both GPT and Claude models behind OpenRouter. Claude 4-6 reliably returns clean JSON (Claude 4 sometimes wrapped in code fences).
- **OpenAI Direct**: Same `response_format` parameter
- **Anthropic Direct**: No `response_format` support (returns `invalid_request_error: Extra inputs are not permitted`). Use `tools` + `tool_choice` to force structured output via `tool_use`. Response arrives as `input_json_delta` events instead of `text_delta`.

`buildRequestBody` in `call-ai/v2/build-request.ts` handles this automatically:
- Auto-detects Anthropic from `api.anthropic.com` URL → produces `tools`/`tool_choice`/`max_tokens`
- All other URLs → produces `response_format: json_schema`
- Explicit `apiStyle` parameter overrides auto-detection

In production, all models go through OpenRouter which normalizes to the `response_format` interface. The Anthropic direct path exists for potential future direct-API support.

## Fixtures

All fixtures are captured via `bash fixtures/capture.sh` which uses the v2 CLI (`pnpm --silent cli`). Models use Claude 4-6 (`anthropic/claude-sonnet-4-6` for OpenRouter, `claude-sonnet-4-6` for Anthropic direct).

Line counts vary per-capture since each response generates a different sandwich, but JSON key shapes and event types are consistent across captures.
