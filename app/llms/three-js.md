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
