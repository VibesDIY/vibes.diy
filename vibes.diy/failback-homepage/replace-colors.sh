#!/bin/bash

# This script replaces Tailwind gray colors with theme colors

# Light mode replacements
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-50/bg-light-background-01/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-100/bg-light-background-01/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-200/bg-light-background-02/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-300/accent-00/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-400/accent-01/g'

# Dark mode replacements
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-600/bg-dark-decorative-01/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-700/bg-dark-decorative-00/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-800/bg-dark-background-01/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/bg-gray-900/bg-dark-background-00/g'

# Replace text colors too
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-100/text-dark-primary/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-200/text-dark-secondary/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-700/text-light-secondary/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-800/text-light-primary/g'
find ./app/components -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/text-gray-900/text-light-primary/g'

echo "Color replacement complete!"
