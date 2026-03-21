# SSE Fixtures

Captured raw SSE responses for testing the v2 streaming pipeline.

## Providers

### Active fixtures (used by provider-fixtures.test.ts)

| Fixture | Provider | Schema method | Status |
|---------|----------|---------------|--------|
| `openrouter-gpt-codeblock.llm.txt` | OpenRouter → GPT-4o-mini | prompt-engineering (```JSON block) | ✅ passes |
| `openrouter-claude-codeblock.llm.txt` | OpenRouter → Claude Sonnet | prompt-engineering (```JSON block) | ✅ passes |
| `openai-codeblock.llm.txt` | OpenAI direct | prompt-engineering (```JSON block) | ✅ passes |
| `anthropic-codeblock.llm.txt` | Anthropic direct | prompt-engineering (```JSON block) | ❌ parser TODO |

All fixtures request a sandwich JSON: `{ "name": "...", "layers": ["..."] }`

The schema is injected into the user message and the model is asked to respond with a ` ```JSON ` code block. This mirrors the approach in `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` (`callAI` handler, `generateSchema` message).

### Reference fixtures (historical, not used by tests)

| Fixture | Provider | Schema method |
|---------|----------|---------------|
| `openrouter-gpt-json-schema.llm.txt` | OpenRouter → GPT-4o-mini | `response_format: json_schema` |
| `openrouter-claude-json-schema.llm.txt` | OpenRouter → Claude Sonnet | `response_format: json_schema` |
| `openai-json-schema.llm.txt` | OpenAI direct | `response_format: json_schema` |
| `anthropic-json-schema.llm.txt` | Anthropic direct | `tool_use` + `tool_choice` (`input_json_delta`) |

## Anthropic Direct — known failure

Anthropic's native SSE format uses `event:` prefix lines and a different payload structure (`content_block_delta`) that `SseChunk` does not yet handle. The `anthropic-codeblock.llm.txt` fixture correctly captures what a future Anthropic SSE normalizer must consume.

## Regenerating fixtures

```bash
cd call-ai/v2
bash fixtures/capture.sh
```

Requires `.env` with: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

Note: Anthropic Direct is captured via `curl` directly because the CLI uses
`Authorization: Bearer` whereas Anthropic requires `x-api-key`.

## Files

- `sandwich-schema.json` — schema used in the capture prompt
- `capture.sh` — shell script to re-capture all fixtures
