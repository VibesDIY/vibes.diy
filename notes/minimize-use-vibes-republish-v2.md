# Minimize use-vibes Republish Requirements (v2)

## User Request

"Think about how we can minimize what is subject to needing republish on change. I want it to be that use-vibes is just a minimal wrapper on use fireproof, and all the vibe control etc is normal react code in the vibes.diy app pkg"

**Updated goal**: Also move mounting code into vibes.diy app pkg

## Current State Analysis

### What's in use-vibes Today

**Core API (minimal, stable):**
- `useFireproof()` - Augments with vibeMetadata, handles sync
- `fireproof`, `ImgFile`, `toCloud` - Re-exports from use-fireproof
- `callAI` - AI integration
- Context: `VibeContextProvider`, `useVibeContext`, `VibeMetadata`
- **Mounting: `mountVibesApp`, `mountVibeCode`, `mountVibeWithCleanup`** ← MOVE TO APP

**UI Components (frequently changing):**
- `VibesPanel` - 216 lines, 3-mode state machine ← MOVE TO APP
- `VibesButton` - Styled button variants ← MOVE TO APP
- `VibesSwitch` - Animated toggle/logo ← MOVE TO APP
- `HiddenMenuWrapper` - 275 lines, sliding menu ← MOVE TO APP
- `BrutalistCard` - Styled card container ← MOVE TO APP
- `LabelContainer` - Label wrapper ← MOVE TO APP
- `ImgGen` - Image generation component ← KEEP (for user vibes)
- `VibeControl` - Floating action button ← MOVE TO APP

### Current Usage Patterns

**Mounting functions (only used by vibes.diy app):**
- `vibe-viewer.tsx` - Uses `mountVibeWithCleanup`
- `InlinePreview.tsx` - Uses `mountVibeWithCleanup`
- **User vibes**: NEVER import mounting functions directly

**UI components (only used by vibes.diy app):**
- 14 files in vibes.diy/pkg/app import from use-vibes
- **User vibes**: NEVER import UI components (auto-wrapped by mount)

### Key Architectural Insight

**Mounting functions are app-only code:**
```typescript
// ONLY called by vibes.diy app, never by user vibes:
mountVibesApp({
  appComponent: UserVibeComponent,
  showVibesSwitch: true,  // Wraps with HiddenMenuWrapper + VibesPanel
  vibeMetadata: { titleId, installId }
})
```

Since only the app uses mounting functions, and they depend on UI components, they should move to the app too.

## Problem Statement

**Current pain points:**
1. UI tweaks to VibesPanel require npm publish + CDN wait
2. **Mounting logic tweaks require npm publish + CDN wait** ← NEW
3. vibe-viewer.tsx uses UI + mounting indirectly via use-vibes
4. Bundle includes mounting code + large UI components even when not needed

## Proposed Solution (v2)

### Architecture Goal

```
use-vibes (consumer API ONLY)
├─ Core hooks: useFireproof
├─ AI integration: callAI
└─ Consumer components: ImgGen (for user vibes)

vibes.diy/pkg/app (all application code)
├─ All UI: VibesPanel, VibesButton, HiddenMenuWrapper, etc.
├─ All mounting: mountVibeCode, mountVibeWithCleanup
└─ Vibe viewer: Composes everything explicitly
```

### What Moves to vibes.diy

**UI Components (7):**
1. VibesPanel
2. VibesButton
3. VibesSwitch
4. HiddenMenuWrapper
5. BrutalistCard
6. LabelContainer
7. VibeControl

**Mounting Functions (3):** ← NEW
1. `mountVibesApp` - High-level mounting with UI wrapper
2. `mountVibeCode` - Raw mounting without wrapper
3. `mountVibeWithCleanup` - Cleanup-enabled mounting

**What Stays in use-vibes:**
- `useFireproof` hook
- `callAI` function
- `ImgGen` component (for user vibes)
- Fireproof re-exports: `fireproof`, `ImgFile`, `toCloud`

## Implementation Approach

### Phase 1: Move UI Components

**Create: `vibes.diy/pkg/app/components/vibes/`**

Move these directories:
```
use-vibes/base/components/VibesPanel.tsx
use-vibes/base/components/VibesButton/
use-vibes/base/components/VibesSwitch/
use-vibes/base/components/HiddenMenuWrapper/
use-vibes/base/components/BrutalistCard/
use-vibes/base/components/LabelContainer/
use-vibes/base/components/VibeControl.tsx
```

**Keep in use-vibes:**
- `use-vibes/base/components/ImgGen.tsx` - User-facing component

### Phase 2: Move Mounting Functions ← NEW

**Create: `vibes.diy/pkg/app/utils/vibeMount.ts`**

Move these functions:
```
use-vibes/base/mounting/mountVibesApp
use-vibes/base/mounting/mountVibeCode
use-vibes/base/mounting/mountVibeWithCleanup
```

**Rationale:**
- Only used by vibes.diy app (vibe-viewer, InlinePreview)
- Depend on UI components being moved
- No user vibes ever call these functions
- Moving allows app to iterate on mounting without npm publish

### Phase 3: Update vibe-viewer to Use Local Code

**File: `vibes.diy/pkg/app/routes/vibe-viewer.tsx`**

**Before:**
```typescript
import { mountVibeWithCleanup } from 'use-vibes'
// Mounting and UI come from use-vibes
```

**After:**
```typescript
import { mountVibeWithCleanup } from '../utils/vibeMount'
import { HiddenMenuWrapper } from '../components/vibes/HiddenMenuWrapper'
import { VibesPanel } from '../components/vibes/VibesPanel'

// Mount user vibe
const unmount = await mountVibeWithCleanup(...)

// Compose UI explicitly
<HiddenMenuWrapper menuContent={<VibesPanel />}>
  <div id={vibeContainerId} />
</HiddenMenuWrapper>
```

### Phase 4: Simplify use-vibes Exports

**File: `use-vibes/pkg/index.ts`**

**Remove ALL app code, keep ONLY consumer API:**
```typescript
export {
  // Core hook
  useFireproof,

  // AI integration
  callAI,

  // Consumer component
  ImgGen,
  type ImgGenProps,

  // Fireproof re-exports
  fireproof,
  ImgFile,
  toCloud,
  type Fireproof,
} from '@vibes.diy/use-vibes-base';
```

**Removed exports:**
- ❌ `mountVibesApp`, `mountVibeCode`, `mountVibeWithCleanup` ← MOVED TO APP
- ❌ `VibesPanel`, `VibesButton`, `VibesSwitch`, etc. ← MOVED TO APP
- ❌ `VibeContext`, `VibeContextProvider` ← MOVED TO APP
- ❌ All app-specific utilities ← MOVED TO APP

### Phase 5: Update All Import Statements

**Update ~16 files in vibes.diy/pkg/app:**

```typescript
// Old:
import { VibesButton, mountVibeWithCleanup } from 'use-vibes'

// New:
import { VibesButton } from '../components/vibes/VibesButton'
import { mountVibeWithCleanup } from '../utils/vibeMount'
```

**Files to update:**
- vibe-viewer.tsx (mounting + UI imports)
- InlinePreview.tsx (mounting imports)
- LoggedOutView.tsx (UI imports)
- NewSessionView.tsx (UI imports)
- BrutalistLayout.tsx (UI imports)
- settings.tsx (UI imports)
- Plus ~10 other files

## Benefits (Updated)

✅ **Faster UI iteration**: Edit VibesPanel without npm publish
✅ **Faster mounting iteration**: Edit mounting logic without npm publish ← NEW
✅ **Smaller use-vibes bundle**: ~60% reduction (UI + mounting removed) ← UPDATED
✅ **Clearer architecture**: Library (hooks/components) vs App (integration)
✅ **Complete separation**: use-vibes has ZERO app-specific code ← NEW
✅ **Flexible composition**: App controls all integration details
✅ **Easier debugging**: All app code in same repo
✅ **Faster dev cycle**: No CDN wait for any app changes

## Breaking Changes

This is a **major version bump** (0.19.0) with NO backward compatibility:
- Removes ALL app UI component exports
- **Removes ALL mounting function exports** ← NEW
- Keeps ONLY consumer-facing API: `useFireproof`, `callAI`, `ImgGen`
- vibe-viewer must import mounting and UI locally
- No migration path - clean architectural break

## Implementation Steps (Ordered)

### Step 1: Move UI Components
**Move 7 component directories from use-vibes → vibes.diy:**
```bash
use-vibes/base/components/VibesPanel.tsx
use-vibes/base/components/VibesButton/
use-vibes/base/components/VibesSwitch/
use-vibes/base/components/HiddenMenuWrapper/
use-vibes/base/components/BrutalistCard/
use-vibes/base/components/LabelContainer/
use-vibes/base/components/VibeControl.tsx

→ vibes.diy/pkg/app/components/vibes/
```

Also move associated styles and tests.

### Step 2: Move Mounting Functions ← NEW
**Create `vibes.diy/pkg/app/utils/vibeMount.ts`:**
- Move `mountVibesApp()` from use-vibes/base/mounting/
- Move `mountVibeCode()` from use-vibes/base/mounting/
- Move `mountVibeWithCleanup()` from use-vibes/base/mounting/
- Update imports to reference local UI components

### Step 3: Update use-vibes Exports
**Files:**
- `use-vibes/base/index.ts` - Remove UI + mounting exports
- `use-vibes/pkg/index.ts` - Remove UI + mounting exports

**Keep ONLY:**
- `useFireproof`, `callAI`, `ImgGen`
- Fireproof re-exports: `fireproof`, `ImgFile`, `toCloud`

### Step 4: Update vibe-viewer.tsx
**File:** `vibes.diy/pkg/app/routes/vibe-viewer.tsx`

**Changes:**
1. Import mounting from `../utils/vibeMount` (not use-vibes)
2. Import UI from `../components/vibes/` (not use-vibes)
3. Compose UI explicitly in React

```typescript
import { mountVibeWithCleanup } from '../utils/vibeMount'
import { HiddenMenuWrapper } from '../components/vibes/HiddenMenuWrapper'
import { VibesPanel } from '../components/vibes/VibesPanel'
```

### Step 5: Update InlinePreview.tsx
**File:** `vibes.diy/pkg/app/components/ResultPreview/InlinePreview.tsx`

**Changes:**
- Import mounting from `../../utils/vibeMount`
- No UI needed (uses `showVibesSwitch: false`)

### Step 6: Update All Other Import Statements
**~14 files importing UI components:**

```typescript
// Old:
import { VibesButton, VibesSwitch, BrutalistCard } from 'use-vibes'

// New:
import { VibesButton } from '../components/vibes/VibesButton'
import { VibesSwitch } from '../components/vibes/VibesSwitch'
import { BrutalistCard } from '../components/vibes/BrutalistCard'
```

Files: LoggedOutView, NewSessionView, BrutalistLayout, settings, etc.

### Step 7: Clean Up use-vibes
**Actions:**
1. Delete moved component directories
2. Delete moved mounting directory ← NEW
3. Delete moved styles
4. Delete moved tests
5. Update README - document minimal consumer API
6. Remove unused app utilities

### Step 8: Testing
**Verify:**
- ✅ use-vibes builds with minimal exports
- ✅ vibes.diy builds with local mounting + UI
- ✅ vibe-viewer page renders correctly
- ✅ Inline preview works
- ✅ All 16 files with updated imports work
- ✅ Tests pass in both packages

### Step 9: Version Bump and Publish
**Actions:**
1. Bump use-vibes to 0.19.0 (breaking change)
2. Update CHANGELOG with breaking changes (removed mounting exports)
3. Publish to npm with --tag dev first
4. Test with published version
5. Tag as latest when verified

## Success Criteria (Updated)

✅ use-vibes exports ONLY: `useFireproof`, `callAI`, `ImgGen`, fireproof utils
✅ ALL mounting logic lives in vibes.diy/pkg/app/utils/ ← NEW
✅ ALL UI components live in vibes.diy/pkg/app/components/vibes/
✅ use-vibes bundle size reduced by ~60% ← UPDATED
✅ UI + mounting changes don't require use-vibes publish ← UPDATED
✅ Complete separation: use-vibes has zero app code ← NEW
✅ All existing functionality works
✅ Tests pass in both packages
