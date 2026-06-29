#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

USER_SLUG="og"
LOG="_status.log"
: > "$LOG"

gen() {
  local slug="$1"; local theme="$2"; local prompt="$3"
  local theme_spec; theme_spec=$(npx vibes-diy@latest themes --slug "$theme" 2>/dev/null)
  npx vibes-diy@latest generate \
    --user-slug "$USER_SLUG" \
    --app-slug "$slug" \
    "Theme: $theme_spec

$prompt" \
    >> "$LOG" 2>&1 \
    && echo "DONE $slug exit=0" >> "$LOG" \
    || echo "DONE $slug exit=1" >> "$LOG" &
}

# 1. Particle galaxy VR — spotlight
gen "particle-galaxy-vr" "rift" \
  "Babylon.js WebXR particle galaxy. SolidParticleSystem 2000 instances, custom GLSL rainbow-cycling color shader. Enter an infinite star field in immersive-vr. Desktop shows orbiting camera."

# 2. AR tap-to-place with Fireproof persistence
gen "ar-tap-anchor" "nexus" \
  "Babylon.js WebXR AR tap-to-place. Hit-testing to place a glowing geometric object on real surfaces. Fireproof persists each anchor so objects survive page reload."

# 3. Hand tracking interactions on Quest
gen "hand-grab-ui" "edge" \
  "Babylon.js WebXR hand tracking on Quest. Detect fingertip positions and pinch gestures to grab floating glowing orbs. Show hand skeleton joints as small spheres."

# 4. Procedural architecture — multi-user VR rooms
gen "procedural-rooms-vr" "mesh" \
  "Babylon.js procedural VR rooms built with MeshBuilder ribbons and tubes. Walk through in immersive-vr. Fireproof syncs the room seed so multiple users share the same space."

# 5. Beat-reactive 3D VR music visualizer
gen "beat-visualizer-vr" "neon" \
  "Babylon.js WebXR music visualizer. Web Audio FFT drives particle emitRate and GLSL shader uniforms in real time. Immersive-vr puts you inside the beat."

# 6. AR furniture placement
gen "ar-couch-fit" "carbon" \
  "Babylon.js WebXR AR furniture placement. Tap to anchor a couch-sized semi-transparent box on a real floor surface. Walk around it to judge fit."

# 7. Controller painting — shared Fireproof strokes
gen "vr-graffiti-wall" "recon" \
  "Babylon.js WebXR VR graffiti painter. Squeeze trigger to spray particle strokes in 3D. Fireproof persists every stroke so all visitors see the shared artwork."

# 8. Instanced mesh explosions at 72fps
gen "mesh-explosion-vr" "vault" \
  "Babylon.js WebXR instanced explosion. Fire 250 InstancedMesh spheres with Ammo.js physics from a VR controller. Optimized for Quest 72fps with instanced rendering."

wait
echo "ALL DONE" >> "$LOG"
echo "Generation complete — check $LOG"
