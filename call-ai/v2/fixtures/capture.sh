#!/usr/bin/env bash
#
# Capture SSE fixtures from 4 provider combinations.
#
# Uses build-schema-prompt.ts to generate the system message, matching
# the production path in srv-sandbox.ts vibeCallAI handler.
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
SYSTEM_MSG=$(npx tsx fixtures/print-schema-prompt.ts)
USER_MSG="Describe a sandwich"

echo "Capturing OpenRouter GPT..." >&2
pnpm --silent cli \
  --system "$SYSTEM_MSG" \
  --prompt "$USER_MSG" \
  --model openai/gpt-4o-mini \
  --api-key "$OPENROUTER_API_KEY" \
  --url https://openrouter.ai/api/v1/chat/completions \
  > "$DIR/openrouter-gpt.llm.txt"
echo "  → $(wc -l < "$DIR/openrouter-gpt.llm.txt") lines" >&2

echo "Capturing OpenRouter Claude..." >&2
pnpm --silent cli \
  --system "$SYSTEM_MSG" \
  --prompt "$USER_MSG" \
  --model anthropic/claude-sonnet-4-6 \
  --api-key "$OPENROUTER_API_KEY" \
  --url https://openrouter.ai/api/v1/chat/completions \
  > "$DIR/openrouter-claude.llm.txt"
echo "  → $(wc -l < "$DIR/openrouter-claude.llm.txt") lines" >&2

echo "Capturing OpenAI Direct..." >&2
pnpm --silent cli \
  --system "$SYSTEM_MSG" \
  --prompt "$USER_MSG" \
  --model gpt-4o-mini \
  --api-key "$OPENAI_API_KEY" \
  --url https://api.openai.com/v1/chat/completions \
  > "$DIR/openai.llm.txt"
echo "  → $(wc -l < "$DIR/openai.llm.txt") lines" >&2

echo "Capturing Anthropic Direct..." >&2
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "{
    \"model\": \"claude-sonnet-4-6\",
    \"max_tokens\": 1024,
    \"stream\": true,
    \"system\": $(echo "$SYSTEM_MSG" | jq -Rs .),
    \"messages\": [{\"role\": \"user\", \"content\": $(echo "$USER_MSG" | jq -Rs .)}]
  }" \
  > "$DIR/anthropic.llm.txt"
echo "  → $(wc -l < "$DIR/anthropic.llm.txt") lines" >&2

echo "Done." >&2
