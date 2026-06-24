# Slash Commands

A command registry pattern for handling `/command` input in the REPL. The skill presents slash commands as a checklist — users select which ones to include. `/model`, `/new`, and `/help` are ON by default.

---

## src/commands.ts

```typescript
import type { Interface } from 'readline';
import type { AgentConfig } from './config.js';
import type { ChatMessage } from './agent.js';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const GRAY = '\x1b[90m';

export interface CommandContext {
  config: AgentConfig;
  rl: Interface;
  messages: ChatMessage[];
  sessionPath: string;
  resetSession: () => string;
  totalTokens: { input: number; output: number };
}

export interface SlashCommand {
  name: string;
  description: string;
  execute: (args: string, ctx: CommandContext) => Promise<void>;
}

const commands: SlashCommand[] = [];

export function registerCommand(cmd: SlashCommand): void {
  commands.push(cmd);
}

export function getCommands(): SlashCommand[] {
  return commands;
}

export async function dispatch(input: string, ctx: CommandContext): Promise<boolean> {
  const [name, ...rest] = input.split(' ');
  const cmd = commands.find((c) => c.name === name);
  if (!cmd) {
    console.log(`  ${DIM}Unknown command: ${name}. Type /help for available commands.${RESET}`);
    return true;
  }
  await cmd.execute(rest.join(' '), ctx);
  return true;
}
```

---

## Default-ON Commands

### /model

Move the existing `selectModel` logic into the registry:

```typescript
import { registerCommand } from './commands.js';

function ask(rl: Interface, prompt: string): Promise<string> {
  return new Promise((r) => rl.question(prompt, r));
}

registerCommand({
  name: '/model',
  description: 'Switch to a different model',
  execute: async (_args, ctx) => {
    console.log(`  ${DIM}Current:${RESET} ${CYAN}${ctx.config.model}${RESET}`);
    const query = await ask(ctx.rl, `  ${DIM}Search models:${RESET} `);
    if (!query.trim()) return;
    process.stdout.write(`  ${DIM}Fetching…${RESET}`);
    const res = await fetch('https://openrouter.ai/api/v1/models');
    const { data } = await res.json() as { data: { id: string; name: string }[] };
    process.stdout.write('\r\x1b[K');
    const q = query.toLowerCase();
    const matches = data
      .filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      .slice(0, 15);
    if (!matches.length) { console.log(`  ${DIM}No models matching "${query}".${RESET}`); return; }
    matches.forEach((m, i) => console.log(`  ${DIM}${String(i + 1).padStart(2)})${RESET} ${m.id}`));
    const pick = await ask(ctx.rl, `\n  ${DIM}Select (1-${matches.length}):${RESET} `);
    const idx = parseInt(pick) - 1;
    if (idx >= 0 && idx < matches.length) {
      ctx.config.model = matches[idx].id;
      console.log(`  ${DIM}Model →${RESET} ${CYAN}${ctx.config.model}${RESET}`);
    } else { console.log(`  ${DIM}Cancelled.${RESET}`); }
  },
});
```

### /new

```typescript
registerCommand({
  name: '/new',
  description: 'Start a fresh conversation',
  execute: async (_args, ctx) => {
    ctx.messages.length = 0;
    ctx.sessionPath = ctx.resetSession();
    console.log(`  ${GREEN}✓${RESET} ${DIM}New session started.${RESET}`);
  },
});
```

### /help

```typescript
registerCommand({
  name: '/help',
  description: 'List available commands',
  execute: async (_args, _ctx) => {
    for (const cmd of getCommands()) {
      console.log(`  ${CYAN}${cmd.name.padEnd(12)}${RESET}${DIM}${cmd.description}${RESET}`);
    }
  },
});
```

---

## Optional Commands (OFF by default)

### /compact

Requires the Context Compaction module (`src/compaction.ts`).

```typescript
import { compactMessages } from './compaction.js';
import { OpenRouter } from '@openrouter/agent';

registerCommand({
  name: '/compact',
  description: 'Compress conversation context',
  execute: async (args, ctx) => {
    const before = ctx.messages.length;
    const client = new OpenRouter({ apiKey: ctx.config.apiKey });
    const compacted = await compactMessages(client, ctx.messages, {
      threshold: 0,
      keepRecent: Math.min(10, ctx.messages.length),
      ...(args && { model: args }),
    });
    ctx.messages.length = 0;
    ctx.messages.push(...compacted);
    console.log(`  ${GREEN}✓${RESET} ${DIM}Compacted ${before} → ${ctx.messages.length} messages.${RESET}`);
  },
});
```

### /session

```typescript
registerCommand({
  name: '/session',
  description: 'Show session info and token usage',
  execute: async (_args, ctx) => {
    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
    console.log(`  ${DIM}file${RESET}      ${ctx.sessionPath}`);
    console.log(`  ${DIM}messages${RESET}  ${ctx.messages.length}`);
    console.log(`  ${DIM}tokens${RESET}    ${fmt(ctx.totalTokens.input)} in · ${fmt(ctx.totalTokens.output)} out`);
  },
});
```

### /export

```typescript
import { writeFileSync } from 'fs';

registerCommand({
  name: '/export',
  description: 'Save conversation as Markdown',
  execute: async (args, ctx) => {
    const file = args.trim() || `session-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    const md = ctx.messages
      .map((m) => `## ${m.role === 'user' ? 'User' : 'Assistant'}\n\n${m.content}`)
      .join('\n\n---\n\n');
    writeFileSync(file, md, 'utf-8');
    console.log(`  ${GREEN}✓${RESET} ${DIM}Exported to ${file}${RESET}`);
  },
});
```

---

## Wire into cli.ts

Replace inline `/model` handling with the registry:

```typescript
import { dispatch, type CommandContext } from './commands.js';
import './commands-init.js'; // registers selected commands (side-effect import)

// In main(), after session setup, create the context:
const cmdCtx: CommandContext = {
  config,
  rl,
  messages,
  sessionPath,
  resetSession: () => { sessionPath = newSessionPath(config.sessionDir); return sessionPath; },
  totalTokens: { input: 0, output: 0 },
};

// In the line handler, before message push:
if (trimmed.startsWith('/')) {
  await dispatch(trimmed, cmdCtx);
  rl.prompt();
  return;
}

// After each agent call, accumulate tokens:
cmdCtx.totalTokens.input += result.usage?.inputTokens ?? 0;
cmdCtx.totalTokens.output += result.usage?.outputTokens ?? 0;
```

The agent generates a `src/commands-init.ts` file that imports and registers only the commands the user selected. For default-ON commands:

```typescript
import './commands.js';
// Registers: /model, /new, /help
```
