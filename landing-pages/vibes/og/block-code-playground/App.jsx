import React, { useState, useRef, useEffect, useCallback } from "react"
import { useImgGen, ImgGen } from "use-vibes"

const THEMES = [
  {
    id: "ocean", name: "Ocean", emoji: "🌊",
    bg: "linear-gradient(180deg, #0a2a4a 0%, #1a4a6a 40%, #2a6a8a 100%)",
    chaserPrompt: "cute cartoon orange clownfish swimming right, game sprite, chibi style, white background, centered, no text",
    caughtPrompt: "happy cartoon pufferfish puffed up and round, game sprite, chibi style, white background, centered, no text",
  },
  {
    id: "space", name: "Space", emoji: "🚀",
    bg: "linear-gradient(180deg, #0a0a2e 0%, #1a1a4e 40%, #0a0a2e 100%)",
    chaserPrompt: "cute cartoon astronaut in white spacesuit floating, game sprite, chibi style, white background, centered, no text",
    caughtPrompt: "cute friendly green alien with big head waving, game sprite, chibi style, white background, centered, no text",
  },
  {
    id: "forest", name: "Forest", emoji: "🌲",
    bg: "linear-gradient(180deg, #0a2a0a 0%, #1a4a1a 40%, #0a3a0a 100%)",
    chaserPrompt: "cute cartoon red fox running right, game sprite, chibi style, white background, centered, no text",
    caughtPrompt: "cute cartoon fluffy owl with big round eyes, game sprite, chibi style, white background, centered, no text",
  },
  {
    id: "candy", name: "Candy", emoji: "🍭",
    bg: "linear-gradient(180deg, #4a1a4a 0%, #6a2a5a 40%, #4a1a4a 100%)",
    chaserPrompt: "cute cartoon pink gummy bear character smiling, game sprite, chibi style, white background, centered, no text",
    caughtPrompt: "cute cartoon rainbow lollipop character with face and tiny arms, game sprite, chibi style, white background, centered, no text",
  },
]

const DEFAULT_CONFIG = {
  startSpeed: 2.5,
  maxSpeed: 7,
  spriteSize: 96,
  catchRadius: 0.35,
  catchDuration: 50,
  movement: "chase",
  onCatchActions: ["score", "speed"],
  scorePerCatch: 1,
  speedPerCatch: 0.25,
  shakeOnCatch: false,
}

function useImgUrl(prompt, id) {
  const skip = !prompt || !id
  const { loading, progress, document } = useImgGen({ prompt: prompt || undefined, _id: id || undefined, skip })
  let url = null
  if (document?.versions?.length && document._files) {
    const ver = document.versions[document.currentVersion ?? 0]
    if (ver?.id && document._files[ver.id]) url = document._files[ver.id].url
  }
  return { loading: skip ? false : loading, progress, url }
}

// ── Blockly block definitions ──

function defineGameBlocks(B) {
  B.Blocks["game_on_start"] = {
    init() {
      this.appendDummyInput().appendField("⚙ when game starts")
      this.appendStatementInput("DO")
      this.setColour("#e6a817")
      this.setDeletable(false)
    },
  }
  B.Blocks["game_on_catch"] = {
    init() {
      this.appendDummyInput().appendField("⭐ when sprite catches cursor")
      this.appendStatementInput("DO")
      this.setColour("#e6a817")
      this.setDeletable(false)
    },
  }
  B.Blocks["game_set_speed"] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("set speed to")
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour("#4CAF50")
    },
  }
  B.Blocks["game_set_max_speed"] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("set max speed to")
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour("#4CAF50")
    },
  }
  B.Blocks["game_set_sprite_size"] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("set sprite size to")
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour("#4CAF50")
    },
  }
  B.Blocks["game_set_movement"] = {
    init() {
      this.appendDummyInput()
        .appendField("set movement to")
        .appendField(new B.FieldDropdown([
          ["chase", "chase"],
          ["zigzag", "zigzag"],
          ["orbit", "orbit"],
        ]), "MODE")
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour("#4CAF50")
    },
  }
  B.Blocks["game_add_score"] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("add")
      this.appendDummyInput().appendField("to score")
      this.setInputsInline(true)
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour("#FF6B6B")
    },
  }
  B.Blocks["game_increase_speed"] = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("increase speed by")
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour("#FF6B6B")
    },
  }
  B.Blocks["game_shake"] = {
    init() {
      this.appendDummyInput().appendField("🫨 shake screen")
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour("#FF6B6B")
    },
  }
  B.Blocks["game_set_celebration"] = {
    init() {
      this.appendDummyInput()
        .appendField("celebration length")
        .appendField(new B.FieldDropdown([
          ["short", "25"],
          ["medium", "50"],
          ["long", "80"],
        ]), "DUR")
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour("#FF6B6B")
    },
  }
}

function defineGameGenerators(B) {
  const JS = B.JavaScript
  const ORD = JS.ORDER_NONE || 0

  JS.forBlock = JS.forBlock || {}
  JS.forBlock["game_on_start"] = function (block) {
    return JS.statementToCode(block, "DO")
  }
  JS.forBlock["game_on_catch"] = function (block) {
    const stmts = JS.statementToCode(block, "DO")
    return `__cfg.__onCatchCode = function(api) {\n${stmts}};\n`
  }
  JS.forBlock["game_set_speed"] = function (block) {
    const v = JS.valueToCode(block, "VALUE", ORD) || "2.5"
    return `__cfg.startSpeed = ${v};\n`
  }
  JS.forBlock["game_set_max_speed"] = function (block) {
    const v = JS.valueToCode(block, "VALUE", ORD) || "7"
    return `__cfg.maxSpeed = ${v};\n`
  }
  JS.forBlock["game_set_sprite_size"] = function (block) {
    const v = JS.valueToCode(block, "VALUE", ORD) || "96"
    return `__cfg.spriteSize = ${v};\n`
  }
  JS.forBlock["game_set_movement"] = function (block) {
    const m = block.getFieldValue("MODE")
    return `__cfg.movement = "${m}";\n`
  }
  JS.forBlock["game_add_score"] = function (block) {
    const v = JS.valueToCode(block, "VALUE", ORD) || "1"
    return `api.addScore(${v});\n`
  }
  JS.forBlock["game_increase_speed"] = function (block) {
    const v = JS.valueToCode(block, "VALUE", ORD) || "0.25"
    return `api.increaseSpeed(${v});\n`
  }
  JS.forBlock["game_shake"] = function () {
    return `api.shake();\n`
  }
  JS.forBlock["game_set_celebration"] = function (block) {
    const d = block.getFieldValue("DUR")
    return `__cfg.catchDuration = ${d};\n`
  }
}

const TOOLBOX_XML = `<xml>
  <category name="Events" colour="#e6a817">
    <block type="game_on_start"></block>
    <block type="game_on_catch"></block>
  </category>
  <category name="Settings" colour="#4CAF50">
    <block type="game_set_speed"><value name="VALUE"><shadow type="math_number"><field name="NUM">2.5</field></shadow></value></block>
    <block type="game_set_max_speed"><value name="VALUE"><shadow type="math_number"><field name="NUM">7</field></shadow></value></block>
    <block type="game_set_sprite_size"><value name="VALUE"><shadow type="math_number"><field name="NUM">96</field></shadow></value></block>
    <block type="game_set_movement"></block>
    <block type="game_set_celebration"></block>
  </category>
  <category name="Actions" colour="#FF6B6B">
    <block type="game_add_score"><value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="game_increase_speed"><value name="VALUE"><shadow type="math_number"><field name="NUM">0.25</field></shadow></value></block>
    <block type="game_shake"></block>
  </category>
  <category name="Math" colour="#5C68A6">
    <block type="math_number"></block>
    <block type="math_arithmetic"></block>
  </category>
</xml>`

const DEFAULT_WORKSPACE_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="game_on_start" x="20" y="20" deletable="false">
    <statement name="DO">
      <block type="game_set_speed">
        <value name="VALUE"><shadow type="math_number"><field name="NUM">2.5</field></shadow></value>
        <next><block type="game_set_max_speed">
          <value name="VALUE"><shadow type="math_number"><field name="NUM">7</field></shadow></value>
          <next><block type="game_set_sprite_size">
            <value name="VALUE"><shadow type="math_number"><field name="NUM">96</field></shadow></value>
            <next><block type="game_set_movement">
              <field name="MODE">chase</field>
            </block></next>
          </block></next>
        </block></next>
      </block>
    </statement>
  </block>
  <block type="game_on_catch" x="20" y="280" deletable="false">
    <statement name="DO">
      <block type="game_add_score">
        <value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
        <next><block type="game_increase_speed">
          <value name="VALUE"><shadow type="math_number"><field name="NUM">0.25</field></shadow></value>
        </block></next>
      </block>
    </statement>
  </block>
</xml>`

function compileBlocks(B, workspace) {
  const code = B.JavaScript.workspaceToCode(workspace)
  const cfg = { ...DEFAULT_CONFIG, __onCatchCode: null }
  try {
    const fn = new Function("__cfg", code)
    fn(cfg)
  } catch (e) {
    console.warn("Block compile error:", e)
  }
  return cfg
}

// ── Sprite Editor ──

function SpritePromptField({ label, emoji, prompt, onChange }) {
  const [draft, setDraft] = useState(prompt)
  const [committed, setCommitted] = useState(prompt)
  const isDirty = draft !== committed

  const handleGenerate = () => {
    setCommitted(draft)
    onChange(draft)
  }

  return (
    <div style={{
      background: "#2a2a3e",
      borderRadius: "12px",
      padding: "1.25rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.2rem" }}>{emoji}</span>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>{label}</span>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={2}
          style={{
            flex: 1,
            background: "#1e1e2e",
            border: "2px solid #3a3a5e",
            borderRadius: "8px",
            color: "#fff",
            padding: "0.6rem 0.8rem",
            fontSize: "0.85rem",
            fontFamily: "'Inter', system-ui, sans-serif",
            resize: "vertical",
            outline: "none",
          }}
          placeholder="Describe your sprite..."
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          onClick={handleGenerate}
          disabled={!isDirty && !!committed}
          style={{
            background: isDirty ? "#4ade80" : "rgba(255,255,255,0.1)",
            border: `2px solid ${isDirty ? "#22c55e" : "rgba(255,255,255,0.2)"}`,
            borderRadius: "8px",
            color: isDirty ? "#0a2a0a" : "rgba(255,255,255,0.4)",
            padding: "0.4rem 1rem",
            cursor: isDirty ? "pointer" : "default",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}
        >
          Generate
        </button>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          overflow: "hidden",
          background: "#fff",
          border: "2px solid #3a3a5e",
          flexShrink: 0,
        }}>
          {committed && (
            <ImgGen
              prompt={committed}
              _id={`custom-${committed.slice(0, 30).replace(/\s/g, "-")}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              showControls={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SpriteEditorTab({ theme, customSprites, onCustomSprites }) {
  return (
    <div style={{
      flex: 1,
      padding: "1.5rem",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "1.25rem",
    }}>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", margin: 0 }}>
        Type a prompt and hit Generate to create custom sprites with AI. Leave blank to keep the theme default.
      </p>
      <SpritePromptField
        label="Chaser Sprite"
        emoji="🏃"
        prompt={customSprites.chaser || theme.chaserPrompt}
        onChange={p => onCustomSprites({ ...customSprites, chaser: p })}
      />
      <SpritePromptField
        label="Caught Sprite"
        emoji="🎉"
        prompt={customSprites.caught || theme.caughtPrompt}
        onChange={p => onCustomSprites({ ...customSprites, caught: p })}
      />
    </div>
  )
}

// ── Block Editor Panel ──

function BlockEditor({ onApply, onClose, savedXml, theme, customSprites, onCustomSprites }) {
  const editorRef = useRef(null)
  const workspaceRef = useRef(null)
  const [blocklyReady, setBlocklyReady] = useState(false)
  const [activeTab, setActiveTab] = useState("blocks")

  useEffect(() => {
    if (window.Blockly && window.Blockly.JavaScript) {
      setBlocklyReady(true)
      return
    }
    const s1 = document.createElement("script")
    s1.src = "https://unpkg.com/blockly/blockly.min.js"
    s1.onload = () => {
      const s2 = document.createElement("script")
      s2.src = "https://unpkg.com/blockly/javascript_compressed.js"
      s2.onload = () => setBlocklyReady(true)
      document.body.appendChild(s2)
    }
    document.body.appendChild(s1)
  }, [])

  useEffect(() => {
    if (!blocklyReady || !editorRef.current) return
    const B = window.Blockly
    defineGameBlocks(B)
    defineGameGenerators(B)

    if (workspaceRef.current) workspaceRef.current.dispose()
    const ws = B.inject(editorRef.current, {
      toolbox: TOOLBOX_XML,
      trashcan: true,
      scrollbars: true,
      zoom: { controls: true, startScale: 0.9 },
      grid: { spacing: 20, length: 3, colour: "#eee", snap: true },
    })
    workspaceRef.current = ws

    const xml = savedXml || DEFAULT_WORKSPACE_XML
    try {
      B.Xml.domToWorkspace(B.utils.xml.textToDom(xml), ws)
    } catch (e) {
      B.Xml.domToWorkspace(B.utils.xml.textToDom(DEFAULT_WORKSPACE_XML), ws)
    }

    return () => { ws.dispose(); workspaceRef.current = null }
  }, [blocklyReady])

  useEffect(() => {
    if (workspaceRef.current && activeTab === "blocks") {
      setTimeout(() => window.Blockly?.svgResize(workspaceRef.current), 50)
    }
  }, [activeTab])

  const handlePlay = () => {
    if (!workspaceRef.current) return
    const B = window.Blockly
    const xml = B.Xml.domToText(B.Xml.workspaceToDom(workspaceRef.current))
    const cfg = compileBlocks(B, workspaceRef.current)
    onApply(cfg, xml)
  }

  const tabStyle = (active) => ({
    background: active ? "#1e1e2e" : "transparent",
    border: "none",
    borderBottom: active ? "2px solid #4ade80" : "2px solid transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.4)",
    padding: "0.5rem 1.25rem",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 700,
    transition: "all 0.15s",
  })

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 100,
      display: "flex",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div
        onClick={onClose}
        style={{
          width: "30%",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          cursor: "pointer",
        }}
      />
      <div style={{
        width: "70%",
        background: "#1e1e2e",
        display: "flex",
        flexDirection: "column",
        boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          background: "#2a2a3e",
          borderBottom: "2px solid #3a3a5e",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.2rem" }}>🧩</span>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>Game Editor</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: "8px", color: "#fff", padding: "0.4rem 1rem", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: 600,
            }}>Cancel</button>
            <button onClick={handlePlay} style={{
              background: "#4ade80", border: "2px solid #22c55e", borderRadius: "8px",
              color: "#0a2a0a", padding: "0.4rem 1.2rem", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: 700,
            }}>▶ Play</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          background: "#2a2a3e",
          borderBottom: "1px solid #3a3a5e",
        }}>
          <button onClick={() => setActiveTab("blocks")} style={tabStyle(activeTab === "blocks")}>
            🧩 Blocks
          </button>
          <button onClick={() => setActiveTab("sprites")} style={tabStyle(activeTab === "sprites")}>
            🎨 Sprites
          </button>
        </div>

        {/* Content */}
        <div ref={editorRef} style={{ flex: 1, display: activeTab === "blocks" ? "block" : "none" }} />
        {activeTab === "sprites" && (
          <SpriteEditorTab
            theme={theme}
            customSprites={customSprites}
            onCustomSprites={onCustomSprites}
          />
        )}

        {!blocklyReady && activeTab === "blocks" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.5)", fontSize: "1.1rem",
          }}>Loading editor...</div>
        )}
      </div>
    </div>
  )
}

// ── UI Components ──

function ThemePicker({ onSelect }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "2rem", fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#fff", marginBottom: "0.5rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
        Sprite Chase
      </h1>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "1.1rem", marginBottom: "3rem" }}>
        Pick a world — AI generates your sprites
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", maxWidth: "900px", width: "100%" }}>
        {THEMES.map(theme => (
          <button key={theme.id} onClick={() => onSelect(theme)} style={{
            background: theme.bg, border: "3px solid rgba(255,255,255,0.15)", borderRadius: "20px",
            padding: "2.5rem 1.5rem", cursor: "pointer", transition: "all 0.2s ease",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)" }}
          >
            <span style={{ fontSize: "3rem" }}>{theme.emoji}</span>
            <span style={{ color: "#fff", fontSize: "1.3rem", fontWeight: 700 }}>{theme.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function LoadingScreen({ theme, chaserStatus, caughtStatus }) {
  const done = (!chaserStatus.loading ? 1 : 0) + (!caughtStatus.loading ? 1 : 0)
  const avgProgress = ((chaserStatus.progress || 0) + (caughtStatus.progress || 0)) / 2
  return (
    <div style={{
      minHeight: "100vh", background: theme.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", fontFamily: "'Inter', system-ui, sans-serif", color: "#fff", padding: "2rem",
    }}>
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>{theme.emoji}</div>
      <h2 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "0.5rem" }}>Generating {theme.name} sprites...</h2>
      <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "2rem" }}>AI is painting your world</p>
      <div style={{ width: "300px", height: "8px", background: "rgba(255,255,255,0.15)", borderRadius: "4px", overflow: "hidden", marginBottom: "1rem" }}>
        <div style={{ width: `${done === 2 ? 100 : avgProgress}%`, height: "100%", background: "#4ade80", borderRadius: "4px", transition: "width 0.3s ease" }} />
      </div>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem" }}>{done}/2 sprites ready</p>
    </div>
  )
}

function Particles({ x, y }) {
  const [particles] = useState(() =>
    Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      speed: 2 + Math.random() * 3,
      size: 4 + Math.random() * 6,
      color: ["#ffd700", "#ff6b6b", "#4ade80", "#60a5fa", "#f472b6"][Math.floor(Math.random() * 5)],
    }))
  )
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let frame, t = 0
    const run = () => { t++; setTick(t); if (t < 25) frame = requestAnimationFrame(run) }
    frame = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame)
  }, [])
  if (tick >= 25) return null
  return (
    <>
      {particles.map((p, i) => {
        const dist = p.speed * tick * 2
        return (
          <div key={i} style={{
            position: "absolute", left: x + Math.cos(p.angle) * dist, top: y + Math.sin(p.angle) * dist,
            width: p.size, height: p.size, borderRadius: "50%", background: p.color,
            opacity: 1 - tick / 25, transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 10,
          }} />
        )
      })}
    </>
  )
}

const AMBIENT = { ocean: { char: "🫧", count: 12 }, space: { char: "✦", count: 20 }, forest: { char: "🍃", count: 10 }, candy: { char: "✨", count: 15 } }

function AmbientParticles({ themeId }) {
  const config = AMBIENT[themeId] || AMBIENT.ocean
  const [particles] = useState(() =>
    Array.from({ length: config.count }, (_, i) => ({
      left: `${(i / config.count) * 100 + (Math.random() * 10 - 5)}%`,
      animDuration: `${8 + Math.random() * 12}s`,
      animDelay: `${-Math.random() * 20}s`,
      size: `${0.6 + Math.random() * 1}rem`,
      opacity: 0.15 + Math.random() * 0.2,
    }))
  )
  return (
    <>
      <style>{`@keyframes ambient-float { 0% { transform: translateY(100vh) rotate(0deg); } 100% { transform: translateY(-10vh) rotate(360deg); } }`}</style>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.left, bottom: "-5vh", fontSize: p.size, opacity: p.opacity,
          animation: `ambient-float ${p.animDuration} linear infinite`, animationDelay: p.animDelay,
          pointerEvents: "none", zIndex: 0,
        }}>{config.char}</div>
      ))}
    </>
  )
}

// ── Game Engine ──

function GameCanvas({ theme, chaserUrl: defaultChaserUrl, caughtUrl: defaultCaughtUrl, onBack }) {
  const containerRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [savedXml, setSavedXml] = useState(null)
  const [gameConfig, setGameConfig] = useState(DEFAULT_CONFIG)
  const gameConfigRef = useRef(gameConfig)
  gameConfigRef.current = gameConfig
  const [customSprites, setCustomSprites] = useState({ chaser: null, caught: null })

  const customChaser = useImgUrl(customSprites.chaser, customSprites.chaser ? `custom-${customSprites.chaser.slice(0, 30).replace(/\s/g, "-")}` : null)
  const customCaught = useImgUrl(customSprites.caught, customSprites.caught ? `custom-${customSprites.caught.slice(0, 30).replace(/\s/g, "-")}` : null)

  const chaserUrl = (customSprites.chaser && customChaser.url) || defaultChaserUrl
  const caughtUrl = (customSprites.caught && customCaught.url) || defaultCaughtUrl

  const makeInitialState = useCallback((cfg) => ({
    score: 0,
    chaserX: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
    chaserY: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
    mouseX: typeof window !== "undefined" ? window.innerWidth / 2 + 150 : 550,
    mouseY: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
    facingLeft: false,
    caught: false,
    catchTimer: 0,
    speed: cfg.startSpeed,
    mouseActive: false,
    orbitAngle: 0,
    zigzagT: 0,
  }), [])

  const [gameState, setGameState] = useState(() => makeInitialState(DEFAULT_CONFIG))
  const stateRef = useRef(gameState)
  stateRef.current = gameState
  const rafRef = useRef(null)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [particleBursts, setParticleBursts] = useState([])
  const burstIdRef = useRef(0)
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    let loaded = 0
    const checkDone = () => { if (++loaded >= 2) setImagesLoaded(true) }
    const img1 = new Image(); img1.crossOrigin = "anonymous"; img1.onload = checkDone; img1.onerror = checkDone; img1.src = chaserUrl
    const img2 = new Image(); img2.crossOrigin = "anonymous"; img2.onload = checkDone; img2.onerror = checkDone; img2.src = caughtUrl
  }, [chaserUrl, caughtUrl])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleMove = (e) => {
      const rect = el.getBoundingClientRect()
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
      stateRef.current = { ...stateRef.current, mouseX: x, mouseY: y, mouseActive: true }
    }
    el.addEventListener("mousemove", handleMove)
    el.addEventListener("touchmove", handleMove, { passive: true })
    return () => { el.removeEventListener("mousemove", handleMove); el.removeEventListener("touchmove", handleMove) }
  }, [])

  useEffect(() => {
    if (!imagesLoaded || editing) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      return
    }
    let lastTime = performance.now()

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 16.67, 3)
      lastTime = now
      const s = { ...stateRef.current }
      const cfg = gameConfigRef.current

      if (s.caught) {
        s.catchTimer -= dt
        if (s.catchTimer <= 0) {
          s.caught = false
        }
      } else if (s.mouseActive) {
        const dx = s.mouseX - s.chaserX
        const dy = s.mouseY - s.chaserY
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 2) {
          const moveSpeed = s.speed * dt

          if (cfg.movement === "chase") {
            const ratio = Math.min(moveSpeed / dist, 1)
            s.chaserX += dx * ratio
            s.chaserY += dy * ratio
          } else if (cfg.movement === "zigzag") {
            s.zigzagT = (s.zigzagT || 0) + dt * 0.15
            const perpX = -dy / dist
            const perpY = dx / dist
            const wiggle = Math.sin(s.zigzagT) * 40
            const targetX = s.mouseX + perpX * wiggle
            const targetY = s.mouseY + perpY * wiggle
            const tdx = targetX - s.chaserX
            const tdy = targetY - s.chaserY
            const tdist = Math.sqrt(tdx * tdx + tdy * tdy)
            if (tdist > 2) {
              const r = Math.min(moveSpeed / tdist, 1)
              s.chaserX += tdx * r
              s.chaserY += tdy * r
            }
          } else if (cfg.movement === "orbit") {
            s.orbitAngle = (s.orbitAngle || 0) + s.speed * dt * 0.008
            const shrink = Math.max(dist - moveSpeed * 0.3, 0)
            s.chaserX = s.mouseX - Math.cos(s.orbitAngle) * shrink
            s.chaserY = s.mouseY - Math.sin(s.orbitAngle) * shrink
          }

          if (Math.abs(dx) > 5) s.facingLeft = dx < 0
        }

        if (dist < cfg.spriteSize * cfg.catchRadius) {
          s.caught = true
          s.catchTimer = cfg.catchDuration

          const api = {
            addScore: (n) => { s.score += n },
            increaseSpeed: (n) => { s.speed = Math.min(s.speed + n, cfg.maxSpeed) },
            shake: () => { setShaking(true); setTimeout(() => setShaking(false), 300) },
          }

          if (cfg.__onCatchCode) {
            try { cfg.__onCatchCode(api) } catch (e) { console.warn("onCatch error:", e) }
          } else {
            api.addScore(cfg.scorePerCatch)
            api.increaseSpeed(cfg.speedPerCatch)
            if (cfg.shakeOnCatch) api.shake()
          }

          const id = burstIdRef.current++
          setParticleBursts(prev => [...prev, { id, x: s.chaserX, y: s.chaserY }])
          setTimeout(() => setParticleBursts(prev => prev.filter(b => b.id !== id)), 600)
        }
      }

      stateRef.current = s
      setGameState(s)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [imagesLoaded, editing])

  const handleApplyConfig = (cfg, xml) => {
    setSavedXml(xml)
    setGameConfig(cfg)
    gameConfigRef.current = cfg
    const newState = makeInitialState(cfg)
    stateRef.current = newState
    setGameState(newState)
    setEditing(false)
  }

  const s = gameState
  const cfg = gameConfig
  const spriteUrl = s.caught ? caughtUrl : chaserUrl
  const spriteScale = s.caught ? 1.2 : 1

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden", position: "relative",
      background: theme.bg, cursor: "crosshair", fontFamily: "'Inter', system-ui, sans-serif", userSelect: "none",
      animation: shaking ? "shake 0.3s ease" : "none",
    }} ref={containerRef}>
      <style>{`@keyframes shake {
        0%, 100% { transform: translate(0); }
        20% { transform: translate(-6px, 3px); }
        40% { transform: translate(6px, -3px); }
        60% { transform: translate(-4px, -2px); }
        80% { transform: translate(4px, 2px); }
      }`}</style>

      <AmbientParticles themeId={theme.id} />

      {/* HUD */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "1rem 1.5rem", zIndex: 10,
      }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.2)",
            borderRadius: "12px", color: "#fff", padding: "0.5rem 1rem", cursor: "pointer",
            fontSize: "0.9rem", fontWeight: 600, backdropFilter: "blur(10px)",
          }}>← Themes</button>
          <button onClick={() => setEditing(true)} style={{
            background: "rgba(74,222,128,0.2)", border: "2px solid rgba(74,222,128,0.4)",
            borderRadius: "12px", color: "#4ade80", padding: "0.5rem 1rem", cursor: "pointer",
            fontSize: "0.9rem", fontWeight: 600, backdropFilter: "blur(10px)",
          }}>🧩 Edit</button>
        </div>
        <div style={{
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", borderRadius: "16px",
          padding: "0.6rem 1.5rem", display: "flex", alignItems: "center", gap: "0.5rem",
        }}>
          <span style={{ fontSize: "1.5rem" }}>⭐</span>
          <span style={{ color: "#fff", fontSize: "1.8rem", fontWeight: 800, minWidth: "2ch", textAlign: "center" }}>{s.score}</span>
        </div>
        <div style={{
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", borderRadius: "16px",
          padding: "0.5rem 1rem", color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", fontWeight: 500,
          display: "flex", gap: "0.75rem",
        }}>
          <span>Speed: {s.speed.toFixed(1)}</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span style={{ textTransform: "capitalize" }}>{cfg.movement}</span>
        </div>
      </div>

      {/* Catch glow */}
      {s.caught && (
        <div style={{
          position: "absolute", left: s.chaserX, top: s.chaserY, transform: "translate(-50%, -50%)",
          width: cfg.spriteSize * 3, height: cfg.spriteSize * 3, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,100,0.3) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 1,
        }} />
      )}

      {/* Score pop */}
      {s.caught && s.catchTimer > cfg.catchDuration - 10 && (
        <div style={{
          position: "absolute", left: s.chaserX, top: s.chaserY - cfg.spriteSize * 0.8,
          transform: "translate(-50%, -50%)", color: "#ffd700", fontSize: "2rem", fontWeight: 900,
          textShadow: "0 2px 8px rgba(0,0,0,0.5)", pointerEvents: "none", zIndex: 15,
        }}>+{cfg.__onCatchCode ? "" : cfg.scorePerCatch}</div>
      )}

      {/* Particles */}
      {particleBursts.map(b => <Particles key={b.id} x={b.x} y={b.y} />)}

      {/* Sprite */}
      <div style={{
        position: "absolute", left: s.chaserX, top: s.chaserY,
        width: cfg.spriteSize * spriteScale, height: cfg.spriteSize * spriteScale,
        transform: `translate(-50%, -50%) ${s.facingLeft ? "scaleX(-1)" : ""} ${s.caught ? `rotate(${Math.sin(Date.now() / 80) * 15}deg) scale(1.15)` : ""}`,
        pointerEvents: "none", zIndex: 2, borderRadius: "50%", overflow: "hidden",
        border: s.caught ? "3px solid #ffd700" : "3px solid rgba(255,255,255,0.6)",
        boxShadow: s.caught ? "0 0 24px rgba(255,215,0,0.6), 0 0 48px rgba(255,215,0,0.3)" : "0 4px 12px rgba(0,0,0,0.4)",
        transition: "border 0.15s, box-shadow 0.15s", background: "#fff",
      }}>
        <img src={spriteUrl} alt="sprite" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* Cursor reticle */}
      {!s.caught && (
        <div style={{
          position: "absolute", left: s.mouseX, top: s.mouseY, width: 20, height: 20,
          transform: "translate(-50%, -50%)", border: "2px solid rgba(255,255,255,0.3)",
          borderRadius: "50%", pointerEvents: "none", zIndex: 1,
        }} />
      )}

      {/* Instructions */}
      {s.score === 0 && !s.caught && (
        <div style={{
          position: "absolute", bottom: "3rem", left: "50%", transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.5)", fontSize: "1.1rem", fontWeight: 500, textAlign: "center",
          pointerEvents: "none", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)",
          padding: "0.8rem 1.5rem", borderRadius: "12px",
        }}>
          Move your cursor — the sprite is chasing you! &nbsp; Click 🧩 Edit to customize with blocks.
        </div>
      )}

      {/* Block Editor */}
      {editing && (
        <BlockEditor
          onApply={handleApplyConfig}
          onClose={() => setEditing(false)}
          savedXml={savedXml}
          theme={theme}
          customSprites={customSprites}
          onCustomSprites={setCustomSprites}
        />
      )}
    </div>
  )
}

// ── App root ──

export default function App() {
  const [theme, setTheme] = useState(null)
  if (!theme) return <ThemePicker onSelect={setTheme} />
  return <GameLoader theme={theme} onBack={() => setTheme(null)} />
}

function GameLoader({ theme, onBack }) {
  const chaser = useImgUrl(theme.chaserPrompt, `sprite-chaser-${theme.id}`)
  const caught = useImgUrl(theme.caughtPrompt, `sprite-caught-${theme.id}`)
  const bothReady = chaser.url && caught.url && !chaser.loading && !caught.loading
  if (!bothReady) return <LoadingScreen theme={theme} chaserStatus={chaser} caughtStatus={caught} />
  return <GameCanvas theme={theme} chaserUrl={chaser.url} caughtUrl={caught.url} onBack={onBack} />
}
