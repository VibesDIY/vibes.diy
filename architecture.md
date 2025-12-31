# Vibes Architecture

## Overview

Vibes is a three-layer architecture connecting user-facing services to Fireproof's sync backend.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FP-Cloud Service                                     │
│                        (Fireproof Backend)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Requires: CloudToken (derived from ClerkToken via Dashboard)               │
│                                                                             │
│  - Sync backend with access control                                         │
│  - Database data storage                                                    │
│  - Real-time push                                                           │
│  - Token refresh: Clerk token change -> new Fireproof token                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ CloudToken
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Dashboard API                                      │
│                      (Access Control Manager)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Requires: ClerkToken/OAuth2                                                │
│                                                                             │
│  - Scopes CloudTokens to specific ledgers                                   │
│  - Security context = appSlug + groupId (visible in URL)                    │
│  - APIs:                                                                    │
│    - Create ledgers                                                         │
│    - List user's ledgers                                                    │
│    - Bind ledger to vibe context                                            │
│    - Manage invites/sharing                                                 │
│  - AI-friendly: just knows "todos" or "blog-posts" names                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ ClerkToken
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Vibes-Svc                                         │
│                     (Application Services)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## FP-Cloud Service

The sync backend where access control is enforced, and database data and real-time push is handled. To access this you need a Fireproof token - we have APIs that allow you to get one based on a Clerk token. In a running app there is typically a mechanism that gets an updated Fireproof token every time the Clerk token changes. Clerk has an API where we can register to receive token changes when they occur, making it simple to implement Fireproof session continuity.

## Dashboard API

The Dashboard API allows us to scope which ledger access is bundled in a particular Fireproof token. When an individual vibe is run by our website it receives tokens scoped within that vibe's security context. The context is based on the application slug and the group ID, both of which are in the URL so it's transparent to users what security context they're in.

The dashboard also has APIs to create ledgers, list all of the users' ledgers, bind a particular ledger to a vibe context, as well as APIs to manage invites and sharing. To an end user and also to the AI that's generating our apps, all it needs to know about a ledger is its name in the code, e.g. the word "todos" or "blog-posts" - vibes handles security by using consumer friendly dashboard defaults.

## Vibes-Svc

### Session Middleware

```
Every Request -> HttpSecure Cookie
Cookie = Seed(UA+IP) + ServerId(priv) + ServerDate%10min -> seed:hash
```

This cookie allows us to do rate limiting. It is applied before we know who the user is, allowing us to have some sense of repeat requesters and slow down bots.

### Services

| Service              | Auth                     | Purpose                                                                         |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| **Serv-Homepage**    | Session + optional Clerk | Main React app routes. Future: static landing page split for reliability        |
| **Serv-Clerk/OAuth** | Session                  | Auth flow handling                                                              |
| **Serv-Profile**     | Session + Clerk          | Payment, KYC, PII. Links to `vibes.diy/@username` (private, not public profile) |
| **Serv-Chat**        | Session + optional Clerk | AI gateway. Future: server-side repair, progressive coding                      |
| **Serv-Img**         | Session + Clerk          | Image generation gateway                                                        |
| **Serv-CodePreview** | Session + optional Clerk | JSX -> JS transform, syntax check. Future: move from browser to server          |
| **Serv-AppSlug**     | Session + optional Clerk | App hosting, code storage, versioning                                           |

#### Serv-Homepage

This is the endpoint that handles web requests for the vibes.diy main React app routes. In the future we might split out the index.html static landing page to an isolated service so we have a landing page that always works even if there's something wrong with esm.sh etc.

#### Serv-Profile (Payment)

This is the part that has limited access to PII, eg payment gateway and KYC. It might link to a username part of the url eg vibes.diy/@jchris etc but this is different from the public profile page.

#### Serv-Chat and Serv-Img

Currently part of the hosting services, these are the APIs that give access to AI responses, either chat or image. Today we parse and store those responses from the browser, our API acts only as a gatekeeper, but passes responses back as they come from the LLM, with no changes.

In the next rev we will move intelligence about AI handling to the vibes cloud which can then "repair" apps as they are being coded, instead of requiring a single pass to be free of syntax errors every time. This also opens the door for progressive coding, etc.

#### Serv-CodePreview (Monaco)

Turns the AI generated App.jsx syntax into browser-ready JavaScript, and can also check syntax before we send it to clients. Today this happens in the browser, moving it to the server gives security and flexibility and offloads heavy processing from mobile devices.

#### Serv-AppSlug

The app hosting/publishing service. Ensures unique app identifiers, handles code storage and versioning. This serves the HTML home engineered for the generated vibes to run inside.

## App Slug URL Architecture

### Published App Flow

```
vibes.diy/vibe/appSlug/groupId  (outer page)
        │
        │ provides via PostMessage:
        │   - CloudTokenEP (endpoint for token refresh)
        │   - Responds to overlay actions
        │
        └──────> <iframe src="appSlug-groupId.vibes.diy">
                       │
                       │ use-vibes
                       │ const db = useFireproof("todos")
                       │ attach() -> calls CloudTokenEP
                       │
                       │ Overlay UI (Vibes button menu)
                       │   [Remix]  -> postMessage
                       │   [Invite] -> postMessage
                       │   [Logout] -> postMessage
```

### Dev Mode Flow

```
vibes.diy/dev/appSlug
        │
        │ 302 redirect (requires valid session)
        │
        └──────> dev-{sessionId}-appSlug.vibes.diy
```

- Dev mode is always single user, no remote sync (local-only Fireproof)
- Session code updates require SessionId match
- Publish requires ClerkToken

### Token Flow

Token refresh is driven by the outer page's Clerk events:

```
┌─────────────────────────────────────────┐
│  Outer Page (vibes.diy/vibe/...)        │
│  ┌─────────────────────────────────┐    │
│  │  Clerk SDK                      │    │
│  │  onTokenChange() ──────────────────> PostMessage to iframe
│  │                                 │    │   { type: "cloudToken", token: "..." }
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Iframe (appSlug-groupId.vibes.diy)     │
│                                         │
│  window.addEventListener("message")     │
│  -> updates Fireproof token             │
│  -> no polling, purely event-driven     │
└─────────────────────────────────────────┘
```

### Overlay UI Pattern

The overlay UI lives inside the iframe for look and feel reasons (inherits app styles), but communicates via PostMessage so the outer page can handle navigation and auth:

```
┌─────────────────────────────────────────────────────────────────┐
│  Iframe: appSlug-groupId.vibes.diy                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  HTML Wrapper                                            │   │
│  │                                                          │   │
│  │  ┌─────────────────┐                                    │   │
│  │  │  [Vibes Button] │ -> toggles overlay visibility      │   │
│  │  └─────────────────┘                                    │   │
│  │                                                          │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Overlay UI (styled to match app)               │    │   │
│  │  │                                                 │    │   │
│  │  │  [Remix]  --> postMessage({ action: "remix" })  │    │   │
│  │  │  [Invite] --> postMessage({ action: "invite" }) │    │   │
│  │  │  [Logout] --> postMessage({ action: "logout" }) │    │   │
│  │  │  [Share]  --> postMessage({ action: "share" })  │    │   │
│  │  │                                                 │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ┌─────────────────┐                                    │   │
│  │  │   App.jsx       │                                    │   │
│  │  └─────────────────┘                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │
         │ PostMessage { action: "remix" }
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Outer Page: vibes.diy/vibe/appSlug/groupId                     │
│                                                                 │
│  Handles actions:                                               │
│  - "remix"  -> navigate to /remix/appSlug                       │
│  - "invite" -> Dashboard API call, show invite modal            │
│  - "logout" -> Clerk signOut()                                  │
│  - "share"  -> copy URL / native share API                      │
└─────────────────────────────────────────────────────────────────┘
```

Benefits of this split:

- **Look & feel**: Overlay inherits iframe's styles/theme, feels native to the app
- **Thin messages**: Iframe just sends intents, no logic
- **Navigation control**: Outer page owns the URL bar, can do proper routing
- **Security**: Iframe can't access Clerk credentials directly, outer page validates actions
