#!/bin/bash
set -e

# Builds workspace packages into public/dist/ for browser import map resolution.
# Run from vibes.diy/pkg/ via: pnpm build:dist

DIST=public/dist
rm -rf "$DIST"
mkdir -p "$DIST"

TSGO_FLAGS="--ignoreConfig --target es2022 --module nodenext --moduleResolution nodenext --jsx react --rewriteRelativeImportExtensions --skipLibCheck --declaration false"

pnpm exec tsgo $TSGO_FLAGS --outDir "$DIST/api-pkg"      --rootDir ../api/pkg       ../api/pkg/index.ts
pnpm exec tsgo $TSGO_FLAGS --outDir "$DIST/api-types"     --rootDir ../api/types     ../api/types/index.ts
pnpm exec tsgo $TSGO_FLAGS --outDir "$DIST/call-ai-v2"    --rootDir ../../call-ai/v2 ../../call-ai/v2/index.ts
pnpm exec tsgo $TSGO_FLAGS --outDir "$DIST/prompts/pkg"   --rootDir ../../prompts/pkg ../../prompts/pkg/index.ts
pnpm exec tsgo $TSGO_FLAGS --outDir "$DIST/use-vibes/base" --rootDir ../../use-vibes/base ../../use-vibes/base/index.ts
pnpm exec tsgo $TSGO_FLAGS --outDir "$DIST/use-vibes/pkg"  --rootDir ../../use-vibes/pkg  ../../use-vibes/pkg/index.ts

# Fix .jsx → .js in imports (tsgo converts .tsx → .jsx instead of .js)
find "$DIST" -name "*.js" -exec sed -i '' 's/\.jsx"/\.js"/g; s/\.jsx'"'"'/\.js'"'"'/g' {} +

echo "Built dist packages to $DIST"
