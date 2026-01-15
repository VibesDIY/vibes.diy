# call-ai

A lightweight library for making AI API calls with streaming support.

## Installation

```bash
npm install call-ai
# or
yarn add call-ai
# or
pnpm add call-ai
```

## Usage

```typescript
import { callAi } from "call-ai";

// Basic usage with string prompt (non-streaming by default)
const response = await callAi("Explain quantum computing in simple terms", {
  apiKey: "your-api-key",
  model: "gpt-4",
});

// The response is the complete text
console.log(response);

// With streaming enabled (returns an AsyncGenerator)
const generator = callAi("Tell me a story", {
  apiKey: "your-api-key",
  model: "gpt-4",
  stream: true,
});

// Process streaming updates
for await (const chunk of generator) {
  console.log(chunk); // Streaming updates as they arrive
}

// Using message array for more control
const messages = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Explain quantum computing in simple terms" },
];

const response = await callAi(messages, {
  apiKey: "your-api-key",
  model: "gpt-4",
});

console.log(response);

// Using schema for structured output
const schema = {
  name: "exercise_summary",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    points: { type: "array", items: { type: "string" } },
  },
  required: ["title", "summary"],
};

const response = await callAi("Summarize the benefits of exercise", {
  apiKey: "your-api-key",
  schema: schema,
});

const structuredOutput = JSON.parse(response);
console.log(structuredOutput.title);

// Streaming with schema for OpenRouter structured JSON output
const schema = {
  properties: {
    title: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
};

const generator = callAi("Create a list of sci-fi books", {
  apiKey: "your-api-key",
  stream: true,
  schema: schema,
});

for await (const chunk of generator) {
  console.log(chunk); // Shows the partial JSON as it's being generated
}
```

## Features

- 🔄 Streaming responses via AsyncGenerator when `stream: true`
- 🧩 Structured JSON outputs with schema validation
- 🔌 Full compatibility with OpenRouter's JSON schema format for structured outputs
- 📝 Support for message arrays with system, user, and assistant roles
- 🔧 TypeScript support with full type definitions
- ✅ Works in Node.js and browser environments

## Supported LLM Providers

Call-AI supports all models available through OpenRouter, including:

- OpenAI models (GPT-4, GPT-3.5, etc.)
- Anthropic Claude
- Gemini
- Llama 3
- Mistral
- And many more

## Choosing a model

Different LLMs have different strengths when working with structured data. Based on our testing, here's a guide to help you choose the right model for your schema needs:

### Schema Complexity Guide

| Model Family | Grade | Simple Flat Schema | Complex Flat Schema              | Nested Schema | Best For                                                  |
| ------------ | ----- | ------------------ | -------------------------------- | ------------- | --------------------------------------------------------- |
| OpenAI       | A     | ✅ Excellent       | ✅ Excellent                     | ✅ Excellent  | Most reliable for all schema types                        |
| Gemini       | A     | ✅ Excellent       | ✅ Excellent                     | ✅ Good       | Good all-around performance, especially with flat schemas |
| Claude       | B     | ✅ Excellent       | ⚠️ Good (occasional JSON errors) | ✅ Good       | Simple schemas, robust handling of complex prompts        |
| Llama 3      | C     | ✅ Good            | ✅ Good                          | ❌ Poor       | Simpler flat schemas, may struggle with nested structures |
| Deepseek     | C     | ✅ Good            | ✅ Good                          | ❌ Poor       | Basic flat schemas only                                   |

### Schema Structure Recommendations

1. **Flat schemas perform better across all models**. If you need maximum compatibility, avoid deeply nested structures.

2. **Field names matter**. Some models have preferences for certain property naming patterns:
   - Use simple, common naming patterns like `name`, `type`, `items`, `price`
   - Avoid deeply nested object hierarchies (more than 2 levels deep)
   - Keep array items simple (strings or flat objects)

3. **Model-specific considerations**:
   - **OpenAI models**: Best overall schema adherence and handle complex nesting well
   - **Claude models**: Great for simple schemas, occasional JSON formatting issues with complex structures
   - **Gemini models**: Good general performance, handles array properties well
   - **Llama/Mistral/Deepseek**: Strong with flat schemas, but often ignore nesting structure and provide their own organization

4. **For mission-critical applications** requiring schema adherence, use OpenAI models or implement fallback mechanisms.

## Setting API Keys

You can provide your API key in three ways:

1. Directly in the options:

```typescript
const response = await callAi("Hello", { apiKey: "your-api-key" });
```

2. Set globally in the browser:

```typescript
window.CALLAI_API_KEY = "your-api-key";
const response = await callAi("Hello");
```

3. Use environment variables in Node.js (with a custom implementation):

```typescript
// Example of environment variable integration
import { callAi } from "call-ai";
const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
const response = await callAi("Hello", { apiKey });
```

## API

```typescript
// Main function
function callAi(prompt: string | Message[], options?: CallAIOptions): Promise<string> | AsyncGenerator<string, string, unknown>;

// Types
type Message = {
  role: "user" | "system" | "assistant";
  content: string;
};

interface Schema {
  /**
   * Optional schema name that will be sent to the model provider if supported
   */
  name?: string;
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

interface CallAIOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  stream?: boolean;
  schema?: Schema | null;
  [key: string]: any;
}
```

### Options

- `apiKey`: Your API key (can also be set via window.CALLAI_API_KEY)
- `model`: Model identifier (default: 'openrouter/auto')
- `endpoint`: API endpoint (default: 'https://openrouter.ai/api/v1/chat/completions')
- `stream`: Enable streaming responses (default: false)
- `schema`: Optional JSON schema for structured output
- Any other options are passed directly to the API (temperature, max_tokens, etc.)

## Advanced: Event-Driven Parser

For advanced use cases (like custom UI rendering or tool call interception), you can use the event-driven parser stack directly.

```typescript
import { OpenRouterParser, createCodeBlockHandler, SegmentAccumulator } from "call-ai";

const parser = new OpenRouterParser();

// Register standard handlers
parser.register(createCodeBlockHandler());

// Listen for specific events
parser.onEvent((evt) => {
  switch (evt.type) {
    case "code.start":
      console.log("Started code block:", evt.language);
      break;
    case "tool.complete":
      console.log("Tool call finished:", evt.functionName, evt.arguments);
      break;
    case "or.image":
      console.log("Image generated:", evt.url || "base64 data");
      break;
  }
});

// Or use the SegmentAccumulator for high-level UI blocks
const accumulator = new SegmentAccumulator(parser);

// Feed raw SSE chunks from your fetch response
for await (const chunk of response.body) {
  parser.processChunk(new TextDecoder().decode(chunk));
  console.log(accumulator.segments); // Growing array of {type, content}
}
```

## License

MIT or Apache-2.0, at your option

## Contributing and Release Process

### Development

1. Fork the repository
2. Make your changes
3. Add tests for new functionality
4. Run tests: `npm test`
5. Run type checking: `npm run typecheck`
6. Create a pull request

### Integration Tests

The project includes integration tests that make real API calls to verify functionality with actual LLM models:

1. Copy `.env.example` to `.env` and add your OpenRouter API key
2. Run integration tests: `npm run test:integration`

Note: Integration tests are excluded from the normal test suite to avoid making API calls during CI/CD. They require a valid API key to execute and will be skipped if no key is provided.

### Release Process

This library uses GitHub Actions to automate the release process:

1. Update the version in `package.json` (follow semver)
2. Update `CHANGELOG.md` with details of changes
3. Commit changes: `git commit -am "Release vX.Y.Z"`
4. Create a git tag: `git tag -a vX.Y.Z -m "Version X.Y.Z"`
5. Push changes and tag: `git push origin main vX.Y.Z`

The GitHub workflow in `.github/workflows/publish.yml` will:

- Automatically trigger when a new tag is pushed
- Run tests and type checking
- Verify the tag signature
- Publish the package to npm

When making significant changes, remember to:

- Document breaking changes in the changelog
- Update documentation to reflect API changes
- Update TypeScript types
