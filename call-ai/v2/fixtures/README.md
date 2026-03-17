# SSE Fixtures

Captured raw SSE responses for testing the v2 streaming pipeline.

## Providers

| Fixture | Provider | Schema method | Format |
|---------|----------|---------------|--------|
| `openrouter-gpt-json-schema.llm.txt` | OpenRouter → GPT-4o-mini | `response_format: json_schema` | OpenRouter SSE |
| `openrouter-claude-json-schema.llm.txt` | OpenRouter → Claude Sonnet | `response_format: json_schema` | OpenRouter SSE |
| `openai-json-schema.llm.txt` | OpenAI direct | `response_format: json_schema` | OpenAI SSE |
| `anthropic-json-schema.llm.txt` | Anthropic direct | `tool_use` + `tool_choice` | Anthropic SSE (`input_json_delta`) |

All fixtures return a sandwich JSON: `{ "name": "...", "layers": ["..."] }`

## Regenerating fixtures

```bash
cd call-ai/v2
bash fixtures/capture.sh
```

Requires `.env` with: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

## CLI with schema

The v2 CLI supports `--schema` for structured output:

```bash
# Dry run (prints request body, no API call)
pnpm cli --prompt "Describe a sandwich" --schema fixtures/sandwich-schema.json --dry-run

# Live capture (raw SSE to stdout)
pnpm cli --prompt "Describe a sandwich" --schema fixtures/sandwich-schema.json
```

## Notes

- Anthropic's native API doesn't support `response_format` — uses `tool_use` with `tool_choice` instead, producing `input_json_delta` events
- In production, all models go through OpenRouter which provides a unified `response_format: json_schema` interface
- The Anthropic fixture proves the pipeline handles `input_json_delta` for potential future direct-API support

## Files

- `sandwich-schema.json` — shared schema used by all captures
- `capture.sh` — shell script to re-capture all fixtures via CLI
