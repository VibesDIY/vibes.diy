# Numbered how-it-works steps on the home page, in the logo's own two colors

Source: `claude/home-page-numbered-steps-la6zyr`

The home page had a strong hero and a prompt box but no plain-language "what
happens if I do this" beat. Added a three-step row under the brand line —
Describe your app → See it build before your eyes → Invite your friends — where
each step leads with a numbered circle. The small design decision worth writing
up: instead of inventing a new accent for the numerals, the circles reuse the
logo palette exactly — a cream numeral (`--vibes-cream`) on a black disc
(`--vibes-black`). It reads as "the brand mark, repeated three times," which is
cheaper and more coherent than a bespoke step-badge style. The steps flow
side-by-side on desktop and stack on mobile, and the copy lives in a single
`HOW_IT_WORKS_STEPS` constant so the marketing line is one edit, not three JSX
sites. Hook for a post: onboarding microcopy that borrows the logo's own two
colors instead of adding a fourth.
