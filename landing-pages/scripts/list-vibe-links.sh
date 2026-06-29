#!/usr/bin/env bash
# List all vibes.diy/vibe/<author>/<slug> links found in src/pages/
# Handles two patterns:
#   1. Full URLs: https://vibes.diy/vibe/og/some-slug
#   2. JSON data objects: {"author":"og","slug":"some-slug",...}

# Pattern 1: explicit URLs
grep -roh 'https://vibes\.diy/vibe/[^"<> ]*' src/pages/ \
  | grep -v '{{' \
  | grep -v 'AUTHOR\|SLUG' \
  | sed 's|.*:https||; s|^|https|'

# Pattern 2: JSON slug+author pairs — extract with Python for reliable multi-key matching
python3 - <<'EOF'
import re, os, sys

page_dir = "src/pages"
seen = set()

for root, dirs, files in os.walk(page_dir):
    for fname in files:
        path = os.path.join(root, fname)
        try:
            text = open(path).read()
        except Exception:
            continue
        # Find all JSON objects containing both "author" and "slug"
        for obj in re.finditer(r'\{[^{}]*"slug"\s*:\s*"([^"]+)"[^{}]*"author"\s*:\s*"([^"]+)"[^{}]*\}', text):
            slug, author = obj.group(1), obj.group(2)
            seen.add(f"https://vibes.diy/vibe/{author}/{slug}")
        for obj in re.finditer(r'\{[^{}]*"author"\s*:\s*"([^"]+)"[^{}]*"slug"\s*:\s*"([^"]+)"[^{}]*\}', text):
            author, slug = obj.group(1), obj.group(2)
            seen.add(f"https://vibes.diy/vibe/{author}/{slug}")

for url in sorted(seen):
    print(url)
EOF
