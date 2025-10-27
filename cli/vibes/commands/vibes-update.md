---
description: Update the Vibes plugin's cached prompt data to the latest version
---

# Update Vibes Plugin Data

You will help the user update their locally cached plugin data (`plugin-data.json`) to the latest version from the GitHub repository.

## Process

1. **Check Current Version**: Read the current `plugin-data.json` file to determine the installed version.

2. **Fetch Latest Version**: Retrieve the latest `plugin-data.json` from GitHub:
   ```
   https://raw.githubusercontent.com/fireproof-storage/vibes.diy/main/cli/vibes/plugin-data.json
   ```

3. **Compare Versions**: Check if an update is available by comparing version numbers.

4. **Show Changes**: If a newer version is available, inform the user about:
   - Current version vs. new version
   - When the new version was generated (check `generatedAt` field)
   - Brief summary of what might have changed (styles, library docs, core guidelines)

5. **Confirm Update**: Ask the user if they want to proceed with the update.

6. **Apply Update**: If confirmed:
   - Backup the current `plugin-data.json` (rename to `plugin-data.json.backup`)
   - Download and save the new version
   - Verify the new file is valid JSON
   - Confirm success

7. **Rollback Option**: If something goes wrong, restore from backup and inform the user.

## Important Notes

- The plugin data file is located at: `${CLAUDE_PLUGIN_ROOT}/../plugin-data.json`
- Always create a backup before updating
- Version numbers follow semantic versioning (e.g., 1.0.0, 1.1.0, 2.0.0)
- The update process does NOT modify the plugin code itself, only the cached prompt data
- Users should test generated apps after major version updates

## Example Output

```
Current version: 1.0.0 (generated 2025-10-24)
Latest version: 1.1.0 (generated 2025-10-25)

New in 1.1.0:
- Style prompts may have been updated
- Library documentation may have been refreshed
- Core coding guidelines may have been improved

Would you like to update? (yes/no)

[If yes]
✓ Backup created: plugin-data.json.backup
✓ Latest version downloaded
✓ Update successful!

Your plugin data is now at version 1.1.0.
The next /vibes command will use the updated prompts.
```
