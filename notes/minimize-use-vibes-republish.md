# Minimize use-vibes Republish Requirements

## User Request

"Think about how we can minimize what is subject to needing republish on change. I want it to be that use-vibes is just a minimal wrapper on use fireproof, and all the vibe control etc is normal react code in the vibes.diy app pkg"

## Current State Analysis

### What's in use-vibes Today

**Core API (minimal, stable):**
- `useFireproof()` - Augments with vibeMetadata, handles sync
- `fireproof`, `ImgFile`, `toCloud` - Re-exports from use-fireproof
- `callAI` - AI integration
- Context: `VibeContextProvider`, `useVibeContext`, `VibeMetadata`
- Mounting: `mountVibesApp`, `mountVibeCode`, `mountVibeWithCleanup`

**UI Components (frequently changing):**
- `VibesPanel` - 216 lines, 3-mode state machine (default/mutate/invite)
- `VibesButton` - Styled button with variants (blue/red/yellow/gray) and icons
- `VibesSwitch` - 75-80px animated toggle/logo button
- `HiddenMenuWrapper` - 275 lines, complex sliding menu with animations
- `BrutalistCard` - Styled card container (sm/md/lg sizes)
- `LabelContainer` - Label wrapper with disappear animation
- `ImgGen` - Image generation component
- `VibeControl` - Floating action button overlay

### Current Usage Patterns

**In vibes.diy app (14 files):**
- `VibesButton` - Used in LoggedOutView, NewSessionView, settings, VibesPanel
- `VibesSwitch` - Used in LoggedOutView, NewSessionView, BrutalistLayout
- `BrutalistCard` - Used in NewSessionView, settings, BrutalistLayout, VibesPanel
- `LabelContainer` - Used in LoggedOutView, VibesPanel
- `mountVibeWithCleanup` - Used in vibe-viewer, InlinePreview

**In user vibe code:**
- `useFireproof` - Data persistence
- `callAI` - AI interactions
- `ImgGen` - Optional image generation
- **NOT USED**: VibesButton, VibesSwitch, VibesPanel (auto-wrapped by mount system)

### Key Architectural Insight

**User vibes are automatically wrapped:**
```typescript
mountVibesApp({
  appComponent: UserVibeComponent,
  showVibesSwitch: true,  // Includes HiddenMenuWrapper + VibesPanel
  vibeMetadata: { titleId, installId }
})
```

When `showVibesSwitch=true`, the mount system wraps user vibes with HiddenMenuWrapper + VibesPanel. This means:
- UI components are bundled into use-vibes even though users never import them
- Changes to VibesPanel require republishing use-vibes
- The vibe-viewer page imports these components transitively through mountVibesApp

## Problem Statement

**Current pain points:**
1. UI tweaks to VibesPanel/VibesButton require npm publish + CDN wait
2. vibe-viewer.tsx uses UI components indirectly via mountVibesApp
3. vibes.diy app imports UI components from use-vibes for its own UI
4. Bundle includes large UI components (HiddenMenuWrapper = 275 lines) even when not needed

## Proposed Solution

### Architecture Goal

```
use-vibes (minimal, stable)
├─ Core hooks: useFireproof, callAI, ImgGen
├─ Context: VibeContextProvider (metadata only)
└─ Mounting: createVibeRoot (pure mounting, no UI)

vibes.diy/pkg/app (UI layer, iterates fast)
├─ All vibe control UI: VibesPanel, VibesButton, HiddenMenuWrapper
├─ App-level UI: BrutalistCard, LabelContainer, VibesSwitch
└─ Vibe viewer page: Composes UI directly, no mount wrapper
```

### Implementation Approach

**Option A: Move Everything (Recommended)**
- Move ALL UI components from use-vibes to vibes.diy/pkg/app except ImgGen
- Keep only hooks and pure mounting logic in use-vibes
- vibe-viewer renders UI directly, doesn't use mountVibesApp
- Inline vibes use lightweight mounting without UI wrapper


## Recommended Implementation: Option A

### Phase 1: Extract Core Mounting Logic

**Create: use-vibes/base/mounting/createVibeRoot.ts**
```typescript
export function createVibeRoot(options: {
  container: HTMLElement;
  component: React.ComponentType;
  vibeMetadata?: VibeMetadata;
}): { unmount: () => void; getContainer: () => HTMLElement }
```

Pure mounting logic without UI dependencies. Just creates React root and renders component.

### Phase 2: Move UI Components to vibes.diy

**Create directory structure:**
```
vibes.diy/pkg/app/components/vibes/
  ├─ VibesPanel.tsx          (from use-vibes)
  ├─ VibesButton/            (from use-vibes)
  ├─ VibesSwitch/            (from use-vibes)
  ├─ HiddenMenuWrapper/      (from use-vibes)
  ├─ BrutalistCard/          (from use-vibes)
  ├─ LabelContainer/         (from use-vibes)
  └─ VibeControl.tsx         (from use-vibes)
```

**Files to move (7 app UI components, NOT ImgGen):**
1. use-vibes/base/components/VibesPanel.tsx → vibes.diy/pkg/app/components/vibes/
2. use-vibes/base/components/VibesButton/ → vibes.diy/pkg/app/components/vibes/
3. use-vibes/base/components/VibesSwitch/ → vibes.diy/pkg/app/components/vibes/
4. use-vibes/base/components/HiddenMenuWrapper/ → vibes.diy/pkg/app/components/vibes/
5. use-vibes/base/components/BrutalistCard/ → vibes.diy/pkg/app/components/vibes/
6. use-vibes/base/components/LabelContainer/ → vibes.diy/pkg/app/components/vibes/
7. use-vibes/base/components/VibeControl.tsx → vibes.diy/pkg/app/components/vibes/

**Keep in use-vibes (for consumer vibes):**
- use-vibes/base/components/ImgGen.tsx (STAYS - user-facing component)

### Phase 3: Update vibe-viewer to Compose UI Directly

**File: vibes.diy/pkg/app/routes/vibe-viewer.tsx**

**Current approach:**
```typescript
mountVibeWithCleanup(vibeCode, containerId, titleId, installId, ...)
// ^ This wraps with HiddenMenuWrapper + VibesPanel automatically
```

**New approach:**
```typescript
// Import from app's components
import { HiddenMenuWrapper } from '../components/vibes/HiddenMenuWrapper'
import { VibesPanel } from '../components/vibes/VibesPanel'

// Mount user vibe without UI wrapper
const unmountVibe = await mountVibeCodeRaw(vibeCode, vibeContainerId, ...)

// Render our own UI around it
return (
  <div className="relative w-full h-screen bg-gray-900">

    <HiddenMenuWrapper menuContent={<VibesPanel />} showVibesSwitch={true}>
      <div id={vibeContainerId} className="w-full h-full" />
    </HiddenMenuWrapper>
  </div>
)
```

This gives vibe-viewer full control over UI composition without dependency on use-vibes UI layer.

### Phase 4: Simplify use-vibes Exports

**File: use-vibes/pkg/index.ts**

**Remove app UI exports, keep only consumer-facing API:**
```typescript
export {
  // Core Fireproof wrapper
  useFireproof,
  fireproof,
  ImgFile,

  // AI integration
  callAI,

  // Consumer-facing UI (for user vibes)
  ImgGen,
  type ImgGenProps,

  // Type exports
  type Fireproof,
  type CallAI,
} from '@vibes.diy/use-vibes-base';
```

**Remove from exports:**
- VibesPanel, VibesButton, VibesSwitch, HiddenMenuWrapper
- BrutalistCard, LabelContainer, VibeControl
- VibeContext etc
- All app-specific UI components and utilities

### Phase 5: Update All Import Statements

**Update 14 files in vibes.diy/pkg/app:**
```typescript
// Old:
import { VibesButton, VibesSwitch } from 'use-vibes'

// New:
import { VibesButton } from '../components/vibes/VibesButton'
import { VibesSwitch } from '../components/vibes/VibesSwitch'
```

Files to update:
- vibes.diy/pkg/app/components/LoggedOutView.tsx
- vibes.diy/pkg/app/components/NewSessionView.tsx
- vibes.diy/pkg/app/components/BrutalistLayout.tsx
- vibes.diy/pkg/app/routes/settings.tsx
- vibes.diy/pkg/app/routes/vibe-instance-list.tsx
- (Plus 9 other files)

## Benefits

✅ **Faster UI iteration**: Edit VibesPanel without npm publish
✅ **Smaller use-vibes bundle**: ~500 lines of UI code removed
✅ **Clearer architecture**: Library vs App separation
✅ **Flexible composition**: vibe-viewer controls its own UI
✅ **Easier debugging**: UI code in same repo as app
✅ **Faster dev cycle**: No CDN wait for UI tweaks

## Breaking Changes

This is a **major version bump** (0.19.0) with NO backward compatibility:
- Removes app UI component exports (VibesPanel, VibesButton, Context, etc.)
- Keeps only consumer-facing API (useFireproof, callAI, ImgGen, mounting)
- vibe-viewer must compose UI explicitly
- No migration path - clean architectural break

## User Decisions (Confirmed)

✅ **No backward compatibility** - Clean break, breaking changes accepted
✅ **Focus on vibe-viewer** - Compose UI directly, explicit control
✅ **Keep ImgGen in use-vibes** - It's for consumers (user vibes), not app UI
✅ **Big Bang approach** - Move all app UI components at once

## Implementation Steps (Ordered)

### Step 1: Move UI Components (use-vibes → vibes.diy)
**Action:** Move 7 app UI component directories
```bash
# Move these directories (with all files, tests, styles):
use-vibes/base/components/VibesPanel.tsx
use-vibes/base/components/VibesButton/
use-vibes/base/components/VibesSwitch/
use-vibes/base/components/HiddenMenuWrapper/
use-vibes/base/components/BrutalistCard/
use-vibes/base/components/LabelContainer/
use-vibes/base/components/VibeControl.tsx

# To:
vibes.diy/pkg/app/components/vibes/
```

**Also move:**
- Associated style files from `use-vibes/base/styles/`
- Component tests from `use-vibes/tests/`

### Step 2: Update use-vibes Exports
**Files:**
- `use-vibes/base/index.ts` - Remove app UI exports, keep ImgGen
- `use-vibes/pkg/index.ts` - Remove app UI exports, keep ImgGen

**Verify exports are minimal:**
- useFireproof, fireproof, ImgFile, toCloud
- callAI
- mountVibeCode, mountVibeWithCleanup
- ImgGen (KEEP - for consumer vibes)

### Step 3: Refactor vibe-viewer.tsx
**File:** `vibes.diy/pkg/app/routes/vibe-viewer.tsx`

**Changes:**
1. Import HiddenMenuWrapper and VibesPanel from local components
2. Change from `mountVibeWithCleanup` wrapping to explicit UI composition
3. Render HiddenMenuWrapper + VibesPanel directly in JSX
4. Mount user vibe code into a container div (no wrapper)

**Before:**
```typescript
await mountVibeWithCleanup(vibeCode, containerId, ...)
// ^ Auto-wraps with UI
```

**After:**
```typescript
// Import local UI
import { HiddenMenuWrapper } from '../components/vibes/HiddenMenuWrapper'
import { VibesPanel } from '../components/vibes/VibesPanel'

// Mount vibe code without UI wrapper
const vibeContainer = document.getElementById(vibeContainerId)
await mountVibeCode(vibeCode, vibeContainerId, ...) // No showVibesSwitch param

// Render UI explicitly in React
<HiddenMenuWrapper menuContent={<VibesPanel />} showVibesSwitch={true}>
  <div id={vibeContainerId} />
</HiddenMenuWrapper>
```

### Step 4: Update All Import Statements
**Files to update (~14 files in vibes.diy/pkg/app):**
- LoggedOutView.tsx
- NewSessionView.tsx
- BrutalistLayout.tsx
- settings.tsx
- vibe-instance-list.tsx
- Plus ~9 other files

**Pattern:**
```typescript
// Old:
import { VibesButton, VibesSwitch, BrutalistCard } from 'use-vibes'
import { VibesButton } from '@vibes.diy/use-vibes-base'

// New:
import { VibesButton } from '../components/vibes/VibesButton'
import { VibesSwitch } from '../components/vibes/VibesSwitch'
import { BrutalistCard } from '../components/vibes/BrutalistCard'
```

### Step 5: Update InlinePreview.tsx
**File:** `vibes.diy/pkg/app/components/ResultPreview/InlinePreview.tsx`

**Changes:**
- Uses `mountVibeWithCleanup` with `showVibesSwitch: false`
- Should work without changes since no UI wrapper needed
- Verify it still works correctly

### Step 6: Clean Up use-vibes
**Actions:**
1. Delete moved component directories from use-vibes/base/components/
2. Delete moved styles from use-vibes/base/styles/
3. Delete moved tests from use-vibes/tests/
4. Update use-vibes README - document minimal API
5. Remove any unused utilities (app slug functions, style utils)

### Step 7: Testing
**Verify:**
- ✅ use-vibes builds successfully
- ✅ vibes.diy builds successfully
- ✅ vibe-viewer page renders correctly with UI
- ✅ Inline preview works without UI chrome
- ✅ All 14 files importing UI components work
- ✅ Tests pass in both packages

### Step 8: Version Bump and Publish
**Actions:**
1. Bump use-vibes to 0.19.0 (breaking change)
2. Update CHANGELOG.md with breaking changes
3. Publish to npm with --tag dev first
4. Test with published version
5. Tag as latest when verified

## Success Criteria

✅ UI changes in vibes.diy don't require use-vibes publish
✅ use-vibes bundle size reduced by ~50%
✅ vibe-viewer composes UI explicitly (no magic wrapping)
✅ All existing functionality works (UI just moved)
✅ Tests pass in both packages
