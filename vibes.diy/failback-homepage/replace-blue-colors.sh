#!/bin/bash

# Replace blue-tinted borders and focus styles with theme colors

# Replace blue borders and focus states in settings.tsx
sed -i '' 's/focus:border-blue-500/focus:border-accent-02/g' ./app/routes/settings.tsx
sed -i '' 's/focus:ring-blue-500/focus:ring-accent-02/g' ./app/routes/settings.tsx
sed -i '' 's/bg-blue-500/bg-accent-02/g' ./app/routes/settings.tsx
sed -i '' 's/bg-blue-600/bg-accent-03/g' ./app/routes/settings.tsx

# Replace blue border in Message.tsx system messages
sed -i '' 's/border-blue-500 bg-blue-50 dark:bg-blue-900\/20/border-accent-02 bg-light-background-01 dark:bg-dark-background-01\/40/g' ./app/components/Message.tsx

echo "Replaced blue-tinted colors with theme grayscale colors"
