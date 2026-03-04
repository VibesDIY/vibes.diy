#!/usr/bin/env bash
#
# Capture SSE fixtures from all 4 provider combinations.
#
# Usage: cd call-ai/v2 && bash fixtures/capture.sh
#
# Requires .env with: OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
#
set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env
set -a
source .env
set +a

DIR=fixtures
SCHEMA=fixtures/sandwich-schema.json
PROMPT="Describe a sandwich"

echo "Capturing OpenRouter GPT..." >&2
pnpm --silent cli \
  --prompt "$PROMPT" \
  --schema "$SCHEMA" \
  --model openai/gpt-4o-mini \
  --api-key "$OPENROUTER_API_KEY" \
  --url https://openrouter.ai/api/v1/chat/completions \
  > "$DIR/openrouter-gpt-json-schema.llm.txt"
echo "  → $(wc -l < "$DIR/openrouter-gpt-json-schema.llm.txt") lines" >&2

echo "Capturing OpenRouter Claude..." >&2
pnpm --silent cli \
  --prompt "$PROMPT" \
  --schema "$SCHEMA" \
  --model anthropic/claude-sonnet-4-6 \
  --api-key "$OPENROUTER_API_KEY" \
  --url https://openrouter.ai/api/v1/chat/completions \
  > "$DIR/openrouter-claude-json-schema.llm.txt"
echo "  → $(wc -l < "$DIR/openrouter-claude-json-schema.llm.txt") lines" >&2

echo "Capturing OpenAI Direct..." >&2
pnpm --silent cli \
  --prompt "$PROMPT" \
  --schema "$SCHEMA" \
  --model gpt-4o-mini \
  --api-key "$OPENAI_API_KEY" \
  --url https://api.openai.com/v1/chat/completions \
  > "$DIR/openai-json-schema.llm.txt"
echo "  → $(wc -l < "$DIR/openai-json-schema.llm.txt") lines" >&2

echo "Capturing Anthropic Direct (tool_use)..." >&2
pnpm --silent cli \
  --prompt "$PROMPT" \
  --schema "$SCHEMA" \
  --model claude-sonnet-4-6 \
  --api-key "$ANTHROPIC_API_KEY" \
  --url https://api.anthropic.com/v1/messages \
  > "$DIR/anthropic-json-schema.llm.txt"
echo "  → $(wc -l < "$DIR/anthropic-json-schema.llm.txt") lines" >&2

echo "Done." >&2
