import * as THREE from "three";
import { SCENE_DIMENSIONS, EXPLOSION } from "../constants/scene.js";
import { makeChrome } from "../factories/sceneObjects.js";

export interface ScreenshotBoyConfig {
  position?: [number, number, number];
  id?: string;
  scene?: THREE.Scene;
  color?: number;
  screenshotPath?: string;
}

export class ScreenshotBoy {
  public readonly group: THREE.Group;
  public readonly id: string;
  private readonly color: number;
  private readonly screenshotPath?: string;

  // Three.js objects
  private yellowMesh!: THREE.Mesh;
  private chrome!: THREE.Mesh;

  constructor(config: ScreenshotBoyConfig = {}) {
    this.id =
      config.id || `screenshotboy-${Math.random().toString(36).substr(2, 9)}`;
    this.color = config.color ?? 0xffff00; // Default to yellow
    this.screenshotPath = config.screenshotPath;
    this.group = new THREE.Group();
    this.group.name = this.id;

    // Set position
    if (config.position) {
      this.group.position.set(...config.position);
    }

    // Set to reclined state (rotate -90 degrees around x-axis)
    this.group.rotation.x = -Math.PI / 2;

    // Create all Three.js objects
    this.createObjects();
    this.buildHierarchy();
  }

  private createObjects() {
    // Create colored mesh (same dimensions as enclosure)
    const yellowMeshGeometry = new THREE.BoxGeometry(
      SCENE_DIMENSIONS.ENCLOSURE.WIDTH +
        SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH,
      SCENE_DIMENSIONS.ENCLOSURE.HEIGHT +
        SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH,
      SCENE_DIMENSIONS.ENCLOSURE.DEPTH,
    );

    // Create materials - use array if screenshot is provided
    let materials: THREE.Material | THREE.Material[];

    if (this.screenshotPath) {
      // Calculate dimensions of the large face (top/bottom face)
      const faceWidth =
        SCENE_DIMENSIONS.ENCLOSURE.WIDTH +
        SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH;
      const faceHeight =
        SCENE_DIMENSIONS.ENCLOSURE.HEIGHT +
        SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH;
      const faceAspect = faceWidth / faceHeight;

      // Load screenshot texture
      const textureLoader = new THREE.TextureLoader();
      const texture = textureLoader.load(
        this.screenshotPath,
        (loadedTexture: THREE.Texture) => {
          const image = loadedTexture.image as
            | HTMLImageElement
            | HTMLCanvasElement
            | ImageBitmap;
          if (!image) return;

          // Configure texture to crop (not stretch) after image loads
          const imgAspect = image.width / image.height;

          if (imgAspect > faceAspect) {
            // Image is wider - crop sides
            const scale = imgAspect / faceAspect;
            loadedTexture.repeat.set(1 / scale, 1);
            loadedTexture.offset.set((1 - 1 / scale) / 2, 0);
          } else {
            // Image is taller - crop top/bottom
            const scale = faceAspect / imgAspect;
            loadedTexture.repeat.set(1, 1 / scale);
            loadedTexture.offset.set(0, (1 - 1 / scale) / 2);
          }
          loadedTexture.needsUpdate = true;
        },
      );

      // Create material array for each face
      const colorMaterial = new THREE.MeshToonMaterial({ color: this.color });
      const screenshotMaterial = new THREE.MeshToonMaterial({ map: texture });

      // BoxGeometry face order: right, left, top, bottom, front, back
      // Front face (index 4) is the large face that will show after rotation
      materials = [
        colorMaterial,
        colorMaterial,
        colorMaterial,
        colorMaterial,
        screenshotMaterial, // front (large face)
        colorMaterial,
      ];
    } else {
      materials = new THREE.MeshToonMaterial({ color: this.color });
    }

    this.yellowMesh = new THREE.Mesh(yellowMeshGeometry, materials);

    // Position at normal enclosure position
    this.yellowMesh.position.z = EXPLOSION.NORMAL_POSITIONS.ENCLOSURE_Z;

    // Create chrome with address bar (reuse factory function)
    this.chrome = makeChrome();

    // Position chrome at the back, similar to CounterBoy
    this.chrome.position.z =
      EXPLOSION.NORMAL_POSITIONS.ENCLOSURE_BACK_Z +
      EXPLOSION.NORMAL_POSITIONS.CHROME_OFFSET;
  }

  private buildHierarchy() {
    this.group.add(this.yellowMesh);
    this.group.add(this.chrome);
  }

  // Cleanup
  public dispose() {
    // Remove from parent if it has one
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    // Dispose of geometries and materials
    this.group.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }
}
