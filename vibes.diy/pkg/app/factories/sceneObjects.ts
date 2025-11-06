import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import {
  SCENE_DIMENSIONS,
  COLORS,
  DATA_LAYER,
  RENDERING,
  EXTERNAL_URLS,
  TEXT_CONTENT,
  ANIMATION_DURATIONS
} from '../constants/scene';
import noise3Url from '../assets/noise3.png';

// Deterministic pseudo-random generator for block presets
// Uses a simple hash function to generate random-looking values from an index
export function generateBlockPreset(index: number): { hexPair: string, textureOffsetX: number, textureOffsetY: number } {
  // Simple hash function for pseudo-random values
  const hash = (seed: number) => {
    let x = seed;
    x = ((x >> 16) ^ x) * 0x45d9f3b;
    x = ((x >> 16) ^ x) * 0x45d9f3b;
    x = (x >> 16) ^ x;
    return x >>> 0; // Convert to unsigned 32-bit integer
  };

  // Generate three different pseudo-random values
  const h1 = hash(index * 2654435761 + 2); // Large prime for better distribution
  const h2 = hash(index * 2654435761 + 3);
  const h3 = hash(index * 2654435761 + 4);

  // Generate hex pair (00-ff)
  const hexValue = h1 % 256;
  const hexPair = hexValue.toString(16).padStart(2, '0');

  // Generate offsets (0.0-0.99) with better distribution
  const textureOffsetX = ((h2 % 10000) / 10000);
  const textureOffsetY = ((h3 % 10000) / 10000);

  return { hexPair, textureOffsetX, textureOffsetY };
}

export function makeGridGroup() {
  // Grid front (as child of enclosure) - 4x5 grid of line segments
  const gridGroup = new THREE.Group()

  gridGroup.position.set(0, 0, SCENE_DIMENSIONS.GRID.POSITION_Z)

  const lineMaterial = new LineMaterial({
    color: COLORS.GRID,
    linewidth: SCENE_DIMENSIONS.GRID.LINE_WIDTH,
  })

  // Create 5 horizontal lines (4 spaces = 5 lines)
  for (let i = 0; i < DATA_LAYER.GRID_LINES.HORIZONTAL; i++) {
    const y = (SCENE_DIMENSIONS.GRID.HEIGHT / 2) - (i * (SCENE_DIMENSIONS.GRID.HEIGHT / 4))
    const points = [
      -SCENE_DIMENSIONS.GRID.WIDTH / 2, y, 0,
      SCENE_DIMENSIONS.GRID.WIDTH / 2, y, 0
    ]
    const lineGeometry = new LineGeometry()
    lineGeometry.setPositions(points)
    const line = new Line2(lineGeometry, lineMaterial)
    gridGroup.add(line)
  }

  // Create 4 vertical lines (3 spaces = 4 lines)
  for (let i = 0; i < DATA_LAYER.GRID_LINES.VERTICAL; i++) {
    const x = (SCENE_DIMENSIONS.GRID.WIDTH / 2) - (i * (SCENE_DIMENSIONS.GRID.WIDTH / 3))
    const points = [
      x, -SCENE_DIMENSIONS.GRID.HEIGHT / 2, 0,
      x, SCENE_DIMENSIONS.GRID.HEIGHT / 2, 0
    ]
    const lineGeometry = new LineGeometry()
    lineGeometry.setPositions(points)
    const line = new Line2(lineGeometry, lineMaterial)
    gridGroup.add(line)
  }

  return { gridGroup };
}

export function makeUnencryptedBlock() {
  // Block (as child of enclosure)
  const blockGeometry = new THREE.BoxGeometry(
    SCENE_DIMENSIONS.BLOCK.WIDTH,
    SCENE_DIMENSIONS.BLOCK.HEIGHT,
    SCENE_DIMENSIONS.BLOCK.DEPTH
  )
  const blockMaterial = new THREE.MeshToonMaterial({ color: 0xda291c })
  const block = new THREE.Mesh(blockGeometry, blockMaterial)
  return block;
}

export function makeEncryptedBlock(textureOffsetX: number = 0, textureOffsetY: number = 0) {
  // Block (as child of enclosure)
  const blockGeometry = new THREE.CylinderGeometry(
    SCENE_DIMENSIONS.BLOCK.WIDTH / 2, // top radius (half width for cylinder)
    SCENE_DIMENSIONS.BLOCK.WIDTH / 2, // bottom radius (half width for cylinder)
    SCENE_DIMENSIONS.BLOCK.HEIGHT, // height
    SCENE_DIMENSIONS.BLOCK.SEGMENTS
  )
  // @ts-ignore
  const textureLoader = new THREE.TextureLoader()
  const noiseTexture = textureLoader.load(noise3Url)
  // Stretch the texture by scaling it down
  noiseTexture.repeat.set(0.08, 0.1)
  // Move texture to use a different part of the image (deterministic)
  noiseTexture.offset.set(textureOffsetX, textureOffsetY)
  // @ts-ignore
  noiseTexture.minFilter = THREE.NearestFilter
  // @ts-ignore
  noiseTexture.maxFilter = THREE.NearestFilter
  noiseTexture.needsUpdate = true
  // @ts-ignore
  noiseTexture.wrapS = THREE.RepeatWrapping
  // @ts-ignore
  noiseTexture.wrapT = THREE.RepeatWrapping
  const blockMaterial = new THREE.MeshToonMaterial({ map: noiseTexture })
  const block = new THREE.Mesh(blockGeometry, blockMaterial)
  return block;
}

interface BlockSituationParams {
  speed?: number
  startPosition?: number
  textureOffsetX?: number
  textureOffsetY?: number
}

export function makeCid(hexPair : string) {
  const loader = new FontLoader()
  const textGroup = new THREE.Group()

  loader.load(EXTERNAL_URLS.HELVETICA_FONT, function (font: any) {


    const textGeometry = new TextGeometry(hexPair, {
      font: font,
      size: 0.3,
      depth: 0.02,
      curveSegments: 8,
      bevelEnabled: false
    })

    // Center the text
    // textGeometry.computeBoundingBox()
    // const textWidth = textGeometry.boundingBox!.max.x - textGeometry.boundingBox!.min.x
    // const textHeight = textGeometry.boundingBox!.max.y - textGeometry.boundingBox!.min.y
    // textGeometry.translate(-textWidth / 2, -textHeight / 2, 0)

    const textMaterial = new THREE.MeshToonMaterial({ color: 0x444444 })
    const textMesh = new THREE.Mesh(textGeometry, textMaterial)

    // Position on the grid behind the encrypted block (now that blocks are flat)
    // @ts-ignore
    textMesh.rotation.z = -Math.PI / 2
    // @ts-ignore
    textMesh.position.x = -0.25
    // @ts-ignore
    textMesh.position.y = -1
    textGroup.add(textMesh)
  })

  return textGroup
}

export function makeBlockSituation(hexPair : string, params: BlockSituationParams = {}) {
  const { speed = ANIMATION_DURATIONS.BLOCK_SPEED, startPosition = 4, textureOffsetX = 0, textureOffsetY = 0 } = params
  const group = new THREE.Group()
  // Add encrypted block
  const unencryptedBlock = makeUnencryptedBlock()
  const encryptedBlock = makeEncryptedBlock(textureOffsetX, textureOffsetY)

  // Rotate blocks to lie flat on the grid
  encryptedBlock.rotation.x = Math.PI / 2
  unencryptedBlock.rotation.x = Math.PI / 2

  // @ts-ignore
  encryptedBlock.position.x = SCENE_DIMENSIONS.BUTTON.POSITION.X
  // @ts-ignore
  encryptedBlock.position.y = SCENE_DIMENSIONS.BUTTON.POSITION.Y

  // @ts-ignore
  encryptedBlock.visible = false;
  // @ts-ignore
  unencryptedBlock.visible = false; // Hidden until animation starts
  // @ts-ignore
  unencryptedBlock.position.x = SCENE_DIMENSIONS.BUTTON.POSITION.X
  // @ts-ignore
  unencryptedBlock.position.y = SCENE_DIMENSIONS.BUTTON.POSITION.Y
  unencryptedBlock.position.z = startPosition

  const cid = makeCid(hexPair)
  // @ts-ignore
  cid.position.x = SCENE_DIMENSIONS.BUTTON.POSITION.X
  // @ts-ignore
  cid.position.y = SCENE_DIMENSIONS.BUTTON.POSITION.Y + 2
  // @ts-ignore
  cid.visible = false
  group.add(cid)

  group.add(unencryptedBlock);
  group.add(encryptedBlock);

  return {
    group,
    unencryptedBlock,
    encryptedBlock,
    cid,
    params: { speed, startPosition }
  };

}

export function makeTabletLabel(gridGroup: THREE.Group) {

  const loader = new FontLoader()
  loader.load(EXTERNAL_URLS.HELVETICA_FONT, function (font: any) {
    const textGeometry = new TextGeometry(TEXT_CONTENT.SAMPLE_TEXT, {
      font: font,
      size: SCENE_DIMENSIONS.TEXT.SIZE,
      depth: SCENE_DIMENSIONS.TEXT.DEPTH,
      curveSegments: SCENE_DIMENSIONS.TEXT.CURVE_SEGMENTS,
      bevelEnabled: false
    })
    const textMaterial = new THREE.MeshToonMaterial({ color: COLORS.TEXT })
    const textMesh = new THREE.Mesh(textGeometry, textMaterial)
    textMesh.position.set(SCENE_DIMENSIONS.TEXT.POSITION.X, (SCENE_DIMENSIONS.GRID.HEIGHT / 2) - (3 * (SCENE_DIMENSIONS.GRID.HEIGHT / 4)) + SCENE_DIMENSIONS.TEXT.POSITION.Y_OFFSET, 0)
    gridGroup.add(textMesh)
  });

}

export function makeDataLayer() {
  // Grid front (as child of enclosure) - 4x5 grid of line segments
  const gridGroup = new THREE.Group()

  gridGroup.position.set(0, 0, 0);

  // create text at destination1
  // makeTabletLabel(gridGroup);

  // Add red button contact pad
  const buttonGeometry = new THREE.TorusGeometry(SCENE_DIMENSIONS.BUTTON_PAD.RADIUS, SCENE_DIMENSIONS.BUTTON_PAD.TUBE_RADIUS, SCENE_DIMENSIONS.BUTTON_PAD.SEGMENTS, SCENE_DIMENSIONS.BUTTON_PAD.SEGMENTS)
  const buttonMaterial = new THREE.MeshToonMaterial({ color: COLORS.BUTTON })
  const button = new THREE.Mesh(buttonGeometry, buttonMaterial)
  button.position.set(SCENE_DIMENSIONS.BUTTON_PAD.POSITION.X, SCENE_DIMENSIONS.BUTTON_PAD.POSITION.Y, SCENE_DIMENSIONS.BUTTON_PAD.POSITION.Z)
  // button.castShadow = true
  // button.receiveShadow = true
  // gridGroup.add(button)

  return gridGroup;
}

export function makeEnclosureBack() {
  // Enclosure back
  const enclosureBackGeometry = new THREE.BoxGeometry(SCENE_DIMENSIONS.ENCLOSURE.WIDTH + SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH, SCENE_DIMENSIONS.ENCLOSURE.HEIGHT + SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH, SCENE_DIMENSIONS.ENCLOSURE.DEPTH)
  const enclosureBackMaterial = new THREE.MeshToonMaterial({ color: COLORS.ENCLOSURE })
  const enclosureBack = new THREE.Mesh(enclosureBackGeometry, enclosureBackMaterial)
  // enclosureBack.castShadow = true
  // enclosureBack.receiveShadow = true
  return enclosureBack;
}

export function makeChrome() {
  // Browser chrome (as child of enclosure)
  const chromeGeometry = new THREE.BoxGeometry(SCENE_DIMENSIONS.CHROME.WIDTH, SCENE_DIMENSIONS.CHROME.HEIGHT, SCENE_DIMENSIONS.CHROME.DEPTH)
  const chromeMaterial = new THREE.MeshToonMaterial({ color: COLORS.CHROME })
  const chrome = new THREE.Mesh(chromeGeometry, chromeMaterial)
  chrome.position.set(0, SCENE_DIMENSIONS.CHROME.POSITION.Y, SCENE_DIMENSIONS.CHROME.POSITION.Z);
  const addressBarGeometry = new THREE.BoxGeometry(SCENE_DIMENSIONS.CHROME.ADDRESS_BAR.WIDTH, SCENE_DIMENSIONS.CHROME.ADDRESS_BAR.HEIGHT, SCENE_DIMENSIONS.CHROME.ADDRESS_BAR.DEPTH)
  const addressBarMaterial = new THREE.MeshToonMaterial({ color: COLORS.ADDRESS_BAR })
  const addressBar = new THREE.Mesh(addressBarGeometry, addressBarMaterial)
  addressBar.position.set(SCENE_DIMENSIONS.CHROME.ADDRESS_BAR.POSITION.X, SCENE_DIMENSIONS.CHROME.ADDRESS_BAR.POSITION.Y, SCENE_DIMENSIONS.CHROME.ADDRESS_BAR.POSITION.Z);
  chrome.add(addressBar)
  // chrome.castShadow = true
  // chrome.receiveShadow = true
  return chrome;
}

export function makeDisplayTexture(counter: number = 0) {
  // Create canvas for display content
  const canvas = document.createElement('canvas')
  canvas.width = SCENE_DIMENSIONS.DISPLAY.CANVAS.WIDTH
  canvas.height = SCENE_DIMENSIONS.DISPLAY.CANVAS.HEIGHT
  const ctx = canvas.getContext('2d')!

  // Draw simple content on canvas
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Add some text
  ctx.fillStyle = COLORS.DISPLAY_TEXT
  ctx.font = `${SCENE_DIMENSIONS.DISPLAY.FONT_SIZE}px dseg7_classic_miniregular`
  // right
  ctx.textAlign = 'right'
  ctx.fillText(counter.toString(), SCENE_DIMENSIONS.DISPLAY.TEXT_X, (canvas.height / 2) + (SCENE_DIMENSIONS.DISPLAY.FONT_SIZE / 2))

  return canvas;
}

export function makeEnclosure() {
  // Blue enclosure
  const geometry = new THREE.BoxGeometry(SCENE_DIMENSIONS.ENCLOSURE.WIDTH + SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH, SCENE_DIMENSIONS.ENCLOSURE.HEIGHT + SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH, SCENE_DIMENSIONS.ENCLOSURE.DEPTH)
  const material = new THREE.MeshToonMaterial({ color: COLORS.ENCLOSURE })
  const enclosure = new THREE.Mesh(geometry, material)

  // Red button (as child of enclosure)
  const buttonGeometry = new THREE.CylinderGeometry(SCENE_DIMENSIONS.BUTTON.RADIUS, SCENE_DIMENSIONS.BUTTON.RADIUS, SCENE_DIMENSIONS.BUTTON.HEIGHT, SCENE_DIMENSIONS.BUTTON.SEGMENTS)
  const buttonMaterial = new THREE.MeshToonMaterial({ color: COLORS.BUTTON })
  const button = new THREE.Mesh(buttonGeometry, buttonMaterial)
  button.position.set(SCENE_DIMENSIONS.BUTTON.POSITION.X, SCENE_DIMENSIONS.BUTTON.POSITION.Y, SCENE_DIMENSIONS.BUTTON.POSITION.Z);
  button.rotation.x = Math.PI / 2
  enclosure.add(button)

  // Display (as child of enclosure)
  const displayMaterial = new THREE.MeshToonMaterial({ color: COLORS.DISPLAY_BACKGROUND })
  const displayGeometry = new THREE.BoxGeometry(SCENE_DIMENSIONS.DISPLAY.WIDTH, SCENE_DIMENSIONS.DISPLAY.HEIGHT, SCENE_DIMENSIONS.DISPLAY.DEPTH);
  const display = new THREE.Mesh(displayGeometry, displayMaterial)
  display.position.set(SCENE_DIMENSIONS.DISPLAY.POSITION.X, SCENE_DIMENSIONS.DISPLAY.POSITION.Y, SCENE_DIMENSIONS.DISPLAY.POSITION.Z);
  display.rotation.x = Math.PI / 2
  enclosure.add(display)

  // Delay to load font
  setTimeout(() => {
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(makeDisplayTexture())
    texture.needsUpdate = true
    const materials = [
      displayMaterial,
      displayMaterial,
      new THREE.MeshToonMaterial({ map: texture }),
      displayMaterial,
      displayMaterial,
      displayMaterial
    ]
    display.material = materials
  }, RENDERING.FONT_LOAD_DELAY);

  return { enclosure, display, button };
}
