import { useRef } from "react";
import * as THREE from "three";
import {
  SCENE_DIMENSIONS,
  COLORS,
  LIGHTING,
  RENDERING,
  COUNTERBOY_POSITIONS,
} from "../constants/scene.js";
import { CounterBoy } from "../classes/CounterBoy.js";
import { ScreenshotBoy } from "../classes/ScreenshotBoy.js";
import bonsaiImg from "../assets/screenshots/bonsai.png";
import deasImg from "../assets/screenshots/deas.png";
import encryptImg from "../assets/screenshots/encrypt.png";
import pickathonImg from "../assets/screenshots/pickathon.png";
import puzzleImg from "../assets/screenshots/puzzle.png";

export function useSceneSetup(
  mountRef: React.RefObject<HTMLDivElement | null>,
) {
  const sceneRef = useRef<THREE.Scene | undefined>(undefined);
  const rendererRef = useRef<THREE.WebGLRenderer | undefined>(undefined);
  const cameraRef = useRef<THREE.OrthographicCamera | undefined>(undefined);
  const counterBoyLeftRef = useRef<CounterBoy | undefined>(undefined);
  const counterBoyRightRef = useRef<CounterBoy | undefined>(undefined);
  const screenshotBoysRef = useRef<ScreenshotBoy[]>([]);
  const replicatorRef = useRef<THREE.Mesh | undefined>(undefined);
  const axesHelperRef = useRef<THREE.AxesHelper | undefined>(undefined);

  const initializeScene = () => {
    if (!mountRef.current) return null;

    mountRef.current.innerHTML = "";

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(
      SCENE_DIMENSIONS.FRUSTUM.WIDTH / -2,
      SCENE_DIMENSIONS.FRUSTUM.WIDTH / 2,
      SCENE_DIMENSIONS.FRUSTUM.HEIGHT / 2,
      SCENE_DIMENSIONS.FRUSTUM.HEIGHT / -2,
      RENDERING.CAMERA.NEAR,
      RENDERING.CAMERA.FAR,
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight,
    );
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, RENDERING.PIXEL_RATIO_MAX),
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Create CounterBoy instances
    const counterBoyLeft = new CounterBoy({
      position: COUNTERBOY_POSITIONS.LEFT as [number, number, number],
      id: "counterboy-left",
      scene: scene,
    });
    const counterBoyRight = new CounterBoy({
      position: COUNTERBOY_POSITIONS.RIGHT as [number, number, number],
      id: "counterboy-right",
      scene: scene,
    });
    // Store references
    counterBoyLeftRef.current = counterBoyLeft;
    counterBoyRightRef.current = counterBoyRight;

    scene.add(counterBoyLeft.group);
    scene.add(counterBoyRight.group);

    // Create ScreenshotBoy instances at grid positions
    const gridValues = [-18, -9, 0, 9, 18];

    const screenshots = [
      bonsaiImg,
      deasImg,
      encryptImg,
      pickathonImg,
      puzzleImg,
    ];

    const screenshotBoys: ScreenshotBoy[] = [];
    let screenshotIndex = 0;

    for (const x of gridValues) {
      for (const z of gridValues) {
        // Skip the origin position (0, 0, 0)
        if (x === 0 && z === 0) {
          continue;
        }

        const screenshotBoy = new ScreenshotBoy({
          position: [x, 0, z],
          id: `screenshotboy-${x}-${z}`,
          color: 0xffffff, // white
          screenshotPath: screenshots[screenshotIndex % screenshots.length],
          scene: scene,
        });
        screenshotBoys.push(screenshotBoy);
        scene.add(screenshotBoy.group);
        screenshotBoy.group.visible = false;
        screenshotIndex++;
      }
    }

    screenshotBoysRef.current = screenshotBoys;

    // Create replicator cube (small green cube at midpoint)
    const replicatorGeometry = new THREE.BoxGeometry(
      SCENE_DIMENSIONS.REPLICATOR.WIDTH,
      SCENE_DIMENSIONS.REPLICATOR.HEIGHT,
      SCENE_DIMENSIONS.REPLICATOR.DEPTH,
    );
    const replicatorMaterial = new THREE.MeshLambertMaterial({
      color: COLORS.REPLICATOR,
      transparent: true,
      opacity: COLORS.REPLICATOR_OPACITY,
    });
    const replicator = new THREE.Mesh(replicatorGeometry, replicatorMaterial);

    // Position at midpoint between origin and right CounterBoy
    const midpoint = COUNTERBOY_POSITIONS.RIGHT[0] / 2;
    replicator.position.set(midpoint, 0, 0);
    replicator.visible = false; // Hidden by default
    replicatorRef.current = replicator;
    scene.add(replicator);

    // Add helpers and environment
    // const axesHelper = new THREE.AxesHelper(SCENE_DIMENSIONS.AXES_HELPER_SIZE)
    // axesHelperRef.current = axesHelper
    // scene.add(axesHelper)

    const groundGeometry = new THREE.PlaneGeometry(
      SCENE_DIMENSIONS.GROUND.SIZE,
      SCENE_DIMENSIONS.GROUND.SIZE,
    );
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: COLORS.GROUND,
      transparent: true,
      opacity: SCENE_DIMENSIONS.GROUND.OPACITY,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    // scene.add(ground)

    // Add lighting
    const ambientLight = new THREE.AmbientLight(
      COLORS.AMBIENT_LIGHT,
      LIGHTING.AMBIENT_INTENSITY,
    );
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
      COLORS.DIRECTIONAL_LIGHT,
      LIGHTING.DIRECTIONAL.INTENSITY,
    );
    directionalLight.position.set(
      LIGHTING.DIRECTIONAL.POSITION.x,
      LIGHTING.DIRECTIONAL.POSITION.y,
      LIGHTING.DIRECTIONAL.POSITION.z,
    );
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width =
      LIGHTING.DIRECTIONAL.SHADOW_MAP_SIZE;
    directionalLight.shadow.mapSize.height =
      LIGHTING.DIRECTIONAL.SHADOW_MAP_SIZE;
    directionalLight.lookAt(new THREE.Vector3(0, 0, 0));
    scene.add(directionalLight);

    return { scene, camera, renderer, counterBoyLeft, counterBoyRight };
  };

  const setupResizeHandler = (
    renderer: THREE.WebGLRenderer,
    camera: THREE.OrthographicCamera,
  ) => {
    const handleResize = () => {
      if (!mountRef.current || !renderer) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      renderer.setSize(width, height);

      if (camera) {
        const aspect = width / height;
        const frustumHalfWidth = SCENE_DIMENSIONS.FRUSTUM.WIDTH / 2;
        const frustumHalfHeight = SCENE_DIMENSIONS.FRUSTUM.HEIGHT / 2;
        camera.left = -frustumHalfWidth * aspect;
        camera.right = frustumHalfWidth * aspect;
        camera.top = frustumHalfHeight;
        camera.bottom = -frustumHalfHeight;
        camera.updateProjectionMatrix();
      }
    };

    // Call immediately to set initial size
    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  };

  const startRenderLoop = (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.OrthographicCamera,
  ) => {
    const animate = () => {
      requestAnimationFrame(animate);
      // Render loop - no individual object animations needed
      renderer.render(scene, camera);
    };
    animate();
  };

  const cleanup = () => {
    if (mountRef.current && rendererRef.current?.domElement) {
      mountRef.current.removeChild(rendererRef.current.domElement);
    }
    rendererRef.current?.dispose();

    // Cleanup CounterBoy instances
    counterBoyLeftRef.current?.dispose();
    counterBoyRightRef.current?.dispose();

    // Cleanup ScreenshotBoy instances
    screenshotBoysRef.current.forEach((boy) => boy.dispose());

    // Cleanup replicator
    if (replicatorRef.current) {
      replicatorRef.current.geometry?.dispose();
      const material = replicatorRef.current.material;
      if (material) {
        if (Array.isArray(material)) {
          material.forEach((mat) => mat.dispose());
        } else {
          material.dispose();
        }
      }
    }
  };

  return {
    sceneRef,
    rendererRef,
    cameraRef,
    counterBoyLeftRef,
    counterBoyRightRef,
    screenshotBoysRef,
    replicatorRef,
    axesHelperRef,
    initializeScene,
    setupResizeHandler,
    startRenderLoop,
    cleanup,
  };
}
