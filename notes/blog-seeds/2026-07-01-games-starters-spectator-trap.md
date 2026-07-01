# The on-ramp game nobody could play

**Hook:** We copied our two best mind-games onto the /start Games tree, opened
the page logged-out, and hit "Spectator mode — watch the game live" plus an
infinite loop of "Failed to save your changes" toasts. The games were great.
Anonymous visitors just weren't allowed to play them.

**Source:** Extending the Instant Starter Stack (#2941) with a Games category
(PR #3006): `match-pairs` + `hue-hunt` picked from the landing-pages mind-games
featured apps, plus two hand-tuned evolutions (`tone-pairs` — every shape sings
a pentatonic note when flipped; `hue-rush` — endless rounds with streaks).

**The gotcha:** The originals store the game board in the vibe's shared
Fireproof database. That's a feature on a personal vibe (spectate a friend's
game live!) but a trap on a curated starter: an anonymous visitor gets
`can("write") === false`, so every tile is disabled — and worse, the
auto-start-a-demo-game effect wasn't gated on writability, so each anonymous
load retried a doomed `database.put` forever, spamming error toasts. It never
showed on the originals only because their databases already had game docs.

**The fix:** For on-ramp starters, follow the Bloom rule — pure local state, no
login, no backend. The curated copies were reworked to React state +
localStorage (bests/streaks per device). Multiplayer-shared boards stay a
delightful *evolution* someone can ask for, not the entry experience.

**Second thread:** the evolutions are the pitch made concrete — "Make the pairs
play tones" turns a memory game into an instrument; "Let me play unlimited
rounds" removes the daily gate. Each chip is a one-tap instant jump (the
cached-suggestion cross-slug bless), not a codegen wait.
