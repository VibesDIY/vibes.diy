import * as THREE from "three";
import { animate } from "animejs";
import {
  EXPLOSION,
  ANIMATION_DURATIONS,
  SCENE_DIMENSIONS,
  COLORS,
} from "../constants/scene";
import {
  makeEnclosure,
  makeEnclosureBack,
  makeChrome,
  makeGridGroup,
  makeDataLayer,
  makeBlockSituation,
} from "../factories/sceneObjects";

export interface CounterBoyConfig {
  position?: [number, number, number];
  id?: string;
  scene?: THREE.Scene;
}

interface BlockSituationObjects {
  group: THREE.Group;
  unencryptedBlock: THREE.Mesh;
  encryptedBlock: THREE.Mesh;
  cid: THREE.Group;
  params: {
    speed: number;
    startPosition: number;
  };
}

export class CounterBoy {
  public readonly group: THREE.Group;
  public readonly id: string;
  private scene: THREE.Scene | undefined;

  // Three.js objects
  private enclosure!: THREE.Mesh;
  private enclosureBack!: THREE.Mesh;
  private chrome!: THREE.Mesh;
  private gridGroup!: THREE.Group;
  private dataLayer!: THREE.Group;
  private display!: THREE.Mesh;
  private button!: THREE.Mesh;
  // @ts-ignore - used in createObjects but TypeScript doesn't detect it

  // Geometry references for thickness animation
  // @ts-ignore - unused but kept for potential future use
  private originalEnclosureGeometry!: THREE.BoxGeometry;

  // State
  private encryptedBlocksCount: number = 0;
  private isExploded: boolean = false;
  private isTension: boolean = false;
  private isReclined: boolean = false;
  private isAnimating: boolean = false;

  // Block animation state
  private blockSituations: BlockSituationObjects[] = [];
  private isBlockAnimating: boolean = false;
  private blockAnimationRef: any = null;

  // Animation refs
  private currentAnimation: any = null;

  constructor(config: CounterBoyConfig = {}) {
    this.id =
      config.id || `counterboy-${Math.random().toString(36).substr(2, 9)}`;
    this.scene = config.scene;
    this.group = new THREE.Group();
    // @ts-ignore
    this.group.name = this.id;

    // Set position
    if (config.position) {
      this.group.position.set(...config.position);
    }

    // Create all Three.js objects
    this.createObjects();
    this.buildHierarchy();
  }

  private createObjects() {
    const { enclosure, display, button } = makeEnclosure();
    this.enclosure = enclosure;
    this.display = display;
    this.button = button;

    // Store reference to original geometry for thickness animation
    // @ts-ignore - geometry exists on Mesh
    this.originalEnclosureGeometry = this.enclosure
      .geometry as THREE.BoxGeometry;

    this.enclosureBack = makeEnclosureBack();
    this.chrome = makeChrome();
    const { gridGroup } = makeGridGroup();
    this.gridGroup = gridGroup;
    this.dataLayer = makeDataLayer();

    // Set initial positions to match EXPLOSION.NORMAL_POSITIONS
    this.enclosure.position.z = EXPLOSION.NORMAL_POSITIONS.ENCLOSURE_Z;
    this.dataLayer.position.z = EXPLOSION.NORMAL_POSITIONS.DATA_LAYER_Z;
    this.gridGroup.position.z = EXPLOSION.NORMAL_POSITIONS.GRID_GROUP_Z;
    this.enclosureBack.position.z = EXPLOSION.NORMAL_POSITIONS.ENCLOSURE_BACK_Z;
    this.chrome.position.z =
      this.enclosureBack.position.z + EXPLOSION.NORMAL_POSITIONS.CHROME_OFFSET;

    // Grid should be hidden initially (only visible in tension/exploded states)
    // @ts-ignore - visible exists on Group
    this.gridGroup.visible = false;
  }

  private buildHierarchy() {
    this.group.add(this.enclosure);
    this.group.add(this.gridGroup);
    this.group.add(this.enclosureBack);
    this.group.add(this.dataLayer);
    this.group.add(this.chrome);
  }

  // Public getters for state
  public getEncryptedBlocksCount(): number {
    return this.encryptedBlocksCount;
  }

  public getIsExploded(): boolean {
    return this.isExploded;
  }

  public getIsTension(): boolean {
    return this.isTension;
  }

  public getIsReclined(): boolean {
    return this.isReclined;
  }

  public getIsAnimating(): boolean {
    return this.isAnimating;
  }

  public getIsBlockAnimating(): boolean {
    return this.isBlockAnimating;
  }

  // Block animation methods
  public animateBlockEncryption(
    preset: { hexPair: string; textureOffsetX: number; textureOffsetY: number },
    onComplete?: () => void,
    skipUnencrypted: boolean = false,
  ) {
    if (this.isBlockAnimating) return;

    // Count visible encrypted blocks
    const visibleEncryptedBlocks = this.blockSituations.filter(
      (situation) => (situation.encryptedBlock as any).visible,
    );

    // If there are already 5 visible encrypted blocks, hide the oldest one
    if (visibleEncryptedBlocks.length >= 5) {
      const oldestVisible = visibleEncryptedBlocks[0];
      // @ts-ignore
      oldestVisible.encryptedBlock.visible = false;
      // @ts-ignore
      oldestVisible.cid.visible = false;
    }

    // Move all existing block situations to the left
    this.blockSituations.forEach((situation) => {
      // @ts-ignore - position exists on Group
      situation.group.position.x -= 1.0;
    });

    // Create new block situation
    const newBlockSituation = this.createNewBlockSituation(preset);
    if (newBlockSituation) {
      this.blockSituations.push(newBlockSituation);

      if (skipUnencrypted) {
        // For synced animations: just show encrypted block and CID instantly
        (newBlockSituation.encryptedBlock as any).visible = true;
        (newBlockSituation.cid as any).visible = true;
        // Remove the unencrypted block since we don't need it
        (newBlockSituation.group as any).remove(
          newBlockSituation.unencryptedBlock,
        );

        // Increment encrypted blocks count and update display
        this.encryptedBlocksCount++;
        this.updateDisplayTexture();

        onComplete?.();
      } else {
        // For user-initiated animations: show full animation
        this.animateNewBlock(newBlockSituation, onComplete);
      }
    }
  }

  private createNewBlockSituation(preset: {
    hexPair: string;
    textureOffsetX: number;
    textureOffsetY: number;
  }): BlockSituationObjects | null {
    if (!this.scene) return null;

    const blockSituation = makeBlockSituation(preset.hexPair, {
      textureOffsetX: preset.textureOffsetX,
      textureOffsetY: preset.textureOffsetY,
    });

    // Position at origin since it's now a child of this.group
    // @ts-ignore
    blockSituation.group.position.set(0, 0, 0);

    // New block situations should inherit visibility based on current state
    // Only visible if in tension or exploded state
    // @ts-ignore - visible exists on Group
    blockSituation.group.visible = this.isTension || this.isExploded;

    this.group.add(blockSituation.group);
    return blockSituation;
  }

  private animateNewBlock(
    blockSituation: BlockSituationObjects,
    onComplete?: () => void,
  ) {
    if (this.isBlockAnimating) return;

    this.isBlockAnimating = true;
    const { unencryptedBlock, encryptedBlock, cid, params } = blockSituation;
    const { speed } = params;

    // Show the unencrypted block when animation starts
    (unencryptedBlock as any).visible = true;

    // Calculate animation duration based on distance and speed
    // Use duration of 0 when not exploded and not in tension state (blocks are hidden anyway)
    const distance =
      unencryptedBlock.position.z - (SCENE_DIMENSIONS.BLOCK.WIDTH / 2 + 0.1);
    const baseDuration = (distance / speed) * 16.67; // Convert to ms (assuming 60fps)
    const duration = this.isExploded || this.isTension ? baseDuration : 0;

    // Animate block movement using anime.js (same pattern as original)
    this.blockAnimationRef = animate(unencryptedBlock.position, {
      z: SCENE_DIMENSIONS.BLOCK.WIDTH / 2 + 0.1,
      duration,
      ease: "linear",
      onRender: () => {
        // Show encrypted block when unencrypted block passes through
        if (
          unencryptedBlock.position.z <= 1 &&
          !(encryptedBlock as any).visible
        ) {
          (encryptedBlock as any).visible = true;
          this.startTextureAnimation(encryptedBlock);
        }
      },
      onComplete: () => {
        // Remove unencrypted block when animation completes
        (blockSituation.group as any).remove(unencryptedBlock);

        // Add 3D cid text behind the encrypted block
        (cid as any).visible = true;

        // Increment encrypted blocks count and update display
        this.encryptedBlocksCount++;
        this.updateDisplayTexture();

        this.isBlockAnimating = false;
        this.stopTextureAnimation();
        this.blockAnimationRef = null;

        // Notify completion to React component
        onComplete?.();
      },
    });
  }

  private startTextureAnimation(encryptedBlock: THREE.Mesh) {
    let frameCount = 0;
    const material = encryptedBlock.material as any;

    // Store initial offsets for deterministic animation
    const initialX = material?.map?.offset.x || 0;
    const initialY = material?.map?.offset.y || 0;

    const animateTexture = () => {
      if (!this.isBlockAnimating) return;

      // Deterministic texture animation based on frame count and initial offset
      frameCount++;
      if (frameCount % 3 === 0 && material && material.map) {
        // Create deterministic but random-looking pattern using sine waves
        const time = frameCount * 0.1;
        material.map.offset.x = (initialX + Math.sin(time * 0.7) * 0.2) % 1;
        material.map.offset.y = (initialY + Math.cos(time * 0.5) * 0.2) % 1;
        material.map.needsUpdate = true;
      }

      if (this.isBlockAnimating) {
        requestAnimationFrame(animateTexture);
      }
    };
    animateTexture();
  }

  private stopTextureAnimation() {
    // Texture animation will stop when isBlockAnimating becomes false
  }

  // Helper method to create enclosure geometry with specific depth
  private createEnclosureGeometry(depth: number): THREE.BoxGeometry {
    return new THREE.BoxGeometry(
      SCENE_DIMENSIONS.ENCLOSURE.WIDTH +
        SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH,
      SCENE_DIMENSIONS.ENCLOSURE.HEIGHT +
        SCENE_DIMENSIONS.ENCLOSURE.BORDER_WIDTH,
      depth,
    );
  }

  // Method to animate enclosure thickness
  // @ts-ignore - duration parameter unused but kept for API consistency
  private animateEnclosureThickness(
    targetThickness: number,
    duration: number = 400,
    onComplete?: () => void,
  ) {
    // @ts-ignore - geometry exists on Mesh
    if (!this.enclosure.geometry) return;

    // Create new geometry with target thickness
    const newGeometry = this.createEnclosureGeometry(targetThickness);

    // Replace the geometry (this preserves children like display and button)
    // @ts-ignore - geometry exists on Mesh
    const oldGeometry = this.enclosure.geometry;
    // @ts-ignore
    this.enclosure.geometry = newGeometry;

    // Dispose of old geometry to prevent memory leaks
    oldGeometry.dispose();

    // Call completion callback immediately since geometry replacement is instant
    onComplete?.();
  }

  // Set explosion progress directly (for timeline seeking)
  // progress: 0 = normal, 0.5 = tension, 1.0 = exploded
  public setExplosionProgress(progress: number) {
    // Clamp progress to 0-1
    progress = Math.max(0, Math.min(1, progress));

    // Helper function to lerp between two values
    const lerp = (start: number, end: number, t: number) =>
      start + (end - start) * t;

    let enclosureZ: number;
    let dataLayerZ: number;
    let gridGroupZ: number;
    let enclosureBackZ: number;
    let chromeOffset: number;
    let thickness: number;

    if (progress <= 0.5) {
      // Interpolate from normal to tension (0.0 - 0.5)
      const t = progress * 2; // Map 0-0.5 to 0-1

      enclosureZ = lerp(
        EXPLOSION.NORMAL_POSITIONS.ENCLOSURE_Z,
        EXPLOSION.TENSION_POSITIONS.ENCLOSURE_Z,
        t,
      );
      dataLayerZ = lerp(
        EXPLOSION.NORMAL_POSITIONS.DATA_LAYER_Z,
        EXPLOSION.TENSION_POSITIONS.DATA_LAYER_Z,
        t,
      );
      gridGroupZ = lerp(
        EXPLOSION.NORMAL_POSITIONS.GRID_GROUP_Z,
        EXPLOSION.TENSION_POSITIONS.GRID_GROUP_Z,
        t,
      );
      enclosureBackZ = lerp(
        EXPLOSION.NORMAL_POSITIONS.ENCLOSURE_BACK_Z,
        EXPLOSION.TENSION_POSITIONS.ENCLOSURE_BACK_Z,
        t,
      );
      chromeOffset = lerp(
        EXPLOSION.NORMAL_POSITIONS.CHROME_OFFSET,
        EXPLOSION.TENSION_POSITIONS.CHROME_OFFSET,
        t,
      );
      thickness = lerp(
        SCENE_DIMENSIONS.ENCLOSURE.DEPTH,
        EXPLOSION.TENSION_THICKNESSES.ENCLOSURE,
        t,
      );
    } else {
      // Interpolate from tension to exploded (0.5 - 1.0)
      const t = (progress - 0.5) * 2; // Map 0.5-1.0 to 0-1

      enclosureZ = lerp(
        EXPLOSION.TENSION_POSITIONS.ENCLOSURE_Z,
        EXPLOSION.POSITIONS.ENCLOSURE_Z * EXPLOSION.FACTOR,
        t,
      );
      dataLayerZ = lerp(
        EXPLOSION.TENSION_POSITIONS.DATA_LAYER_Z,
        EXPLOSION.POSITIONS.DATA_LAYER_Z,
        t,
      );
      gridGroupZ = lerp(
        EXPLOSION.TENSION_POSITIONS.GRID_GROUP_Z,
        EXPLOSION.POSITIONS.GRID_GROUP_Z * EXPLOSION.FACTOR,
        t,
      );
      enclosureBackZ = lerp(
        EXPLOSION.TENSION_POSITIONS.ENCLOSURE_BACK_Z,
        EXPLOSION.POSITIONS.ENCLOSURE_BACK_Z * EXPLOSION.FACTOR,
        t,
      );
      chromeOffset = lerp(
        EXPLOSION.TENSION_POSITIONS.CHROME_OFFSET,
        EXPLOSION.POSITIONS.CHROME_OFFSET,
        t,
      );
      thickness = lerp(
        EXPLOSION.TENSION_THICKNESSES.ENCLOSURE,
        SCENE_DIMENSIONS.ENCLOSURE.DEPTH,
        t,
      );
    }

    // Set positions
    this.enclosure.position.z = enclosureZ;
    this.dataLayer.position.z = dataLayerZ;
    this.gridGroup.position.z = gridGroupZ;
    this.enclosureBack.position.z = enclosureBackZ;
    this.chrome.position.z = enclosureBackZ + chromeOffset;

    // Set thickness (instant geometry replacement)
    this.setEnclosureThickness(thickness);

    // Handle visibility - show grid/blocks when progress exceeds threshold
    const isVisible = progress > EXPLOSION.VISIBILITY_THRESHOLD;
    // @ts-ignore - visible exists on Group
    this.gridGroup.visible = isVisible;
    this.blockSituations.forEach((situation) => {
      // @ts-ignore - visible exists on Group
      situation.group.visible = isVisible;
    });

    // Update internal state flags
    this.isExploded = progress >= 1.0;
    this.isTension =
      progress > EXPLOSION.VISIBILITY_THRESHOLD && progress < 1.0;
  }

  // Helper to set enclosure thickness instantly
  private setEnclosureThickness(thickness: number) {
    // @ts-ignore - geometry exists on Mesh
    if (!this.enclosure.geometry) return;

    const newGeometry = this.createEnclosureGeometry(thickness);
    // @ts-ignore - geometry exists on Mesh
    const oldGeometry = this.enclosure.geometry;
    // @ts-ignore
    this.enclosure.geometry = newGeometry;
    oldGeometry.dispose();
  }

  // Animation methods
  public animateExplode(explode: boolean, onComplete?: () => void) {
    if (this.isAnimating) return;

    this.isAnimating = true;

    if (explode) {
      // Three-state explosion: normal → tension → exploded
      this.animateToTension(() => {
        this.animateToExploded(() => {
          this.isExploded = true;
          this.isTension = false;
          this.isAnimating = false;
          onComplete?.();
        });
      });
    } else {
      // Direct collapse: exploded → normal
      this.animateToNormal(() => {
        this.isExploded = false;
        this.isTension = false;
        this.isAnimating = false;
        onComplete?.();
      });
    }
  }

  private animateToTension(onComplete?: () => void) {
    this.isTension = true;

    // Show grid and all blocks when entering tension state
    // @ts-ignore - visible exists on Group
    this.gridGroup.visible = true;
    this.blockSituations.forEach((situation) => {
      // @ts-ignore - visible exists on Group
      situation.group.visible = true;
    });

    // Animate thickness to 0.4
    this.animateEnclosureThickness(
      EXPLOSION.TENSION_THICKNESSES.ENCLOSURE,
      ANIMATION_DURATIONS.EXPLOSION / 2,
    );

    // Create animation timeline for tension positions
    const animations = [
      {
        target: this.enclosure.position,
        z: EXPLOSION.TENSION_POSITIONS.ENCLOSURE_Z,
      },
      {
        target: this.dataLayer.position,
        z: EXPLOSION.TENSION_POSITIONS.DATA_LAYER_Z,
      },
      {
        target: this.gridGroup.position,
        z: EXPLOSION.TENSION_POSITIONS.GRID_GROUP_Z,
      },
      {
        target: this.enclosureBack.position,
        z: EXPLOSION.TENSION_POSITIONS.ENCLOSURE_BACK_Z,
      },
    ];

    let completedAnimations = 0;
    const totalAnimations = animations.length;

    animations.forEach((anim) => {
      animate(anim.target, {
        z: anim.z,
        duration: ANIMATION_DURATIONS.EXPLOSION / 2,
        ease: "inOutQuad",
        onRender: () => {
          // Update chrome position relative to enclosureBack
          this.chrome.position.z =
            this.enclosureBack.position.z +
            EXPLOSION.TENSION_POSITIONS.CHROME_OFFSET;
        },
        onComplete: () => {
          completedAnimations++;
          if (completedAnimations === totalAnimations) {
            onComplete?.();
          }
        },
      });
    });
  }

  private animateToExploded(onComplete?: () => void) {
    // Animate thickness back to 0.1
    this.animateEnclosureThickness(
      SCENE_DIMENSIONS.ENCLOSURE.DEPTH,
      ANIMATION_DURATIONS.EXPLOSION / 2,
    );

    // Create animation timeline for exploded positions
    const animations = [
      {
        target: this.enclosure.position,
        z: EXPLOSION.POSITIONS.ENCLOSURE_Z * EXPLOSION.FACTOR,
      },
      {
        target: this.dataLayer.position,
        z: EXPLOSION.POSITIONS.DATA_LAYER_Z,
      },
      {
        target: this.gridGroup.position,
        z: EXPLOSION.POSITIONS.GRID_GROUP_Z * EXPLOSION.FACTOR,
      },
      {
        target: this.enclosureBack.position,
        z: EXPLOSION.POSITIONS.ENCLOSURE_BACK_Z * EXPLOSION.FACTOR,
      },
    ];

    let completedAnimations = 0;
    const totalAnimations = animations.length;

    animations.forEach((anim) => {
      animate(anim.target, {
        z: anim.z,
        duration: ANIMATION_DURATIONS.EXPLOSION / 2,
        ease: "inOutQuad",
        onRender: () => {
          // Update chrome position relative to enclosureBack
          this.chrome.position.z =
            this.enclosureBack.position.z + EXPLOSION.POSITIONS.CHROME_OFFSET;
        },
        onComplete: () => {
          completedAnimations++;
          if (completedAnimations === totalAnimations) {
            onComplete?.();
          }
        },
      });
    });
  }

  private animateToNormal(onComplete?: () => void) {
    // Hide grid and all blocks when returning to normal state
    // @ts-ignore - visible exists on Group
    this.gridGroup.visible = false;
    this.blockSituations.forEach((situation) => {
      // @ts-ignore - visible exists on Group
      situation.group.visible = false;
    });

    // Animate thickness to normal (should already be 0.1)
    this.animateEnclosureThickness(
      SCENE_DIMENSIONS.ENCLOSURE.DEPTH,
      ANIMATION_DURATIONS.EXPLOSION,
    );

    // Create animation timeline for normal positions
    const animations = [
      {
        target: this.enclosure.position,
        z: EXPLOSION.NORMAL_POSITIONS.ENCLOSURE_Z,
      },
      {
        target: this.dataLayer.position,
        z: EXPLOSION.NORMAL_POSITIONS.DATA_LAYER_Z,
      },
      {
        target: this.gridGroup.position,
        z: EXPLOSION.NORMAL_POSITIONS.GRID_GROUP_Z,
      },
      {
        target: this.enclosureBack.position,
        z: EXPLOSION.NORMAL_POSITIONS.ENCLOSURE_BACK_Z,
      },
    ];

    let completedAnimations = 0;
    const totalAnimations = animations.length;

    animations.forEach((anim) => {
      animate(anim.target, {
        z: anim.z,
        duration: ANIMATION_DURATIONS.EXPLOSION,
        ease: "inOutQuad",
        onRender: () => {
          // Update chrome position relative to enclosureBack
          this.chrome.position.z =
            this.enclosureBack.position.z +
            EXPLOSION.NORMAL_POSITIONS.CHROME_OFFSET;
        },
        onComplete: () => {
          completedAnimations++;
          if (completedAnimations === totalAnimations) {
            onComplete?.();
          }
        },
      });
    });
  }

  public animateRecline(recline: boolean, onComplete?: () => void) {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.isReclined = recline;

    const targetRotation = recline ? -Math.PI / 2 : 0;

    this.currentAnimation = animate(this.group.rotation, {
      x: targetRotation,
      duration: ANIMATION_DURATIONS.RECLINE,
      ease: "inOutQuad",
      onComplete: () => {
        this.isAnimating = false;
        this.currentAnimation = null;
        onComplete?.();
      },
    });
  }

  // Button interactions
  public pressButton() {
    if ((this.button as any).scale.y > 0.5) {
      (this.button as any).scale.y = 0.5;
    }
  }

  public releaseButton() {
    (this.button as any).scale.y = 1;
  }

  // Display update
  private updateDisplayTexture() {
    // Create canvas for display content
    const canvas = document.createElement("canvas");
    canvas.width = SCENE_DIMENSIONS.DISPLAY.CANVAS.WIDTH;
    canvas.height = SCENE_DIMENSIONS.DISPLAY.CANVAS.HEIGHT;
    const ctx = canvas.getContext("2d")!;

    // Draw simple content on canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add some text
    ctx.fillStyle = COLORS.DISPLAY_TEXT;
    ctx.font = `${SCENE_DIMENSIONS.DISPLAY.FONT_SIZE}px dseg7_classic_miniregular`;
    // right
    ctx.textAlign = "right";
    ctx.fillText(
      this.encryptedBlocksCount.toString(),
      SCENE_DIMENSIONS.DISPLAY.TEXT_X,
      canvas.height / 2 + SCENE_DIMENSIONS.DISPLAY.FONT_SIZE / 2,
    );

    // Update texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Handle material array (display uses an array of materials with texture on index 1 and 2)
    if (Array.isArray(this.display.material)) {
      const textMaterial2 = this.display.material[2] as THREE.MeshToonMaterial;
      if (textMaterial2) {
        // @ts-ignore - map and needsUpdate exist on MeshToonMaterial
        textMaterial2.map = texture;
        // @ts-ignore
        textMaterial2.needsUpdate = true;
      }
    }
  }

  // Cleanup
  public dispose() {
    if (this.currentAnimation) {
      if (
        typeof this.currentAnimation === "object" &&
        "cancel" in this.currentAnimation
      ) {
        this.currentAnimation.cancel();
      }
    }

    // Cleanup block animations
    if (this.blockAnimationRef) {
      if (
        typeof this.blockAnimationRef === "object" &&
        "cancel" in this.blockAnimationRef
      ) {
        this.blockAnimationRef.cancel();
      }
    }

    // Clean up block situations
    this.blockSituations.forEach((situation) => {
      if ((situation.group as any).parent) {
        (situation.group as any).parent.remove(situation.group);
      }
      // Dispose block geometries and materials
      (situation.group as any).traverse((child: any) => {
        if (child instanceof THREE.Mesh) {
          (child as any).geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((material: any) => material.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    });
    this.blockSituations = [];

    // Remove from parent if it has one
    if ((this.group as any).parent) {
      (this.group as any).parent.remove(this.group);
    }

    // Dispose of geometries and materials
    (this.group as any).traverse((child: any) => {
      if (child instanceof THREE.Mesh) {
        (child as any).geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material: any) => material.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });

    // Remove from parent if it has one
    if ((this.group as any).parent) {
      (this.group as any).parent.remove(this.group);
    }
  }
}
