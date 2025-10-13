# Debug Plan: Sharing Events Not Working

## Problem Statement

The sharing functionality works when importing from 'use-vibes' directly (as in ShareExample.tsx), but doesn't work when importing from 'use-fireproof' with import map redirect (as in the test app).

### Observed Behavior
- Template dispatches events correctly: `vibes-share-request`, `vibes-sync-enable`
- No response events received: `vibes-share-success` or `vibes-share-error`
- Console shows template events firing but no use-vibes responses

### Working vs Non-Working Cases

**ShareExample.tsx (WORKING):**
```javascript
import { useFireproof } from 'use-vibes';
```

**Test App (NOT WORKING):**
```javascript
import { useFireproof } from 'use-fireproof';
```
With import map: `"use-fireproof": "https://esm.sh/use-vibes@0.12.15-dev-sharing-02"`

## Diagnostic Strategy

### Phase 1: Add Diagnostics to Enhanced useFireproof

Add console logs to `/Users/jchris/code/vibes.diy/use-vibes/base/index.ts`:

1. **Function Entry Detection**
   - Log when enhanced useFireproof is called
   - Verify which version is being loaded

2. **Event Listener Registration**
   - Log when each useEffect sets up event listeners
   - Verify listeners are being attached to document

3. **Share Function Creation**
   - Log when share function is created
   - Log attachment state

4. **Event Reception**
   - Log when vibes-share-request events are received
   - Log share function availability and attachment state

### Phase 2: Test Locally with React Example

Test ShareExample.tsx locally to verify diagnostic output shows:
- Enhanced hook initialization
- Event listener setup
- Event reception and handling

### Phase 3: Test via ESM.sh

Deploy diagnostic version and test with ai-builder-hosting to see:
- Whether diagnostics appear at all (indicating enhanced hook is running)
- Where the process breaks down

## Expected Diagnostic Output

### Working Case (ShareExample.tsx locally):
```
[useFireproof] Enhanced hook called with: todos-shared-15
[useFireproof] Import source detection - checking if enhanced version is active
[useFireproof] Creating share function, attach state: undefined
[useFireproof] Setting up vibes-share-request listener
[useFireproof] Setting up vibes-sync-enable listener
[useFireproof] Setting up vibes-sync-disable listener
[useFireproof] Received vibes-share-request event: {email: "test@example.com", role: "member", right: "read"}
```

### Non-Working Case (via import map):
- **Scenario A**: No logs at all → Enhanced hook not being called (import mapping issue)
- **Scenario B**: Partial logs → Enhanced hook called but event listeners not set up
- **Scenario C**: All setup logs but no event reception → Events not reaching the hook

## Release Process

1. **Diagnostic Release**: `use-vibes@v0.12.15-dev-sharing-debug`
2. **Test and analyze console output**
3. **Implement fix based on findings**
4. **Final Release**: `use-vibes@v0.12.15-dev-sharing-03`

## Hypotheses

1. **Import Map Resolution Issue**: ESM.sh might not properly redirect named exports from 'use-fireproof' to the enhanced version
2. **Module Loading Order**: The enhanced hook might load after event dispatching
3. **Export Path Issue**: The redirected import might resolve to the original useFireproof instead of the enhanced one

This plan will definitively identify which hypothesis is correct and guide the appropriate fix.