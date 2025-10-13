# Release Notes for use-vibes Package

## Dev Branch Changes (jchris/selem-sharing)

### ⚠️ IMPORTANT: Pre-release Cleanup Required

**Before releasing to latest npm tag, revert the following change:**

- **File**: `use-vibes/pkg/package.json`
- **Change**: The `-x '^'` flag was removed from the `pack` and `publish` scripts
- **Current**: `"publish": "core-cli build"`  
- **Should be**: `"publish": "core-cli build -x '^'"`

**Reason**: The caret removal was needed for dev testing to fix ESM.sh dependency resolution conflicts, but production releases should maintain semver ranges for proper dependency management.

### Changes Made for Dev Testing

1. **React useId Conflict Fix**: Replaced `useId()` with simple counter in enhanced useFireproof hook
2. **Caret Removal**: Temporarily removed `-x '^'` flag to publish exact versions instead of semver ranges
3. **Import Map Updates**: Added cache-busting parameters for ai-builder-hosting project testing

### Files Modified

- `use-vibes/base/index.ts` - React conflict fix (keep this)
- `use-vibes/pkg/package.json` - Build script changes (REVERT before production)
- `ai-builder-hosting/src/config/library-import-map.json` - Testing changes (project-specific)

## Testing Status

- ✅ React useId conflict resolved
- ✅ Enhanced useFireproof hook working in dev environment  
- 🧪 ESM.sh dependency resolution testing in progress
- ⏳ End-to-end sharing functionality validation pending