# Babylon.js WebXR Reference for Coding Agents

_Babylon.js is a full-featured 3D engine with first-class WebXR support. Load it from CDN — no build step required._

## CDN Setup (No Build Step)

```html
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<!-- Optional: physics, loaders, GUI -->
<script src="https://cdn.babylonjs.com/cannon.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
```

## Core Setup

```javascript
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
});

const scene = new BABYLON.Scene(engine);

// Required resize handler
window.addEventListener("resize", () => engine.resize());

// Render loop — put your per-frame logic in scene.onBeforeRenderObservable
engine.runRenderLoop(() => scene.render());
```

### Minimal Scene with Lighting

```javascript
// Camera (required even in VR — sets the non-XR fallback view)
const camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 1.7, -5), scene);
camera.setTarget(BABYLON.Vector3.Zero());
camera.attachControl(canvas, true);

// Lights
const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene);
ambient.intensity = 0.4;

const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-1, -2, -1), scene);
sun.position = new BABYLON.Vector3(5, 10, 5);
sun.intensity = 0.8;
```

---

## VR Mode

```javascript
// createDefaultXRExperienceAsync is async — always await it
const xrHelper = await scene.createDefaultXRExperienceAsync({
  floorMeshes: [ground], // meshes user can teleport onto
  disableTeleportation: false, // set true to disable built-in teleport
});

// Access the base XR session
const sessionManager = xrHelper.baseExperience.sessionManager;

// Check if currently in XR
if (xrHelper.baseExperience.state === BABYLON.WebXRState.IN_XR) {
  console.log("In VR");
}

// React to entering/leaving XR
xrHelper.baseExperience.onStateChangedObservable.add((state) => {
  if (state === BABYLON.WebXRState.IN_XR) {
    // User entered VR — hide 2D UI, etc.
  }
  if (state === BABYLON.WebXRState.NOT_IN_XR) {
    // User exited VR
  }
});
```

### VR Button

`createDefaultXRExperienceAsync` adds the "Enter VR" button automatically. To add it manually:

```javascript
const vrButton = BABYLON.WebXRDefaultExperience.CreateAsync(scene, {
  uiOptions: { sessionMode: "immersive-vr" },
});
```

---

## AR Mode (Passthrough)

AR mode requires HTTPS. The Quest Browser and Chrome on Android support it. Safari/Vision Pro does not yet support AR passthrough via WebXR.

```javascript
const xrHelper = await scene.createDefaultXRExperienceAsync({
  uiOptions: {
    sessionMode: "immersive-ar",
    referenceSpaceType: "local-floor",
  },
  optionalFeatures: true, // enables hit-test, anchors if supported
});
```

### Hit Testing (Tap to Place)

```javascript
const hitTest = xrHelper.featuresManager.enableFeature(BABYLON.WebXRHitTest, "latest");

// Reusable indicator mesh (a thin ring)
const indicator = BABYLON.MeshBuilder.CreateTorus(
  "indicator",
  {
    diameter: 0.3,
    thickness: 0.01,
    tessellation: 32,
  },
  scene
);
indicator.isPickable = false;

hitTest.onHitTestResultObservable.add((results) => {
  if (results.length > 0) {
    indicator.isVisible = true;
    results[0].transformationMatrix.decompose(undefined, indicator.rotationQuaternion, indicator.position);
  } else {
    indicator.isVisible = false;
  }
});
```

### Anchors (Persist Placed Objects)

```javascript
const anchors = xrHelper.featuresManager.enableFeature(BABYLON.WebXRAnchorSystem, "latest");

// Place an object anchored to a real-world surface
async function placeAnchor(hitTestResult) {
  const anchor = await anchors.addAnchorPointUsingHitTestResultAsync(hitTestResult);
  const mesh = BABYLON.MeshBuilder.CreateSphere("orb", { diameter: 0.15 }, scene);
  anchor.attachedNode = mesh; // mesh follows the anchor
}
```

### Plane Detection

```javascript
const planes = xrHelper.featuresManager.enableFeature(BABYLON.WebXRPlaneDetector, "latest");

planes.onPlaneAddedObservable.add((plane) => {
  // plane.xrPlane.polygon — array of DOMPointReadOnly vertices
  // plane.mesh — auto-generated Babylon mesh for the detected plane
  plane.mesh.material = planeMaterial;
});
```

---

## Generative Art Patterns

### Particle System (Billboarded Sprites)

```javascript
const particles = new BABYLON.ParticleSystem("stars", 3000, scene);

// Texture — use a built-in or a canvas texture
particles.particleTexture = new BABYLON.Texture("https://playground.babylonjs.com/textures/flare.png", scene);

particles.emitter = new BABYLON.Vector3(0, 1, 0); // world position
particles.minEmitBox = new BABYLON.Vector3(-5, -5, -5);
particles.maxEmitBox = new BABYLON.Vector3(5, 5, 5);

particles.color1 = new BABYLON.Color4(0.3, 0.8, 1, 1);
particles.color2 = new BABYLON.Color4(1, 0.3, 0.8, 0.8);
particles.colorDead = new BABYLON.Color4(0, 0, 0, 0);

particles.minSize = 0.02;
particles.maxSize = 0.08;
particles.minLifeTime = 2;
particles.maxLifeTime = 6;
particles.emitRate = 200;
particles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
particles.gravity = new BABYLON.Vector3(0, -0.1, 0);
particles.minAngularSpeed = -Math.PI;
particles.maxAngularSpeed = Math.PI;

particles.start();
```

### Solid Particle System (Performant Many-Mesh)

Use `SolidParticleSystem` when you need 3D geometry (not billboards) for thousands of instances:

```javascript
const sps = new BABYLON.SolidParticleSystem("sps", scene);
const sphere = BABYLON.MeshBuilder.CreateSphere("tmp", { diameter: 0.1 }, scene);
sps.addShape(sphere, 500); // 500 sphere instances
sphere.dispose();

const mesh = sps.buildMesh();

// Position particles on init
sps.initParticles = () => {
  for (let i = 0; i < sps.nbParticles; i++) {
    const p = sps.particles[i];
    p.position.x = (Math.random() - 0.5) * 10;
    p.position.y = (Math.random() - 0.5) * 10;
    p.position.z = (Math.random() - 0.5) * 10;
    p.color = new BABYLON.Color4(Math.random(), Math.random(), Math.random(), 1);
  }
};

sps.initParticles();
sps.setParticles();

// Animate each frame
scene.onBeforeRenderObservable.add(() => {
  const t = performance.now() / 1000;
  for (let i = 0; i < sps.nbParticles; i++) {
    const p = sps.particles[i];
    p.rotation.y += 0.01;
    p.position.y += Math.sin(t + i * 0.1) * 0.001;
  }
  sps.setParticles();
});
```

### Procedural Geometry

```javascript
// Primitives via MeshBuilder
const box = BABYLON.MeshBuilder.CreateBox("box", { size: 1 }, scene);
const sphere = BABYLON.MeshBuilder.CreateSphere("s", { diameter: 1, segments: 32 }, scene);
const torus = BABYLON.MeshBuilder.CreateTorus("t", { diameter: 2, thickness: 0.3 }, scene);
const ribbon = BABYLON.MeshBuilder.CreateRibbon("r", { pathArray: paths }, scene);
const tube = BABYLON.MeshBuilder.CreateTube("tube", { path: points, radius: 0.1 }, scene);

// Custom vertex data
const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const indices = new Uint32Array([0, 1, 2]);
const normals = [];
const vertexData = new BABYLON.VertexData();
vertexData.positions = positions;
vertexData.indices = indices;
BABYLON.VertexData.ComputeNormals(positions, indices, normals);
vertexData.normals = normals;
const customMesh = new BABYLON.Mesh("custom", scene);
vertexData.applyToMesh(customMesh);
```

### Custom GLSL Shaders

```javascript
BABYLON.Effect.ShadersStore["colorCycleVertexShader"] = `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 worldViewProjection;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

BABYLON.Effect.ShadersStore["colorCycleFragmentShader"] = `
  precision highp float;
  varying vec2 vUv;
  uniform float time;
  uniform float hueShift;
  vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
    float m = l - c / 2.0;
    vec3 rgb;
    if (h < 60.0)       rgb = vec3(c, x, 0.0);
    else if (h < 120.0) rgb = vec3(x, c, 0.0);
    else if (h < 180.0) rgb = vec3(0.0, c, x);
    else if (h < 240.0) rgb = vec3(0.0, x, c);
    else if (h < 300.0) rgb = vec3(x, 0.0, c);
    else                rgb = vec3(c, 0.0, x);
    return rgb + m;
  }
  void main() {
    float hue = mod(hueShift + vUv.x * 120.0 + time * 30.0, 360.0);
    vec3 color = hsl2rgb(hue, 0.8, 0.5 + sin(time + vUv.y * 6.28) * 0.15);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const shaderMat = new BABYLON.ShaderMaterial("colorCycle", scene, "colorCycle", {
  attributes: ["position", "uv"],
  uniforms: ["worldViewProjection", "time", "hueShift"],
});
shaderMat.setFloat("hueShift", 0);

// Update uniforms each frame
const startTime = performance.now();
scene.onBeforeRenderObservable.add(() => {
  shaderMat.setFloat("time", (performance.now() - startTime) / 1000);
});
```

---

## Controller & Hand Tracking

### Motion Controllers

```javascript
const xrInput = xrHelper.input;

xrInput.onControllerAddedObservable.add((controller) => {
  controller.onMotionControllerInitObservable.add((motionController) => {
    const triggerComponent = motionController.getComponent(BABYLON.WebXRControllerComponent.TRIGGER_TYPE);
    if (triggerComponent) {
      triggerComponent.onButtonStateChangedObservable.add((component) => {
        if (component.pressed) {
          console.log("Trigger pressed on", motionController.handedness);
        }
      });
    }

    // Controller mesh position/rotation
    const grip = controller.grip; // the physical grip space
    // grip.position, grip.rotationQuaternion update every frame
  });
});
```

### Hand Tracking

```javascript
const handTracking = xrHelper.featuresManager.enableFeature(BABYLON.WebXRHandTracking, "latest", { xrInput: xrHelper.input });

handTracking.onHandAddedObservable.add((hand) => {
  // Get index fingertip position every frame
  scene.onBeforeRenderObservable.add(() => {
    const tip = hand.getJointMesh(BABYLON.WebXRHandJoint.INDEX_FINGER_TIP);
    if (tip) {
      // tip.position is the world-space fingertip position
    }
  });
});
```

---

## Materials & PBR

```javascript
// Standard PBR material
const pbr = new BABYLON.PBRMaterial("pbr", scene);
pbr.albedoColor = new BABYLON.Color3(0.2, 0.6, 1.0);
pbr.metallic = 0.8;
pbr.roughness = 0.2;

// Emissive glow
pbr.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.9);
pbr.emissiveIntensity = 1.5;

// Glass
const glass = new BABYLON.PBRMaterial("glass", scene);
glass.alpha = 0.3;
glass.metallic = 0;
glass.roughness = 0;
glass.subSurface.isRefractionEnabled = true;
glass.subSurface.refractionIntensity = 0.8;

// Unlit (good for AR overlays — no lighting calculation)
const unlit = new BABYLON.StandardMaterial("unlit", scene);
unlit.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
unlit.disableLighting = true;
```

---

## Performance in VR

- Target **72 fps on Quest** — keep draw calls under ~100 per frame
- Use `mesh.freezeWorldMatrix()` for any mesh that never moves
- Use `scene.freezeMaterials()` after all materials are set up
- Prefer `SolidParticleSystem` over individual meshes for 100+ repeated objects
- Use `BABYLON.InstancedMesh` for identical geometry:

```javascript
const source = BABYLON.MeshBuilder.CreateSphere("source", { diameter: 0.1 }, scene);
source.isVisible = false;

for (let i = 0; i < 200; i++) {
  const instance = source.createInstance(`orb_${i}`);
  instance.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
}
```

---

## Common Gotchas

- **`createDefaultXRExperienceAsync` is async** — always `await` it or chain `.then()`. Calling it without await silently skips XR setup.
- **AR requires HTTPS** — `localhost` works for dev; plain `http://` will fail on device.
- **Quest AR setting** — `immersive-ar` may require "WebXR Passthrough" enabled in Quest Browser settings (about://flags).
- **Apple Vision Pro** — `immersive-vr` works via visionOS Safari WebXR; AR passthrough is not yet available.
- **Always call `engine.resize()`** on window resize AND when XR display geometry changes.
- **`rotationQuaternion` vs `rotation`** — once Babylon sets `rotationQuaternion` on a mesh (e.g. via XR tracking), `rotation` is ignored. Use `rotationQuaternion` consistently.
- **Dispose properly** — call `scene.dispose()` and `engine.dispose()` on React component unmount to prevent memory leaks.

---

## Real-World Example 1: VR Generative Art — Particle Galaxy

A floating galaxy of 2000 particles with a custom-shader core sphere, navigable in VR. Session data stored in Fireproof.

```javascript
import React, { useEffect, useRef } from "react";
import { useFireproof } from "use-fireproof";

// ── Pure Babylon functions (no React, no Fireproof) ────────────────────────

function buildScene(canvas) {
  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0.02, 1);

  const camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 1.7, -8), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  new BABYLON.HemisphericLight("amb", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.1;

  window.addEventListener("resize", () => engine.resize());
  engine.runRenderLoop(() => scene.render());
  return { engine, scene };
}

function buildGalaxy(scene) {
  const galaxy = new BABYLON.ParticleSystem("galaxy", 2000, scene);
  galaxy.particleTexture = new BABYLON.Texture("https://playground.babylonjs.com/textures/flare.png", scene);
  galaxy.emitter = new BABYLON.Vector3(0, 0, 0);
  galaxy.minEmitBox = new BABYLON.Vector3(-6, -0.5, -6);
  galaxy.maxEmitBox = new BABYLON.Vector3(6, 0.5, 6);
  galaxy.color1 = new BABYLON.Color4(0.4, 0.7, 1, 1);
  galaxy.color2 = new BABYLON.Color4(1, 0.4, 0.8, 0.6);
  galaxy.colorDead = new BABYLON.Color4(0, 0, 0, 0);
  galaxy.minSize = 0.03;
  galaxy.maxSize = 0.12;
  galaxy.minLifeTime = 4;
  galaxy.maxLifeTime = 10;
  galaxy.emitRate = 80;
  galaxy.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  galaxy.gravity = new BABYLON.Vector3(0, 0, 0);
  galaxy.minAngularSpeed = -0.5;
  galaxy.maxAngularSpeed = 0.5;
  galaxy.start();
  return galaxy;
}

function buildCoreShader(scene) {
  BABYLON.Effect.ShadersStore["galaxyCoreVertexShader"] = `
    precision highp float;
    attribute vec3 position; attribute vec2 uv;
    uniform mat4 worldViewProjection;
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = worldViewProjection * vec4(position, 1.0); }
  `;
  BABYLON.Effect.ShadersStore["galaxyCoreFragmentShader"] = `
    precision highp float;
    varying vec2 vUv; uniform float time;
    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p);
      float glow = 0.05 / max(r, 0.01);
      float hue = mod(atan(p.y, p.x) / 6.283 + time * 0.1, 1.0) * 360.0;
      float c = mod(hue / 60.0, 2.0) - 1.0;
      vec3 col = vec3(
        step(hue, 60.0) * (1.0 - abs(c)) + step(300.0, hue),
        step(60.0, hue) * step(hue, 180.0) * (1.0 - abs(mod(hue / 60.0, 2.0) - 1.0)),
        step(180.0, hue) * step(hue, 300.0) * (1.0 - abs(mod(hue / 60.0, 2.0) - 1.0))
      );
      gl_FragColor = vec4(col * glow * 2.0, min(glow, 1.0));
    }
  `;
  const mat = new BABYLON.ShaderMaterial("galaxyCore", scene, "galaxyCore", {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "time"],
  });
  mat.backFaceCulling = false;
  mat.alphaMode = BABYLON.Constants.ALPHA_ADD;

  const sphere = BABYLON.MeshBuilder.CreateSphere("core", { diameter: 1.5, segments: 32 }, scene);
  sphere.material = mat;

  const t0 = performance.now();
  scene.onBeforeRenderObservable.add(() => {
    mat.setFloat("time", (performance.now() - t0) / 1000);
  });
  return sphere;
}

async function enableVR(scene) {
  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene);
  ground.isVisible = false;
  return scene.createDefaultXRExperienceAsync({ floorMeshes: [ground] });
}

// ── React container component ──────────────────────────────────────────────

export default function App() {
  const { database, useLiveQuery } = useFireproof("galaxy-sessions");
  const canvasRef = useRef(null);
  const { docs: sessions } = useLiveQuery("type", { key: "session" });

  useEffect(() => {
    if (!canvasRef.current) return;
    const { engine, scene } = buildScene(canvasRef.current);
    buildGalaxy(scene);
    buildCoreShader(scene);
    enableVR(scene).then(() => {
      database.put({ type: "session", startedAt: Date.now() });
    });
    return () => {
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 text-white text-sm opacity-70">Sessions: {sessions.length}</div>
    </div>
  );
}
```

---

## Real-World Example 2: AR Passthrough — Tap to Place Glowing Orbs

Tap a real-world surface to plant a pulsing orb anchored in place. Orb positions are stored in Fireproof so they survive page reload.

```javascript
import React, { useEffect, useRef, useState } from "react";
import { useFireproof } from "use-fireproof";

// ── Pure Babylon functions ─────────────────────────────────────────────────

function buildARScene(canvas) {
  const engine = new BABYLON.Engine(canvas, true, { alpha: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // transparent for AR

  const camera = new BABYLON.FreeCamera("cam", new BABYLON.Vector3(0, 1.6, 0), scene);
  camera.minZ = 0.01;

  window.addEventListener("resize", () => engine.resize());
  engine.runRenderLoop(() => scene.render());
  return { engine, scene };
}

function makeOrbMaterial(scene) {
  BABYLON.Effect.ShadersStore["orbVertexShader"] = `
    precision highp float;
    attribute vec3 position; attribute vec2 uv;
    uniform mat4 worldViewProjection;
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = worldViewProjection * vec4(position, 1.0); }
  `;
  BABYLON.Effect.ShadersStore["orbFragmentShader"] = `
    precision highp float;
    varying vec2 vUv; uniform float time; uniform vec3 baseColor;
    void main() {
      vec2 p = vUv - 0.5;
      float r = length(p);
      float rim = smoothstep(0.5, 0.35, r) - smoothstep(0.35, 0.2, r);
      float core = smoothstep(0.2, 0.0, r);
      float pulse = 0.7 + 0.3 * sin(time * 3.0);
      vec3 col = baseColor * (rim * 0.6 + core * 2.0) * pulse;
      gl_FragColor = vec4(col, (rim + core) * 0.9);
    }
  `;
  const mat = new BABYLON.ShaderMaterial("orb", scene, "orb", {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "time", "baseColor"],
  });
  mat.backFaceCulling = false;
  mat.alphaMode = BABYLON.Constants.ALPHA_ADD;
  return mat;
}

function spawnOrb(scene, position, orbMat) {
  const mesh = BABYLON.MeshBuilder.CreateSphere("orb", { diameter: 0.15, segments: 16 }, scene);
  mesh.position.copyFrom(position);
  const mat = orbMat.clone("orbInst_" + Date.now());
  const hue = Math.random();
  mat.setVector3("baseColor", new BABYLON.Vector3(hue, 0.5, 1 - hue));
  mesh.material = mat;
  return mesh;
}

async function enableAR(scene, onPlace) {
  const xrHelper = await scene.createDefaultXRExperienceAsync({
    uiOptions: { sessionMode: "immersive-ar", referenceSpaceType: "local-floor" },
    optionalFeatures: true,
  });

  const hitTest = xrHelper.featuresManager.enableFeature(BABYLON.WebXRHitTest, "latest");

  // Indicator ring
  const indicator = BABYLON.MeshBuilder.CreateTorus("indicator", { diameter: 0.25, thickness: 0.008, tessellation: 32 }, scene);
  const indicatorMat = new BABYLON.StandardMaterial("indMat", scene);
  indicatorMat.emissiveColor = new BABYLON.Color3(0.4, 1, 0.8);
  indicatorMat.disableLighting = true;
  indicator.material = indicatorMat;
  indicator.isVisible = false;

  let latestHit = null;
  hitTest.onHitTestResultObservable.add((results) => {
    if (results.length > 0) {
      indicator.isVisible = true;
      latestHit = results[0];
      results[0].transformationMatrix.decompose(
        undefined,
        indicator.rotationQuaternion || (indicator.rotationQuaternion = new BABYLON.Quaternion()),
        indicator.position
      );
    } else {
      indicator.isVisible = false;
      latestHit = null;
    }
  });

  // Tap to place
  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN && latestHit) {
      const pos = indicator.position.clone();
      onPlace(pos);
    }
  });

  return xrHelper;
}

// ── React container ────────────────────────────────────────────────────────

export default function App() {
  const { database, useLiveQuery } = useFireproof("ar-orbs");
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const orbMatRef = useRef(null);
  const [orbCount, setOrbCount] = useState(0);
  const { docs: savedOrbs } = useLiveQuery("type", { key: "orb" });

  useEffect(() => {
    if (!canvasRef.current) return;
    const { engine, scene } = buildARScene(canvasRef.current);
    sceneRef.current = scene;
    orbMatRef.current = makeOrbMaterial(scene);

    const t0 = performance.now();
    scene.onBeforeRenderObservable.add(() => {
      const t = (performance.now() - t0) / 1000;
      scene.meshes.forEach((m) => {
        if (m.material?.getClassName?.() === "ShaderMaterial" && m.name.startsWith("orb")) {
          m.material.setFloat("time", t);
        }
      });
    });

    enableAR(scene, async (pos) => {
      spawnOrb(scene, pos, orbMatRef.current);
      setOrbCount((n) => n + 1);
      await database.put({ type: "orb", x: pos.x, y: pos.y, z: pos.z, ts: Date.now() });
    });

    return () => {
      scene.dispose();
      engine.dispose();
    };
  }, []);

  // Restore saved orbs when scene is ready
  useEffect(() => {
    if (!sceneRef.current || !orbMatRef.current || savedOrbs.length === 0) return;
    savedOrbs.forEach((doc) => {
      spawnOrb(sceneRef.current, new BABYLON.Vector3(doc.x, doc.y, doc.z), orbMatRef.current);
    });
  }, [savedOrbs.length]);

  return (
    <div className="relative w-full h-screen">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 bg-black/40 text-white px-3 py-2 rounded-lg text-sm">
        Tap a surface to place an orb · {orbCount} placed this session
      </div>
    </div>
  );
}
```
