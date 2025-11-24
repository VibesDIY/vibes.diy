# Vibes DIY App JSX Guide

## Overview

Vibes DIY apps are React components that combine Fireproof database, CallAI for LLM interactions, and use-vibes for UI components. They follow a neobrutalist design aesthetic with bright colors and bold borders.

## Core Imports

```javascript
import React from "react"
import { callAI, useFireproof, toCloud, ImgGen } from "use-vibes"
```

## Fireproof Setup

### Basic Setup
```javascript
const { useDocument, useLiveQuery, database } = useFireproof("database-name")
```

### With Cloud Sync (No Tenant/Ledger)
```javascript
const { useDocument, useLiveQuery, database, attach } = useFireproof("database-name", { 
  attach: toCloud() 
})
```

### With Cloud Sync (Specific Tenant/Ledger)
```javascript
const { useDocument, useLiveQuery, database, attach } = useFireproof("database-name", { 
  attach: toCloud({
    tenant: "tenant-id",
    ledger: "ledger-id"
  })
})
```

## Document Management

### Creating/Editing Documents
```javascript
const { doc, merge, submit } = useDocument({ text: "" })

// In JSX:
<form onSubmit={submit}>
  <input
    value={doc.text}
    onChange={(e) => merge({ text: e.target.value })}
    placeholder="Enter text..."
  />
  <button type="submit">Save</button>
</form>
```

### Querying Documents
```javascript
// Basic query by field
const { docs } = useLiveQuery("fieldName", { key: "value" })

// Custom query function
const { docs } = useLiveQuery((doc) => doc.text && doc._id, { 
  descending: true, 
  limit: 10 
})

// Query by type
const { docs } = useLiveQuery("type", { key: "note" })
```

## CallAI Integration

### Basic Usage
```javascript
const response = await callAI("Your prompt here")
```

### Streaming
```javascript
const generator = await callAI("Your prompt", { stream: true })

let result = ""
for await (const chunk of generator) {
  result = chunk
}
```

### With Schema
```javascript
const response = await callAI("Generate data", {
  schema: {
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: { type: "number" }
          }
        }
      }
    }
  }
})
```
