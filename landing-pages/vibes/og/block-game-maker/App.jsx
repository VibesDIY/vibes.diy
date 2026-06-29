import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useFireproof } from "use-fireproof"
import { ImgGen } from "use-vibes"

const STAGE_W = 480, STAGE_H = 360
const COLORS = ["#4a90d9", "#d94a4a", "#4ad94a", "#d9d94a", "#d94ad9", "#4ad9d9", "#d9904a", "#904ad9"]

function uid() { return Math.random().toString(36).slice(2, 9) }

function makeSprite(name, overrides = {}) {
  return { id: uid(), name, x: 0, y: 0, vx: 0, vy: 0, direction: 90, size: 50, visible: true, color: COLORS[Math.floor(Math.random() * COLORS.length)], imgPrompt: "", workspaceXml: "", say: "", ...overrides }
}

const TEMPLATES = {
  blank: {
    name: "Blank Project",
    desc: "Empty canvas — build anything",
    emoji: "📋",
    bg: "#1a1a2e",
    sprites: () => [makeSprite("Sprite1", { color: "#4a90d9" })],
  },
  chase: {
    name: "Sprite Chase",
    desc: "A sprite chases your cursor",
    emoji: "🏃",
    bg: "linear-gradient(180deg, #0a2a4a 0%, #1a4a6a 40%, #2a6a8a 100%)",
    sprites: () => [
      makeSprite("Chaser", { color: "#ff6b35", size: 30, imgPrompt: "cute cartoon orange cat running, game sprite, chibi style, white background, centered, no text", workspaceXml: CHASE_CHASER_XML }),
      makeSprite("Star", { color: "#ffd700", size: 20, x: 100, y: 80, imgPrompt: "golden glowing star with sparkles, game sprite, chibi style, white background, centered, no text", workspaceXml: CHASE_STAR_XML }),
    ],
  },
  pong: {
    name: "Pong",
    desc: "Classic paddle & ball game",
    emoji: "🏓",
    bg: "linear-gradient(180deg, #0a0a2e 0%, #0a1a3e 50%, #0a0a2e 100%)",
    sprites: () => [
      makeSprite("Paddle", { color: "#4ade80", size: 15, x: -200, shape: "rect", ratio: 0.3, workspaceXml: PONG_PADDLE_XML }),
      makeSprite("Ball", { color: "#fff", size: 12, imgPrompt: "glowing white tennis ball, game sprite, simple, white background, centered, no text", workspaceXml: PONG_BALL_XML }),
      makeSprite("Wall", { color: "#ff4444", size: 15, x: 210, shape: "rect", ratio: 0.3, visible: true, workspaceXml: PONG_WALL_XML }),
    ],
  },
  breakout: {
    name: "Breakout",
    desc: "Smash bricks with a bouncing ball",
    emoji: "🧱",
    bg: "linear-gradient(180deg, #1a0a2e 0%, #0a0a1e 50%, #0a1a2e 100%)",
    sprites: () => {
      const bricks = []
      const colors = ["#ff6b6b", "#ffa500", "#ffd700", "#4ade80", "#60a5fa"]
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
          bricks.push(makeSprite(`B${row}${col}`, {
            x: -154 + col * 44, y: 130 - row * 18, size: 10,
            color: colors[row], shape: "rect", ratio: 3,
            workspaceXml: BREAKOUT_BRICK_XML,
          }))
        }
      }
      return [
        makeSprite("Paddle", { color: "#4ade80", size: 10, x: 0, y: -155, shape: "rect", ratio: 5, workspaceXml: BREAKOUT_PADDLE_XML }),
        makeSprite("Ball", { color: "#fff", size: 10, x: 0, y: -120, workspaceXml: BREAKOUT_BALL_XML }),
        ...bricks,
      ]
    },
  },
  sounds: {
    name: "Sound Test",
    desc: "Play sounds with keyboard keys",
    emoji: "🔊",
    bg: "#1a0a2e",
    sprites: () => [
      makeSprite("Speaker", { color: "#d65cd6", size: 60, workspaceXml: SOUND_TEST_XML }),
    ],
  },
}

// ── Template workspace XMLs ──

const CHASE_CHASER_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_go_to"><value name="X"><shadow type="math_number"><field name="NUM">-100</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
  <next><block type="gm_forever"><statement name="DO">
    <block type="gm_point_mouse"><next>
    <block type="gm_move"><value name="STEPS"><shadow type="math_number"><field name="NUM">3</field></shadow></value>
    <next><block type="gm_if"><value name="COND"><block type="gm_touching"><field name="TARGET">Star</field></block></value><statement name="DO">
      <block type="gm_change_score"><value name="VAL"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
      <next><block type="gm_play_sound"><field name="SOUND">ping</field></block></next></block>
    </statement></block></next></block></next></block>
  </statement></block></next></block>
</statement></block></xml>`

const CHASE_STAR_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_go_to"><value name="X"><shadow type="math_number"><field name="NUM">100</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">80</field></shadow></value>
  <next><block type="gm_forever"><statement name="DO">
    <block type="gm_if"><value name="COND"><block type="gm_touching"><field name="TARGET">Chaser</field></block></value><statement name="DO">
      <block type="gm_play_sound"><field name="SOUND">pop</field>
      <next><block type="gm_go_to"><value name="X"><block type="math_random_int"><value name="FROM"><shadow type="math_number"><field name="NUM">-200</field></shadow></value><value name="TO"><shadow type="math_number"><field name="NUM">200</field></shadow></value></block></value><value name="Y"><block type="math_random_int"><value name="FROM"><shadow type="math_number"><field name="NUM">-150</field></shadow></value><value name="TO"><shadow type="math_number"><field name="NUM">150</field></shadow></value></block></value></block></next></block>
    </statement></block>
  </statement></block></next></block>
</statement></block></xml>`

const PONG_PADDLE_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_set_x"><value name="VAL"><shadow type="math_number"><field name="NUM">-200</field></shadow></value>
  <next><block type="gm_forever"><statement name="DO">
    <block type="gm_if"><value name="COND"><block type="gm_key_pressed"><field name="KEY">up</field></block></value><statement name="DO">
      <block type="gm_change_y"><value name="VAL"><shadow type="math_number"><field name="NUM">6</field></shadow></value></block>
    </statement><next><block type="gm_if"><value name="COND"><block type="gm_key_pressed"><field name="KEY">down</field></block></value><statement name="DO">
      <block type="gm_change_y"><value name="VAL"><shadow type="math_number"><field name="NUM">-6</field></shadow></value></block>
    </statement></block></next></block>
  </statement></block></next></block>
</statement></block></xml>`

const PONG_BALL_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_go_to"><value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
  <next><block type="gm_set_xvel"><value name="VAL"><shadow type="math_number"><field name="NUM">4</field></shadow></value>
  <next><block type="gm_set_yvel"><value name="VAL"><shadow type="math_number"><field name="NUM">3</field></shadow></value>
  <next><block type="gm_forever"><statement name="DO">
    <block type="gm_bounce_edge"><next>
    <block type="gm_if"><value name="COND"><block type="gm_touching"><field name="TARGET">Paddle</field></block></value><statement name="DO">
      <block type="gm_reverse_xvel"><next><block type="gm_change_score"><value name="VAL"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block></next></block>
    </statement><next><block type="gm_if"><value name="COND"><block type="gm_touching"><field name="TARGET">Wall</field></block></value><statement name="DO">
      <block type="gm_reverse_xvel"><next><block type="gm_change_score"><value name="VAL"><shadow type="math_number"><field name="NUM">-1</field></shadow></value></block></next></block>
    </statement></block></next></block></next></block>
  </statement></block></next></block></next></block></next></block>
</statement></block></xml>`

const PONG_WALL_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_set_x"><value name="VAL"><shadow type="math_number"><field name="NUM">210</field></shadow></value>
  <next><block type="gm_set_size"><value name="VAL"><shadow type="math_number"><field name="NUM">15</field></shadow></value></block></next></block>
</statement></block></xml>`

const BREAKOUT_PADDLE_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_forever"><statement name="DO">
    <block type="gm_set_x"><value name="VAL"><block type="gm_mouse_x"></block></value>
    <next><block type="gm_set_y"><value name="VAL"><shadow type="math_number"><field name="NUM">-160</field></shadow></value></block></next></block>
  </statement></block>
</statement></block></xml>`

const BREAKOUT_BALL_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_go_to"><value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">-120</field></shadow></value>
  <next><block type="gm_set_xvel"><value name="VAL"><shadow type="math_number"><field name="NUM">3</field></shadow></value>
  <next><block type="gm_set_yvel"><value name="VAL"><shadow type="math_number"><field name="NUM">4</field></shadow></value>
  <next><block type="gm_forever"><statement name="DO">
    <block type="gm_bounce_edge"><next>
    <block type="gm_if"><value name="COND"><block type="gm_touching"><field name="TARGET">Paddle</field></block></value><statement name="DO">
      <block type="gm_reverse_yvel"><next><block type="gm_play_sound"><field name="SOUND">ping</field></block></next></block>
    </statement></block></next></block>
  </statement></block></next></block></next></block></next></block>
</statement></block>
<block type="gm_when_receive" x="20" y="320"><field name="MSG">brick-hit</field><statement name="DO">
  <block type="gm_reverse_yvel"></block>
</statement></block></xml>`

const BREAKOUT_BRICK_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_show"><next>
  <block type="gm_forever"><statement name="DO">
    <block type="gm_if"><value name="COND"><block type="gm_touching"><field name="TARGET">Ball</field></block></value><statement name="DO">
      <block type="gm_broadcast"><field name="MSG">brick-hit</field>
      <next><block type="gm_play_sound"><field name="SOUND">pop</field>
      <next><block type="gm_change_score"><value name="VAL"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
      <next><block type="gm_hide"></block></next></block></next></block></next></block>
    </statement></block>
  </statement></block></next></block>
</statement></block></xml>`

const SOUND_TEST_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="gm_when_flag" x="20" y="20" deletable="false"><statement name="DO">
  <block type="gm_set_volume"><value name="VAL"><shadow type="math_number"><field name="NUM">50</field></shadow></value>
  <next><block type="gm_say"><field name="TEXT">Press W A S D Space!</field>
  <next><block type="gm_forever"><statement name="DO">
    <block type="gm_if"><value name="COND"><block type="gm_key_pressed"><field name="KEY">w</field></block></value><statement name="DO">
      <block type="gm_play_sound"><field name="SOUND">ping</field>
      <next><block type="gm_say"><field name="TEXT">ping!</field>
      <next><block type="gm_change_y"><value name="VAL"><shadow type="math_number"><field name="NUM">5</field></shadow></value></block></next></block></next></block>
    </statement><next><block type="gm_if"><value name="COND"><block type="gm_key_pressed"><field name="KEY">a</field></block></value><statement name="DO">
      <block type="gm_play_sound"><field name="SOUND">pop</field>
      <next><block type="gm_say"><field name="TEXT">pop!</field>
      <next><block type="gm_change_x"><value name="VAL"><shadow type="math_number"><field name="NUM">-5</field></shadow></value></block></next></block></next></block>
    </statement><next><block type="gm_if"><value name="COND"><block type="gm_key_pressed"><field name="KEY">s</field></block></value><statement name="DO">
      <block type="gm_play_sound"><field name="SOUND">buzz</field>
      <next><block type="gm_say"><field name="TEXT">buzz!</field>
      <next><block type="gm_change_y"><value name="VAL"><shadow type="math_number"><field name="NUM">-5</field></shadow></value></block></next></block></next></block>
    </statement><next><block type="gm_if"><value name="COND"><block type="gm_key_pressed"><field name="KEY">d</field></block></value><statement name="DO">
      <block type="gm_play_sound"><field name="SOUND">blip</field>
      <next><block type="gm_say"><field name="TEXT">blip!</field>
      <next><block type="gm_change_x"><value name="VAL"><shadow type="math_number"><field name="NUM">5</field></shadow></value></block></next></block></next></block>
    </statement><next><block type="gm_if"><value name="COND"><block type="gm_key_pressed"><field name="KEY">space</field></block></value><statement name="DO">
      <block type="gm_play_sound"><field name="SOUND">whoosh</field>
      <next><block type="gm_say"><field name="TEXT">WHOOSH!</field>
      <next><block type="gm_play_tone"><value name="FREQ"><shadow type="math_number"><field name="NUM">440</field></shadow></value><value name="DUR"><shadow type="math_number"><field name="NUM">300</field></shadow></value></block></next></block></next></block>
    </statement></block></next></block></next></block></next></block></next></block>
  </statement></block></next></block></next></block>
</statement></block></xml>`

// ── Blockly blocks ──

function defineBlocks(B) {
  if (B.__gmDefined) return
  B.__gmDefined = true

  const hat = (type, label, emoji) => {
    B.Blocks[type] = { init() {
      this.appendDummyInput().appendField(`${emoji} ${label}`)
      this.appendStatementInput("DO")
      this.setColour("#e6a817")
      this.setDeletable(false)
    }}
  }
  hat("gm_when_flag", "when 🟢 clicked", "⚡")

  B.Blocks["gm_when_receive"] = { init() {
    this.appendDummyInput().appendField("📩 when I receive").appendField(new B.FieldTextInput("message"), "MSG")
    this.appendStatementInput("DO")
    this.setColour("#e6a817")
  }}
  B.Blocks["gm_broadcast"] = { init() {
    this.appendDummyInput().appendField("📢 broadcast").appendField(new B.FieldTextInput("message"), "MSG")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour("#e6a817")
  }}

  const stmt = (type, label, colour, fields) => {
    B.Blocks[type] = { init() {
      const parts = label.split(/(\[\w+\])/)
      let inp = this.appendDummyInput ? null : null
      parts.forEach(p => {
        const m = p.match(/^\[(\w+)\]$/)
        if (m) {
          this.appendValueInput(m[1]).setCheck("Number")
        } else if (p) {
          if (!inp) inp = this.appendDummyInput()
          inp.appendField(p)
        }
      })
      if (fields) fields(this)
      this.setInputsInline(true)
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(colour)
    }}
  }

  const reporter = (type, label, colour) => {
    B.Blocks[type] = { init() {
      this.appendDummyInput().appendField(label)
      this.setOutput(true, "Number")
      this.setColour(colour)
    }}
  }

  const bool = (type, colour, setup) => {
    B.Blocks[type] = { init() {
      setup(this)
      this.setOutput(true, "Boolean")
      this.setColour(colour)
      this.setInputsInline(true)
    }}
  }

  // Motion
  const MOT = "#4a90d9"
  B.Blocks["gm_move"] = { init() {
    this.appendValueInput("STEPS").setCheck("Number").appendField("move")
    this.appendDummyInput().appendField("steps")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_go_to"] = { init() {
    this.appendValueInput("X").setCheck("Number").appendField("go to x:")
    this.appendValueInput("Y").setCheck("Number").appendField("y:")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_change_x"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("change x by")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_change_y"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("change y by")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_set_x"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("set x to")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_set_y"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("set y to")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_point_dir"] = { init() {
    this.appendValueInput("DIR").setCheck("Number").appendField("point in direction")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_point_mouse"] = { init() {
    this.appendDummyInput().appendField("point towards mouse")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_bounce_edge"] = { init() {
    this.appendDummyInput().appendField("if on edge, bounce")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_set_xvel"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("set x velocity to")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_set_yvel"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("set y velocity to")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_reverse_xvel"] = { init() {
    this.appendDummyInput().appendField("reverse x velocity")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  B.Blocks["gm_reverse_yvel"] = { init() {
    this.appendDummyInput().appendField("reverse y velocity")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(MOT)
  }}
  reporter("gm_x_pos", "x position", MOT)
  reporter("gm_y_pos", "y position", MOT)
  reporter("gm_xvel", "x velocity", MOT)
  reporter("gm_yvel", "y velocity", MOT)
  reporter("gm_dir", "direction", MOT)

  // Control
  const CTL = "#e6a817"
  B.Blocks["gm_forever"] = { init() {
    this.appendDummyInput().appendField("forever")
    this.appendStatementInput("DO")
    this.setPreviousStatement(true)
    this.setColour(CTL)
  }}
  B.Blocks["gm_if"] = { init() {
    this.appendValueInput("COND").setCheck("Boolean").appendField("if")
    this.appendDummyInput().appendField("then")
    this.appendStatementInput("DO")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(CTL)
  }}
  B.Blocks["gm_if_else"] = { init() {
    this.appendValueInput("COND").setCheck("Boolean").appendField("if")
    this.appendDummyInput().appendField("then")
    this.appendStatementInput("DO")
    this.appendDummyInput().appendField("else")
    this.appendStatementInput("ELSE")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(CTL)
  }}

  // Sensing
  const SEN = "#2ca5a5"
  B.Blocks["gm_touching"] = { init() {
    this.appendDummyInput().appendField("touching").appendField(new B.FieldTextInput("Sprite1"), "TARGET").appendField("?")
    this.setOutput(true, "Boolean"); this.setColour(SEN)
  }}
  B.Blocks["gm_key_pressed"] = { init() {
    this.appendDummyInput().appendField("key").appendField(new B.FieldDropdown([
      ["up arrow","up"],["down arrow","down"],["left arrow","left"],["right arrow","right"],
      ["space","space"],["w","w"],["a","a"],["s","s"],["d","d"]
    ]), "KEY").appendField("pressed?")
    this.setOutput(true, "Boolean"); this.setColour(SEN)
  }}
  reporter("gm_mouse_x", "mouse x", SEN)
  reporter("gm_mouse_y", "mouse y", SEN)

  // Looks
  const LOOK = "#9966ff"
  B.Blocks["gm_show"] = { init() {
    this.appendDummyInput().appendField("show")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(LOOK)
  }}
  B.Blocks["gm_hide"] = { init() {
    this.appendDummyInput().appendField("hide")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(LOOK)
  }}
  B.Blocks["gm_set_size"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("set size to")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(LOOK)
  }}
  B.Blocks["gm_say"] = { init() {
    this.appendDummyInput().appendField("say").appendField(new B.FieldTextInput("Hello!"), "TEXT")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(LOOK)
  }}

  // Score
  const SCR = "#ff6b6b"
  B.Blocks["gm_change_score"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("change score by")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(SCR)
  }}
  B.Blocks["gm_set_score"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("set score to")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(SCR)
  }}
  reporter("gm_score", "score", SCR)

  // Sound
  const SND = "#d65cd6"
  B.Blocks["gm_play_sound"] = { init() {
    this.appendDummyInput().appendField("play sound").appendField(new B.FieldDropdown([
      ["ping", "ping"], ["pop", "pop"], ["buzz", "buzz"], ["blip", "blip"], ["whoosh", "whoosh"],
    ]), "SOUND")
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(SND)
  }}
  B.Blocks["gm_play_tone"] = { init() {
    this.appendValueInput("FREQ").setCheck("Number").appendField("play tone")
    this.appendValueInput("DUR").setCheck("Number").appendField("Hz for")
    this.appendDummyInput().appendField("ms")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(SND)
  }}
  B.Blocks["gm_set_volume"] = { init() {
    this.appendValueInput("VAL").setCheck("Number").appendField("set volume to")
    this.appendDummyInput().appendField("%")
    this.setInputsInline(true)
    this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(SND)
  }}
}

// ── Code generators ──

function defineGenerators(B) {
  if (B.__gmGenDefined) return
  B.__gmGenDefined = true
  const JS = B.JavaScript
  const O = JS.ORDER_NONE || 0
  const fb = JS.forBlock = JS.forBlock || {}
  const v = (b, n) => JS.valueToCode(b, n, O) || "0"
  const s = (b, n) => JS.statementToCode(b, n)

  fb["gm_when_flag"] = b => `__onFlag.push(function(s,g){\n${s(b,"DO")}});\n`
  fb["gm_when_receive"] = b => { const msg = b.getFieldValue("MSG"); return `__onReceive['${msg}']=__onReceive['${msg}']||[];__onReceive['${msg}'].push(function(s,g){\n${s(b,"DO")}});\n` }
  fb["gm_broadcast"] = b => `g.broadcast('${b.getFieldValue("MSG")}');\n`
  fb["gm_forever"] = b => `s.__loop=function(){\n${s(b,"DO")}};\n`
  fb["gm_if"] = b => `if(${JS.valueToCode(b,"COND",O)||"false"}){\n${s(b,"DO")}}\n`
  fb["gm_if_else"] = b => `if(${JS.valueToCode(b,"COND",O)||"false"}){\n${s(b,"DO")}}else{\n${s(b,"ELSE")}}\n`

  fb["gm_move"] = b => `s.move(${v(b,"STEPS")});\n`
  fb["gm_go_to"] = b => `s.x=${v(b,"X")};s.y=${v(b,"Y")};\n`
  fb["gm_change_x"] = b => `s.x+=${v(b,"VAL")};\n`
  fb["gm_change_y"] = b => `s.y+=${v(b,"VAL")};\n`
  fb["gm_set_x"] = b => `s.x=${v(b,"VAL")};\n`
  fb["gm_set_y"] = b => `s.y=${v(b,"VAL")};\n`
  fb["gm_point_dir"] = b => `s.direction=${v(b,"DIR")};\n`
  fb["gm_point_mouse"] = () => `s.pointTowards(g.mouseX,g.mouseY);\n`
  fb["gm_bounce_edge"] = () => `s.bounceEdge();\n`
  fb["gm_set_xvel"] = b => `s.vx=${v(b,"VAL")};\n`
  fb["gm_set_yvel"] = b => `s.vy=${v(b,"VAL")};\n`
  fb["gm_reverse_xvel"] = () => `s.vx=-s.vx;\n`
  fb["gm_reverse_yvel"] = () => `s.vy=-s.vy;\n`
  fb["gm_x_pos"] = () => ["s.x", O]
  fb["gm_y_pos"] = () => ["s.y", O]
  fb["gm_xvel"] = () => ["s.vx", O]
  fb["gm_yvel"] = () => ["s.vy", O]
  fb["gm_dir"] = () => ["s.direction", O]

  fb["gm_touching"] = b => [`g.touching(s,"${b.getFieldValue("TARGET")}")`, O]
  fb["gm_key_pressed"] = b => [`g.keyDown("${b.getFieldValue("KEY")}")`, O]
  fb["gm_mouse_x"] = () => ["g.mouseX", O]
  fb["gm_mouse_y"] = () => ["g.mouseY", O]

  fb["gm_show"] = () => `s.visible=true;\n`
  fb["gm_hide"] = () => `s.visible=false;\n`
  fb["gm_set_size"] = b => `s.size=${v(b,"VAL")};\n`
  fb["gm_say"] = b => `s.say="${b.getFieldValue("TEXT")}";\n`

  fb["gm_change_score"] = b => `g.score+=${v(b,"VAL")};\n`
  fb["gm_set_score"] = b => `g.score=${v(b,"VAL")};\n`
  fb["gm_score"] = () => ["g.score", O]

  fb["gm_play_sound"] = b => `g.playSound("${b.getFieldValue("SOUND")}");\n`
  fb["gm_play_tone"] = b => `g.playTone(${v(b,"FREQ")},${v(b,"DUR")});\n`
  fb["gm_set_volume"] = b => `g.setVolume(${v(b,"VAL")});\n`
}

const TOOLBOX = `<xml>
  <category name="Events" colour="#e6a817">
    <block type="gm_when_flag"></block>
    <block type="gm_when_receive"></block>
    <block type="gm_broadcast"></block>
  </category>
  <category name="Motion" colour="#4a90d9">
    <block type="gm_move"><value name="STEPS"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="gm_go_to"><value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="gm_change_x"><value name="VAL"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="gm_change_y"><value name="VAL"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="gm_set_x"><value name="VAL"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="gm_set_y"><value name="VAL"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="gm_point_dir"><value name="DIR"><shadow type="math_number"><field name="NUM">90</field></shadow></value></block>
    <block type="gm_point_mouse"></block>
    <block type="gm_bounce_edge"></block>
    <block type="gm_set_xvel"><value name="VAL"><shadow type="math_number"><field name="NUM">5</field></shadow></value></block>
    <block type="gm_set_yvel"><value name="VAL"><shadow type="math_number"><field name="NUM">5</field></shadow></value></block>
    <block type="gm_reverse_xvel"></block>
    <block type="gm_reverse_yvel"></block>
    <block type="gm_x_pos"></block>
    <block type="gm_y_pos"></block>
    <block type="gm_xvel"></block>
    <block type="gm_yvel"></block>
  </category>
  <category name="Control" colour="#e6a817">
    <block type="gm_forever"></block>
    <block type="gm_if"></block>
    <block type="gm_if_else"></block>
  </category>
  <category name="Sensing" colour="#2ca5a5">
    <block type="gm_touching"></block>
    <block type="gm_key_pressed"></block>
    <block type="gm_mouse_x"></block>
    <block type="gm_mouse_y"></block>
  </category>
  <category name="Looks" colour="#9966ff">
    <block type="gm_show"></block>
    <block type="gm_hide"></block>
    <block type="gm_set_size"><value name="VAL"><shadow type="math_number"><field name="NUM">50</field></shadow></value></block>
    <block type="gm_say"></block>
  </category>
  <category name="Score" colour="#ff6b6b">
    <block type="gm_change_score"><value name="VAL"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="gm_set_score"><value name="VAL"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="gm_score"></block>
  </category>
  <category name="Sound" colour="#d65cd6">
    <block type="gm_play_sound"></block>
    <block type="gm_play_tone"><value name="FREQ"><shadow type="math_number"><field name="NUM">440</field></shadow></value><value name="DUR"><shadow type="math_number"><field name="NUM">200</field></shadow></value></block>
    <block type="gm_set_volume"><value name="VAL"><shadow type="math_number"><field name="NUM">50</field></shadow></value></block>
  </category>
  <category name="Math" colour="#5b67a5">
    <block type="math_number"><field name="NUM">0</field></block>
    <block type="math_arithmetic"></block>
    <block type="math_random_int"><value name="FROM"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="TO"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
    <block type="logic_compare"></block>
    <block type="logic_operation"></block>
    <block type="logic_negate"></block>
  </category>
</xml>`

// ── Game engine ──

function createSpriteAPI(sprite) {
  const s = sprite
  s.move = function(steps) {
    const rad = (s.direction - 90) * Math.PI / 180
    s.x += Math.cos(rad) * steps
    s.y -= Math.sin(rad) * steps
  }
  s.pointTowards = function(tx, ty) {
    const dx = tx - s.x, dy = s.y - ty
    s.direction = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
  }
  s.bounceEdge = function() {
    const hw = s.size / 2, hh = s.size / 2
    if (s.x + hw > STAGE_W/2) { s.x = STAGE_W/2 - hw; s.vx = -Math.abs(s.vx) }
    if (s.x - hw < -STAGE_W/2) { s.x = -STAGE_W/2 + hw; s.vx = Math.abs(s.vx) }
    if (s.y + hh > STAGE_H/2) { s.y = STAGE_H/2 - hh; s.vy = -Math.abs(s.vy) }
    if (s.y - hh < -STAGE_H/2) { s.y = -STAGE_H/2 + hh; s.vy = Math.abs(s.vy) }
  }
  return s
}

function compileSprite(B, sprite) {
  const ws = new B.Workspace()
  try {
    if (!sprite.workspaceXml) return { onFlag: [], onReceive: {} }
    B.Xml.domToWorkspace(B.utils.xml.textToDom(sprite.workspaceXml), ws)
    const code = B.JavaScript.workspaceToCode(ws)
    const scripts = { onFlag: [], onReceive: {} }
    const fn = new Function("__onFlag", "__onReceive", code)
    fn(scripts.onFlag, scripts.onReceive)
    return scripts
  } catch (e) {
    console.warn(`Compile error (${sprite.name}):`, e)
    return { onFlag: [], onReceive: {} }
  } finally {
    ws.dispose()
  }
}

// ── Stage component ──

function Stage({ sprites, running, score, stageRef, bg }) {
  return (
    <div style={{
      position: "relative",
      width: "100%",
      paddingBottom: `${(STAGE_H/STAGE_W)*100}%`,
      background: bg || "#1a1a2e",
      borderRadius: "8px",
      overflow: "hidden",
      border: "2px solid #3a3a5e",
      outline: "none",
    }} ref={stageRef} tabIndex={0}>
      {/* Score */}
      <div style={{
        position: "absolute", top: 8, right: 12, zIndex: 5,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        borderRadius: "10px", padding: "6px 14px",
        color: "#fff", fontSize: "16px", fontWeight: 800, fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex", alignItems: "center", gap: "6px",
      }}>⭐ {score}</div>

      {/* Sprites */}
      {sprites.filter(sp => sp.visible).map(sp => {
        const left = ((sp.x + STAGE_W/2) / STAGE_W) * 100
        const top = ((STAGE_H/2 - sp.y) / STAGE_H) * 100
        const pxSize = (sp.size / STAGE_W) * 100
        const isRect = sp.shape === "rect"
        return (
          <div key={sp.id} style={{
            position: "absolute",
            left: `${left}%`, top: `${top}%`,
            width: `${pxSize * (isRect ? (sp.ratio || 1) : 1)}%`,
            paddingBottom: `${pxSize * (isRect ? 1 / (sp.ratio || 1) : 1)}%`,
            transform: "translate(-50%, -50%)",
            background: sp.imgPrompt ? "#fff" : sp.color,
            borderRadius: isRect ? "4px" : "50%",
            border: sp.imgPrompt ? "2px solid rgba(255,255,255,0.6)" : "2px solid rgba(255,255,255,0.4)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            zIndex: 2,
            overflow: "hidden",
          }}>
            {sp.imgPrompt && (
              <ImgGen
                prompt={sp.imgPrompt}
                _id={`gm-stage-${sp.imgPrompt.slice(0, 30).replace(/\s/g, "-")}`}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                showControls={false}
              />
            )}
            {sp.say && (
              <div style={{
                position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)",
                background: "#fff", color: "#000", borderRadius: "8px", padding: "4px 8px",
                fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)", zIndex: 5,
              }}>{sp.say}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Sprite properties ──

function SpriteProperties({ sprite, onUpdate }) {
  const [prompt, setPrompt] = useState(sprite.imgPrompt || "")
  const [name, setName] = useState(sprite.name)
  const [committed, setCommitted] = useState(sprite.imgPrompt || "")

  useEffect(() => {
    setPrompt(sprite.imgPrompt || "")
    setName(sprite.name)
    setCommitted(sprite.imgPrompt || "")
  }, [sprite.id])

  const handleGenerate = () => {
    setCommitted(prompt)
    onUpdate({ ...sprite, imgPrompt: prompt })
  }

  const handleNameBlur = () => {
    if (name !== sprite.name) onUpdate({ ...sprite, name })
  }

  return (
    <div style={{
      background: "#1e1e2e",
      borderTop: "2px solid #3a3a5e",
      padding: "10px 12px",
      display: "flex",
      gap: "10px",
      alignItems: "flex-start",
      fontSize: "12px",
    }}>
      {/* Preview */}
      <div style={{
        width: 52, height: 52, borderRadius: "50%", overflow: "hidden",
        background: sprite.color, border: "2px solid #3a3a5e", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {committed ? (
          <ImgGen
            prompt={committed}
            _id={`gm-sprite-${committed.slice(0, 30).replace(/\s/g, "-")}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            showControls={false}
          />
        ) : (
          <span style={{ color: "#fff", fontSize: "18px", fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            {sprite.name.slice(0, 2)}
          </span>
        )}
      </div>

      {/* Fields */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={e => { if (e.key === "Enter") e.target.blur() }}
            style={{
              background: "#13131e", border: "1px solid #3a3a5e", borderRadius: "4px",
              color: "#fff", padding: "3px 8px", fontSize: "12px", fontWeight: 700,
              width: "80px",
            }}
          />
          <input
            type="color"
            value={sprite.color}
            onChange={e => onUpdate({ ...sprite, color: e.target.value })}
            style={{
              width: 24, height: 24, border: "1px solid #3a3a5e", borderRadius: "4px",
              padding: 0, cursor: "pointer", background: "none",
            }}
          />
          <span style={{ color: "#666", fontSize: "11px" }}>
            x:{Math.round(sprite.x)} y:{Math.round(sprite.y)}
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <select
            value={sprite.shape || "circle"}
            onChange={e => onUpdate({ ...sprite, shape: e.target.value === "circle" ? undefined : e.target.value })}
            style={{
              background: "#13131e", border: "1px solid #3a3a5e", borderRadius: "4px",
              color: "#fff", padding: "2px 4px", fontSize: "11px", width: "60px",
            }}
          >
            <option value="circle">Circle</option>
            <option value="rect">Rect</option>
          </select>
          <label style={{ color: "#666", fontSize: "11px" }}>Size</label>
          <input
            type="number"
            value={sprite.size}
            onChange={e => onUpdate({ ...sprite, size: Number(e.target.value) || 50 })}
            style={{
              background: "#13131e", border: "1px solid #3a3a5e", borderRadius: "4px",
              color: "#fff", padding: "2px 6px", fontSize: "11px", width: "45px",
            }}
          />
          {(sprite.shape === "rect") && <>
            <label style={{ color: "#666", fontSize: "11px" }}>W:H</label>
            <input
              type="number"
              step="0.1"
              value={sprite.ratio || 1}
              onChange={e => onUpdate({ ...sprite, ratio: Number(e.target.value) || 1 })}
              style={{
                background: "#13131e", border: "1px solid #3a3a5e", borderRadius: "4px",
                color: "#fff", padding: "2px 6px", fontSize: "11px", width: "40px",
              }}
            />
          </>}
          <label style={{ color: "#666", fontSize: "11px" }}>Dir</label>
          <input
            type="number"
            value={sprite.direction}
            onChange={e => onUpdate({ ...sprite, direction: Number(e.target.value) || 0 })}
            style={{
              background: "#13131e", border: "1px solid #3a3a5e", borderRadius: "4px",
              color: "#fff", padding: "2px 6px", fontSize: "11px", width: "45px",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="ImgGen prompt (e.g. cute red dragon)"
            style={{
              flex: 1, background: "#13131e", border: "1px solid #3a3a5e", borderRadius: "4px",
              color: "#fff", padding: "3px 8px", fontSize: "11px", minWidth: 0,
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={!prompt || prompt === committed}
            style={{
              background: prompt && prompt !== committed ? "#4ade80" : "rgba(255,255,255,0.08)",
              border: "none", borderRadius: "4px",
              color: prompt && prompt !== committed ? "#0a2a0a" : "#666",
              padding: "3px 10px", fontSize: "11px", fontWeight: 700,
              cursor: prompt && prompt !== committed ? "pointer" : "default",
            }}
          >Gen</button>
        </div>
      </div>
    </div>
  )
}

// ── Sprite pane ──

function SpritePane({ sprites, selectedId, onSelect, onAdd, onDelete, onUpdateSprite, hideProperties }) {
  const selectedSprite = sprites.find(s => s.id === selectedId)
  return (
    <div>
      {/* Properties for selected sprite */}
      {selectedSprite && !hideProperties && (
        <SpriteProperties sprite={selectedSprite} onUpdate={onUpdateSprite} />
      )}

      {/* Sprite thumbnails */}
      <div style={{
        background: "#1e1e2e",
        borderTop: "1px solid #3a3a5e",
        padding: "8px",
        display: "flex",
        gap: "6px",
        alignItems: "center",
        overflowX: "auto",
        minHeight: "70px",
      }}>
        {sprites.map(sp => (
          <div key={sp.id} onClick={() => onSelect(sp.id)} style={{
            width: 56, height: 56, borderRadius: "8px",
            background: sp.color,
            border: sp.id === selectedId ? "3px solid #4ade80" : "2px solid #3a3a5e",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            position: "relative",
          }}>
            <span style={{ color: "#fff", fontSize: "9px", fontWeight: 700, textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
              {sp.name.slice(0, 4)}
            </span>
            {sprites.length > 1 && sp.id === selectedId && (
              <button onClick={e => { e.stopPropagation(); onDelete(sp.id) }} style={{
                position: "absolute", top: -4, right: -4, width: 16, height: 16,
                borderRadius: "50%", background: "#ff4444", border: "none",
                color: "#fff", fontSize: "10px", cursor: "pointer", lineHeight: "16px",
                padding: 0,
              }}>×</button>
            )}
          </div>
        ))}
        <button onClick={onAdd} style={{
          width: 56, height: 56, borderRadius: "8px",
          background: "rgba(255,255,255,0.05)",
          border: "2px dashed rgba(255,255,255,0.2)",
          color: "rgba(255,255,255,0.4)",
          fontSize: "24px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>+</button>
      </div>
    </div>
  )
}

// ── Blockly editor ──

function BlocklyEditor({ sprite, onSave, blocklyReady }) {
  const editorRef = useRef(null)
  const wsRef = useRef(null)
  const spriteIdRef = useRef(null)

  const saveCurrentWorkspace = useCallback(() => {
    if (wsRef.current && spriteIdRef.current) {
      const B = window.Blockly
      const xml = B.Xml.domToText(B.Xml.workspaceToDom(wsRef.current))
      onSave(spriteIdRef.current, xml)
    }
  }, [onSave])

  useEffect(() => {
    if (!blocklyReady || !editorRef.current || !sprite) return

    if (wsRef.current && spriteIdRef.current && spriteIdRef.current !== sprite.id) {
      saveCurrentWorkspace()
    }

    const B = window.Blockly
    if (wsRef.current) { wsRef.current.dispose(); wsRef.current = null }

    const ws = B.inject(editorRef.current, {
      toolbox: TOOLBOX, trashcan: true, scrollbars: true,
      zoom: { controls: true, startScale: 0.85 },
      grid: { spacing: 20, length: 3, colour: "#ddd", snap: true },
    })
    wsRef.current = ws
    spriteIdRef.current = sprite.id

    if (sprite.workspaceXml) {
      try { B.Xml.domToWorkspace(B.utils.xml.textToDom(sprite.workspaceXml), ws) }
      catch (e) { console.warn("Load error:", e) }
    }

    return () => {
      saveCurrentWorkspace()
      ws.dispose()
      wsRef.current = null
    }
  }, [blocklyReady, sprite?.id])

  useEffect(() => {
    return () => { saveCurrentWorkspace() }
  }, [saveCurrentWorkspace])

  return <div ref={editorRef} style={{ flex: 1, minHeight: 0 }} />
}

// ── Main editor layout ──

function GameEditor({ project, onUpdateProject, onBack }) {
  const [sprites, setSprites] = useState(project.sprites)
  const [selectedId, setSelectedId] = useState(project.sprites[0]?.id)
  const [running, setRunning] = useState(false)
  const [score, setScore] = useState(0)
  const [blocklyReady, setBlocklyReady] = useState(false)
  const stageRef = useRef(null)
  const rafRef = useRef(null)
  const gameRef = useRef({ mouseX: 0, mouseY: 0, keys: {}, score: 0, sprites: [] })

  const selectedSprite = sprites.find(s => s.id === selectedId)

  useEffect(() => {
    if (window.Blockly && window.Blockly.JavaScript) { setBlocklyReady(true); return }
    const s1 = document.createElement("script")
    s1.src = "https://unpkg.com/blockly/blockly.min.js"
    s1.onload = () => {
      const s2 = document.createElement("script")
      s2.src = "https://unpkg.com/blockly/javascript_compressed.js"
      s2.onload = () => { defineBlocks(window.Blockly); defineGenerators(window.Blockly); setBlocklyReady(true) }
      document.body.appendChild(s2)
    }
    document.body.appendChild(s1)
  }, [])

  useEffect(() => {
    const onKey = (e) => { gameRef.current.keys[e.key.toLowerCase().replace("arrow", "")] = e.type === "keydown" }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey) }
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      const rx = (e.clientX - rect.left) / rect.width
      const ry = (e.clientY - rect.top) / rect.height
      gameRef.current.mouseX = (rx - 0.5) * STAGE_W
      gameRef.current.mouseY = (0.5 - ry) * STAGE_H
    }
    el.addEventListener("mousemove", onMove)
    return () => el.removeEventListener("mousemove", onMove)
  }, [])

  const handleSaveWorkspace = useCallback((spriteId, xml) => {
    setSprites(prev => prev.map(sp => sp.id === spriteId ? { ...sp, workspaceXml: xml } : sp))
  }, [])

  const handleStart = () => {
    if (!blocklyReady) return
    const B = window.Blockly
    const runtimeSprites = sprites.map(sp => {
      const rt = { ...sp, __loop: null, say: "" }
      createSpriteAPI(rt)
      return rt
    })

    const g = gameRef.current
    g.score = 0
    g.sprites = runtimeSprites
    g.touching = (s, targetName) => {
      const t = runtimeSprites.find(sp => sp.name === targetName)
      if (!t || !t.visible) return false
      const dist = Math.sqrt((s.x - t.x) ** 2 + (s.y - t.y) ** 2)
      return dist < (s.size + t.size) / 2
    }
    g.keyDown = (k) => !!g.keys[k]

    if (!g._audioCtx) g._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (!g._volume) g._volume = 0.3
    const SOUNDS = {
      ping: { freq: 880, dur: 80, type: "sine" },
      pop: { freq: 300, dur: 100, type: "sine" },
      buzz: { freq: 150, dur: 150, type: "sawtooth" },
      blip: { freq: 660, dur: 60, type: "square" },
      whoosh: { freq: 200, dur: 200, type: "triangle" },
    }
    g.playSound = (name) => {
      const snd = SOUNDS[name]
      if (!snd) return
      g.playTone(snd.freq, snd.dur, snd.type)
    }
    g.playTone = (freq, durMs, type) => {
      try {
        const ctx = g._audioCtx
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type || "sine"
        osc.frequency.value = freq
        gain.gain.value = g._volume
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + durMs / 1000)
      } catch (e) {}
    }
    g.setVolume = (pct) => { g._volume = Math.max(0, Math.min(1, pct / 100)) }

    g.broadcast = (msg) => {
      for (const rt of runtimeSprites) {
        const handlers = rt.__onReceive?.[msg]
        if (handlers) {
          for (const fn of handlers) {
            try { fn(rt, g) } catch (e) { console.warn("Receive error:", e) }
          }
        }
      }
    }

    for (const rt of runtimeSprites) {
      const scripts = compileSprite(B, rt)
      rt.__onReceive = scripts.onReceive
      for (const fn of scripts.onFlag) {
        try { fn(rt, g) } catch (e) { console.warn("Init error:", e) }
      }
    }

    setRunning(true)
    setScore(0)
    if (stageRef.current) stageRef.current.focus()

    const loop = () => {
      for (const rt of runtimeSprites) {
        rt.x += rt.vx
        rt.y += rt.vy
        if (rt.__loop) {
          try { rt.__loop() } catch (e) { console.warn("Loop error:", e) }
        }
      }
      setScore(g.score)
      setSprites(runtimeSprites.map(rt => ({ ...rt })))
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  const handleStop = () => {
    setRunning(false)
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    setSprites(project.sprites)
  }

  const handleAddSprite = () => {
    const sp = makeSprite(`Sprite${sprites.length + 1}`)
    const next = [...sprites, sp]
    setSprites(next)
    setSelectedId(sp.id)
    onUpdateProject({ ...project, sprites: next })
  }

  const handleDeleteSprite = (id) => {
    const next = sprites.filter(s => s.id !== id)
    setSprites(next)
    if (selectedId === id) setSelectedId(next[0]?.id)
    onUpdateProject({ ...project, sprites: next })
  }

  const handleUpdateSprite = (updated) => {
    const next = sprites.map(s => s.id === updated.id ? updated : s)
    setSprites(next)
    onUpdateProject({ ...project, sprites: next })
  }

  useEffect(() => {
    if (!running) {
      onUpdateProject({ ...project, sprites })
    }
  }, [sprites, running])

  return (
    <div style={{
      width: "100vw", height: "100vh", display: "flex",
      fontFamily: "'Inter', system-ui, sans-serif", background: "#13131e", color: "#fff",
    }}>
      {/* Left: Blockly */}
      <div style={{ flex: "1 1 50%", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "8px 12px", background: "#1e1e2e", borderBottom: "2px solid #3a3a5e",
        }}>
          <button onClick={onBack} style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "6px", color: "#aaa", padding: "4px 10px", cursor: "pointer", fontSize: "13px",
          }}>← Projects</button>
          <span style={{ fontWeight: 700, fontSize: "14px" }}>{project.name}</span>
          <div style={{ flex: 1 }} />
          {selectedSprite && (
            <span style={{ color: "#888", fontSize: "12px" }}>
              Editing: <b style={{ color: selectedSprite.color }}>{selectedSprite.name}</b>
            </span>
          )}
        </div>

        {/* Blockly workspace */}
        {selectedSprite && (
          <BlocklyEditor
            sprite={selectedSprite}
            onSave={handleSaveWorkspace}
            blocklyReady={blocklyReady}
          />
        )}
      </div>

      {/* Right: Stage + Sprites */}
      <div style={{
        flex: "0 0 50%", display: "flex", flexDirection: "column",
        background: "#1e1e2e", borderLeft: "2px solid #3a3a5e",
      }}>
        {/* Stage controls */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 12px", borderBottom: "2px solid #3a3a5e",
        }}>
          <button onClick={handleStart} disabled={running} style={{
            height: 36, borderRadius: "8px", padding: "0 16px",
            background: running ? "#2a4a2a" : "#4ade80", border: "none",
            cursor: running ? "default" : "pointer", fontSize: "14px", fontWeight: 700,
            color: running ? "#4a6a4a" : "#0a2a0a",
            display: "flex", alignItems: "center", gap: "6px",
          }}>🟢 Run</button>
          <button onClick={handleStop} disabled={!running} style={{
            height: 36, borderRadius: "8px", padding: "0 16px",
            background: !running ? "#4a2a2a" : "#ff4444", border: "none",
            cursor: !running ? "default" : "pointer", fontSize: "14px", fontWeight: 700,
            color: !running ? "#6a4a4a" : "#fff",
            display: "flex", alignItems: "center", gap: "6px",
          }}>🔴 Stop</button>
          <div style={{ flex: 1 }} />
        </div>

        {/* Stage */}
        <div style={{ padding: "8px", flex: 1, display: "flex", flexDirection: "column" }}>
          <Stage sprites={sprites} running={running} score={score} stageRef={stageRef} bg={project.bg} />
        </div>

        {/* Sprite pane */}
        <SpritePane
          sprites={sprites}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAddSprite}
          onDelete={handleDeleteSprite}
          onUpdateSprite={handleUpdateSprite}
          hideProperties={running}
        />
      </div>
    </div>
  )
}

// ── Project picker ──

function ProjectPicker({ projects, onOpen, onCreate, onDelete }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #13131e 0%, #1a1a2e 50%, #0f1a3e 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "3rem 2rem", fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <h1 style={{ fontSize: "2.5rem", color: "#fff", fontWeight: 900, marginBottom: "0.5rem" }}>
        Game Maker
      </h1>
      <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "2.5rem" }}>
        Build games with blocks — Scratch-style
      </p>

      {/* New project templates */}
      <div style={{ maxWidth: 700, width: "100%", marginBottom: "2.5rem" }}>
        <h2 style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          New Project
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {Object.entries(TEMPLATES).map(([key, tmpl]) => (
            <button key={key} onClick={() => onCreate(key)} style={{
              background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", padding: "1.5rem 1rem", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.4)"; e.currentTarget.style.background = "rgba(74,222,128,0.05)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
            >
              <span style={{ fontSize: "2rem" }}>{tmpl.emoji}</span>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>{tmpl.name}</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>{tmpl.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Existing projects */}
      {projects.length > 0 && (
        <div style={{ maxWidth: 700, width: "100%" }}>
          <h2 style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            My Projects
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {projects.map(p => (
              <div key={p._id} style={{
                display: "flex", alignItems: "center", gap: "1rem",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px", padding: "0.75rem 1rem", cursor: "pointer",
              }} onClick={() => onOpen(p)}>
                <span style={{ fontSize: "1.5rem" }}>{TEMPLATES[p.template]?.emoji || "🎮"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
                    {p.sprites?.length || 0} sprites · {TEMPLATES[p.template]?.name || p.template}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); onDelete(p._id) }} style={{
                  background: "none", border: "none", color: "rgba(255,255,255,0.2)",
                  cursor: "pointer", fontSize: "18px", padding: "4px 8px",
                }}
                  onMouseEnter={e => e.currentTarget.style.color = "#ff4444"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── App root ──

export default function App() {
  const { database, useLiveQuery } = useFireproof("game-maker")
  const { docs: projects } = useLiveQuery("type", { key: "project", descending: true })
  const [activeProject, setActiveProject] = useState(null)

  const handleCreate = async (templateKey) => {
    const tmpl = TEMPLATES[templateKey]
    const proj = {
      type: "project",
      name: tmpl.name,
      template: templateKey,
      bg: tmpl.bg,
      sprites: tmpl.sprites(),
      createdAt: Date.now(),
    }
    const result = await database.put(proj)
    setActiveProject({ ...proj, _id: result.id })
  }

  const handleOpen = (proj) => { setActiveProject(proj) }

  const handleDelete = async (id) => { await database.del(id) }

  const handleUpdate = async (proj) => {
    await database.put(proj)
    setActiveProject(proj)
  }

  if (activeProject) {
    return (
      <GameEditor
        project={activeProject}
        onUpdateProject={handleUpdate}
        onBack={() => setActiveProject(null)}
      />
    )
  }

  return (
    <ProjectPicker
      projects={projects}
      onOpen={handleOpen}
      onCreate={handleCreate}
      onDelete={handleDelete}
    />
  )
}
