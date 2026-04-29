# Fireproof Database API Guide

Fireproof is a lightweight embedded document database with encrypted live sync, designed to make browser apps easy. Use it in any JavaScript environment with a unified API that works both in React (with hooks) and as a standalone core API.

## Key Features

- **Apps run anywhere:** Bundle UI, data, and logic in one file.
- **Real-Time & Offline-First:** Automatic persistence and live queries, runs in the browser - no loading or error states.
- **Unified API:** TypeScript works with Deno, Bun, Node.js, and the browser.
- **React Hooks:** Leverage `useLiveQuery` and `useDocument` for live collaboration. Note: these are NOT top-level exports — they are returned by the `useFireproof()` hook. Always destructure from `const { useLiveQuery, useDocument, database } = useFireproof("db-name")`.

Fireproof enforces cryptographic causal consistency and ledger integrity using hash history, providing git-like versioning with lightweight blockchain-style verification. Data is stored and replicated as content-addressed encrypted blobs, making it safe and easy to sync via commodity object storage providers.

## Installation

The `use-fireproof` package provides both the core API and React hooks.

```js
import { useFireproof } from "use-fireproof";
```

React hooks are the recommended way to use Fireproof in LLM code generation contexts.

#### Create or Load a Database

Fireproof databases store data across sessions and can sync in real-time. Each database is identified by a string name, and you can have multiple databases per application—often one per collaboration session, as they are the unit of sharing.

```js
import { useFireproof } from "use-fireproof";

const { database, useLiveQuery, useDocument } = useFireproof("my-ledger");
```

#### Put and Get Documents

Each document has an `_id`, which can be auto-generated or set explicitly. Auto-generation is recommended to ensure uniqueness and avoid conflicts. If multiple replicas update the same database, Fireproof merges them via CRDTs, deterministically choosing the winner for each `_id`.

Use granular documents, e.g. one document per user action, so saving a form or clicking a button should typically create or update a single document, or just a few documents. Avoid patterns that require a single document to grow without bound.

Fireproof is a local database, no loading states required, just empty data states.

### Basic Example

This example shows Fireproof's `_id` allows easy sorting with `useLiveQuery`.

```js
const App = () => {
  const { useDocument, useLiveQuery } = useFireproof("my-ledger");

  const { doc, merge, submit } = useDocument({ text: "" });

  // _id is roughly temporal, this is most recent
  const { docs } = useLiveQuery("_id", { descending: true, limit: 100 });

  return (
    <div>
      <form onSubmit={submit}>
        <input value={doc.text} onChange={(e) => merge({ text: e.target.value })} placeholder="New document" />
        <button type="submit">Submit</button>
      </form>

      <h3>Recent Documents</h3>
      <ul>
        {docs.map((doc) => (
          <li key={doc._id}>{doc.text}</li>
        ))}
      </ul>
    </div>
  );
};
```

### Editing Documents

Address documents by a known `_id` if you want to force conflict resolution or work with a real world resource, like a schedule slot or a user profile. In a complex app this might come from a route parameter or correspond to an outside identifier.

```js
const { useDocument } = useFireproof("my-ledger");

const { doc, merge, submit, save, reset } = useDocument({ _id: "user-profile:abc@example.com" });
```

The `useDocument` hook provides several methods:

- `merge(updates)`: Update the document with new fields, without saving. Use this instead of keeping a `useState` for document data.
- `submit(e)`: Handles form submission by preventing default, saving, and resetting
- `save()`: Save the current document state
- `reset()`: Reset to initial state

For form-based creation flows, use `submit`:

```js
<form onSubmit={submit}>
```

When you call submit, the document is reset, so if you didn't provide an `_id` then you can use the form to create a stream of new documents as in the basic example above.

### Updating Documents in Event Handlers

To update an existing document from a click handler or callback, use `database.put()` directly. Never call `useDocument` inside an event handler — that violates React's Rules of Hooks.

```js
// ✅ Correct — use database.put() in handlers
onClick={() => database.put({ ...doc, favorite: !doc.favorite })}

// ❌ Wrong — never call hooks inside handlers
function toggleFavorite(id) {
  const { doc, save } = useDocument({ _id: id }) // BREAKS Rules of Hooks
}
```

### Query Data

Data is queried by sorted indexes defined by the application. Sort by strings, numbers, or booleans, as well as arrays for grouping. Use numbers when possible for sorting continuous data.

You can use the `_id` field for temporal sorting so you don't have to write code to get simple recent document lists, as in the basic example above.

Here are other common patterns:

#### Query by Key Range

Passing a string to `useLiveQuery` will index by that field. You can use the key argument to filter by a specific value:

```js
const { docs } = useLiveQuery("agentName", {
  key: "agent-1", // all docs where doc.agentName === "agent-1", sorted by _id
});
```

You can also query a range within a key:

```js
const { docs } = useLiveQuery("agentRating", {
  range: [3, 5],
});
```

#### Counter Pattern

Documents can be updated by multiple clients, and synced later. To create an event counter, don't increment a number on a single doc, instead write a small document per counted event, and query them with an index. Example:

```js
const App = () => {
  const { useLiveQuery, database } = useFireproof("my-ledger");

  const { docs } = useLiveQuery("counter", { key: "my-event-name" });
  const counterValue = docs.length;

  function countEvent() {
    database.put({
      counter: "my-event-name",
    });
  }

  // Call countEvent() to count each event, and render counterValue in the UI.
};
```

This pattern ensures the count is accurate even during sync.

### Custom Indexes

Use a custom index function to normalize and transform document data, for instance if you have both new and old document versions in your app.

```js
const { docs } = useLiveQuery(
  (doc) => {
    if (doc.type == "listing_v1") {
      return doc.sellerId;
    } else if (doc.type == "listing") {
      return doc.userId;
    }
  },
  { key: routeParams.sellerId }
);
```

#### Array Indexes and Prefix Queries

When you want to group rows easily, you can use an array index key. This is great for grouping records my year / month / day or other paths. In this example the prefix query is a shorthand for a key range, loading everything from November 2024:

```js
const queryResult = useLiveQuery(
  (doc) => {
    const date = new Date(doc.date);
    if (Number.isNaN(date.getTime())) return; // return nothing to skip docs without a valid date
    return [date.getFullYear(), date.getMonth(), date.getDate()];
  },
  { prefix: [2024, 11] }
);
```

#### Sortable Lists

Sortable lists are a common pattern. Here's how to implement them using Fireproof:

```js
function App() {
  const { database, useLiveQuery } = useFireproof("my-ledger");

  // Initialize list with evenly spaced positions
  async function initializeList() {
    await database.put({ list: "xyz", position: 1000 });
    await database.put({ list: "xyz", position: 2000 });
    await database.put({ list: "xyz", position: 3000 });
  }

  // Query items on list xyz, sorted by position. Note that useLiveQuery('list', { key:'xyz' }) would be the same docs, sorted chronologically by _id
  const queryResult = useLiveQuery((doc) => [doc.list, doc.position], { prefix: ["xyz"] });

  // Insert between existing items using midpoint calculation
  async function insertBetween(beforeDoc, afterDoc) {
    const newPosition = (beforeDoc.position + afterDoc.position) / 2;
    await database.put({
      list: "xyz",
      position: newPosition,
    });
  }

  return (
    <div>
      <h3>List xyz (Sorted)</h3>
      <ul>
        {queryResult.docs.map((doc) => (
          <li key={doc._id}>
            {doc._id}: position {doc.position}
          </li>
        ))}
      </ul>
      <button onClick={initializeList}>Initialize List</button>
      <button onClick={() => insertBetween(queryResult.docs[1], queryResult.docs[2])}>Insert new doc at 3rd position</button>
    </div>
  );
}
```

## Architecture: Where's My Data?

Data is stored in the browser, and is automatically synced with all invited users.

## Using Fireproof in JavaScript

You can use the core API in HTML or on the backend. Instead of hooks, import the core API directly:

```js
import { fireproof } from "use-fireproof";

const database = fireproof("my-ledger");
```

The document API is async, but doesn't require loading states or error handling.

```js
const ok = await database.put({ text: "Sample Data" });
const doc = await database.get(ok.id);
const latest = await database.query("_id", { limit: 10, descending: true });
console.log("Latest documents:", latest.docs);
```

To subscribe to real-time updates, use the `subscribe` method. This is useful for building backend event handlers or other server-side logic. For instance to send an email when the user completes a todo:

```js
import { fireproof } from "use-firproof";

const database = fireproof("todo-list-db");

database.subscribe((changes) => {
  console.log("Recent changes:", changes);
  changes.forEach((change) => {
    if (change.completed) {
      sendEmail(change.email, "Todo completed", "You have completed a todo.");
    }
  });
}, true);
```

### Form Validation

You can use React's `useState` to manage validation states and error messages. Validate inputs at the UI level before allowing submission.

```javascript
const [errors, setErrors] = useState({});

function validateForm() {
  const newErrors = {};
  if (!doc.name.trim()) newErrors.name = "Name is required.";
  if (!doc.email) newErrors.email = "Email is required.";
  if (!doc.message.trim()) newErrors.message = "Message is required.";
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}

function handleSubmit(e) {
  e.preventDefault();
  if (validateForm()) submit();
}
```

## Example React Application

Code listing for todo tracker App.jsx. Note the code ordering: hooks, then handlers, then classNames right before JSX.

```js
import React from "react";
import { useFireproof } from "use-fireproof";

export default function App() {
  // 1. Hooks and document shapes
  const { useLiveQuery, useDocument, database } = useFireproof("todo-list-db");

  const {
    doc: newTodo,
    merge: mergeNewTodo,
    submit: submitNewTodo,
  } = useDocument({
    todo: "",
    type: "todo",
    completed: false,
    createdAt: Date.now(),
  });

  const { docs: todos } = useLiveQuery("type", {
    key: "todo",
    descending: true,
  });

  // 2. Event handlers
  const handleInputChange = (e) => {
    mergeNewTodo({ todo: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitNewTodo();
  };

  // 3. ClassNames — right before JSX so colors stay consistent
  const c = {
    bg: "bg-white",
    card: "bg-gray-50",
    border: "border-gray-200",
    accent: "bg-[#e63946]",
    text: "text-gray-500",
  };

  // 4. JSX return
  return (
    <div className={`max-w-md mx-auto p-4 ${c.bg} shadow rounded`}>
      <h2 className="text-2xl font-bold mb-4">Todo List</h2>
      <form onSubmit={handleSubmit} className="mb-4">
        <label htmlFor="todo" className="block mb-2 font-semibold">
          Todo
        </label>
        <input
          className={`w-full ${c.border} border rounded px-2 py-1`}
          id="todo"
          type="text"
          onChange={handleInputChange}
          value={newTodo.todo}
        />
      </form>
      <ul className="space-y-3">
        {todos.map((doc) => (
          <li className={`flex flex-col items-start p-2 ${c.border} border rounded ${c.card}`} key={doc._id}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <input
                  className="mr-2"
                  type="checkbox"
                  checked={doc.completed}
                  onChange={() => database.put({ ...doc, completed: !doc.completed })}
                />
                <span className="font-medium">{doc.todo}</span>
              </div>
              <button className={`text-sm ${c.accent} text-white px-2 py-1 rounded`} onClick={() => database.del(doc._id)}>
                Delete
              </button>
            </div>
            <div className={`text-xs ${c.text} mt-1`}>{new Date(doc.createdAt).toISOString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

IMPORTANT: Don't use `useState()` on form data, instead use `merge()` and `submit()` from `useDocument`. Only use `useState` for ephemeral UI state (active tabs, open/closed panels, cursor positions). Keep your data model in Fireproof.
