# Three.js API

_Essential classes, methods, and patterns for Three.js development_

## Core Setup

### Scene Graph Hierarchy

```javascript
import * as THREE from 'three';

// Core trinity
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Everything is an Object3D
scene.add(mesh); // Mesh extends Object3D
group.add(light); // Light extends Object3D
parent.add(child); // Hierarchical transforms
```

## Essential Classes

### Cameras

```javascript
// Perspective (most common)
const camera = new THREE.PerspectiveCamera(
  75, // field of view
  aspect, // aspect ratio
  0.1, // near plane
  1000 // far plane
);

// Orthographic (2D/technical)
const camera = new THREE.OrthographicCamera(left, right, top, bottom, near, far);

// Camera controls
camera.position.set(x, y, z);
camera.lookAt(target);
camera.updateProjectionMatrix(); // After changing properties
```

### Geometries

```javascript
// Primitive geometries
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.SphereGeometry(1, 32, 32);
const plane = new THREE.PlaneGeometry(1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 2, 32);

// Custom geometry
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
geometry.setIndex(indices);
```

### Materials

```javascript
// Basic materials
const basic = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const lambert = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
const phong = new THREE.MeshPhongMaterial({ color: 0x0000ff });

// PBR materials (most realistic)
const standard = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 0.5,
  roughness: 0.5,
  map: texture,
  normalMap: normalTexture,
  envMap: environmentTexture,
});

const physical = new THREE.MeshPhysicalMaterial({
  ...standard,
  clearcoat: 1.0,
  transmission: 0.5,
  thickness: 1.0,
});
```

### Lights

```javascript
// Ambient (global illumination)
const ambient = new THREE.AmbientLight(0xffffff, 0.6);

// Directional (sun-like)
const directional = new THREE.DirectionalLight(0xffffff, 1);
directional.position.set(1, 1, 1);
directional.castShadow = true;

// Point (bulb-like)
const point = new THREE.PointLight(0xffffff, 1, 100);
point.position.set(0, 10, 0);

// Spot (flashlight-like)
const spot = new THREE.SpotLight(0xffffff, 1, 100, Math.PI / 4);
```

### Textures

```javascript
// Texture loading
const loader = new THREE.TextureLoader();
const texture = loader.load('path/to/texture.jpg');

// Texture properties
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(2, 2);
texture.flipY = false;

// HDR textures
const hdrLoader = new THREE.HDRLoader();
const envMap = hdrLoader.load('environment.hdr');
envMap.mapping = THREE.EquirectangularReflectionMapping;
```

## Object3D Fundamentals

### Transform Properties

```javascript
// Position
object.position.set(x, y, z);
object.position.copy(otherObject.position);
object.translateX(distance);

// Rotation (Euler angles)
object.rotation.set(x, y, z);
object.rotation.y = Math.PI / 4;
object.rotateY(Math.PI / 4);

// Scale
object.scale.set(2, 2, 2);
object.scale.multiplyScalar(0.5);

// Quaternion (preferred for animations)
object.quaternion.setFromAxisAngle(axis, angle);
object.lookAt(target);
```

### Hierarchy Operations

```javascript
// Adding/removing children
parent.add(child);
parent.remove(child);
scene.add(mesh, light, helper);

// Traversal
object.traverse((child) => {
  if (child.isMesh) {
    child.material.wireframe = true;
  }
});

// Finding objects
const found = scene.getObjectByName('myObject');
const found = scene.getObjectById(id);
```

## Math Utilities

### Vectors

```javascript
// Vector3 (most common)
const v = new THREE.Vector3(1, 2, 3);
v.add(otherVector);
v.multiplyScalar(2);
v.normalize();
v.cross(otherVector);
v.dot(otherVector);
v.distanceTo(otherVector);

// Vector2 (UV coordinates)
const uv = new THREE.Vector2(0.5, 0.5);
```

### Matrices

```javascript
// Matrix4 (transformations)
const matrix = new THREE.Matrix4();
matrix.makeTranslation(x, y, z);
matrix.makeRotationY(angle);
matrix.makeScale(x, y, z);
matrix.multiply(otherMatrix);

// Apply to object
object.applyMatrix4(matrix);
```

### Colors

```javascript
const color = new THREE.Color();
color.set(0xff0000); // hex
color.setRGB(1, 0, 0); // RGB values 0-1
color.setHSL(0, 1, 0.5); // HSL values
color.lerp(targetColor, 0.1); // interpolation
```

## Raycasting (Mouse Interaction)

```javascript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
  // Normalize mouse coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Cast ray from camera through mouse position
  raycaster.setFromCamera(mouse, camera);

  // Find intersections
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const object = intersects[0].object;
    const point = intersects[0].point;
    // Handle intersection
  }
}
```

## Animation System

### Animation Mixer

```javascript
// For GLTF animations
const mixer = new THREE.AnimationMixer(model);
const action = mixer.clipAction(animationClip);
action.play();

// Update in render loop
function animate() {
  const delta = clock.getDelta();
  mixer.update(delta);
  renderer.render(scene, camera);
}
```

### Manual Animation

```javascript
const clock = new THREE.Clock();

function animate() {
  const time = clock.getElapsedTime();

  // Rotate object
  mesh.rotation.y = time * 0.5;

  // Oscillate position
  mesh.position.y = Math.sin(time) * 2;

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
```

## Loading Assets

### GLTF Models (Recommended)

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('model.gltf', (gltf) => {
  const model = gltf.scene;
  scene.add(model);

  // Access animations
  if (gltf.animations.length > 0) {
    const mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      mixer.clipAction(clip).play();
    });
  }
});
```

### Other Loaders

```javascript
// OBJ files
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// FBX files
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Textures
const textureLoader = new THREE.TextureLoader();
const cubeLoader = new THREE.CubeTextureLoader();
```

## Renderer Configuration

### Basic Setup

```javascript
const renderer = new THREE.WebGLRenderer({
  canvas: canvasElement, // Existing canvas
  antialias: true, // Smooth edges
  alpha: true, // Transparent background
  powerPreference: 'high-performance',
});

renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 1);
```

### Advanced Settings

```javascript
// Shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Tone mapping (HDR)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Color space
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Performance
renderer.setAnimationLoop(animate); // Preferred over requestAnimationFrame
```

## Common Patterns

### Responsive Canvas

```javascript
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);
```

### Performance Optimization

```javascript
// Frustum culling
object.frustumCulled = true;

// LOD (Level of Detail)
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(lowDetailMesh, 100);

// Instancing for many objects
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
const matrix = new THREE.Matrix4();
for (let i = 0; i < count; i++) {
  matrix.setPosition(x, y, z);
  instancedMesh.setMatrixAt(i, matrix);
}
instancedMesh.instanceMatrix.needsUpdate = true;
```

### Dispose Pattern (Memory Management)

```javascript
// Clean up resources
geometry.dispose();
material.dispose();
texture.dispose();
renderer.dispose();

// Traverse and dispose
object.traverse((child) => {
  if (child.geometry) child.geometry.dispose();
  if (child.material) {
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose());
    } else {
      child.material.dispose();
    }
  }
});
```

## Buffer Attributes (Advanced)

### Custom Geometry Data

```javascript
const geometry = new THREE.BufferGeometry();

// Vertex positions (required)
const positions = new Float32Array([
  -1,
  -1,
  0, // vertex 0
  1,
  -1,
  0, // vertex 1
  0,
  1,
  0, // vertex 2
]);
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

// Vertex colors
const colors = new Float32Array([
  1,
  0,
  0, // red
  0,
  1,
  0, // green
  0,
  0,
  1, // blue
]);
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Custom attributes for shaders
const customData = new Float32Array(vertexCount);
geometry.setAttribute('customAttribute', new THREE.BufferAttribute(customData, 1));
```

## Events and Interaction

### Event Dispatcher

```javascript
// Custom events
const emitter = new THREE.EventDispatcher();

emitter.addEventListener('customEvent', (event) => {
  console.log('Event fired:', event.data);
});

emitter.dispatchEvent({ type: 'customEvent', data: 'hello' });
```

### Built-in Events

```javascript
// Loading progress
loader.onProgress = (progress) => {
  console.log(`Loading: ${(progress.loaded / progress.total) * 100}%`);
};

// Window resize
window.addEventListener('resize', onWindowResize);

// Mouse events
canvas.addEventListener('click', onMouseClick);
canvas.addEventListener('mousemove', onMouseMove);
```

## Constants Reference

### Material Constants

```javascript
// Blending modes
THREE.NormalBlending;
THREE.AdditiveBlending;
THREE.SubtractiveBlending;
THREE.MultiplyBlending;

// Culling
THREE.FrontSide;
THREE.BackSide;
THREE.DoubleSide;

// Depth modes
THREE.NeverDepth;
THREE.AlwaysDepth;
THREE.LessDepth;
THREE.LessEqualDepth;
```

### Texture Constants

```javascript
// Wrapping
THREE.RepeatWrapping;
THREE.ClampToEdgeWrapping;
THREE.MirroredRepeatWrapping;

// Filtering
THREE.NearestFilter;
THREE.LinearFilter;
THREE.NearestMipmapNearestFilter;
THREE.LinearMipmapLinearFilter;

// Formats
THREE.RGBAFormat;
THREE.RGBFormat;
THREE.RedFormat;
```

### Rendering Constants

```javascript
// Shadow types
THREE.BasicShadowMap;
THREE.PCFShadowMap;
THREE.PCFSoftShadowMap;
THREE.VSMShadowMap;

// Tone mapping
THREE.NoToneMapping;
THREE.LinearToneMapping;
THREE.ReinhardToneMapping;
THREE.CineonToneMapping;
THREE.ACESFilmicToneMapping;
```

## Common Gotchas

### Matrix Updates

```javascript
// Force matrix update after transform changes
object.updateMatrix();
object.updateMatrixWorld();

// Automatic updates (default: true)
object.matrixAutoUpdate = false; // Manual control
```

### Geometry Modifications

```javascript
// After modifying geometry attributes
geometry.attributes.position.needsUpdate = true;
geometry.computeBoundingSphere();
geometry.computeBoundingBox();
```

### Material Updates

```javascript
// After changing material properties
material.needsUpdate = true;

// Texture updates
texture.needsUpdate = true;
```

## Performance Tips

### Efficient Rendering

```javascript
// Batch similar objects
const geometry = new THREE.InstancedBufferGeometry();
const material = new THREE.MeshStandardMaterial();
const instancedMesh = new THREE.InstancedMesh(geometry, material, 1000);

// Freeze objects that don't move
object.matrixAutoUpdate = false;
object.updateMatrix();

// Use appropriate geometry detail
const sphere = new THREE.SphereGeometry(1, 8, 6); // Low poly
const sphere = new THREE.SphereGeometry(1, 32, 32); // High poly
```

### Memory Management

```javascript
// Remove from scene
scene.remove(object);

// Dispose resources
object.traverse((child) => {
  if (child.geometry) child.geometry.dispose();
  if (child.material) child.material.dispose();
});

// Clear references
object = null;
```

## Quick Reference

### Essential Imports

```javascript
// Core
import * as THREE from 'three';

// Controls
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';

// Loaders
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// Post-processing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';

// Helpers
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
```

### Minimal Working Example

```javascript
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

function animate() {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
```

---

# Three.js Condensed Guide: Most Impressive Examples

_A curated collection of Three.js's most visually stunning and technically advanced examples_

## Quick Start Template

```javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Basic setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
camera.position.set(5, 5, 5);
controls.update();

// Animation loop
function animate() {
  controls.update();
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);
```

## 1. Spectacular Visual Effects

### Galaxy Generator (WebGPU + TSL)

Creates a procedural spiral galaxy with thousands of animated particles.

```javascript
import * as THREE from 'three/webgpu';
import { color, cos, sin, time, uniform, range, vec3, PI2 } from 'three/tsl';

const material = new THREE.SpriteNodeMaterial({
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

// Procedural galaxy structure
const radiusRatio = range(0, 1);
const radius = radiusRatio.pow(1.5).mul(5);
const branches = 3;
const branchAngle = range(0, branches).floor().mul(PI2.div(branches));
const angle = branchAngle.add(time.mul(radiusRatio.oneMinus()));

const position = vec3(cos(angle), 0, sin(angle)).mul(radius);
material.positionNode = position.add(randomOffset);

// Dynamic colors
const colorInside = uniform(color('#ffa575'));
const colorOutside = uniform(color('#311599'));
material.colorNode = mix(colorInside, colorOutside, radiusRatio);

const galaxy = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, 20000);
```

### Ocean Shaders

Realistic water simulation with dynamic waves and sky reflections.

```javascript
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
const water = new Water(waterGeometry, {
  textureWidth: 512,
  textureHeight: 512,
  waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg'),
  sunDirection: new THREE.Vector3(),
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 3.7,
});

// Sky system
const sky = new Sky();
sky.scale.setScalar(10000);
const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 10;
skyUniforms['rayleigh'].value = 2;
```

### Unreal Bloom Effect

Cinematic glow and HDR post-processing.

```javascript
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5, // strength
  0.4, // radius
  0.85 // threshold
);
composer.addPass(bloomPass);

// Render with bloom
composer.render();
```

## 2. Advanced GPU Computing

### Flocking Birds (GPGPU)

GPU-accelerated boid simulation with emergent flocking behavior.

```javascript
// Position computation shader
const fragmentShaderPosition = `
uniform float time;
uniform float delta;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D(texturePosition, uv);
    vec3 position = tmpPos.xyz;
    vec3 velocity = texture2D(textureVelocity, uv).xyz;
    
    gl_FragColor = vec4(position + velocity * delta * 15.0, tmpPos.w);
}`;

// Velocity computation (separation, alignment, cohesion)
const fragmentShaderVelocity = `
uniform float separationDistance;
uniform float alignmentDistance; 
uniform float cohesionDistance;
uniform vec3 predator;

void main() {
    // Boid algorithm implementation
    // ...separation, alignment, cohesion logic
}`;
```

### Cloth Physics (WebGPU Compute)

Real-time fabric simulation using compute shaders.

```javascript
import { Fn, uniform, attribute, Loop } from 'three/tsl';

// Verlet integration in compute shader
const computeVertexForces = Fn(() => {
  const position = attribute('position');
  const velocity = attribute('velocity');

  // Spring forces, wind, gravity
  const force = uniform('wind').add(uniform('gravity'));

  // Verlet integration
  const newPosition = position.add(velocity.mul(uniform('deltaTime')));

  return newPosition;
})();

const clothMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x204080,
  roughness: 0.8,
  transmission: 0.2,
  sheen: 0.5,
});
```

## 3. Impressive 3D Scenes

### Photorealistic Car

Advanced PBR materials with interactive customization.

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

// Environment setup
scene.environment = new HDRLoader().load('textures/equirectangular/venice_sunset_1k.hdr');
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;

// Load car model
const loader = new GLTFLoader();
const gltf = await loader.loadAsync('models/gltf/ferrari.glb');

// Material customization
gltf.scene.traverse((child) => {
  if (child.isMesh && child.material.name === 'body') {
    child.material.color.setHex(bodyColor);
    child.material.metalness = 1.0;
    child.material.roughness = 0.5;
    child.material.clearcoat = 1.0;
  }
});
```

### Minecraft World Generator

Procedural voxel terrain with optimized geometry merging.

```javascript
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

function generateTerrain(width, depth) {
  const noise = new ImprovedNoise();
  const data = [];

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      // Multi-octave noise
      const height = noise.noise(x / 100, z / 100, 0) * 50 + noise.noise(x / 50, z / 50, 0) * 25;
      data.push(Math.floor(height));
    }
  }

  return data;
}

// Merge geometries for performance
const geometries = [];
// ...create individual cube geometries
const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
```

## 4. Interactive Experiences

### VR Painting

Virtual reality 3D painting with hand tracking.

```javascript
// WebXR setup
renderer.xr.enabled = true;
document.body.appendChild(VRButton.createButton(renderer));

// Hand input
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);

controller1.addEventListener('selectstart', onSelectStart);
controller1.addEventListener('selectend', onSelectEnd);

function onSelectStart(event) {
  // Start painting stroke
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    color: currentColor,
    linewidth: brushSize,
  });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
}
```

### Physics Vehicle Controller

Real-time vehicle physics with Rapier.js integration.

```javascript
import { World } from '@dimforge/rapier3d-compat';

// Physics world
const world = new World({ x: 0, y: -9.81, z: 0 });

// Vehicle setup
const vehicleDesc = world.createRigidBody({
  type: 'dynamic',
  translation: { x: 0, y: 1, z: 0 },
});

// Wheel constraints
wheels.forEach((wheel, index) => {
  const wheelJoint = world.createImpulseJoint(vehicleDesc, wheel.body, wheelConstraints[index]);
});
```

## 5. Cutting-Edge WebGPU Features

### Path Tracing

Realistic ray-traced lighting with global illumination.

```javascript
import { PathTracingRenderer } from 'three/addons/renderers/PathTracingRenderer.js';

const ptRenderer = new PathTracingRenderer(renderer);
ptRenderer.setSize(window.innerWidth, window.innerHeight);

// Progressive rendering
let sampleCount = 0;
function animate() {
  if (sampleCount < 1000) {
    ptRenderer.update();
    sampleCount++;
  }
}
```

### TSL (Three.js Shading Language)

Modern node-based shader programming.

```javascript
import { mix, noise, time, uv, vec3, sin, cos } from 'three/tsl';

// Procedural materials with TSL
const proceduralMaterial = new THREE.MeshStandardNodeMaterial();

// Animated noise texture
const noiseValue = noise(uv().mul(10).add(time.mul(0.1)));
const colorA = vec3(1, 0.5, 0.2);
const colorB = vec3(0.2, 0.5, 1);

proceduralMaterial.colorNode = mix(colorA, colorB, noiseValue);
proceduralMaterial.roughnessNode = noiseValue.mul(0.5).add(0.3);
```

## Performance Tips for Impressive Results

### Instancing for Massive Scenes

```javascript
const instancedMesh = new THREE.InstancedMesh(geometry, material, 100000);
const matrix = new THREE.Matrix4();

for (let i = 0; i < instancedMesh.count; i++) {
  matrix.setPosition(
    Math.random() * 2000 - 1000,
    Math.random() * 2000 - 1000,
    Math.random() * 2000 - 1000
  );
  instancedMesh.setMatrixAt(i, matrix);
}
```

### LOD for Complex Models

```javascript
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(mediumDetailMesh, 50);
lod.addLevel(lowDetailMesh, 200);
```

### Render Targets for Effects

```javascript
const renderTarget = new THREE.WebGLRenderTarget(1024, 1024);
renderer.setRenderTarget(renderTarget);
renderer.render(effectScene, effectCamera);
renderer.setRenderTarget(null);

// Use render target as texture
material.map = renderTarget.texture;
```

## Essential Setup for Maximum Impact

### HDR Environment

```javascript
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const hdrTexture = new HDRLoader().load('environment.hdr');
hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = hdrTexture;
scene.background = hdrTexture;
```

### Tone Mapping

```javascript
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
```

### Post-Processing Chain

```javascript
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(resolution, strength, radius, threshold));
composer.addPass(new OutputPass());
```

---

_This guide focuses on Three.js's most impressive capabilities. Each example demonstrates advanced techniques that create visually stunning results with minimal code complexity._

# Real world example

```javascript
import React, { useState, useEffect, useRef, useCallback } from "react"
import { useFireproof } from "use-fireproof"

export default function SkyGlider() {
  const { database, useLiveQuery } = useFireproof("sky-glider-scores")
  const canvasRef = useRef(null)
  const gameStateRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    glider: null,
    clouds: [],
    balloons: [],
    smokeTrail: [],
    lastSmokeTime: 0,
    score: 0,
    gameRunning: false,
    keys: {},
    velocity: { x: 0, y: 0, z: 0 },
    heading: 0, // Current heading in radians
    forwardSpeed: 0 // Speed in current heading direction
  })
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentScore, setCurrentScore] = useState(0)
  const [gameInitialized, setGameInitialized] = useState(false)

  // Live query for high scores with proper fallback
  const { docs: scoreData } = useLiveQuery("type", { key: "score" }) || { docs: [] }
  const highScores = scoreData || []

  const saveScore = useCallback(async (score) => {
    const timestamp = Date.now()
    await database.put({
      _id: `score-${timestamp}`,
      type: "score",
      value: score,
      timestamp,
      date: new Date().toISOString()
    })
  }, [database])

  const initThreeJS = useCallback(() => {
    if (!canvasRef.current || gameInitialized || !window.THREE) return

    try {
      // Scene setup
      const scene = new window.THREE.Scene()
      scene.background = new window.THREE.Color(0x70d6ff)
      scene.fog = new window.THREE.Fog(0x70d6ff, 50, 300)

      // Camera
      const camera = new window.THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
      camera.position.set(0, 10, 20)

      // Renderer
      const renderer = new window.THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = window.THREE.PCFSoftShadowMap

      // Lighting
      const ambientLight = new window.THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      const directionalLight = new window.THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(50, 100, 50)
      directionalLight.castShadow = true
      scene.add(directionalLight)

      // Triangular Glider - pointing in direction of movement
      const gliderGeometry = new window.THREE.Group()
      
      // Main triangular body (pointing forward in Z direction)
      const triangleGeometry = new window.THREE.ConeGeometry(2, 8, 3)
      const triangleMaterial = new window.THREE.MeshLambertMaterial({ color: 0xff70a6 })
      const triangle = new window.THREE.Mesh(triangleGeometry, triangleMaterial)
      triangle.rotation.x = Math.PI / 2 // Point forward in Z direction
      gliderGeometry.add(triangle)
      
      // Wings (smaller triangular fins)
      const wingGeometry = new window.THREE.ConeGeometry(1.5, 3, 3)
      const wingMaterial = new window.THREE.MeshLambertMaterial({ color: 0xff9770 })
      
      const leftWing = new window.THREE.Mesh(wingGeometry, wingMaterial)
      leftWing.rotation.x = Math.PI / 2
      leftWing.rotation.z = Math.PI / 3
      leftWing.position.set(-3, 0, -1)
      gliderGeometry.add(leftWing)
      
      const rightWing = new window.THREE.Mesh(wingGeometry, wingMaterial)
      rightWing.rotation.x = Math.PI / 2
      rightWing.rotation.z = -Math.PI / 3
      rightWing.position.set(3, 0, -1)
      gliderGeometry.add(rightWing)
      
      // Tail fin
      const tailGeometry = new window.THREE.ConeGeometry(1, 2, 3)
      const tailMaterial = new window.THREE.MeshLambertMaterial({ color: 0xffd670 })
      const tail = new window.THREE.Mesh(tailGeometry, tailMaterial)
      tail.rotation.x = -Math.PI / 2
      tail.position.z = -3
      gliderGeometry.add(tail)

      gliderGeometry.position.set(0, 10, 0)
      gliderGeometry.castShadow = true
      scene.add(gliderGeometry)

      // Create clouds (150 clouds with size range from current to 10x larger)
      const clouds = []
      for (let i = 0; i < 150; i++) {
        const cloudGroup = new window.THREE.Group()
        
        // Random scale factor from 1x to 10x
        const scaleFactor = 1 + Math.random() * 9
        
        // Number of cloud parts based on size (larger clouds have more parts)
        const numParts = Math.floor(4 + scaleFactor * 2)
        
        // Multiple spheres for cloud effect
        for (let j = 0; j < numParts; j++) {
          const baseRadius = (Math.random() * 2 + 1) * scaleFactor
          const cloudGeometry = new window.THREE.SphereGeometry(baseRadius, 8, 6)
          const cloudMaterial = new window.THREE.MeshLambertMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: Math.max(0.3, 0.8 - scaleFactor * 0.05) // Larger clouds slightly more transparent
          })
          const cloudPart = new window.THREE.Mesh(cloudGeometry, cloudMaterial)
          cloudPart.position.set(
            (Math.random() - 0.5) * 4 * scaleFactor,
            (Math.random() - 0.5) * 2 * scaleFactor,
            (Math.random() - 0.5) * 4 * scaleFactor
          )
          cloudGroup.add(cloudPart)
        }
        
        // Position clouds in a much larger area to accommodate more clouds
        cloudGroup.position.set(
          (Math.random() - 0.5) * 800, // Much wider spread
          Math.random() * 50 + 5, // Higher altitude range
          (Math.random() - 0.5) * 800  // Much deeper spread
        )
        
        clouds.push({
          mesh: cloudGroup,
          scale: scaleFactor,
          drift: { 
            x: (Math.random() - 0.5) * 0.01 * (2 - scaleFactor * 0.1), // Larger clouds drift slower
            y: Math.random() * 0.005 * (2 - scaleFactor * 0.1), 
            z: (Math.random() - 0.5) * 0.01 * (2 - scaleFactor * 0.1) 
          }
        })
        scene.add(cloudGroup)
      }

      // Create hot air balloons
      const balloons = []
      for (let i = 0; i < 6; i++) {
        const balloonGroup = new window.THREE.Group()
        
        // Balloon
        const balloonGeometry = new window.THREE.SphereGeometry(3, 12, 8)
        const colors = [0xe9ff70, 0xff70a6, 0xff9770, 0xffd670]
        const balloonMaterial = new window.THREE.MeshLambertMaterial({ 
          color: colors[Math.floor(Math.random() * colors.length)]
        })
        const balloonMesh = new window.THREE.Mesh(balloonGeometry, balloonMaterial)
        balloonGroup.add(balloonMesh)
        
        // Basket
        const basketGeometry = new window.THREE.BoxGeometry(1.5, 1, 1.5)
        const basketMaterial = new window.THREE.MeshLambertMaterial({ color: 0x8B4513 })
        const basket = new window.THREE.Mesh(basketGeometry, basketMaterial)
        basket.position.y = -4
        balloonGroup.add(basket)
        
        balloonGroup.position.set(
          (Math.random() - 0.5) * 300, // Wider spread to match cloud distribution
          Math.random() * 20 + 5,
          (Math.random() - 0.5) * 300
        )
        
        balloons.push({
          mesh: balloonGroup,
          drift: { x: (Math.random() - 0.5) * 0.01, y: Math.random() * 0.02 + 0.01, z: (Math.random() - 0.5) * 0.01 }
        })
        scene.add(balloonGroup)
      }

      // Store in ref
      gameStateRef.current = {
        ...gameStateRef.current,
        scene,
        camera,
        renderer,
        glider: gliderGeometry,
        clouds,
        balloons,
        smokeTrail: [],
        lastSmokeTime: 0,
        heading: 0,
        forwardSpeed: 0
      }

      setGameInitialized(true)
    } catch (error) {
      console.error('Error initializing Three.js:', error)
    }
  }, [gameInitialized])

  const createSmokeCloud = useCallback((position) => {
    const state = gameStateRef.current
    if (!state.scene || !window.THREE) return

    // Create a tiny dark smoke puff (much smaller than glider fin)
    const smokeGeometry = new window.THREE.SphereGeometry(0.08 + Math.random() * 0.05, 4, 3)
    const smokeMaterial = new window.THREE.MeshLambertMaterial({ 
      color: 0x242424, 
      transparent: true, 
      opacity: 0.7 + Math.random() * 0.2
    })
    const smokeCloud = new window.THREE.Mesh(smokeGeometry, smokeMaterial)
    
    // Position behind the glider's engine area (back of fuselage) accounting for heading
    const heading = state.heading
    const offsetX = Math.sin(heading) * -4 // Behind in heading direction
    const offsetZ = Math.cos(heading) * -4 // Behind in heading direction
    
    smokeCloud.position.set(
      position.x + offsetX + (Math.random() - 0.5) * 0.2,
      position.y - 0.2 + (Math.random() - 0.5) * 0.1,
      position.z + offsetZ + Math.random() * 0.3
    )
    
    state.scene.add(smokeCloud)
    state.smokeTrail.push({
      mesh: smokeCloud,
      createdAt: Date.now()
    })

    // Remove old smoke clouds to prevent memory issues (keep last 300 for longer trail)
    while (state.smokeTrail.length > 300) {
      const oldSmoke = state.smokeTrail.shift()
      state.scene.remove(oldSmoke.mesh)
    }
  }, [])

  const handleKeyDown = useCallback((event) => {
    // Prevent space from causing any default behavior (like scrolling)
    if (event.code === 'Space') {
      event.preventDefault()
    }
    gameStateRef.current.keys[event.code] = true
  }, [])

  const handleKeyUp = useCallback((event) => {
    // Prevent space from causing any default behavior
    if (event.code === 'Space') {
      event.preventDefault()
    }
    gameStateRef.current.keys[event.code] = false
  }, [])

  const updateGame = useCallback(() => {
    const state = gameStateRef.current
    if (!state.gameRunning || !state.glider || !window.THREE) return

    try {
      const { keys, glider } = state

      // Turning mechanics - left/right changes heading (FIXED: reversed the directions)
      const turnRate = 0.03
      if (keys['ArrowLeft'] || keys['KeyA']) {
        state.heading += turnRate // Turn left = increase heading (counter-clockwise)
      }
      if (keys['ArrowRight'] || keys['KeyD']) {
        state.heading -= turnRate // Turn right = decrease heading (clockwise)
      }

      // Vertical movement
      const verticalAccel = 0.002
      const maxVerticalSpeed = 0.15
      const verticalDrag = 0.95
      
      if (keys['ArrowUp'] || keys['KeyW']) state.velocity.y += verticalAccel
      if (keys['ArrowDown'] || keys['KeyS']) state.velocity.y -= verticalAccel
      
      state.velocity.y = Math.max(-maxVerticalSpeed, Math.min(maxVerticalSpeed, state.velocity.y * verticalDrag))

      // Forward/backward speed in heading direction - ONLY space does thrust
      const forwardAccel = 0.003
      const maxForwardSpeed = 0.25
      const forwardDrag = 0.98
      
      if (keys['Space']) {
        state.forwardSpeed += forwardAccel // Only space increases thrust
      }
      if (keys['ShiftLeft']) {
        state.forwardSpeed -= forwardAccel // Shift decreases thrust
      }
      
      state.forwardSpeed = Math.max(-maxForwardSpeed, Math.min(maxForwardSpeed, state.forwardSpeed * forwardDrag))

      // Convert heading and forward speed to world velocity
      state.velocity.x = Math.sin(state.heading) * state.forwardSpeed
      state.velocity.z = Math.cos(state.heading) * state.forwardSpeed

      // Update glider position
      glider.position.add(new window.THREE.Vector3(state.velocity.x, state.velocity.y, state.velocity.z))

      // Update glider rotation to match heading and movement
      glider.rotation.y = state.heading // Face the heading direction
      glider.rotation.z = (keys['ArrowLeft'] || keys['KeyA'] ? 0.5 : 0) - (keys['ArrowRight'] || keys['KeyD'] ? 0.5 : 0) // Bank in turns (fixed direction)
      glider.rotation.x = -state.velocity.y * 1.5 // Pitch based on vertical movement

      // Create tiny smoke trail at irregular intervals
      const currentTime = Date.now()
      const timeSinceLastSmoke = currentTime - state.lastSmokeTime
      const smokeInterval = 150 + Math.random() * 200 // 150-350ms irregular intervals
      
      if (timeSinceLastSmoke > smokeInterval) {
        createSmokeCloud(glider.position)
        state.lastSmokeTime = currentTime
      }

      // Update camera to follow glider from behind based on heading
      const cameraDistance = 15
      const cameraHeight = 8
      const idealCameraPosition = new window.THREE.Vector3(
        glider.position.x - Math.sin(state.heading) * cameraDistance,
        glider.position.y + cameraHeight,
        glider.position.z - Math.cos(state.heading) * cameraDistance
      )
      state.camera.position.lerp(idealCameraPosition, 0.05)
      state.camera.lookAt(glider.position)

      // Animate clouds with different behaviors based on size
      state.clouds.forEach(cloud => {
        cloud.mesh.position.x += cloud.drift.x
        cloud.mesh.position.y += cloud.drift.y
        cloud.mesh.position.z += cloud.drift.z
        
        // Add gentle rotation for larger clouds
        if (cloud.scale > 5) {
          cloud.mesh.rotation.y += 0.001
        }
        
        // Reset position if too far (larger area due to more clouds)
        const resetDistance = 400
        if (Math.abs(cloud.mesh.position.x - glider.position.x) > resetDistance) {
          cloud.mesh.position.x = glider.position.x + (Math.random() - 0.5) * resetDistance * 2
        }
        if (Math.abs(cloud.mesh.position.z - glider.position.z) > resetDistance) {
          cloud.mesh.position.z = glider.position.z + (Math.random() - 0.5) * resetDistance * 2
        }
        
        // Keep clouds in reasonable altitude range
        if (cloud.mesh.position.y > 60) {
          cloud.mesh.position.y = 5
        }
        if (cloud.mesh.position.y < 0) {
          cloud.mesh.position.y = 55
        }
      })

      // Animate balloons
      state.balloons.forEach(balloon => {
        balloon.mesh.position.x += balloon.drift.x
        balloon.mesh.position.y += balloon.drift.y
        balloon.mesh.position.z += balloon.drift.z
        
        // Gentle swaying
        balloon.mesh.rotation.z = Math.sin(Date.now() * 0.001) * 0.1
        
        // Reset position if too far
        if (Math.abs(balloon.mesh.position.x - glider.position.x) > 200) {
          balloon.mesh.position.x = glider.position.x + (Math.random() - 0.5) * 300
        }
        if (Math.abs(balloon.mesh.position.z - glider.position.z) > 200) {
          balloon.mesh.position.z = glider.position.z + (Math.random() - 0.5) * 300
        }
      })

      // Fade out old smoke clouds gradually
      state.smokeTrail.forEach(smoke => {
        const age = currentTime - smoke.createdAt
        const maxAge = 30000 // 30 seconds
        if (age > maxAge) {
          smoke.mesh.material.opacity = 0
        } else {
          const fadeStart = 15000 // Start fading after 15 seconds
          if (age > fadeStart) {
            const fadeProgress = (age - fadeStart) / (maxAge - fadeStart)
            smoke.mesh.material.opacity = (0.7 + Math.random() * 0.2) * (1 - fadeProgress)
          }
        }
      })

      // Update score (distance traveled)
      state.score += Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.y * state.velocity.y + state.velocity.z * state.velocity.z) * 10
      setCurrentScore(Math.floor(state.score))

      // Render
      state.renderer.render(state.scene, state.camera)
    } catch (error) {
      console.error('Error in game loop:', error)
    }
  }, [createSmokeCloud])

  const startGame = useCallback(() => {
    if (!gameInitialized) return
    
    gameStateRef.current.gameRunning = true
    gameStateRef.current.score = 0
    gameStateRef.current.lastSmokeTime = Date.now()
    gameStateRef.current.heading = 0
    gameStateRef.current.forwardSpeed = 0
    gameStateRef.current.velocity = { x: 0, y: 0, z: 0 }
    
    // Clear old smoke trail
    gameStateRef.current.smokeTrail.forEach(smoke => {
      gameStateRef.current.scene.remove(smoke.mesh)
    })
    gameStateRef.current.smokeTrail = []
    
    setCurrentScore(0)
    setIsPlaying(true)

    const gameLoop = () => {
      if (gameStateRef.current.gameRunning) {
        updateGame()
        requestAnimationFrame(gameLoop)
      }
    }
    gameLoop()
  }, [gameInitialized, updateGame])

  const stopGame = useCallback(async () => {
    gameStateRef.current.gameRunning = false
    setIsPlaying(false)
    
    if (currentScore > 0) {
      await saveScore(currentScore)
    }
  }, [currentScore, saveScore])

  useEffect(() => {
    // Load Three.js
    if (!window.THREE) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
      script.onload = () => {
        setTimeout(initThreeJS, 100)
      }
      document.head.appendChild(script)
      
      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      }
    } else {
      initThreeJS()
    }
  }, [initThreeJS])

  useEffect(() => {
    // Event listeners
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Resize handler
    const handleResize = () => {
      if (gameStateRef.current.camera && gameStateRef.current.renderer) {
        gameStateRef.current.camera.aspect = window.innerWidth / window.innerHeight
        gameStateRef.current.camera.updateProjectionMatrix()
        gameStateRef.current.renderer.setSize(window.innerWidth, window.innerHeight)
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('resize', handleResize)
      if (gameStateRef.current.gameRunning) {
        gameStateRef.current.gameRunning = false
      }
    }
  }, [handleKeyDown, handleKeyUp])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#70d6ff]" 
         style={{
           backgroundImage: `radial-gradient(circle at 20% 30%, #ff70a6 2px, transparent 2px),
                            radial-gradient(circle at 60% 70%, #ffd670 2px, transparent 2px),
                            radial-gradient(circle at 80% 20%, #e9ff70 2px, transparent 2px),
                            radial-gradient(circle at 40% 80%, #ff9770 2px, transparent 2px)`,
           backgroundSize: '40px 40px, 60px 60px, 50px 50px, 45px 45px'
         }}>
      
      {/* Game Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top HUD */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-auto">
          <div className="bg-[#ffffff] border-4 border-[#242424] px-4 py-2 rounded-none shadow-[4px_4px_0px_#242424]">
            <div className="text-[#242424] font-bold text-lg">Score: {currentScore}</div>
          </div>
          
          <div className="flex gap-2">
            {!isPlaying ? (
              <button 
                onClick={startGame}
                disabled={!gameInitialized}
                className="bg-[#e9ff70] hover:bg-[#ffd670] border-4 border-[#242424] px-6 py-3 font-bold text-[#242424] shadow-[4px_4px_0px_#242424] hover:shadow-[2px_2px_0px_#242424] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gameInitialized ? 'Start Flying' : 'Loading...'}
              </button>
            ) : (
              <button 
                onClick={stopGame}
                className="bg-[#ff70a6] hover:bg-[#ff9770] border-4 border-[#242424] px-6 py-3 font-bold text-[#242424] shadow-[4px_4px_0px_#242424] hover:shadow-[2px_2px_0px_#242424] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Land
              </button>
            )}
          </div>
        </div>

        {/* Controls Help */}
        {!isPlaying && gameInitialized && (
          <div className="absolute bottom-4 left-4 bg-[#ffffff] border-4 border-[#242424] p-4 shadow-[4px_4px_0px_#242424] max-w-xs">
            <h3 className="text-[#242424] font-bold mb-2">Controls</h3>
            <div className="text-[#242424] text-sm space-y-1">
              <div><strong>A/← Left</strong>: Turn left</div>
              <div><strong>D/→ Right</strong>: Turn right</div>
              <div><strong>W/S or ↑/↓</strong>: Climb/dive</div>
              <div><strong>Space</strong>: Thrust forward</div>
              <div><strong>Shift</strong>: Reverse thrust</div>
              <div className="mt-2 text-xs italic">Turn in circles to see your smoke trail!</div>
            </div>
          </div>
        )}

        {/* High Scores */}
        {!isPlaying && highScores.length > 0 && (
          <div className="absolute bottom-4 right-4 bg-[#ffffff] border-4 border-[#242424] p-4 shadow-[4px_4px_0px_#242424] max-w-xs">
            <h3 className="text-[#242424] font-bold mb-2">High Scores</h3>
            <div className="space-y-1">
              {highScores
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
                .map((score, index) => (
                  <div key={score._id} className="text-[#242424] text-sm flex justify-between">
                    <span>#{index + 1}</span>
                    <span className="font-bold">{Math.floor(score.value)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```