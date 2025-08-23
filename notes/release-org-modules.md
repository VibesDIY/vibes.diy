# Release Organization Modules Challenge

## Current Package Structure Analysis

The monorepo contains multiple packages that need to be published as `@vibes.diy/*` scoped packages:

### Package Inventory

#### 1. **@vibes.diy/use-vibes-base** (base package)
- **Current name**: `@vibes.diy/use-vibes-base` ✅ (already correctly scoped)
- **Path**: `/use-vibes/base/package.json`
- **Status**: Internal workspace package, needs to be made public
- **Dependencies**: `call-ai: workspace:*`, `use-fireproof: ^0.23.7`, `uuid: ^11.1.0`
- **Version**: `0.0.0`

#### 2. **use-vibes** (main public package)  
- **Current name**: `use-vibes` ❌ (needs scoping)
- **Should be**: `@vibes.diy/use-vibes`
- **Path**: `/use-vibes/pkg/package.json`
- **Dependencies**: `use-vibes-base: workspace:*`
- **Version**: `0.0.0`

#### 3. **call-ai** (AI utilities package)
- **Current name**: `call-ai` ❌ (needs scoping)
- **Should be**: `@vibes.diy/call-ai`
- **Path**: `/call-ai/pkg/package.json`
- **Version**: `0.0.0`
- **Repository**: Points to separate `fireproof-storage/call-ai` repo

#### 4. **vibes-diy** (main app)
- **Current name**: `vibes-diy`
- **Path**: `/vibes.diy/pkg/package.json`  
- **Status**: Private app (`"private": "true"`), not for npm release
- **Dependencies**: Uses published `call-ai: 0.10.2` (not workspace)

## Release Challenges & Requirements

### 1. **Dependency Chain Resolution**
```
@vibes.diy/use-vibes
  └── @vibes.diy/use-vibes-base
      └── @vibes.diy/call-ai (workspace:* -> published version)
```

### 2. **Package Naming Changes Required**
- [ ] `use-vibes` → `@vibes.diy/use-vibes`
- [ ] `call-ai` → `@vibes.diy/call-ai` 
- [ ] Update `use-vibes-base` dependency reference in `use-vibes/pkg`

### 3. **Workspace Dependency Management**
- [ ] Convert `workspace:*` dependencies to actual version numbers
- [ ] Ensure `use-vibes-base` publishes before `use-vibes` 
- [ ] Update `call-ai` workspace reference in `use-vibes-base`

### 4. **Repository & Publishing Setup**
- [ ] Add repository info to packages missing it
- [ ] Configure npm org scope access for `@vibes.diy`
- [ ] Set up publish permissions for all packages
- [ ] Add `publishConfig` for scoped packages

### 5. **Core-CLI Build System Integration**
All packages use `@fireproof/core-cli` for build/pack/publish:
- Build: `core-cli tsc`
- Pack: `core-cli build -x '^' --doPack`  
- Publish: `core-cli build -x '^'`

### 6. **Version Management**
- All packages currently at `0.0.0`
- Need coordinated version bumping strategy
- Consider semantic versioning for breaking changes

### 7. **Registry & Access**
- [ ] Verify npm org `@vibes.diy` exists and has proper access
- [ ] Configure GitHub Actions or publish workflow
- [ ] Set up npm tokens for automated publishing

## Recommended Release Strategy

### Phase 1: Package Preparation
1. Update package names to `@vibes.diy/*` scope
2. Add missing repository/homepage fields
3. Add publishConfig for npm scope

### Phase 2: Dependency Chain Publishing
1. Publish `@vibes.diy/call-ai` first (no dependencies)
2. Update and publish `@vibes.diy/use-vibes-base` 
3. Update and publish `@vibes.diy/use-vibes` last

### Phase 3: Version Management
1. Set initial semantic versions (0.1.0?)
2. Update workspace dependencies to published versions
3. Test full dependency resolution

## Files Requiring Changes

```
/use-vibes/pkg/package.json       - Rename to @vibes.diy/use-vibes
/use-vibes/base/package.json      - Add publishConfig, update call-ai dep  
/call-ai/pkg/package.json         - Rename to @vibes.diy/call-ai
/pnpm-workspace.yaml              - No changes needed
/package.json (root)              - Update build scripts if needed
```

## Key Questions

1. **Should `call-ai` remain as separate package or move under @vibes.diy?**
   - Currently points to `fireproof-storage/call-ai` repo
   - Used by external apps at version `0.10.2`

2. **Version strategy for initial release?**
   - Start with `0.1.0` or `1.0.0`?
   - How to handle breaking changes during development?

3. **Publishing automation?**
   - GitHub Actions workflow?
   - Manual releases via core-cli?
   - Automatic or manual version bumping?