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
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFireproof } from 'use-fireproof';
import * as THREE from 'three';

export default function SkyGlider() {
  const { database, useLiveQuery } = useFireproof('sky-glider-scores');
  const canvasRef = useRef(null);
  const gameStateRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    glider: null,
    clouds: [],
    coins: [],
    glowEffects: [],
    smokeTrail: [],
    lastSmokeTime: 0,
    score: 0,
    gameRunning: false,
    keys: {},
    velocity: { x: 0, y: 0, z: 0 },
    heading: 0,
    forwardSpeed: 0,
    pitch: 0,
    roll: 0,
  });

  const [currentScore, setCurrentScore] = useState(0);
  const { docs: scoreData } = useLiveQuery('type', { key: 'score' }) || { docs: [] };

  const saveScore = useCallback(
    async (score) => {
      await database.put({
        _id: `score-${Date.now()}`,
        type: 'score',
        value: score,
        timestamp: Date.now(),
      });
    },
    [database]
  );

  const createGlowEffect = useCallback((position) => {
    const state = gameStateRef.current;
    if (!state.scene) return;

    const glowSphere = new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffd670,
        transparent: true,
        opacity: 0.8,
      })
    );

    glowSphere.position.copy(position);
    state.scene.add(glowSphere);

    const glowEffect = {
      mesh: glowSphere,
      createdAt: Date.now(),
      scale: 1,
    };

    state.glowEffects.push(glowEffect);

    // Remove after animation
    setTimeout(() => {
      state.scene.remove(glowSphere);
      const index = state.glowEffects.indexOf(glowEffect);
      if (index > -1) state.glowEffects.splice(index, 1);
    }, 1000);
  }, []);

  const createSmokeCloud = useCallback((position) => {
    const state = gameStateRef.current;
    if (!state.scene) return;

    const smokeGeometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.05, 4, 3);
    const smokeMaterial = new THREE.MeshLambertMaterial({
      color: 0x242424,
      transparent: true,
      opacity: 0.7 + Math.random() * 0.2,
    });
    const smokeCloud = new THREE.Mesh(smokeGeometry, smokeMaterial);

    // Position behind the glider
    const heading = state.heading;
    const offsetX = Math.sin(heading) * -4;
    const offsetZ = Math.cos(heading) * -4;

    smokeCloud.position.set(
      position.x + offsetX + (Math.random() - 0.5) * 0.2,
      position.y - 0.2 + (Math.random() - 0.5) * 0.1,
      position.z + offsetZ + Math.random() * 0.3
    );

    state.scene.add(smokeCloud);
    state.smokeTrail.push({
      mesh: smokeCloud,
      createdAt: Date.now(),
    });

    // Keep trail manageable
    while (state.smokeTrail.length > 100) {
      const oldSmoke = state.smokeTrail.shift();
      state.scene.remove(oldSmoke.mesh);
    }
  }, []);

  const createTexturedCoin = useCallback((scene, position) => {
    // Create procedural gold texture
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Gold gradient
    const gradient = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
    gradient.addColorStop(0, '#ffd670');
    gradient.addColorStop(0.5, '#ff9770');
    gradient.addColorStop(1, '#ffb347');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    // Add metallic shine lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(angle) * 30, 64 + Math.sin(angle) * 30);
      ctx.lineTo(64 + Math.cos(angle) * 50, 64 + Math.sin(angle) * 50);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 0.3, 16),
      new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.8,
        roughness: 0.2,
      })
    );

    coin.position.copy(position);
    coin.rotation.z = Math.PI / 2;
    scene.add(coin);

    return {
      mesh: coin,
      collected: false,
      rotation: Math.random() * 0.02 + 0.01,
    };
  }, []);

  const initThreeJS = useCallback(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x70d6ff);
    scene.fog = new THREE.Fog(0x70d6ff, 50, 300);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 10, 20);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);

    // Glider
    const glider = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(2, 8, 3),
      new THREE.MeshLambertMaterial({ color: 0xff70a6 })
    );
    body.rotation.x = Math.PI / 2;
    glider.add(body);

    glider.position.set(0, 10, 0);
    scene.add(glider);

    // Create simple clouds
    const clouds = [];
    for (let i = 0; i < 30; i++) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(Math.random() * 5 + 3, 8, 6),
        new THREE.MeshLambertMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.7,
        })
      );
      cloud.position.set(
        (Math.random() - 0.5) * 400,
        Math.random() * 30 + 10,
        (Math.random() - 0.5) * 400
      );
      scene.add(cloud);
      clouds.push({
        mesh: cloud,
        drift: {
          x: (Math.random() - 0.5) * 0.01,
          y: 0,
          z: (Math.random() - 0.5) * 0.01,
        },
      });
    }

    // Create initial coins
    const coins = [];
    for (let i = 0; i < 20; i++) {
      const coin = createTexturedCoin(
        scene,
        new THREE.Vector3(
          (Math.random() - 0.5) * 200,
          Math.random() * 40 + 10,
          (Math.random() - 0.5) * 200
        )
      );
      coins.push(coin);
    }

    gameStateRef.current = {
      ...gameStateRef.current,
      scene,
      camera,
      renderer,
      glider,
      clouds,
      coins,
      lastSmokeTime: Date.now(),
      heading: 0,
      forwardSpeed: 0.1,
      pitch: 0,
      roll: 0,
    };

    const gameLoop = () => {
      if (gameStateRef.current.gameRunning) {
        updateGame();
        requestAnimationFrame(gameLoop);
      }
    };
    gameStateRef.current.gameRunning = true;
    gameLoop();
  }, [createTexturedCoin]);

  const checkCoinCollisions = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.glider) return;

    state.coins.forEach((coin) => {
      if (!coin.collected) {
        const distance = state.glider.position.distanceTo(coin.mesh.position);
        if (distance < 4) {
          coin.collected = true;
          coin.mesh.visible = false;
          createGlowEffect(coin.mesh.position);
          state.score += 1;
          setCurrentScore(state.score);

          // Respawn coin at random location
          setTimeout(() => {
            coin.mesh.position.set(
              (Math.random() - 0.5) * 200,
              Math.random() * 40 + 10,
              (Math.random() - 0.5) * 200
            );
            coin.mesh.visible = true;
            coin.collected = false;
          }, 5000);
        }
      }
    });
  }, [createGlowEffect]);

  const handleKeyDown = useCallback((event) => {
    if (event.code === 'Space') event.preventDefault();
    gameStateRef.current.keys[event.code] = true;
  }, []);

  const handleKeyUp = useCallback((event) => {
    if (event.code === 'Space') event.preventDefault();
    gameStateRef.current.keys[event.code] = false;
  }, []);

  const updateGame = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.gameRunning || !state.glider) return;

    const { keys, glider } = state;

    // Controls
    if (keys['ArrowLeft'] || keys['KeyA']) state.heading += 0.03;
    if (keys['ArrowRight'] || keys['KeyD']) state.heading -= 0.03;
    if (keys['ArrowUp'] || keys['KeyW']) state.pitch += 0.01;
    if (keys['ArrowDown'] || keys['KeyS']) state.pitch -= 0.01;
    if (keys['Space']) state.forwardSpeed = Math.min(0.3, state.forwardSpeed + 0.005);

    // Physics
    state.forwardSpeed = Math.max(0.05, state.forwardSpeed * 0.995);
    state.velocity.x = Math.sin(state.heading) * Math.cos(state.pitch) * state.forwardSpeed;
    state.velocity.y = Math.sin(-state.pitch) * state.forwardSpeed;
    state.velocity.z = Math.cos(state.heading) * Math.cos(state.pitch) * state.forwardSpeed;

    glider.position.add(new THREE.Vector3(state.velocity.x, state.velocity.y, state.velocity.z));
    
    // Point glider in thrust vector direction
    const thrustDirection = new THREE.Vector3(state.velocity.x, state.velocity.y, state.velocity.z).normalize();
    if (thrustDirection.length() > 0) {
      glider.lookAt(glider.position.clone().add(thrustDirection));
    }

    // Camera follow
    const cameraDistance = 15;
    state.camera.position.set(
      glider.position.x - Math.sin(state.heading) * cameraDistance,
      glider.position.y + 10,
      glider.position.z - Math.cos(state.heading) * cameraDistance
    );
    state.camera.lookAt(glider.position);

    // Create smoke trail
    const currentTime = Date.now();
    const timeSinceLastSmoke = currentTime - state.lastSmokeTime;
    const smokeInterval = 150 + Math.random() * 200;

    if (timeSinceLastSmoke > smokeInterval) {
      createSmokeCloud(glider.position);
      state.lastSmokeTime = currentTime;
    }

    // Animate
    checkCoinCollisions();
    state.coins.forEach((coin) => {
      if (!coin.collected) coin.mesh.rotation.y += coin.rotation;
    });
    state.clouds.forEach((cloud) => {
      cloud.mesh.position.add(new THREE.Vector3(cloud.drift.x, cloud.drift.y, cloud.drift.z));
    });

    // Animate glow effects
    state.glowEffects.forEach((effect) => {
      const age = Date.now() - effect.createdAt;
      const progress = age / 1000;
      effect.scale = 1 + progress * 2;
      effect.mesh.scale.setScalar(effect.scale);
      effect.mesh.material.opacity = 0.8 * (1 - progress);
    });

    // Fade smoke trail
    state.smokeTrail.forEach((smoke) => {
      const age = currentTime - smoke.createdAt;
      const maxAge = 15000;
      if (age > maxAge) {
        smoke.mesh.material.opacity = 0;
      } else if (age > 7500) {
        const fadeProgress = (age - 7500) / 7500;
        smoke.mesh.material.opacity = (0.7 + Math.random() * 0.2) * (1 - fadeProgress);
      }
    });

    state.renderer.render(state.scene, state.camera);
  }, [checkCoinCollisions, createSmokeCloud]);

  useEffect(() => {
    initThreeJS();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      gameStateRef.current.gameRunning = false;
    };
  }, [initThreeJS, handleKeyDown, handleKeyUp]);

  return (
    <div className="relative h-screen w-full bg-sky-200">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute top-4 left-4 rounded bg-white p-4 shadow">
        <h2 className="text-lg font-bold">Sky Glider</h2>
        <p>Score: {currentScore}</p>
        <p className="mt-2 text-sm">WASD/Arrows: Fly, Space: Thrust</p>
      </div>
      {scoreData.length > 0 && (
        <div className="absolute top-4 right-4 rounded bg-white p-4 shadow">
          <h3 className="font-bold">High Scores</h3>
          {scoreData
            .sort((a, b) => b.value - a.value)
            .slice(0, 3)
            .map((score, i) => (
              <div key={score._id} className="text-sm">
                #{i + 1}: {score.value}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
```

# Visual effects example

```javascript
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFireproof } from 'use-fireproof';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';

export default function HalftoneArtStudio() {
  const { database, useLiveQuery } = useFireproof('halftone-studio');
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [currentPreset, setCurrentPreset] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showParameters, setShowParameters] = useState(false);

  const { docs: presets } = useLiveQuery('type', { key: 'preset' }) || { docs: [] };
  const { docs: parameterHistory } = useLiveQuery('type', { key: 'parameter-state' }) || { docs: [] };

  const [parameters, setParameters] = useState({
    shape: 1, // 1=Dot, 2=Ellipse, 3=Line, 4=Square
    radius: 4,
    rotateR: 15,
    rotateG: 30,
    rotateB: 45,
    scatter: 0,
    blending: 1,
    blendingMode: 1, // 1=Linear, 2=Multiply, 3=Add, 4=Lighter, 5=Darker
    greyscale: false,
    disable: false,
    objectCount: 25,
    rotationSpeed: 1,
    colorTheme: 0 // 0=Rainbow, 1=Warm, 2=Cool, 3=Monochrome
  });

  const saveParameterState = useCallback(async (params, action = 'manual') => {
    await database.put({
      _id: `param-state-${Date.now()}`,
      type: 'parameter-state',
      parameters: { ...params },
      action,
      timestamp: Date.now()
    });
  }, [database]);

  const savePreset = useCallback(async () => {
    if (!presetName.trim()) return;

    await database.put({
      _id: `preset-${Date.now()}`,
      type: 'preset',
      name: presetName,
      parameters: { ...parameters },
      timestamp: Date.now()
    });

    setPresetName('');
  }, [database, presetName, parameters]);

  const loadPreset = useCallback((preset) => {
    setParameters({ ...preset.parameters });
    setCurrentPreset(preset);
  }, []);

  const loadParameterState = useCallback((state) => {
    setParameters({ ...state.parameters });
  }, []);

  const generateRandomScene = useCallback(async () => {
    setIsGenerating(true);

    // Save current state before randomizing
    await saveParameterState(parameters, 'before-randomize');

    // Generate random parameters
    const newParams = {
      shape: Math.floor(Math.random() * 4) + 1,
      radius: Math.random() * 20 + 2,
      rotateR: Math.random() * 90,
      rotateG: Math.random() * 90,
      rotateB: Math.random() * 90,
      scatter: Math.random(),
      blending: Math.random(),
      blendingMode: Math.floor(Math.random() * 5) + 1,
      greyscale: Math.random() > 0.7,
      disable: false,
      objectCount: Math.floor(Math.random() * 40) + 10,
      rotationSpeed: Math.random() * 3 + 0.5,
      colorTheme: Math.floor(Math.random() * 4)
    };

    setParameters(newParams);

    // Save the new randomized state
    setTimeout(async () => {
      await saveParameterState(newParams, 'randomized');
      setIsGenerating(false);
    }, 500);
  }, [parameters, saveParameterState]);

  // Save parameter changes for history
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveParameterState(parameters, 'manual');
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [parameters, saveParameterState]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x242424);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = 12;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Group for all objects
    const group = new THREE.Group();
    scene.add(group);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Post-processing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const halftonePass = new HalftonePass({
      shape: parameters.shape,
      radius: parameters.radius,
      rotateR: parameters.rotateR * (Math.PI / 180),
      rotateG: parameters.rotateG * (Math.PI / 180),
      rotateB: parameters.rotateB * (Math.PI / 180),
      scatter: parameters.scatter,
      blending: parameters.blending,
      blendingMode: parameters.blendingMode,
      greyscale: parameters.greyscale,
      disable: parameters.disable
    });
    composer.addPass(halftonePass);

    // Store refs
    sceneRef.current = {
      scene,
      camera,
      renderer,
      composer,
      halftonePass,
      group,
      controls,
      objects: []
    };

    // Create initial objects
    const createObjects = () => {
      // Clear existing objects
      sceneRef.current.objects.forEach(obj => {
        group.remove(obj);
      });
      sceneRef.current.objects = [];

      // Color themes
      const colorThemes = [
        [0xff70a6, 0x70d6ff, 0xffd670, 0xe9ff70, 0xff9770], // Rainbow
        [0xff9770, 0xffd670, 0xff70a6], // Warm
        [0x70d6ff, 0xe9ff70, 0x242424], // Cool
        [0xffffff, 0x242424] // Monochrome
      ];

      const colors = colorThemes[parameters.colorTheme] || colorThemes[0];

      // Shader material for interesting effects
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 }
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform float time;
          
          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            
            vec3 pos = position;
            pos += sin(pos * 2.0 + time) * 0.1;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform float time;
          
          void main() {
            vec3 color = abs(vNormal) + vec3(vUv, sin(time + vPosition.x));
            color = mix(color, vec3(1.0, 0.4, 0.6), sin(time + vPosition.y) * 0.5 + 0.5);
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });

      // Create various geometric shapes
      const geometries = [
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.SphereGeometry(1.2, 16, 16),
        new THREE.ConeGeometry(1, 2, 8),
        new THREE.CylinderGeometry(0.8, 0.8, 2, 8),
        new THREE.OctahedronGeometry(1.2),
        new THREE.TetrahedronGeometry(1.5),
        new THREE.DodecahedronGeometry(1),
        new THREE.IcosahedronGeometry(1.2)
      ];

      for (let i = 0; i < parameters.objectCount; i++) {
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const basicMaterial = new THREE.MeshPhongMaterial({
          color: colors[Math.floor(Math.random() * colors.length)],
          shininess: 100,
          transparent: true,
          opacity: 0.8 + Math.random() * 0.2
        });

        const mesh = new THREE.Mesh(geometry, Math.random() > 0.3 ? basicMaterial : material);

        mesh.position.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20
        );

        mesh.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );

        mesh.scale.setScalar(0.5 + Math.random() * 1.5);

        group.add(mesh);
        sceneRef.current.objects.push(mesh);
      }
    };

    createObjects();

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Update material uniforms
      sceneRef.current.objects.forEach(obj => {
        if (obj.material.uniforms && obj.material.uniforms.time) {
          obj.material.uniforms.time.value = elapsed;
        }

        // Animate objects
        obj.rotation.x += delta * parameters.rotationSpeed * 0.2;
        obj.rotation.y += delta * parameters.rotationSpeed * 0.3;
        obj.rotation.z += delta * parameters.rotationSpeed * 0.1;
      });

      controls.update();
      composer.render();
      requestAnimationFrame(animate);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [parameters]);

  // Update halftone parameters
  useEffect(() => {
    if (sceneRef.current?.halftonePass) {
      const pass = sceneRef.current.halftonePass;
      pass.uniforms.shape.value = parameters.shape;
      pass.uniforms.radius.value = parameters.radius;
      pass.uniforms.rotateR.value = parameters.rotateR * (Math.PI / 180);
      pass.uniforms.rotateG.value = parameters.rotateG * (Math.PI / 180);
      pass.uniforms.rotateB.value = parameters.rotateB * (Math.PI / 180);
      pass.uniforms.scatter.value = parameters.scatter;
      pass.uniforms.blending.value = parameters.blending;
      pass.uniforms.blendingMode.value = parameters.blendingMode;
      pass.uniforms.greyscale.value = parameters.greyscale;
      pass.uniforms.disable.value = parameters.disable;
    }
  }, [parameters]);

  const shapeName = ['', 'Dot', 'Ellipse', 'Line', 'Square'][parameters.shape] || 'Dot';
  const blendModeName = ['', 'Linear', 'Multiply', 'Add', 'Lighter', 'Darker'][parameters.blendingMode] || 'Linear';
  const actionNames = {
    'before-randomize': '🎲 Before Random',
    'randomized': '✨ Randomized',
    'manual': '✏️ Manual Edit'
  };

  return (
    <div className="relative h-screen w-full bg-[#242424] overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, #70d6ff 2px, transparent 2px)`,
          backgroundSize: '50px 50px'
        }}
      />

      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Main Control Panel */}
      <div className={`absolute top-4 left-4 bg-[#ffffff] rounded-lg p-4 shadow-lg border-4 border-[#242424] max-h-[calc(100vh-2rem)] overflow-y-auto transition-all duration-300 ${showParameters ? 'w-80' : 'w-64'}`}>
        <h2 className="text-lg font-bold text-[#242424] mb-4">RGB Halftone Studio</h2>

        {/* Always visible controls */}
        <div className="space-y-3 mb-4">
          <button
            onClick={generateRandomScene}
            disabled={isGenerating}
            className="w-full bg-[#ff70a6] text-[#242424] font-bold py-3 px-4 rounded border-2 border-[#242424] hover:bg-[#ff9770] disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : '🎲 Random Art'}
          </button>

          <button
            onClick={() => setShowParameters(!showParameters)}
            className="w-full bg-[#70d6ff] text-[#242424] font-bold py-2 px-4 rounded border-2 border-[#242424] hover:bg-[#e9ff70]"
          >
            {showParameters ? '🔼 Hide Controls' : '🔽 Show Controls'}
          </button>
        </div>

        {/* Expandable parameter controls */}
        {showParameters && (
          <div className="space-y-4">
            {/* Shape Controls */}
            <div>
              <label className="block text-sm font-bold text-[#242424] mb-2">Shape: {shapeName}</label>
              <select
                value={parameters.shape}
                onChange={(e) => setParameters(prev => ({ ...prev, shape: parseInt(e.target.value) }))}
                className="w-full p-2 border-2 border-[#242424] rounded text-[#242424]"
              >
                <option value={1}>Dot</option>
                <option value={2}>Ellipse</option>
                <option value={3}>Line</option>
                <option value={4}>Square</option>
              </select>
            </div>

            {/* Size Controls */}
            <div>
              <label className="block text-sm font-bold text-[#242424] mb-2">Size: {parameters.radius.toFixed(1)}</label>
              <input
                type="range"
                min="1"
                max="25"
                step="0.5"
                value={parameters.radius}
                onChange={(e) => setParameters(prev => ({ ...prev, radius: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>

            {/* Color Rotation */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-[#ff70a6] mb-1">Red: {parameters.rotateR.toFixed(0)}°</label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={parameters.rotateR}
                  onChange={(e) => setParameters(prev => ({ ...prev, rotateR: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#e9ff70] mb-1">Green: {parameters.rotateG.toFixed(0)}°</label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={parameters.rotateG}
                  onChange={(e) => setParameters(prev => ({ ...prev, rotateG: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#70d6ff] mb-1">Blue: {parameters.rotateB.toFixed(0)}°</label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={parameters.rotateB}
                  onChange={(e) => setParameters(prev => ({ ...prev, rotateB: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Effects */}
            <div>
              <label className="block text-sm font-bold text-[#242424] mb-2">Scatter: {(parameters.scatter * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={parameters.scatter}
                onChange={(e) => setParameters(prev => ({ ...prev, scatter: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#242424] mb-2">Blend: {(parameters.blending * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={parameters.blending}
                onChange={(e) => setParameters(prev => ({ ...prev, blending: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#242424] mb-2">Blend Mode: {blendModeName}</label>
              <select
                value={parameters.blendingMode}
                onChange={(e) => setParameters(prev => ({ ...prev, blendingMode: parseInt(e.target.value) }))}
                className="w-full p-2 border-2 border-[#242424] rounded text-[#242424]"
              >
                <option value={1}>Linear</option>
                <option value={2}>Multiply</option>
                <option value={3}>Add</option>
                <option value={4}>Lighter</option>
                <option value={5}>Darker</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={parameters.greyscale}
                  onChange={(e) => setParameters(prev => ({ ...prev, greyscale: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm font-bold text-[#242424]">Greyscale</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={parameters.disable}
                  onChange={(e) => setParameters(prev => ({ ...prev, disable: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm font-bold text-[#242424]">Disable Effect</span>
              </label>
            </div>

            {/* Save Preset */}
            <div>
              <input
                type="text"
                placeholder="Preset name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="w-full p-2 border-2 border-[#242424] rounded text-[#242424] mb-2"
              />
              <button
                onClick={savePreset}
                disabled={!presetName.trim()}
                className="w-full bg-[#ffd670] text-[#242424] font-bold py-2 px-4 rounded border-2 border-[#242424] hover:bg-[#e9ff70] disabled:opacity-50"
              >
                💾 Save Preset
              </button>
            </div>

            {/* Saved Presets */}
            {presets.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-[#242424] mb-2">💾 Saved Presets</h4>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {presets
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((preset) => (
                      <div
                        key={preset._id}
                        className={`p-2 rounded border-2 cursor-pointer transition-colors ${currentPreset?._id === preset._id
                            ? 'bg-[#ff70a6] border-[#242424]'
                            : 'bg-[#ffffff] border-[#242424] hover:bg-[#e9ff70]'
                          }`}
                        onClick={() => loadPreset(preset)}
                      >
                        <div className="text-xs font-bold text-[#242424]">{preset.name}</div>
                        <div className="text-xs text-[#242424] opacity-75">
                          {['', 'Dot', 'Ellipse', 'Line', 'Square'][preset.parameters.shape]} • {preset.parameters.greyscale ? 'B&W' : 'Color'}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Parameter History */}
            {parameterHistory.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-[#242424] mb-2">📜 Parameter History</h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {parameterHistory
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, 10)
                    .map((state) => (
                      <div
                        key={state._id}
                        className="p-2 rounded border-2 border-[#242424] cursor-pointer hover:bg-[#e9ff70] transition-colors"
                        onClick={() => loadParameterState(state)}
                      >
                        <div className="text-xs font-bold text-[#242424]">
                          {actionNames[state.action] || '⚙️ Unknown'}
                        </div>
                        <div className="text-xs text-[#242424] opacity-75">
                          {['', 'Dot', 'Ellipse', 'Line', 'Square'][state.parameters.shape]} • Size: {state.parameters.radius.toFixed(1)} • {state.parameters.greyscale ? 'B&W' : 'Color'}
                        </div>
                        <div className="text-xs text-[#242424] opacity-50">
                          {new Date(state.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

