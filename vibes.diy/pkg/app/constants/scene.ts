// Scene dimensions and positioning

const frustum = 20;

export const SCENE_DIMENSIONS = {
  CONTAINER: {
    WIDTH: 800,
    HEIGHT: 800
  },
  FRUSTUM: {
    WIDTH: frustum,
    HEIGHT: frustum
  },
  GRID: {
    WIDTH: 6.6,
    HEIGHT: 5.7,
    LINE_WIDTH: 3,
    POSITION_Z: -1.5
  },
  SPHERE: {
    RADIUS: 0.4,
    SEGMENTS: 16,
    OFFSET: 0.8
  },
  BLOCK: {
    WIDTH: 0.8,   // SPHERE.RADIUS * 2
    HEIGHT: 0.2,  // SPHERE.RADIUS / 2
    DEPTH: 0.8,   // SPHERE.RADIUS * 2
    SEGMENTS: 16,
    GOBBLER_PLANE_OFFSET: 0.2
  },
  TEXT: {
    SIZE: 0.4,
    DEPTH: 0.01,
    CURVE_SEGMENTS: 12,
    POSITION: {
      X: -2.2,
      Y_OFFSET: -0.2
    }
  },
  BUTTON_PAD: {
    RADIUS: 0.6,
    TUBE_RADIUS: 0.03,
    SEGMENTS: 32,
    POSITION: {
      X: 6.6 / 2 - 0.4 - 1,
      Y: (5.7 / -2) + 0.4 + 1,
      Z: 3
    }
  },
  ENCLOSURE: {
    WIDTH: 6.6,
    HEIGHT: 5.7,
    DEPTH: 0.1,
    BORDER_WIDTH: 0.8
  },
  CHROME: {
    WIDTH: 6.6 + 1.1,
    HEIGHT: 5.7 + 1.1 + 0.6,
    DEPTH: 0.1,
    POSITION: {
      Y: 0.3,
      Z: 0
    },
    ADDRESS_BAR: {
      WIDTH: 7.7 - 2,
      HEIGHT: 0.55,
      DEPTH: 0.02,
      POSITION: {
        X: 0,
        Y: 3.30,
        Z: 0.06
      }
    }
  },
  DISPLAY: {
    WIDTH: 4,
    HEIGHT: 0.2,
    DEPTH: 2,
    POSITION: {
      X: 0,
      Y: 1.4,
      Z: 0.3
    },
    CANVAS: {
      WIDTH: 400,
      HEIGHT: 200
    },
    FONT_SIZE: 126,
    TEXT_X: 380
  },
  BUTTON: {
    RADIUS: 0.8,
    HEIGHT: 0.2,
    SEGMENTS: 32,
    PRESS_DISTANCE: 0.19,
    POSITION: {
      X: 1.9,
      Y: -1.45,
      Z: 0.3
    }
  },
  GROUND: {
    SIZE: 40,
    OPACITY: 0.2
  },
  AXES_HELPER_SIZE: 15,
  REPLICATOR: {
    WIDTH: 0.1,
    HEIGHT: 10,
    DEPTH: 3
  }
} as const

// Colors
export const COLORS = {
  GRID: 0xcdcccb,
  BLOCK_UNENCRYPTED: 0xda291c,
  BLOCK_ENCRYPTED: 0xfedd00,
  BLOCK_DEFAULT: 0xcdcccb,
  TEXT: 0x000000,
  BUTTON: 0xda291c,
  ENCLOSURE: 0x009ace,
  CHROME: 0xcdcccb,
  ADDRESS_BAR: 0xffffff,
  DISPLAY_BACKGROUND: 0xffffff,
  DISPLAY_TEXT: '#231f20',
  SCENE_BACKGROUND: 0xffffff,
  GROUND: 0xcccccc,
  AMBIENT_LIGHT: 0xffffff,
  DIRECTIONAL_LIGHT: 0xffffff,
  REPLICATOR: 0x00ff00,
  REPLICATOR_OPACITY: 0.3,
  GRID_HELPER: {
    PRIMARY: 0x888888,
    SECONDARY: 0xcccccc
  }
} as const

// Camera positions in spherical coordinates
export const CAMERA_POSITIONS = {
  isometric1: { radius: 34.6, phi: -Math.PI / 4, theta: Math.acos(1 / Math.sqrt(3)) },
  isometric2: { radius: 34.6, phi: Math.PI / 4, theta: Math.acos(1 / Math.sqrt(3)) },
  isometric3: { radius: 34.6, phi: Math.PI / 4, theta: Math.PI - Math.acos(1 / Math.sqrt(3)) },
  isometric4: { radius: 34.6, phi: -Math.PI / 4, theta: Math.PI - Math.acos(1 / Math.sqrt(3)) },
  plan: { radius: 30, phi: 0, theta: 0.01 }, // Slight offset to avoid gimbal lock
  profile: { radius: 30, phi: Math.PI / 2, theta: Math.PI / 2 },
  front: { radius: 30, phi: 0, theta: Math.PI / 2 }
} as const

const linearDistance = 15;
const diagonalDistance = linearDistance / Math.sqrt(3);

// Camera view positions (for updateCameraView function)
export const CAMERA_VIEW_POSITIONS = {
  isometric1: { x: -diagonalDistance, y: diagonalDistance, z: diagonalDistance, rotationY: -Math.PI / 4, rotationX: Math.atan(-1 / Math.sqrt(2)) },
  isometric2: { x: diagonalDistance, y: diagonalDistance, z: diagonalDistance, rotationY: Math.PI / 4, rotationX: Math.atan(-1 / Math.sqrt(2)) },
  isometric3: { x: diagonalDistance, y: -diagonalDistance, z: diagonalDistance, rotationY: Math.PI / 4, rotationX: Math.atan(1 / Math.sqrt(2)) },
  isometric4: { x: -diagonalDistance, y: -diagonalDistance, z: diagonalDistance, rotationY: -Math.PI / 4, rotationX: Math.atan(1 / Math.sqrt(2)) },
  plan: { x: 0, y: linearDistance, z: 0, rotationY: 0, rotationX: -Math.PI / 2 },
  profile: { x: linearDistance, y: 0, z: 0, rotationY: Math.PI / 2, rotationX: 0 },
  front: { x: 0, y: 0, z: linearDistance, rotationY: 0, rotationX: 0 }
} as const

// Animation durations in milliseconds
export const ANIMATION_DURATIONS = {
  CAMERA: 1200,
  RECLINE: 1000,
  EXPLOSION: 800,
  SYNC_DELAY: 600,
  BLOCK_SPEED: 0.20, // Speed of unencrypted block animation
  SCREENSHOT_RISE: 800, // Duration for ScreenshotBoys to rise
  SCREENSHOT_STAGGER: 50, // Stagger delay per unit distance
  SCREENSHOT_NOISE: 200 // Random noise added to stagger delay (+/- this value)
} as const

// Lighting configuration
export const LIGHTING = {
  AMBIENT_INTENSITY: 2,
  DIRECTIONAL: {
    INTENSITY: 2,
    POSITION: { x: 10, y: 10, z: 5 },
    SHADOW_MAP_SIZE: 2048
  }
} as const

// Explosion configuration
export const EXPLOSION = {
  FACTOR: 2,
  VISIBILITY_THRESHOLD: 0.50,
  POSITIONS: {
    ENCLOSURE_Z: 4,
    DATA_LAYER_Z: 0,
    GRID_GROUP_Z: -0.5,
    ENCLOSURE_BACK_Z: -4,
    CHROME_OFFSET: -0.2 - 1
  },
  TENSION_THICKNESSES: {
    ENCLOSURE: 0.4
  },
  TENSION_POSITIONS: {
    ENCLOSURE_Z: 0.2,
    DATA_LAYER_Z: 0,
    GRID_GROUP_Z: -0.5,
    ENCLOSURE_BACK_Z: -0.2,
    CHROME_OFFSET: -0.2
  },
  NORMAL_POSITIONS: {
    ENCLOSURE_Z: -0.05,
    DATA_LAYER_Z: 1,
    GRID_GROUP_Z: -0.05,
    ENCLOSURE_BACK_Z: -0.05,
    CHROME_OFFSET: -0.1
  }
} as const

// CounterBoy positioning
export const COUNTERBOY_POSITIONS = {
  LEFT: [0, 0, 0] as const,
  RIGHT: [9, 0, 0] as const
} as const

// Data layer configuration
export const DATA_LAYER = {
  GRID_LINES: {
    HORIZONTAL: 5,
    VERTICAL: 4
  },
  BUTTON_ORIGIN: { i: 3, j: 1 },
  BUTTON_DESTINATION: { i: 3, j: 2 }
} as const

// Rendering configuration
export const RENDERING = {
  CAMERA: {
    NEAR: 0.1,
    FAR: 1000
  },
  PIXEL_RATIO_MAX: 2,
  DISPLAY_TEXTURE_FACE_INDEX: 2,
  FONT_LOAD_DELAY: 10
} as const

// UI positioning and styling
export const UI_STYLES = {
  CONTAINER: {
    POSITION: "fixed" as const,
    TOP: 0,
    RIGHT: 0,
    WIDTH: "800px",
    HEIGHT: "800px",
    Z_INDEX: 1
  },
  CONTROLS: {
    POSITION: "absolute" as const,
    BOTTOM: -90,
    RIGHT: 10,
    Z_INDEX: 10,
    GAP: "8px"
  },
  BUTTON: {
    PADDING: "8px 12px",
    BORDER: "1px solid #ccc",
    BORDER_RADIUS: "4px",
    CURSOR: "pointer" as const,
    MARGIN_TOP: "4px"
  },
  COLORS: {
    PRIMARY: "#0066cc",
    PRIMARY_TEXT: "#ffffff",
    DEFAULT: "#ffffff",
    DEFAULT_TEXT: "#000000",
    EXPLODE: "#cc6600",
    RECLINE: "#9c27b0",
    DISABLED_OPACITY: 0.6
  }
} as const

// External URLs
export const EXTERNAL_URLS = {
  HELVETICA_FONT: "https://threejs.org/examples/fonts/helvetiker_regular.typeface.json"
} as const

// Text content
export const TEXT_CONTENT = {
  SAMPLE_TEXT: "aa"
} as const
