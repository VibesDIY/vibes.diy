#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/fp/vibes.diy/vibes-diy/linked-influencer"
cd "$HERE"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen li-cliffhanger-writer 'Parody LinkedIn cliffhanger post generator. User pastes a short user story or work anecdote into a textarea. App calls AI to rewrite it as a melodramatic LinkedIn post with cliffhangers, line breaks every sentence, and a "🧵 1/" thread opener. Save each generated post as a Fireproof doc, list saved posts below the form. Cringe-corporate tone parody.'

gen li-profile-roaster 'Parody LinkedIn profile generator from select-all paste. User pastes the raw text of any LinkedIn profile (select-all + copy). App extracts name, headline, current role, and uses AI to generate a parody "thought leader" version of the profile with absurd accomplishments. Save profiles as Fireproof docs and list them. No actual images, just a placeholder avatar circle with initials.'

gen li-humblebrag 'Humblebrag generator. User types a real achievement. App uses AI to produce 5 parody humblebrag LinkedIn posts about it ("Not gonna lie, I almost cried when..." energy). Each post saved as a Fireproof doc, listed with copy-to-clipboard buttons. Cringe-corporate parody tone.'

gen li-thread-stretcher 'LinkedIn thread stretcher. User types a single sentence thought. App uses AI to expand it into a 10-part numbered LinkedIn thread with parody motivational filler, each part starting with an emoji. Saves thread as a Fireproof doc, lists past threads, click to view full thread.'

gen li-quote-attributor 'Fake CEO quote attributor parody. User pastes any sentence. App uses AI to attribute it to an absurd made-up fortune-500 CEO with a parody company name and title. Saves the quote+attribution pair as a Fireproof doc. List of past attributions below.'

gen li-til-generator 'Parody "Today I Learned" LinkedIn post generator. User types a mundane fact. App uses AI to format it as a self-important LinkedIn TIL post with corporate buzzword spin and a closing question for engagement. Save and list.'

gen li-connection-opener 'Sycophantic LinkedIn connection request opener generator. User pastes a target persons headline or summary. App uses AI to produce 5 over-the-top suck-up parody opening lines. Save and list, copy to clipboard.'

gen li-comment-syco 'Sycophantic comment generator parody. User types a LinkedIn post. App uses AI to generate 5 over-the-top supportive parody comments ("THIS. So much THIS."). Save each as a Fireproof doc, list them, copy buttons.'

gen li-hashtag-overlord 'Hashtag overload parody. User pastes any text. App uses AI to append 30+ cringe LinkedIn hashtags to it (#leadership #grindset #monday). Save and list each hashtagged post.'

gen li-title-escalator 'LinkedIn job title escalator parody. User types their real job title. App uses AI to produce 5 absurd LinkedIn-influencer parody titles ("Chief Vibe Architect", "Director of Forward Synergy"). Save and list.'

gen li-why-i-left 'Parody "Why I left X" LinkedIn post generator. User types a company name. App uses AI to generate a melodramatic parody resignation announcement post about leaving that company to find purpose. Save and list past posts.'

gen li-engagement-bait 'LinkedIn engagement bait question generator parody. User types a topic. App uses AI to generate 5 cringe engagement-bait questions ending with "Agree? 👇" or "Thoughts?". Save and list.'

wait
echo "ALL DONE" >> "$HERE/_status.log"
