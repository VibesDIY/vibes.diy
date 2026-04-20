# CallAI Helper Function

The `callAI` function returns structured JSON from an AI model. It always requires a schema and returns a string that you `JSON.parse()`.

## Basic Usage

```javascript
import { callAI } from "call-ai";

const response = await callAI("Give me a todo list for learning React", {
  schema: {
    properties: {
      todos: {
        type: "array",
        description: "List of actionable todo items",
        items: { type: "string" },
      },
    },
  },
});
const todoData = JSON.parse(response);
console.log(todoData.todos);
```

## Items with properties

```javascript
const response = await callAI(
  "Generate 4 items with label, status, priority (low, medium, high, critical), and notes. Return as structured JSON with these fields.",
  {
    schema: {
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Short name for the item" },
              status: { type: "string", description: "Current status (active, done, blocked)" },
              priority: { type: "string", description: "Priority level (low, medium, high, critical)" },
              notes: { type: "string", description: "Additional context or details" },
            },
          },
        },
      },
    },
  }
);
const demoData = JSON.parse(response);
console.log(demoData.items); // Array of item objects
```

### Schema Tips

- Flat schemas perform better across all models. Avoid nesting deeper than 2 levels.
- Use simple property names like `name`, `type`, `items`, `price`.
- Keep array items simple (strings or flat objects).

## Error Handling

```javascript
import { callAI } from "call-ai";

try {
  const response = await callAI("Generate some content", {
    schema: {
      properties: {
        result: { type: "string" },
      },
    },
  });
  console.log(JSON.parse(response));
} catch (error) {
  console.error("API error:", error.message);
}
```
