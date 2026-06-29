#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
USER_SLUG="edu"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen jazz-improvisation-explainer "Build a jazz improvisation explainer for students new to jazz theory. The user picks a jazz standard — Autumn Leaves, All the Things You Are, So What, Giant Steps — and the app shows the chord progression, explains the modes and scales available over each chord, and describes how improvising musicians navigate the harmonic form. Cover the difference between bebop harmonic improvisation, modal improvisation (Miles Davis's approach), and free improvisation. Show how rhythm, call-and-response, blues vocabulary, and motivic development work in practice. Include listening examples and help users connect what they're hearing to what they're learning."
gen jazz-history-timeline "Build a jazz history timeline. The user picks a decade — the 1920s, 1930s, 1940s, 1950s, 1960s, 1970s — and sees the key recordings, the musicians, the venues, the cities, and the social context. Cover the New Orleans origins, the migration to Chicago and New York, the swing era and its popularization, the bebop revolution and its relationship to civil rights, cool jazz and hard bop as competing responses, modal jazz and free jazz in the 1960s, fusion in the 1970s. For each era, show what was changing in Black American life and how the music reflected and shaped those changes."
gen critical-listening-guide "Build a critical listening guide for jazz. The user picks a recording — a Louis Armstrong Hot Five session, a Duke Ellington orchestra recording, a Charlie Parker bebop track, a John Coltrane quartet side, an Ornette Coleman free jazz piece — and gets a structured framework for hearing it: instrumentation and ensemble texture, formal structure (12-bar blues, AABA standard), who solos and in what order, how the rhythm section supports the soloist, how the improvised material relates to the composed melody, and what the recording reveals about its historical moment. Help users develop active listening as a skill."
gen music-society-case "Build a music and society case study explorer. The user picks a musical genre and traces its social context: who created it, in what material circumstances, for what audience, and through what distribution channels. Cover blues (Mississippi Delta, the Great Migration, the recording industry), gospel (Black church traditions, civil rights movement soundtrack), jazz (New Orleans, Harlem Renaissance, bebop and Black intellectual identity), hip-hop (South Bronx, deindustrialization, the crack epidemic, corporate co-optation). For each genre, show how the music was received by white critics and audiences and what that reception meant."
gen improvisation-traditions "Build an improvisation traditions comparison tool. The user picks two traditions — jazz and Indian classical music (Hindustani or Carnatic), Afro-Cuban rumba and West African drumming, free jazz and European contemporary improvisation, gamelan and jazz — and compares how each approaches improvisation: the role of preset structures (scales, ragas, chord changes, rhythmic cycles), how individual expression relates to ensemble coherence, how tradition and innovation are balanced, how musicians learn the tradition, and what improvisation is understood to be for within each culture. Help users see improvisation as a culturally specific practice with different logics."

wait
echo "ALL DONE" >> "$HERE/_status.log"
