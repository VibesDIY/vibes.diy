#!/bin/bash

# Replace border-gray colors with theme colors

# Light mode borders
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/border-gray-200/border-light-decorative-01/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/border-gray-300/border-light-decorative-01/g'

# Dark mode borders
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/border-gray-500/border-dark-decorative-01/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/border-gray-600/border-dark-decorative-01/g'
find ./app -type f -name "*.tsx" -o -name "*.jsx" | xargs sed -i '' 's/border-gray-700/border-dark-decorative-00/g'

echo "Replaced all border-gray classes with theme colors"
