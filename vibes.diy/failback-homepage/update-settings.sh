#!/bin/bash

# Update gray colors in settings.tsx to theme colors

# Light mode background colors
sed -i '' 's/bg-gray-100/bg-light-background-01/g' ./app/routes/settings.tsx
sed -i '' 's/bg-gray-200/bg-light-background-02/g' ./app/routes/settings.tsx
sed -i '' 's/bg-gray-400/accent-01/g' ./app/routes/settings.tsx

# Dark mode background colors
sed -i '' 's/bg-gray-600/bg-dark-decorative-01/g' ./app/routes/settings.tsx
sed -i '' 's/bg-gray-700/bg-dark-decorative-00/g' ./app/routes/settings.tsx
sed -i '' 's/bg-gray-800/bg-dark-background-01/g' ./app/routes/settings.tsx

# Text colors
sed -i '' 's/text-gray-100/text-dark-primary/g' ./app/routes/settings.tsx
sed -i '' 's/text-gray-200/text-dark-secondary/g' ./app/routes/settings.tsx
sed -i '' 's/text-gray-300/text-dark-secondary/g' ./app/routes/settings.tsx
sed -i '' 's/text-gray-400/text-accent-01/g' ./app/routes/settings.tsx
sed -i '' 's/text-gray-600/text-accent-01/g' ./app/routes/settings.tsx
sed -i '' 's/text-gray-700/text-light-secondary/g' ./app/routes/settings.tsx
sed -i '' 's/text-gray-800/text-light-primary/g' ./app/routes/settings.tsx

# Border colors
sed -i '' 's/border-gray-200/border-light-decorative-01/g' ./app/routes/settings.tsx
sed -i '' 's/border-gray-300/border-light-decorative-01/g' ./app/routes/settings.tsx
sed -i '' 's/border-gray-600/border-dark-decorative-01/g' ./app/routes/settings.tsx
sed -i '' 's/border-gray-700/border-dark-decorative-00/g' ./app/routes/settings.tsx

echo "Updated settings.tsx with theme colors"
