#!/bin/bash

# Replace text-gray colors with theme colors

# Light mode text colors
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-300/text-dark-secondary/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-400/text-accent-01/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-500/text-accent-01/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-600/text-accent-02/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-700/text-light-secondary/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-800/text-light-primary/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-900/text-light-primary/g'

echo "Replaced all text-gray classes with theme colors"
