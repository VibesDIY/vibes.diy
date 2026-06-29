const _jsxFileName = "";import {jsxDEV as _jsxDEV, Fragment as _Fragment} from "react/jsx-dev-runtime";import React from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import { useViewer } from "use-vibes"

const SCENES = {
  start: {
    title: "The Trailhead",
    art: "trees",
    prose: [
      "The four of you tumble out of the car at the trailhead... the engine ticking as it cools. Night is falling fast, faster than it should.",
      "Pine trees lean in close. Somewhere, an owl asks a question nobody wants to answer.",
      "Your phone has one bar. Then... none."
    ],
    choices: [
      { label: "Hike to the lake by flashlight", next: "lake" },
      { label: "Set up camp right here at the trailhead", next: "trailhead" },
      { label: "Investigate that strange rustling sound", next: "rustling" },
    ],
  },
  lake: {
    title: "The Glimmering Lake",
    art: "lake",
    prose: [
      "The trail opens onto a lake so still it looks... painted. The moon doubles itself on the water.",
      "Your friend whispers: 'Did that ripple just... move toward us?'",
      "On the far shore, a single lantern flickers. Then another. Then... a third."
    ],
    choices: [
      { label: "Wave at the lanterns", next: "ending_friendly" },
      { label: "Hide behind a log and watch", next: "ending_mystery" },
    ],
  },
  trailhead: {
    title: "Camp at the Trailhead",
    art: "tent",
    prose: [
      "You pitch the tent in record time. The campfire crackles. Marshmallows brown to perfection.",
      "Just as you reach for another... the bushes rustle. Loudly. Not-a-squirrel loudly.",
      "Something very large is breathing... very close."
    ],
    choices: [
      { label: "Shine the flashlight into the bushes", next: "ending_bear" },
      { label: "Slowly back into the tent", next: "ending_cozy" },
    ],
  },
  rustling: {
    title: "Into the Brush",
    art: "trees",
    prose: [
      "You creep toward the sound, flashlight trembling. Branches snap underfoot... or under something else.",
      "A pair of eyes catches the light. Then blinks. Then... grows larger.",
      "You should not have done this. You know that now."
    ],
    choices: [
      { label: "Run back to the car!", next: "ending_bear" },
      { label: "Freeze and pretend to be a tree", next: "ending_mystery" },
    ],
  },
  ending_bear: {
    title: "The Bear is RIGHT THERE",
    art: "bear",
    prose: [
      "The bear is RIGHT THERE. Not a far-off bear. Not a bear in the distance. A bear... RIGHT THERE.",
      "It is enormous. It smells like wet fur and old berries. It is holding your cooler. It opens the cooler.",
      "It takes one sandwich. It nods at you, almost politely... and ambles into the dark."
    ],
    ending: true,
    stars: 2,
  },
  ending_friendly: {
    title: "Lantern Friends",
    art: "lake",
    prose: [
      "The lanterns wave back. Other campers! They paddle over with hot cocoa and a guitar.",
      "You spend the night swapping ghost stories around their fire. Nobody is murdered. Probably.",
      "You will remember this night... forever."
    ],
    ending: true,
    stars: 5,
  },
  ending_mystery: {
    title: "The Watcher in the Dark",
    art: "moon",
    prose: [
      "You watch. It watches. Hours pass. Nobody moves.",
      "At dawn, whatever-it-was is gone. There are footprints. They are... not quite right.",
      "You never speak of it again. But you check the locks. Every night. Forever."
    ],
    ending: true,
    stars: 3,
  },
  ending_cozy: {
    title: "The Tent is a Fortress",
    art: "tent",
    prose: [
      "You zip the tent. Whatever-it-was huffs once... and shuffles away.",
      "You sleep poorly but completely intact. In the morning: raccoon tracks. Just raccoons.",
      "Magnificent, terrifying raccoons."
    ],
    ending: true,
    stars: 4,
  },
}

export default function App() {
  const { viewer, can, isViewerPending, ViewerTag } = useViewer()
  const { useDocument, useLiveQuery, database } = useFireproof("campfire-tale")
  const { docs: stateDocs } = useLiveQuery("type", { key: "story-state" })
  const stateDoc = stateDocs[0] || { type: "story-state", sceneId: "start" }
  const scene = SCENES[stateDoc.sceneId] || SCENES.start

  const { docs: epilogues } = useLiveQuery("sceneId", { key: stateDoc.sceneId })
  const epilogue = epilogues.find(e => e.type === "epilogue")
  const [isLoading, setIsLoading] = React.useState(false)

  async function chooseNext(nextId) {
    await database.put({ ...stateDoc, sceneId: nextId })
  }
  async function restart() {
    await database.put({ ...stateDoc, sceneId: "start" })
  }
  async function generateEpilogue() {
    setIsLoading(true)
    try {
      const res = await callAI(
        `Write a humorous campfire epilogue for a story ending titled "${scene.title}". Tone: warm, funny, slightly spooky, read aloud. Use ellipses for dramatic pauses. The outcome: ${scene.prose.join(" ")}`,
        { schema: { properties: { narration: { type: "string" }, signoff: { type: "string" } } } }
      )
      const parsed = JSON.parse(res)
      await database.put({ type: "epilogue", sceneId: stateDoc.sceneId, ...parsed, createdAt: Date.now() })
    } finally { setIsLoading(false) }
  }

  const c = {
    page: "min-h-screen text-[#FFF8E7] font-['Crimson_Text',serif] pb-20",
    hero: "relative flex flex-col items-center justify-center text-center px-6 min-h-[60vh]",
    heroOverlay: "absolute inset-0 bg-gradient-to-b from-[#0D1117]/40 via-[#0D1117]/50 to-[#0D1117]/90",
    heroContent: "relative z-10 max-w-2xl",
    heroTitle: "font-['Cinzel_Decorative',serif] text-[#F4A300] leading-[1.05] tracking-wide italic font-bold drop-shadow-lg",
    heroSub: "text-[#FFF8E7]/80 mt-4 max-w-[500px] mx-auto leading-relaxed drop-shadow-md",
    main: "max-w-2xl mx-auto px-4 py-6 space-y-8",
    section: "rounded-lg border border-[#F4A300]/20 bg-[#161b22] p-6 shadow-lg shadow-black/40",
    sceneTitle: "font-['Cinzel_Decorative',serif] text-[1.5rem] font-bold text-[#F4A300] mb-4 text-center tracking-wide",
    prose: "text-[#FFF8E7] leading-relaxed text-[1.1rem] space-y-3",
    choiceBtn: "block w-full text-left px-6 py-4 min-h-[52px] my-2 rounded-md bg-[#F4A300] text-[#0D1117] font-bold text-[1rem] hover:bg-[#ffb733] transition disabled:opacity-50",
    restartBtn: "px-6 py-3 min-h-[44px] rounded-md border-2 border-[#F4A300] text-[#F4A300] font-bold text-[1rem] hover:bg-[#F4A300]/10 transition",
    stars: "text-3xl text-[#F4A300] text-center my-3 tracking-widest",
    artBox: "h-48 my-4 rounded-md relative overflow-hidden border border-[#F4A300]/10",
  }

  return (
    _jsxDEV('div', { className: c.page, style: { background: "#0D1117" }, children: [
      _jsxDEV('style', { children: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Crimson+Text:ital@0;1&display=optional');
      `}, void 0, false, {fileName: _jsxFileName, lineNumber: 152}, this)
      , _jsxDEV('div', { id: "app-header", className: c.hero, style: { minHeight: '60vh', background: "url('https://images.unsplash.com/photo-1697731299507-b4e2f4615a00?w=1920&q=80&fit=crop') center/cover no-repeat" }, children: [
        _jsxDEV('div', { className: c.heroOverlay }, void 0, false, {fileName: _jsxFileName, lineNumber: 155}, this)
        , _jsxDEV('div', { className: c.heroContent, children: [
          _jsxDEV('h1', { className: c.heroTitle, style: { fontSize: 'clamp(2.5rem, 8vw, 5rem)', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "Gather 'round." }, void 0, false, {fileName: _jsxFileName, lineNumber: 157}, this)
          , _jsxDEV('p', { className: c.heroSub, style: { fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }, children: "A campfire story where the group picks what happens next." }, void 0, false, {fileName: _jsxFileName, lineNumber: 158}, this)
          , (!isViewerPending && !viewer) && (
            _jsxDEV('div', { className: "mt-6 flex flex-col items-center gap-3", children: [
              _jsxDEV(ViewerTag, { style: { background: '#F4A300', border: 'none', color: '#0D1117', borderRadius: '0.5rem', padding: '0.95rem 2.4rem', fontSize: '1.2rem', fontWeight: 700, boxShadow: '0 6px 22px rgba(0,0,0,0.5)' } }, void 0, false, {fileName: _jsxFileName}, this)
              , _jsxDEV('p', { className: "text-[#FFF8E7]/80 text-sm", style: { textShadow: '0 2px 12px rgba(0,0,0,0.6)' }, children: "Sign in to gather your crew and start the story." }, void 0, false, {fileName: _jsxFileName}, this)
            ]}, void 0, true, {fileName: _jsxFileName}, this)
          )
          , stateDoc.sceneId === "start" && can("write") && (
            _jsxDEV('button', { onClick: () => chooseNext(scene.choices[0].next), className: "mt-6 px-8 py-4 min-h-[52px] rounded-md bg-[#F4A300] text-[#0D1117] font-bold text-lg hover:bg-[#ffb733] transition", children: "Start the story" }, void 0, false, {fileName: _jsxFileName, lineNumber: 160}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 156}, this)
        , _jsxDEV('div', { style: { position: 'absolute', bottom: '0.75rem', right: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }, children: ["Photo by ", _jsxDEV('a', { href: "https://unsplash.com/@davehoefler?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Dave Hoefler" }, void 0, false, {fileName: _jsxFileName}, this), " on ", _jsxDEV('a', { href: "https://unsplash.com/?utm_source=vibes_diy&utm_medium=referral", style: { color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }, target: "_blank", rel: "noopener noreferrer", children: "Unsplash" }, void 0, false, {fileName: _jsxFileName}, this)] }, void 0, true, {fileName: _jsxFileName}, this)
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 154}, this)
      , _jsxDEV('main', { id: "app", className: c.main, children: [
        _jsxDEV('section', { id: "scene-story", className: c.section, children: [
          _jsxDEV('h2', { className: c.sceneTitle, children: scene.title}, void 0, false, {fileName: _jsxFileName, lineNumber: 200}, this)
          , _jsxDEV('div', { className: c.prose, children: 
            scene.prose.map((p, i) => _jsxDEV('p', { children: p}, i, false, {fileName: _jsxFileName, lineNumber: 202}, this))
          }, void 0, false, {fileName: _jsxFileName, lineNumber: 201}, this)
          , scene.ending ? (
            _jsxDEV('div', { className: "mt-6 text-center" , children: [
              _jsxDEV('div', { className: c.stars, children: [
                "★".repeat(scene.stars), "☆".repeat(5 - scene.stars)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 206}, this)
              , _jsxDEV('p', { className: "text-[0.9rem] text-[#FFF8E7]/60 mb-4"  , children: [scene.stars, " of 5 camp stars"    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 209}, this)
              , can("write") && (
                _jsxDEV('button', { onClick: restart, className: c.restartBtn, children: "Start the story" }, void 0, false, {fileName: _jsxFileName, lineNumber: 211}, this)
              )
            ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 205}, this)
          ) : (
            _jsxDEV('div', { className: "mt-5", children: 
              can("write") ? (
                scene.choices.map((ch, i) => (
                  _jsxDEV('button', { onClick: () => chooseNext(ch.next), className: c.choiceBtn, children: ["▸ "
                     , ch.label
                  ]}, i, true, {fileName: _jsxFileName, lineNumber: 218}, this)
                ))
              ) : (
                _jsxDEV('p', { className: "text-center text-[0.9rem] text-[#FFF8E7]/50 italic mt-4"    , children: "...the reader is choosing the next path..."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 223}, this)
              )
            }, void 0, false, {fileName: _jsxFileName, lineNumber: 215}, this)
          )
        ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 199}, this)
        , scene.ending && (
          _jsxDEV('section', { id: "scene-epilogue", className: c.section, children: [
            _jsxDEV('h2', { className: c.sceneTitle, children: "Campfire Epilogue" }, void 0, false, {fileName: _jsxFileName, lineNumber: 230}, this)
            , epilogue ? (
              _jsxDEV('div', { className: c.prose, children: [
                _jsxDEV('p', { children: epilogue.narration}, void 0, false, {fileName: _jsxFileName, lineNumber: 233}, this)
                , _jsxDEV('p', { className: "text-[#F4A300] italic text-center mt-4"   , children: ["— " , epilogue.signoff, " —" ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 234}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 232}, this)
            ) : can("write") ? (
              _jsxDEV('div', { className: "text-center", children: [
                _jsxDEV('p', { className: "text-[0.9rem] text-[#FFF8E7]/60 mb-3"  , children: "...let the AI bard write a sign-off..."      }, void 0, false, {fileName: _jsxFileName, lineNumber: 238}, this)
                , _jsxDEV('button', { onClick: generateEpilogue, disabled: isLoading, className: c.choiceBtn + " inline-flex items-center justify-center gap-2", children: [
                  isLoading && (
                    _jsxDEV('svg', { className: "animate-spin", width: "18", height: "18", viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "2", children: 
                      _jsxDEV('circle', { cx: "12", cy: "12", r: "9", strokeDasharray: "40 20" ,}, void 0, false, {fileName: _jsxFileName, lineNumber: 242}, this )
                    }, void 0, false, {fileName: _jsxFileName, lineNumber: 241}, this)
                  )
                  , isLoading ? "Summoning..." : "Generate Epilogue"
                ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 239}, this)
              ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 237}, this)
            ) : (
              _jsxDEV('p', { className: "text-center text-[0.9rem] text-[#FFF8E7]/50 italic"   , children: "...awaiting the bard's words..."   }, void 0, false, {fileName: _jsxFileName, lineNumber: 249}, this)
            )
          ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 229}, this)
        )
      ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 159}, this)
    ]}, void 0, true, {fileName: _jsxFileName, lineNumber: 151}, this)
  )
}