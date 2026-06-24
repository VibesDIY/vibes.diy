# Extension Framework Reference

Complete documentation for extending the Open Responses specification with custom items, events, and schema fields.

**Specification:** https://www.openresponses.org/specification#extending-open-responses

---

## Overview

Open Responses is designed to be extended by providers without fragmenting the ecosystem. All extensions use vendor-prefixed names to prevent collisions. An API is Open Responses-compliant if it implements the specification directly **or** is a proper superset.

Core invariants that extensions must preserve:
- Core behavior remains intact
- Clients can reconstruct canonical responses even when ignoring all unknown types and fields
- The `type` field is always the discriminator — unknown types are safely skippable

---

## 1. Custom Items

Providers can introduce new item types beyond the core set.

**Naming convention:** `vendor_slug:type_name`

Examples: `openai:web_search_call`, `acme:document_retrieval`, `anthropic:thinking`

**Required fields on all custom items:**

| Field | Type | Required |
|-------|------|----------|
| `id` | string | Yes — unique within response |
| `type` | string | Yes — vendor-prefixed type name |
| `status` | string | Yes — must follow item state machine |

Custom items participate in the same item state machine as core items (`in_progress` -> `completed`/`incomplete`). They must be losslessly round-trippable — if sent as part of `input` in a follow-up request, the server must correctly process them.

**Example — Custom web search item:**

```json
{
  "id": "item_050",
  "type": "acme:web_search_call",
  "status": "completed",
  "query": "Open Responses specification",
  "results": [
    {
      "title": "Open Responses",
      "url": "https://www.openresponses.org/",
      "snippet": "An open-source specification for multi-provider LLM interoperability."
    }
  ]
}
```

**Example — Custom telemetry item:**

```json
{
  "id": "item_060",
  "type": "acme:telemetry_chunk",
  "status": "completed",
  "metrics": {
    "inference_time_ms": 423,
    "tokens_per_second": 87.2,
    "cache_hit": true
  }
}
```

**Example — Internally-hosted tool item:**

A provider offering a built-in code interpreter produces custom item types that can be sent back in `input` on a follow-up request for lossless context reconstruction:

```json
{
  "id": "item_030",
  "type": "acme:code_interpreter_call",
  "status": "completed",
  "code": "import math\nprint(math.sqrt(144))",
  "language": "python",
  "output": [
    {"type": "text", "text": "12.0"}
  ]
}
```

---

## 2. Custom Streaming Events

Providers can emit custom events during streaming.

**Naming convention:** `vendor_slug:event_name`

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Event schema identifier with vendor prefix |
| `sequence_number` | integer | Monotonically increasing for ordering |

**Constraints:**
- Must NOT alter core response semantics
- Must NOT change token ordering
- Must NOT affect item lifecycle transitions
- Clients must silently ignore unknown event types

**Example — Custom trace event:**

```
event: acme:trace_event
data: {"type":"acme:trace_event","sequence_number":1,"trace_id":"t_abc123","span":"model.inference","duration_ms":142}

event: acme:trace_event
data: {"type":"acme:trace_event","sequence_number":2,"trace_id":"t_abc123","span":"tool.execution","duration_ms":89}
```

**Example — Custom progress event:**

```
event: acme:generation_progress
data: {"type":"acme:generation_progress","sequence_number":1,"percent_complete":35,"estimated_remaining_ms":800}
```

---

## 3. Schema Extensions

Providers may add optional fields to existing core schemas (items, responses, events).

**Rules:**
- Extended fields must be **optional** — never required
- Must not break clients that ignore unknown fields
- Must not change the semantics of existing fields
- Should be clearly documented with types and failure modes

**Example — Extended response with provider metadata:**

```json
{
  "id": "resp_001",
  "status": "completed",
  "output": [...],
  "usage": {"input_tokens": 50, "output_tokens": 30},
  "acme:request_id": "req_xyz789",
  "acme:region": "us-east-1",
  "acme:cache_status": "hit"
}
```

---

## 4. Governance Path

Extensions that gain broad adoption across multiple frontier providers can be proposed for standardization:

```
Vendor Extension  -->  Broad Adoption  -->  TSC Proposal  -->  Core Specification
```

The **Technical Steering Committee (TSC)** evaluates extensions based on:
- Adoption across multiple providers
- Interoperability value
- Implementation consistency
- Backward compatibility

This process ensures that the specification evolves based on real-world usage rather than theoretical design.
