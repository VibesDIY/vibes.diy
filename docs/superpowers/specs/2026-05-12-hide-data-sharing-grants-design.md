# Hide Data Sharing Grants from Settings

**Issue:** [VibesDIY/vibes.diy#1692](https://github.com/VibesDIY/vibes.diy/issues/1692)
**Date:** 2026-05-12

## Goal

Hide the "Data Sharing Grants" section from the `/settings` page without
deleting the underlying code. The section is confusing to end users today,
but may become useful in the future. The change must be reversible by
uncommenting.

## Scope

All changes are confined to a single file:
[`vibes.diy/pkg/app/routes/settings.tsx`](../../../vibes.diy/pkg/app/routes/settings.tsx).

No backend, API-type, or test changes.

## Changes

### 1. Comment out the JSX block

The `<BrutalistCard>` rendered at lines 603-609 inside `SettingsContent`
contains the `<h3>Data Sharing Grants</h3>` heading, its descriptive
paragraph, and `<GrantsList />`. Wrap the whole `<BrutalistCard>...</BrutalistCard>`
element in a JSX comment block (`{/* ... */}`) so it remains valid inside
the surrounding `<BrutalistLayout>` children.

### 2. Comment out the `GrantsList` function

The `GrantsList` function defined at lines 25-112 has no other consumers
(verified via grep). Wrap the entire function in a block comment
(`/* ... */`) above the next live function (`UserSlugsCard`).

### 3. Comment out unused imports

`GrantsList` is the only consumer in this file of:

- `isUserSettingSharing` (named import from `@vibes.diy/api-types`, line 9)
- `SharingGrantItem` (type-only named import from `@vibes.diy/api-types`, line 17)

Remove both from their import statements. Leave a single-line comment above
the imports such as `// Restore isUserSettingSharing and SharingGrantItem from
@vibes.diy/api-types when re-enabling GrantsList.` so the next person knows
where to reinstate them.

### 4. Update the layout subtitle

The `<BrutalistLayout>` on line 596 passes
`subtitle="Manage your account and data sharing"`. Change this string to
`"Manage your account"`. No comment is needed; the original wording is
preserved in git history.

## Out of scope

- No deletion of any logic — every removed line is preserved as a comment.
- No changes to the `sharing` user-setting type, `vibeDiyApi.ensureUserSettings`
  call paths, or any `@vibes.diy/api-types` definitions.
- No changes to other settings cards (`UserSlugsCard`, `ProfileCard`,
  `ModelDefaultsCard`, Security, Account).

## Verification

- `pnpm check` (format + build + test + lint, per
  [`CLAUDE.md`](../../../CLAUDE.md) and
  [`agents/code-quality.md`](../../../agents/code-quality.md)) must pass
  clean with no unused-symbol warnings or errors.
- Manual: visit `/settings` in the dev server while signed in. Confirm:
  - The "Data Sharing Grants" card no longer renders.
  - The page subtitle reads "Manage your account".
  - The other settings cards (User Slugs, Profile, Default Models, Security,
    Account) render unchanged.

## Restoration path

To re-enable the section in the future, reverse all four changes:

1. Uncomment the `<BrutalistCard>` JSX block in `SettingsContent`.
2. Uncomment the `GrantsList` function.
3. Add `isUserSettingSharing` and `SharingGrantItem` back to the
   `@vibes.diy/api-types` import statements; remove the reminder comment.
4. Restore the subtitle to `"Manage your account and data sharing"`.

## Risks

Very low. Single file, no external consumers of `GrantsList`, no API surface
change, and no test references to `GrantsList` or the "Data Sharing Grants"
heading.
