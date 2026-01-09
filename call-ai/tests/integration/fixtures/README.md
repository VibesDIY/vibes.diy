# Integration Fixtures

Use `scripts/capture-openrouter-stream.js` to refresh streaming fixtures. Example:

```
pnpm --filter call-ai-tests-integration exec node scripts/capture-openrouter-stream.js \
  fixtures/openai-fireproof-stream-request.json \
  fixtures/openai-fireproof-stream-response.txt
```

The `openai-fireproof-stream-request.json` prompt asks for markdown → code → markdown output with a `useFireproof` import, producing data suitable for exercising `LineStreamParser` and StructuredMessage formatting.
