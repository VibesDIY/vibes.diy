import React, { useEffect, useRef } from "react";
import { animate } from "animejs";
import * as THREE from "three";
import { useSceneSetup } from "../../hooks/index.js";
import {
  COUNTERBOY_POSITIONS,
  ANIMATION_DURATIONS,
  CAMERA_VIEW_POSITIONS,
} from "../../constants/scene.js";
import { generateBlockPreset } from "../../factories/sceneObjects.js";
import { CounterBoy } from "../../classes/CounterBoy.js";
import { ScreenshotBoy } from "../../classes/ScreenshotBoy.js";

interface TimelineSegment {
  at: number; // start percentage (0-100)
  until: number; // end percentage (0-100)
  animation: ReturnType<typeof animate>; // paused anime.js animation
}

interface TimelinePoint {
  at: number; // trigger percentage (0-100)
  trigger: () => void; // callback to fire
}

type TimelineEntry = TimelineSegment | TimelinePoint;

interface AnimatedSceneProps {
  progress: number; // 0-100
  style?: React.CSSProperties;
}

export function AnimatedScene({ progress, style }: AnimatedSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneSetup = useSceneSetup(mountRef);

  // Timeline refs
  const masterTimelineSegmentsRef = useRef<TimelineEntry[]>([]);
  const lastPositionRef = useRef(0);
  const blockIndexRef = useRef<number>(0);
  const showRightCounterBoyRef = useRef(false);

  // Unified boom handler - always applies same block to BOTH CounterBoys
  const handleBoom = (source: "left" | "right") => {
    const leftCounterBoy = sceneSetup.counterBoyLeftRef.current;
    const rightCounterBoy = sceneSetup.counterBoyRightRef.current;

    const primaryCounterBoy =
      source === "left" ? leftCounterBoy : rightCounterBoy;
    const syncCounterBoy = source === "left" ? rightCounterBoy : leftCounterBoy;

    if (!primaryCounterBoy) return;

    // Press button on primary
    primaryCounterBoy.pressButton();

    // Release button and trigger block animation after short delay
    setTimeout(() => {
      primaryCounterBoy.releaseButton();

      // Generate ONE preset for BOTH CounterBoys
      const preset = generateBlockPreset(blockIndexRef.current);
      blockIndexRef.current++;

      // Trigger primary CounterBoy with full animation
      primaryCounterBoy.animateBlockEncryption(preset, () => {});

      // Sync to other CounterBoy after delay (instant appearance, same preset)
      setTimeout(() => {
        if (syncCounterBoy) {
          syncCounterBoy.animateBlockEncryption(preset, () => {}, true);
        }
      }, ANIMATION_DURATIONS.SYNC_DELAY);
    }, 100);
  };

  // Wrapper functions for timeline triggers
  const handleLeftBoom = () => handleBoom("left");
  const handleRightBoom = () => handleBoom("right");

  // Create master timeline score
  const makeScore = (): TimelineEntry[] => {
    const counterBoyLeft = sceneSetup.counterBoyLeftRef.current;
    const counterBoyRight = sceneSetup.counterBoyRightRef.current;
    const camera = sceneSetup.cameraRef.current;
    const screenshotBoys = sceneSetup.screenshotBoysRef.current;

    if (!counterBoyLeft || !counterBoyRight || !camera || !screenshotBoys) {
      return [];
    }

    const rotationTargets = [
      counterBoyLeft.group.rotation,
      counterBoyRight.group.rotation,
    ];
    const counterBoys = [counterBoyLeft, counterBoyRight];
    const iso1View = CAMERA_VIEW_POSITIONS.isometric1;

    // Create unified camera animation state
    const cameraAnimationState = {
      posX: camera.position.x,
      posY: camera.position.y,
      posZ: camera.position.z,
      rotX: camera.rotation.x,
      rotY: camera.rotation.y,
      camera: camera,
    };

    // Camera pan states for 2-up animation
    const targetOffsetX = COUNTERBOY_POSITIONS.RIGHT[0] / 2;
    const cameraPanState = {
      offsetX: 0,
      baseX: iso1View.x,
      camera: camera,
    };

    // Separate state for pan-back animation
    const cameraPanBackState = {
      offsetX: targetOffsetX,
      baseX: iso1View.x,
      camera: camera,
    };

    // Explosion animation state
    const explosionState = {
      progress: 0,
      counterBoys: counterBoys,
    };

    // Collapse animation state (starts at 1.0 and goes to 0)
    const collapseState = {
      progress: 1.0,
      counterBoys: counterBoys,
    };

    // ScreenshotBoys animation state
    const screenshotBoysState = {
      progress: 0,
      boys: screenshotBoys,
    };

    return [
      // Counterboy button presses
      {
        at: 2,
        trigger: handleLeftBoom,
      },
      {
        at: 4,
        trigger: handleLeftBoom,
      },
      // CounterBoy recline
      {
        at: 5,
        until: 10,
        animation: animate(rotationTargets, {
          x: -Math.PI / 2,
          duration: ANIMATION_DURATIONS.RECLINE,
          ease: "inOutQuad",
          autoplay: false,
        }),
      },
      // Camera position and rotation combined
      {
        at: 5,
        until: 10,
        animation: animate(cameraAnimationState, {
          posX: iso1View.x,
          posY: iso1View.y,
          posZ: iso1View.z,
          rotX: iso1View.rotationX,
          rotY: iso1View.rotationY,
          duration: ANIMATION_DURATIONS.CAMERA,
          ease: "inOutQuad",
          autoplay: false,
          onRender: () => {
            camera.position.set(
              cameraAnimationState.posX,
              cameraAnimationState.posY,
              cameraAnimationState.posZ,
            );
            camera.rotation.x = cameraAnimationState.rotX;
            camera.rotation.y = cameraAnimationState.rotY;
            camera.lookAt(0, 0, 0);
          },
        }),
      },
      // Explosion
      {
        at: 15,
        until: 20,
        animation: animate(explosionState, {
          progress: 1.0,
          duration: ANIMATION_DURATIONS.EXPLOSION,
          ease: "inOutQuad",
          autoplay: false,
          onRender: () => {
            // Update all CounterBoy instances with current explosion progress
            explosionState.counterBoys.forEach((counterBoy: CounterBoy) => {
              counterBoy.setExplosionProgress(explosionState.progress);
            });
          },
        }),
      },
      // Press button on exploded counterboy
      {
        at: 25,
        trigger: handleLeftBoom,
      },
      // Show second Counterboy
      {
        at: 28,
        until: 33,
        animation: animate(cameraPanState, {
          offsetX: targetOffsetX,
          duration: ANIMATION_DURATIONS.CAMERA,
          ease: "inOutQuad",
          autoplay: false,
          onRender: () => {
            camera.position.x = cameraPanState.baseX + cameraPanState.offsetX;
          },
        }),
      },
      // right boom
      {
        at: 38,
        trigger: handleRightBoom,
      },
      // left boom
      {
        at: 43,
        trigger: handleLeftBoom,
      },
      // hide second Counterboy, pan back
      {
        at: 58,
        until: 63,
        animation: animate(cameraPanBackState, {
          offsetX: 0,
          duration: ANIMATION_DURATIONS.CAMERA,
          ease: "inOutQuad",
          autoplay: false,
          onRender: () => {
            camera.position.x =
              cameraPanBackState.baseX + cameraPanBackState.offsetX;
          },
        }),
      },
      // Collapse (un-explode)
      {
        at: 68,
        until: 73,
        animation: animate(collapseState, {
          progress: 0,
          duration: ANIMATION_DURATIONS.EXPLOSION,
          ease: "inOutQuad",
          autoplay: false,
          onRender: () => {
            // Update all CounterBoy instances with current collapse progress
            collapseState.counterBoys.forEach((counterBoy: CounterBoy) => {
              counterBoy.setExplosionProgress(collapseState.progress);
            });
          },
        }),
      },
      {
        at: 78,
        trigger: handleLeftBoom,
      },
      // Show ScreenshotBoys
      {
        at: 83,
        until: 95,
        animation: animate(screenshotBoysState, {
          progress: 1.0,
          duration: ANIMATION_DURATIONS.SCREENSHOT_RISE,
          ease: "inOutQuad",
          autoplay: false,
          onRender: () => {
            // Update all ScreenshotBoy instances with current progress
            screenshotBoysState.boys.forEach((boy: ScreenshotBoy) => {
              // Enable transparency on all materials
              boy.group.traverse((child: THREE.Object3D) => {
                const mesh = child as THREE.Mesh;
                if (mesh.material) {
                  const materials = Array.isArray(mesh.material)
                    ? mesh.material
                    : [mesh.material];
                  materials.forEach((mat: THREE.Material) => {
                    mat.transparent = true;
                  });
                }
              });

              // Hide when fully transparent, show otherwise
              boy.group.visible = screenshotBoysState.progress > 0.125;

              // Interpolate position and opacity based on progress
              boy.group.position.y = -20 + 20 * screenshotBoysState.progress;
              boy.group.traverse((child: THREE.Object3D) => {
                const mesh = child as THREE.Mesh;
                if (mesh.material) {
                  const materials = Array.isArray(mesh.material)
                    ? mesh.material
                    : [mesh.material];
                  materials.forEach((mat: THREE.Material) => {
                    mat.opacity = screenshotBoysState.progress;
                  });
                }
              });
            });
          },
        }),
      },
    ];
  };

  // Seek timeline to specific position
  const seekTimeline = (position: number) => {
    // Build segments if they don't exist
    if (masterTimelineSegmentsRef.current.length === 0) {
      masterTimelineSegmentsRef.current = makeScore();
    }

    const lastPosition = lastPositionRef.current;

    // Seek each segment based on its timing
    masterTimelineSegmentsRef.current.forEach((entry) => {
      // Handle trigger points
      if ("trigger" in entry) {
        // Fire trigger if we're crossing the 'at' point forward
        if (lastPosition < entry.at && position >= entry.at) {
          entry.trigger();
        }
        return;
      }

      // Handle animation segments
      const { at, until, animation } = entry;

      let segmentProgress: number;

      if (position < at) {
        segmentProgress = 0;
      } else if (position > until) {
        segmentProgress = 1;
      } else {
        segmentProgress = (position - at) / (until - at);
      }

      // Seek animation to the calculated progress
      const time = segmentProgress * animation.duration;
      animation.seek(time);
    });

    lastPositionRef.current = position;

    // Show/hide right counterboy based on position
    const shouldShowRight = position >= 33 && position < 58;
    if (shouldShowRight !== showRightCounterBoyRef.current) {
      showRightCounterBoyRef.current = shouldShowRight;
      if (sceneSetup.counterBoyRightRef.current) {
        sceneSetup.counterBoyRightRef.current.group.visible = shouldShowRight;
      }
    }
  };

  // Initialize scene on mount
  useEffect(() => {
    const result = sceneSetup.initializeScene();
    if (!result) return;

    const { scene, camera, renderer } = result;

    // Set initial camera view (front view)
    camera.rotation.order = "YXZ";
    camera.position.set(0, 0, 15);
    camera.rotation.y = 0;
    camera.rotation.x = 0;
    camera.lookAt(0, 0, 0);

    // Hide right counterboy initially
    if (sceneSetup.counterBoyRightRef.current) {
      sceneSetup.counterBoyRightRef.current.group.visible = false;
    }

    // Setup resize handler
    const removeResizeHandler = sceneSetup.setupResizeHandler(renderer, camera);

    // Force an immediate render with correct aspect ratio
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    // Start render loop
    sceneSetup.startRenderLoop(renderer, scene, camera);

    return () => {
      removeResizeHandler();
      sceneSetup.cleanup();

      // Cancel all animations
      masterTimelineSegmentsRef.current.forEach((entry) => {
        if ("animation" in entry && entry.animation) {
          try {
            entry.animation.pause();
          } catch (e) {
            // Ignore errors
          }
        }
      });
      masterTimelineSegmentsRef.current = [];
    };
  }, []);

  // Update timeline when progress changes
  useEffect(() => {
    // Only seek if scene is initialized
    if (sceneSetup.cameraRef.current) {
      seekTimeline(progress);
    }
  }, [progress]);

  return (
    <div
      ref={mountRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    />
  );
}
