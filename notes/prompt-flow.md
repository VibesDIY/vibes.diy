# Prompt Flow Architecture - Moving Orchestration Upstream

## Current Problem

Both `vibes.diy` and `useVibes` need the same two-stage component generation process:
1. **Stage 1**: AI selects dependencies based on the user's prompt
2. **Stage 2**: Generate component with selected dependencies in the system prompt

Currently, this logic is scattered:
- `vibes.diy` uses `useSystemPromptManager` → `makeBaseSystemPrompt` → internally calls `selectLlmsAndOptions`
- `useVibes` would need to duplicate this entire flow
- Metadata (selected dependencies) is only available via callback, making it hard to access

## Proposed Solution: Centralized Orchestration in Prompts Package

### New Architecture

```
@vibes.diy/prompts (orchestrator)
    ├── generateComponentWithDependencies() [NEW]
    │   ├── Stage 1: selectLlmsAndOptions()
    │   ├── Stage 2: makeBaseSystemPrompt()
    │   └── Returns: { systemPrompt, metadata }
    │
    ├── Consumed by:
    │   ├── vibes.diy app (via useSystemPromptManager)
    │   └── useVibes hook (direct call)
    │
    └── Existing functions remain for backward compatibility
```

### New Function API

```typescript
export interface ComponentGenerationResult {
  systemPrompt: string;
  metadata: {
    dependencies: string[];           // Selected library modules
    aiSelectedDependencies: string[]; // What AI chose (before overrides)
    demoData: boolean;                // Include demo data button
    model: string;                    // AI model used
    timestamp: number;                // Generation timestamp
  };
}

export async function generateComponentWithDependencies(
  prompt: string,
  options: Partial<UserSettings> & LlmSelectionOptions,
  model?: string
): Promise<ComponentGenerationResult>
```

### Implementation Details

#### Stage 1: Dependency Selection
- Call `selectLlmsAndOptions()` with user prompt and history
- AI analyzes prompt to determine:
  - Which UI libraries to include (React Hook Form, Lucide icons, etc.)
  - Whether to add a demo data button
- Log decisions for debugging: `console.log('🎯 AI selected dependencies:', ...)`

#### Stage 2: System Prompt Generation
- Call `makeBaseSystemPrompt()` with selected dependencies
- Include proper imports, Fireproof setup, style guidelines
- System prompt includes:
  - "Use Fireproof for data persistence"
  - "Begin the component with the import statements"
  - Selected library documentation
  - Style prompt and guidelines

#### Metadata Return
- Return both system prompt AND metadata
- Metadata includes all decisions for future database storage
- Console log at key moments for debugging

### Integration Points

#### vibes.diy App Integration

Simplify `useSystemPromptManager.ts`:

```typescript
const ensureSystemPrompt = useCallback(async (overrides) => {
  const result = await generateComponentWithDependencies(
    overrides?.userPrompt || '',
    { ...settingsDoc, ...vibeDoc, ...overrides },
    model
  );
  
  // Store metadata for UI updates
  onAiDecisions?.(result.metadata);
  
  return result.systemPrompt;
}, [settingsDoc, vibeDoc, onAiDecisions]);
```

#### useVibes Hook Integration

Direct usage in `use-vibes.ts`:

```typescript
const generateComponent = async (prompt: string) => {
  // Get system prompt and metadata
  const result = await generateComponentWithDependencies(
    prompt,
    {
      userPrompt: prompt,
      history: [],
      fallBackUrl: 'https://esm.sh/use-vibes/prompt-catalog/llms',
      ...options
    },
    options.model
  );

  // Log for debugging
  console.log('📦 Component metadata for storage:', result.metadata);

  // Store metadata in state for future DB persistence
  setState(prev => ({
    ...prev,
    document: {
      ...prev.document,
      ...result.metadata,
      prompt,
      _id: `vibe-${Date.now()}`,
      created_at: Date.now(),
    }
  }));

  // Generate component with system prompt
  const messages = [
    { role: 'system', content: result.systemPrompt },
    { role: 'user', content: prompt },
  ];

  const aiResponse = await callAI(messages, {
    model: result.metadata.model,
    max_tokens: 2000,
  });
  
  // Parse and compile component...
};
```

## Benefits

1. **Single Source of Truth**: Two-stage logic lives in one place
2. **No Duplication**: Both apps use the same orchestration
3. **Better Metadata Access**: Direct return instead of callbacks
4. **Easier Testing**: Can test orchestration independently
5. **Future-Ready**: Metadata ready for database storage
6. **Consistent Behavior**: Identical generation across apps

## Implementation Plan

### Phase 1: Add Orchestrator (Current)
1. ✅ Write this plan document
2. Add `generateComponentWithDependencies` to prompts package
3. Add comprehensive tests for the new function
4. Verify console logging at key points

### Phase 2: Integrate with useVibes
1. Update useVibes to use new function
2. Add test for system prompt content
3. Verify metadata is captured correctly
4. Console log metadata for future DB storage

### Phase 3: Migrate vibes.diy (Later)
1. Update useSystemPromptManager to use new function
2. Ensure backward compatibility
3. Test both apps work identically

### Phase 4: Database Persistence (Future)
1. Store metadata in Fireproof database
2. Add document schema for vibes
3. Enable history/versioning of generated components
4. Cache dependency selections per session

## Testing Strategy

### Unit Tests
- Mock `selectLlmsAndOptions` and `makeBaseSystemPrompt`
- Verify correct stage execution order
- Test metadata structure and content
- Verify console.log calls for debugging

### Integration Tests
- Test with real prompt strings
- Verify system prompt contains expected text
- Check dependency selection logic
- Test override behaviors

### End-to-End Tests
- Generate actual components
- Verify imports match selected dependencies
- Test that components compile successfully
- Ensure Fireproof integration works

## Console Logging Points

For debugging and future database storage preparation:

1. **After Stage 1**: Log AI-selected dependencies
   ```
   🎯 Component generation: AI selected dependencies: {
     selected: ['useFireproof', 'LucideIcons'],
     demoData: false,
     prompt: "Create a todo app",
     model: "anthropic/claude-sonnet-4.5"
   }
   ```

2. **After Stage 2**: Log final metadata
   ```
   📦 Component metadata for storage: {
     dependencies: ['useFireproof', 'LucideIcons'],
     aiSelectedDependencies: ['useFireproof', 'LucideIcons'],
     demoData: false,
     model: "anthropic/claude-sonnet-4.5",
     timestamp: 1735234567890
   }
   ```

3. **On Generation Complete**: Log success with document ID
   ```
   ✅ Component generated successfully: vibe-1735234567890
   ```

## Migration Path

1. **Backward Compatible**: Keep existing functions working
2. **Gradual Migration**: Apps can migrate at their own pace
3. **Deprecation Plan**: Eventually mark old patterns as deprecated
4. **Documentation**: Update docs to show new preferred pattern

## Future Enhancements

1. **Caching**: Cache dependency selections per session
2. **Learning**: Track which dependencies work well together
3. **Presets**: Allow saving dependency sets as templates
4. **Versioning**: Track changes to generated components
5. **Sharing**: Export/import component configurations

This architecture makes the prompts package the true "brain" of component generation, with both apps being thin clients that consume its orchestration capabilities.
