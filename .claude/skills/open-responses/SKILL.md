---
description: 'This skill should be used when implementing, consuming, or debugging an Open Responses-compliant API — the open standard for multi-provider LLM interoperability. Covers protocol, items, state machines, streaming events, tools, the agentic loop pattern, and extensions. Triggers on: Open Responses, open-responses, /v1/responses endpoint, multi-provider LLM API, Open Responses compliance.'
metadata:
    github-path: open-responses
    github-ref: refs/heads/main
    github-repo: https://github.com/OpenRouterTeam/skills
    github-tree-sha: c4b900d68355d5ff7e557af11506816bdc762ab1
name: open-responses
version: 1.0.0
---
# Open Responses

Open Responses is an open-source specification defining a unified HTTP protocol for multi-provider LLM interactions. It standardizes how clients and servers communicate — messages, tool calls, streaming, multimodal inputs, reasoning — so that code written against one provider works with any compliant provider.

> **This is the protocol standard itself, not any specific SDK.** Open Responses is provider-agnostic. Any LLM provider (OpenAI, Anthropic, Gemini, Databricks, Hugging Face, Ollama, etc.) can implement a compliant API.

> **Stateless by default, stateful where needed.** The core protocol does not require server-side session persistence. Multi-turn conversations can be threaded via `previous_response_id`, which instructs the server to reconstruct context from prior responses. However, providers may offer stateful features (e.g., server-side storage, conversation objects) as extensions. The spec notes that item states "do not necessarily mean they are stateful in the sense of being persisted to disk or stored long-term."

### Design Principles

- **Multi-provider compatibility** — one schema, any provider
- **Stateless-first protocol** — context reconstruction via `previous_response_id`; providers may optionally offer persistence
- **Polymorphic items** — all model outputs share a common item structure discriminated by `type`
- **Semantic streaming** — SSE events map directly to state machine transitions
- **Extensible without fragmentation** — vendor-prefixed extensions prevent namespace collisions

**Specification:** https://www.openresponses.org/specification

---

## Reference Files

For detailed schemas, JSON examples, and complete event catalogs, load the appropriate reference file:

| File | Contents | When to Load |
|------|----------|-------------|
| `references/protocol-and-items.md` | HTTP protocol, item types, content types, control parameters, error handling | Implementing or debugging request/response structure |
| `references/state-machines-and-streaming.md` | State machine diagrams, streaming event catalog, complete SSE sequences for text and tool use | Implementing or debugging streaming, state transitions |
| `references/extensions.md` | Custom items, custom events, schema extensions, governance path | Extending the spec with provider-specific features |

To search references for specific topics: grep for `function_call`, `streaming`, `tool_choice`, `previous_response_id`, `vendor:`, or other keywords.

---

## Core Concepts

### Endpoint and Transport

All requests go to `POST /v1/responses` with `Authorization: Bearer <token>` and `Content-Type: application/json`. Non-streaming responses return JSON. Streaming responses use SSE (`text/event-stream`) terminated by `data: [DONE]`.

### Items

Items are polymorphic atomic units discriminated by `type`. **Output items** (those emitted by the model in a response) must include `id`, `type`, and `status` fields. Core output types: `message`, `function_call`, `reasoning`. Providers extend with vendor-prefixed types (e.g., `acme:web_search_call`).

**Input items** (those sent by the client in a request) have different requirements per type. Content types like `input_text`, `input_image`, and `input_file` do not carry `id` or `status`. `function_call_output` items require `call_id` and `output` but treat `id` and `status` as optional.

**Message roles:** `user`, `assistant`, `system`, `developer`. The `system` role is distinct from the `instructions` parameter — it is an inline message item in the input array. The `developer` role is a separate role that providers may handle differently from `system`.

### State Machines and Event Emission

The response and item lifecycles are both finite state machines. Each state constrains which events can be emitted.

#### Response Lifecycle — Events Emitted Per State

```mermaid
stateDiagram-v2
    [*] --> created : response.created
    created --> queued : response.queued
    queued --> in_progress : response.in_progress

    state in_progress {
        direction LR
        note right of in_progress
            Events emittable while in_progress:
            ─────────────────────────────────
            response.output_item.added
            response.content_part.added
            response.output_text.delta
            response.output_text.done
            response.function_call_arguments.delta
            response.function_call_arguments.done
            response.reasoning_summary_text.delta
            response.reasoning_summary_text.done
            response.content_part.done
            response.output_item.done
            vendor:custom_event

            All delta events carry: sequence_number,
            output_index, item_id
            Content-level events also carry: content_index
        end note
    }

    in_progress --> completed : response.completed
    in_progress --> incomplete : response.incomplete\n(item hit token budget)
    in_progress --> failed : response.failed
    completed --> [*]
    incomplete --> [*]
    failed --> [*]
```

> **Note:** If any item ends in `incomplete` status, the containing response MUST also be `incomplete`.

#### Item Lifecycle — Events Emitted Per State

```mermaid
stateDiagram-v2
    [*] --> in_progress : response.output_item.added

    state in_progress {
        direction LR
        note right of in_progress
            Events emittable while item is in_progress:
            ──────────────────────────────────────────
            Message items:
              response.content_part.added
              response.output_text.delta  (repeated)
              response.output_text.done
              response.content_part.done

            Function call items:
              response.function_call_arguments.delta  (repeated)
              response.function_call_arguments.done

            Reasoning items:
              response.reasoning_summary_text.delta  (repeated)
              response.reasoning_summary_text.done
        end note
    }

    in_progress --> completed : response.output_item.done
    in_progress --> incomplete : response.output_item.done
    completed --> [*]
    incomplete --> [*]

    note right of completed : Terminal — no further deltas
    note right of incomplete : Terminal — token budget exhausted
```

#### Event Validity Summary

| Response State | Valid Events |
|---------------|-------------|
| `created` | *(transient — response object just created)* |
| `queued` | *(waiting for model availability)* |
| `in_progress` | All delta events, all custom events, item lifecycle events |
| `completed` | *(terminal — no more events except `[DONE]`)* |
| `incomplete` | *(terminal — no more events except `[DONE]`)* |
| `failed` | *(terminal — no more events except `[DONE]`)* |

| Item State | Valid Events |
|-----------|-------------|
| `in_progress` | Content deltas (`.delta`), content completion (`.done`), part lifecycle |
| `completed` | *(terminal — no further deltas for this item)* |
| `incomplete` | *(terminal — no further deltas for this item)* |

All delta and item events carry `sequence_number` (monotonically increasing), `output_index` (position in response output array), and `item_id`. Content-level events (text, reasoning summary) additionally carry `content_index` (position within a content part). Servers SHOULD NOT use the SSE `id` field.

### Streaming Events

Two categories of SSE events:

- **Delta events** — incremental content: `response.output_text.delta`, `response.function_call_arguments.delta`, `response.output_item.added`, `response.output_item.done`, etc.
- **Lifecycle events** — state transitions: `response.created`, `response.queued`, `response.in_progress`, `response.completed`, `response.incomplete`, `response.failed`

Rule: the `event` SSE header must match the `type` field inside the JSON body.

---

## Tools

Open Responses defines two tool categories based on execution location.

**Externally-hosted tools** — implementation lives outside the provider's system. The model requests invocation via `function_call` items, and the developer must supply results as `function_call_output` items in a follow-up request. Note that "externally hosted" does not always mean the developer executes the tool locally — MCP tools are externally hosted (the implementation lives on external servers), but control is not necessarily yielded back to the developer first. Examples: function tools, MCP server tools.

**Internally-hosted tools** — implementation lives inside the provider's system. The provider executes without yielding control and returns results as provider-specific item types within the same response. These items must be losslessly round-trippable in follow-up requests. Examples: file search, code interpreter, web search.

### Tool Definition

```json
{
  "type": "function",
  "name": "get_weather",
  "description": "Get current weather for a location",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {"type": "string", "description": "City name"},
      "units": {"type": "string", "enum": ["celsius", "fahrenheit"]}
    },
    "required": ["location"]
  }
}
```

### Tool Control

The `tool_choice` parameter controls whether and how the model uses tools:

| `tool_choice` value | Purpose |
|-----------|---------|
| `"auto"` | Model decides whether to call tools (default) |
| `"required"` | Model must invoke at least one tool |
| `"none"` | No tool calls permitted |
| `{"type": "function", "name": "..."}` | Force a specific tool |
| `{"type": "allowed_tools", "tools": [...]}` | Restrict which tools the model may invoke |

The `allowed_tools` form is nested inside `tool_choice`, not a separate top-level parameter:

```json
{
  "tool_choice": {
    "type": "allowed_tools",
    "tools": [
      {"type": "function", "name": "get_weather"}
    ]
  }
}
```

The model MUST restrict its tool calls to the subset named in `allowed_tools`. Servers MUST enforce this as a hard constraint. Tool definitions remain in the model's context, preserving prompt cache.

---

## Agentic Loop Pattern

The agentic loop is the core pattern for multi-step, tool-augmented workflows.

### Flow

```
  Client                     Provider                    Model
    |                           |                          |
    |-- POST /v1/responses ---->|                          |
    |                           |--- prompt to model ----->|
    |                           |<-- output items ---------|
    |                           |                          |
    |            [external tool calls needing               |
    |             client-supplied results?]                 |
    |                           |                          |
    |              YES                                     |
    |<-- response with --------|                          |
    |   function_call items     |                          |
    |                           |                          |
    |   [client satisfies       |                          |
    |    tool calls]            |                          |
    |                           |                          |
    |-- POST /v1/responses ---->|                          |
    |   previous_response_id +  |                          |
    |   function_call_output    |--- prompt + context ---->|
    |   items in input          |<-- output items ---------|
    |                           |                          |
    |              NO: no client-satisfied calls remain     |
    |<-- completed response ----|                          |
    |   (may contain message,   |                          |
    |    reasoning, hosted-tool |                          |
    |    items, etc.)           |                          |
```

### Key Principles

1. **Stateless-first iteration** — Each loop iteration is a new HTTP request. The server reconstructs context from `previous_response_id`. Providers may optionally persist state, but the protocol does not require it.

2. **Developer controls external tool execution** — For externally-hosted function tools, the developer decides when to execute, what results to return, and whether to continue. For MCP tools (also externally hosted), execution may happen without first yielding control to the developer.

3. **Parallel tool calls** — The model may emit multiple `function_call` items in a single response. Execute all of them and return all results in one follow-up request.

4. **Loop termination** — The loop ends when no client-satisfied external tool calls remain in the response. The final response may contain not just `message` items but also `reasoning` items, internally-hosted tool items, and other non-message output items.

5. **Provider handles internal tools** — For internally-hosted tools, the provider executes within the same request and returns provider-specific item types. No developer loop required.

### Example: Multi-Tool Agent

**Turn 1 — Request with tools:**

```json
{
  "model": "provider/model-name",
  "input": [{"type": "message", "role": "user", "content": "Compare the weather in Paris and Tokyo."}],
  "tools": [{"type": "function", "name": "get_weather", "description": "Get current weather for a city", "parameters": {"type": "object", "properties": {"location": {"type": "string"}}, "required": ["location"]}}]
}
```

**Turn 1 — Model emits two parallel function_call items:**

```json
{
  "id": "resp_100",
  "status": "completed",
  "output": [
    {"id": "item_101", "type": "function_call", "name": "get_weather", "call_id": "call_paris", "arguments": "{\"location\":\"Paris\"}", "status": "completed"},
    {"id": "item_102", "type": "function_call", "name": "get_weather", "call_id": "call_tokyo", "arguments": "{\"location\":\"Tokyo\"}", "status": "completed"}
  ]
}
```

**Turn 2 — Developer returns tool results:**

```json
{
  "model": "provider/model-name",
  "previous_response_id": "resp_100",
  "input": [
    {"type": "function_call_output", "call_id": "call_paris", "output": "{\"temperature\":18,\"condition\":\"partly cloudy\"}"},
    {"type": "function_call_output", "call_id": "call_tokyo", "output": "{\"temperature\":24,\"condition\":\"sunny\"}"}
  ],
  "tools": [...]
}
```

**Turn 2 — Model synthesizes final answer (no function_call items = loop ends):**

```json
{
  "id": "resp_101",
  "status": "completed",
  "output": [
    {"id": "item_200", "type": "message", "role": "assistant", "status": "completed", "content": [{"type": "output_text", "text": "Paris is currently 18°C and partly cloudy. Tokyo is warmer at 24°C with sunny skies."}]}
  ]
}
```

### Multi-Turn Conversations

Multi-turn conversations use `previous_response_id` to chain context. The server reconstructs the full conversation by walking the response chain (providers may also support server-side persistence as an extension):

```
Server loads: previous_response.input + previous_response.output + new_input
```

```json
// Turn 1
{"model": "provider/model-name", "input": [{"type": "message", "role": "user", "content": "What is the population of France?"}]}
// Response: {"id": "resp_200", ...}

// Turn 2 — references Turn 1
{"model": "provider/model-name", "previous_response_id": "resp_200", "input": [{"type": "message", "role": "user", "content": "And what about Germany?"}]}
```

---

## Extensions

Open Responses supports four extension mechanisms, all using vendor-prefixed names to prevent collisions. For full details with examples, load `references/extensions.md`.

| Mechanism | Naming Pattern | Required Fields | Constraint |
|-----------|---------------|-----------------|------------|
| Custom Items | `vendor:type_name` | `id`, `type`, `status` | Must follow item state machine, must round-trip |
| Custom Events | `vendor:event_name` | `type`, `sequence_number` | Must not alter core semantics or token order |
| Schema Extensions | vendor-prefixed fields | N/A (optional fields) | Must not break clients ignoring unknown fields |
| Governance Path | N/A | N/A | Broad adoption -> TSC proposal -> core spec |

Clients must silently ignore unknown item types and event types — this is the forward-compatibility contract.

---

## Compliance

An API is Open Responses-compliant if it implements the spec directly or is a proper superset. The published acceptance test suite is available at https://www.openresponses.org/.

### Core Compliance Tests

| Test | Validates |
|------|-----------|
| Basic Text Response | ResponseResource schema, item structure, usage |
| Streaming Response | SSE events, correct ordering, final structure |
| System Prompt | `instructions` parameter, system role handling |
| Tool Calling | Function tool definition, function_call output, round-tripping |
| Image Input | Image URL in user content |
| Multi-turn Conversation | Message history, assistant + user turns |

### Server Implementation Checklist

- [ ] `POST /v1/responses` endpoint with `Authorization` header
- [ ] Valid output items with `id`, `type`, `status`; input items per their type requirements
- [ ] Item state machine: `in_progress` -> `completed` / `incomplete`
- [ ] Response state machine: `created` -> `queued` -> `in_progress` -> `completed` / `incomplete` / `failed`
- [ ] Emit all 6 lifecycle events: `response.created`, `.queued`, `.in_progress`, `.completed`, `.incomplete`, `.failed`
- [ ] Response `incomplete` when any item ends `incomplete`
- [ ] Non-streaming JSON and streaming SSE with `event`/`type` matching
- [ ] `data: [DONE]` terminal marker
- [ ] Function tools: `function_call` items, `function_call_output` round-tripping
- [ ] `previous_response_id` for conversation continuation
- [ ] Error objects: `type`, `code`, `param`, `message` with correct HTTP status codes
- [ ] Vendor-prefixed extensions (if applicable)

### Client Implementation Checklist

- [ ] Send `Authorization` and `Content-Type` headers
- [ ] Parse polymorphic items by `type` field
- [ ] Track item and response state machines
- [ ] Process SSE: parse `event:` + `data:` lines, handle `[DONE]`
- [ ] Implement agentic loop for externally-hosted tools
- [ ] Silently ignore unknown item types and event types
- [ ] Support `previous_response_id` for multi-turn conversations
- [ ] Handle parallel tool calls in a single response

---

## Quick Reference

### Streaming Event Types

| Event | Category |
|-------|----------|
| `response.created` | Lifecycle |
| `response.queued` | Lifecycle |
| `response.in_progress` | Lifecycle |
| `response.completed` | Lifecycle |
| `response.incomplete` | Lifecycle |
| `response.failed` | Lifecycle |
| `response.output_item.added` / `.done` | Delta |
| `response.content_part.added` / `.done` | Delta |
| `response.output_text.delta` / `.done` | Delta |
| `response.function_call_arguments.delta` / `.done` | Delta |
| `response.reasoning_summary_text.delta` / `.done` | Delta |
| `vendor:custom_event` | Custom |

### Item Types

| Type | Category |
|------|----------|
| `message` | Core |
| `function_call` | Core |
| `function_call_output` | Core |
| `reasoning` | Core |
| `vendor:custom_type` | Extension |

### State Summary

| Object | States | Terminal |
|--------|--------|---------|
| Response | created -> queued -> in_progress -> completed / incomplete / failed | completed, incomplete, failed |
| Item | in_progress -> completed / incomplete | completed, incomplete |

If any item ends `incomplete`, the containing response MUST also be `incomplete`.

### Error Types

| Type | HTTP | Retry |
|------|------|-------|
| `invalid_request` | 400 | No |
| `not_found` | 404 | No |
| `too_many_requests` | 429 | Yes |
| `server_error` | 500 | Yes |
| `model_error` | 500 | Maybe |
