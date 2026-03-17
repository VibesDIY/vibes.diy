#!/usr/bin/env bash
#
# Capture SSE fixtures from all 4 provider combinations using prompt-engineering:
# schema injected in user message, model asked to respond with a ```JSON code block.
# This mirrors the approach in vibes.diy/vibe/srv-sandbox/srv-sandbox.ts (callAI handler).
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
SCHEMA_JSON=$(cat "$SCHEMA")

# System prompt that asks the model to respond with a ```JSON code block.
# Mirrors the srv-sandbox.ts generateSchema message.
PROMPT="Here is the JSON schema for the expected response.
Please generate one result that conforms to this schema.
Output like Code Blocks and like \`\`\`JSON
${SCHEMA_JSON}

Describe a sandwich. Your output must be a flat JSON object with the fields listed in the schema's 'properties' at the top level (not nested under 'properties')."

echo "Capturing OpenRouter GPT..." >&2
pnpm --silent cli \
  --prompt "$PROMPT" \
  --model openai/gpt-4o-mini \
  --api-key "$OPENROUTER_API_KEY" \
  --url https://openrouter.ai/api/v1/chat/completions \
  > "$DIR/openrouter-gpt-codeblock.llm.txt"
echo "  → $(wc -l < "$DIR/openrouter-gpt-codeblock.llm.txt") lines" >&2

echo "Capturing OpenRouter Claude..." >&2
pnpm --silent cli \
  --prompt "$PROMPT" \
  --model anthropic/claude-sonnet-4-6 \
  --api-key "$OPENROUTER_API_KEY" \
  --url https://openrouter.ai/api/v1/chat/completions \
  > "$DIR/openrouter-claude-codeblock.llm.txt"
echo "  → $(wc -l < "$DIR/openrouter-claude-codeblock.llm.txt") lines" >&2

echo "Capturing OpenAI Direct..." >&2
pnpm --silent cli \
  --prompt "$PROMPT" \
  --model gpt-4o-mini \
  --api-key "$OPENAI_API_KEY" \
  --url https://api.openai.com/v1/chat/completions \
  > "$DIR/openai-codeblock.llm.txt"
echo "  → $(wc -l < "$DIR/openai-codeblock.llm.txt") lines" >&2

echo "Capturing Anthropic Direct..." >&2
# Anthropic's native API requires x-api-key auth and max_tokens, so we use curl directly.
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "{
    \"model\": \"claude-sonnet-4-6\",
    \"max_tokens\": 1024,
    \"stream\": true,
    \"messages\": [{\"role\": \"user\", \"content\": $(echo "$PROMPT" | jq -Rs .)}]
  }" \
  > "$DIR/anthropic-codeblock.llm.txt"
echo "  → $(wc -l < "$DIR/anthropic-codeblock.llm.txt") lines" >&2

echo "Done." >&2
