---
title: "Pickathon made the fan-made planner official — your festival could be next"
date: 2026-07-02T16:00:00Z
summary: "Pickathon liked the fan-built schedule planner so much they're now co-marketing it as Pick. Plan. Share. If you run a festival like Bumbershoot, Outside Lands, Sasquatch!, or Newport Folk, the same app is a remix away — you just point a coding agent at your schedule feed."
description: "How Pickathon adopted a fan-made festival schedule planner built on Vibes DIY — and how any festival (Bumbershoot, Outside Lands, Sasquatch!, Newport Folk, Pitchfork, Treefort) can remix it by pointing a coding agent at its own schedule API."
thumb: "/images/blog/pickathon-adopts-the-picker/pick-plan-share.jpg"
author: "Vibes DIY"
---

If you help run a music festival — a **Bumbershoot**, an **Outside Lands**, a
**Sasquatch!**, a **Newport Folk**, a **Pitchfork**, a **Treefort** — you already know
the perennial problem: your lineup is gorgeous, your schedule is a PDF, and your fans are
building their nights in a group chat and a screenshot. This is a story about a festival
that fixed that without hiring anyone, and an invitation for yours to do the same.

## Pickathon made it official

Two summers back, a Pickathon regular named Meghan Sinnott wanted a better way to plan her
weekend on the farm, so she *vibed* one into existence in a single afternoon — no
engineers, no budget, just a prompt on [Vibes DIY](https://vibes.diy). Browse the lineup,
star the sets you can't miss, jot private notes, block out your meal and volunteer times,
compare picks with friends. It was a personal itch-scratcher. It became a grassroots hit:
people pulled it up at the gate, traded QR codes, argued over who starred what.

This year, **Pickathon liked it enough to make it official.** They're co-marketing the
built-out version to their audience as **Pick. Plan. Share.** — their lineup, their
frog, their season art, front and center:

<figure>
  <img src="/images/blog/pickathon-adopts-the-picker/pick-plan-share.jpg" alt="Pickathon 'Pick. Plan. Share.' marketing graphic: a phone showing the Pickathon Picker app — the Saturday schedule with LAFLOR, Buddy Wynkoop, and DJ Honest John — beside the Vibes DIY logo and the tagline 'Your festival planning sidekick,' pickathon.com/picker.">
  <figcaption>Pickathon's own campaign for the app — <a href="https://pickathon.com/picker">pickathon.com/picker</a>. It started as one attendee's afternoon project; the festival adopted it as the official planning companion.</figcaption>
</figure>

That's the whole arc: a fan solved her own problem, the community adopted it, and the
festival backed the fan. Pickathon made a genuinely smart call here — they didn't
commission a six-figure app, they recognized a thing their people already loved and put
their name behind it. It reads the **live** schedule, so it's never a stale PDF, and it
cost them essentially nothing to stand up.

## Your festival, same app, one conversation

Here's the part for everyone *other* than Pickathon reading this. There is nothing
Pickathon-specific about how this was built. The whole app — the lineup browser, the
public star counts, the private notes, the friends-who-can-see-each-other's-picks
sharing model — is a **remix away** for any festival.

And "remix" is not a euphemism for a services engagement. If you have some technical
acumen and administrative reach over your festival's data, standing up your own version
is about as hard as **telling a coding agent how to reach your schedule feed.** Point it
at your lineup API, describe who should see what ("stars are public, notes are private,
plans can be shared with friends"), and the agent produces the whole thing — data model,
views, and the fiddly permission rules included. We know, because we've watched a single
plain-English paragraph
[reproduce this exact app end to end](https://good.vibes.diy/blog/can-a-prompt-rebuild-the-pickathon-app.html).

## One thing to tell your developer: the CORS gotcha

If a developer on your side picks this up, save them an afternoon of head-scratching with
one fact. **Most festival schedule feeds don't send CORS headers** (`Access-Control-Allow-Origin`),
which means a browser can't fetch them directly from a web app — the request is blocked
before it starts. (Pickathon's feed happens to allow it, which is why the original could
fetch it straight from the page. Yours probably doesn't.)

The wrong fix is to stand up a live proxy that re-fetches your feed on every visit — now
you're running a server, and you're hammering your own API once per fan. The right shape
is a **scheduled server-side fetch that caches the schedule as a single record your app
reads**:

- A server-side job pulls the feed on a timer — every few minutes, say — where browser
  CORS rules simply don't apply.
- It stores the result as **one singleton document** in the app's database.
- Every visitor reads that one synced record. Zero client-side cross-origin calls, and
  your API gets hit on a schedule instead of per-pageview.

On Vibes DIY this is the natural job for a vibe's [`backend.js`](https://good.vibes.diy/blog/backend-js-server-side-vibes.html)
— a scheduled handler that writes to the app database as the owner. To be straight with
you: server-side **external egress** from `backend.js` is the piece rolling out right now
(today's backends run on-timer and answer webhooks, with outbound fetch landing next), so
this is the architecture to design toward. The principle holds regardless of platform:
**fetch on a schedule, cache a singleton, never proxy per request.**

## The takeaway

A festival's most-loved companion app doesn't have to be a line item. Pickathon's is a
fan's afternoon idea that the festival was smart enough to embrace. If you've got a
lineup and a feed, yours is one good prompt away.

<div class="post-cta">
  <h3>Bring your festival's schedule to life</h3>
  <p>Point a coding agent at your lineup feed and describe who sees what. The planner builds itself.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
