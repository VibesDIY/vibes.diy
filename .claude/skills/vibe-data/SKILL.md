---
name: vibe-data
description: Read, write, query, and explore data in vibes using the vibes-diy CLI. Use this skill when the user wants to inspect what data is in a vibe, read or write documents, query a database by field, list databases, tail changes, or do any CRUD operation on vibe data. Trigger on phrases like "what data is in this vibe", "read the database", "add a document", "query the data", "list my vibes", "subscribe to changes", "show me the docs in X", or any data-level operation on a vibe's Firefly databases.
---

# /vibe-data -- read, write, and query vibe data via the CLI

This skill teaches agents how to use the `vibes-diy` CLI to interact with data stored in vibes. Every vibe has one or more Firefly databases; this skill covers discovering them and performing CRUD operations.

## Prerequisites

The operator must be logged in:

```bash
npx vibes-diy login
```

This creates a device certificate. All subsequent commands authenticate automatically.

## Defaults

Two flags appear on nearly every command but usually don't need to be passed explicitly:

- `--handle` defaults to the logged-in user's handle (from `npx vibes-diy login`).
- `--app-slug` defaults to `VIBES_APP_SLUG` env var, or `basename(cwd)` if unset.

When working with someone else's vibe, pass both flags explicitly.

## Discovery workflow

When you don't know what data a vibe contains, follow this sequence:

### 1. List vibes

```bash
npx vibes-diy list --json
```

Output is NDJSON (one JSON object per line). Each line includes `appSlug`, `ownerHandle`, `title`, and metadata. Pipe through `jq` for filtering:

```bash
npx vibes-diy list --json | jq -r 'select(.title | test("todo"; "i")) | "\(.ownerHandle)/\(.appSlug)"'
```

### 2. List databases in a vibe

```bash
npx vibes-diy db list --app-slug recipe-tracker --handle jchris
```

Output lists database names. A typical vibe has one database (often named after the app or a domain concept like `recipes`, `tasks`, `scores`).

### 3. Query by type field

Most vibes store a `type` field on every document. Query it to see what kinds of documents exist:

```bash
npx vibes-diy db query --app-slug recipe-tracker --handle jchris --db recipes type --json
```

This returns all documents grouped by their `type` field value. Use `--limit N` to cap results:

```bash
npx vibes-diy db query --app-slug recipe-tracker --handle jchris --db recipes type --limit 5 --json
```

### 4. Query by a specific key

To get documents of a specific type:

> `--key` takes a JSON value — strings need quotes (e.g. `--key '"recipe"'`), numbers are bare (e.g. `--key 42`).

```bash
npx vibes-diy db query --app-slug recipe-tracker --handle jchris --db recipes type --key '"recipe"' --json
```

### 5. Get a specific document

Once you have a document ID from query results:

```bash
npx vibes-diy db get --app-slug recipe-tracker --handle jchris --db recipes 0196e3a1-7c00-7000-8000-abcdef123456 --json
```

## CRUD operations

### Create or update a document

```bash
npx vibes-diy db put --app-slug recipe-tracker --handle jchris --db recipes '{"type":"recipe","title":"Banana Bread","servings":8}'
```

To update an existing document, include `_id` in the JSON:

```bash
npx vibes-diy db put --app-slug recipe-tracker --handle jchris --db recipes '{"_id":"0196e3a1-7c00-7000-8000-abcdef123456","type":"recipe","title":"Banana Bread","servings":12}'
```

### Delete a document

```bash
npx vibes-diy db del --app-slug recipe-tracker --handle jchris --db recipes 0196e3a1-7c00-7000-8000-abcdef123456
```

## Querying

The `db query` command indexes on a field and returns matching documents.

```bash
# All documents indexed by "type"
npx vibes-diy db query --app-slug X --handle Y --db Z type --json

# Documents where type == "task"
npx vibes-diy db query --app-slug X --handle Y --db Z type --key '"task"' --json

# Limit to 10 results
npx vibes-diy db query --app-slug X --handle Y --db Z type --key '"task"' --limit 10 --json
```

Any field works as the index, not just `type`:

```bash
# Query by status
npx vibes-diy db query --app-slug todo-app --handle jchris --db tasks status --key '"done"' --json

# Query by category
npx vibes-diy db query --app-slug recipe-tracker --handle jchris --db recipes category --key '"dessert"' --json
```

## Chat history

List chat sessions for a vibe and view prompt history:

```bash
# List all chats for an app
npx vibes-diy chats recipe-tracker --json

# Show prompts for a specific chat
npx vibes-diy chats recipe-tracker <chatId> --json
```

Use `--handle` to specify the owner explicitly.

## Tailing changes

Subscribe to real-time changes on a database:

```bash
npx vibes-diy db subscribe --app-slug recipe-tracker --handle jchris --db recipes
```

This streams changes as they happen. Useful for watching what an app does as a user interacts with it. The process runs until interrupted (Ctrl-C).

## The --json flag

Always pass `--json` when you need machine-readable output. Commands that support it:

- `list --json` -- NDJSON, one vibe per line
- `db get ... --json` -- single document as JSON
- `db query ... --json` -- array of matching documents

Without `--json`, output is human-formatted (tables, summaries) which is harder to parse programmatically.

## Practical patterns

### Inspect what a vibe stores

```bash
# What databases exist?
npx vibes-diy db list --app-slug my-vibe --handle jchris

# What types of documents are in the main database?
npx vibes-diy db query --app-slug my-vibe --handle jchris --db main type --json | jq -r '.[].type' | sort -u

# How many of each type?
npx vibes-diy db query --app-slug my-vibe --handle jchris --db main type --json | jq -r '.[].type' | sort | uniq -c | sort -rn
```

### Bulk read all documents of a type

```bash
npx vibes-diy db query --app-slug my-vibe --handle jchris --db main type --key '"todo"' --json | jq '.[]'
```

### Watch a vibe while using it

Open the vibe in a browser, then in a terminal:

```bash
npx vibes-diy db subscribe --app-slug my-vibe --handle jchris --db main
```

Every click, save, or interaction that writes data will appear in the stream.

### Work from the app's directory

If your cwd is a directory named after the app slug, you can omit `--app-slug`:

```bash
cd recipe-tracker
npx vibes-diy db list
npx vibes-diy db query --db recipes type --json
```
