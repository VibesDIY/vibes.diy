# group-listening-drop-v2

> Build a coordinated group listening session app called 'The Drop'. This is a social listening experience where a host announces an album or playlist, sets a start time, and everyone listens together in sync while reacting in real time.

ONBOARDING: On first launch, before showing anything else, present a full-screen genre/scene selector. Ask the user: 'What's your scene?' Show 8-10 genre tiles: Shoegaze, Jazz, Metal, Hip-Hop, Ambient, Post-Punk, Electronic, Country, R&B, Classical. When they pick one, save it to localStorage and use it everywhere. The genre shapes all copy, color palette suggestions in the UI, and the tone of placeholder text throughout the app. A shoegaze user sees dreamy, washed-out language. A metal user sees aggressive, energetic language. A jazz user sees cool, late-night language. A hip-hop user sees current, community-oriented language. After picking, show a brief 'Welcome to the scene' confirmation with genre-appropriate text, then enter the main app.

MAIN VIEW - HOST FLOW: If the user taps 'Host a Drop', they see a form to: enter the album name and artist, enter optional notes (why this album, what to listen for), set a start time using a datetime picker (or relative: 'in 10 minutes', 'in 30 minutes', 'in 1 hour'), and confirm. Once confirmed, the host sees a 'session code' (4-letter room code like VIBE, DROP, JAZZ) that others can use to join. The host sees a countdown to the drop time, the session roster showing who has joined, and a 'Start early' button if everyone is present.

MAIN VIEW - LISTENER FLOW: If the user taps 'Join a Drop', they enter the 4-letter session code and their display name (just a nickname, no account needed). After joining, they see the album info, the host's notes, the countdown to drop time, and the growing roster of who else has joined. The page refreshes the roster every few seconds using Fireproof's live query capability.

COUNTDOWN EXPERIENCE: When fewer than 60 seconds remain, the countdown becomes full-screen with large animated numbers. At 10 seconds, the background pulses. At zero, a big 'NOW' flash appears, then transitions immediately into the live reaction feed. The countdown should feel like a concert starting — anticipatory, communal, exciting.

LIVE REACTION FEED: Once the drop happens (countdown hits zero), the main UI becomes the reaction feed. Users can post reactions as: emoji bursts (tap a large emoji to send it floating up the screen), short text reactions (max 50 characters, genre-appropriate placeholder like 'that bassline...' for jazz, 'walls of sound' for shoegaze, 'that snare' for hip-hop), or named timestamps ('2:34 — the bridge goes crazy'). Reactions appear in a live feed that scrolls upward in real time, with the sender's display name. Use Fireproof's real-time subscription so reactions appear instantly for everyone. Emoji reactions animate: they float up from the bottom of the screen and fade out, overlapping with the text feed.

GENRE THEMING IN THE REACTION FEED: Shoegaze scene: muted lavender/grey palette, reactions float dreamily, placeholder text like 'the reverb just opened up', 'lost in the wash'. Metal scene: dark background, red accents, reactions slam in fast, placeholder text like 'that riff destroyed me', 'breakdown incoming'. Jazz scene: warm cream and amber, reactions drift in smoothly, placeholder text like 'hear that chord substitution', 'late night energy'. Hip-Hop scene: bold contrast, reactions pop in with bounce, placeholder text like 'that sample flip', 'bars'. Ambient scene: deep blue/teal, reactions fade in very slowly, placeholder text like 'just breathing with this', 'texture shift at 4:20'.

SESSION END: The host can end the session, which triggers a 'That's a wrap' screen for all listeners showing: album info, total reactions posted, top emojis used, a scrollable highlight reel of the text reactions, and a 'Host another drop' / 'Join another drop' CTA.

DATA MODEL (Fireproof): Use these document types in Fireproof. Session document: { type: 'session', code: 'VIBE', album: string, artist: string, notes: string, hostName: string, dropTime: ISO timestamp, status: 'waiting' | 'live' | 'ended' }. Member document: { type: 'member', sessionCode: string, name: string, joinedAt: timestamp }. Reaction document: { type: 'reaction', sessionCode: string, name: string, content: string, reactionType: 'emoji' | 'text' | 'timestamp', createdAt: timestamp }. Use Fireproof's useDocument and useLiveQuery hooks for real-time sync. Session code is the primary key for routing — all queries filter by sessionCode.

NAVIGATION: No routing library needed. Use a simple state machine with these screens: 'onboarding' (genre picker, first launch only), 'home' (host or join CTA), 'host-setup' (album + time form), 'host-lobby' (code + roster + countdown), 'join-entry' (code + name form), 'listener-lobby' (album info + roster + countdown), 'live-session' (reaction feed, shared for host and listeners), 'session-ended' (recap screen). Store current screen in React state.

VISUAL IDENTITY: The app should feel like a late-night concert poster crossed with a group chat. Use large bold typography for album names and countdown numbers. The session code should be displayed in a monospace font, large, easy to share. Avoid anything that looks like a standard productivity app. This should feel alive, social, and slightly underground. Each genre skin should feel genuinely different — not just a color swap but a different typographic mood.

Live at [https://vibes.diy/vibe/og/group-listening-drop-v2](https://vibes.diy/vibe/og/group-listening-drop-v2)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
