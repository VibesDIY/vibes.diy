/**
 * Vibes DIY Landing Page - Main JavaScript
 * Ported from React components to vanilla JS
 */

(function() {
  'use strict';

  // ==========================================================================
  // Configuration & State
  // ==========================================================================

  let animationProgress = 0;
  let isMobile = window.innerWidth <= 768;
  let terminalInstance = null;

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function getAbsoluteTop(element) {
    let top = 0;
    let current = element;
    while (current) {
      top += current.offsetTop;
      current = current.offsetParent;
    }
    return top;
  }

  // ==========================================================================
  // Background Positioning
  // ==========================================================================

  function updateSectionBackgrounds() {
    const sections = [
      { id: 'section0', bgClass: 'section-bg-0' },
      { id: 'section1', bgClass: 'section-bg-1' },
      { id: 'section3', bgClass: 'section-bg-3' },
      { id: 'section5', bgClass: 'section-bg-5' },
      { id: 'section8', bgClass: 'section-bg-8' },
    ];

    sections.forEach(({ id, bgClass }) => {
      const section = document.getElementById(id);
      const bg = document.querySelector('.' + bgClass);

      if (section && bg) {
        const absoluteTop = getAbsoluteTop(section);
        const height = section.offsetHeight;
        const offset = isMobile ? -200 : 0;
        const extraHeight = isMobile ? 300 : 30;

        bg.style.top = (absoluteTop + offset) + 'px';
        bg.style.height = (height + extraHeight) + 'px';
      }
    });
  }

  // ==========================================================================
  // Animation Progress & Text Sections
  // ==========================================================================

  function updateAnimationTextSections(progress) {
    const section1 = document.getElementById('animTextSection1');
    const section2 = document.getElementById('animTextSection2');
    const section3 = document.getElementById('animTextSection3');

    if (!section1 || !section2 || !section3) return;

    // Show/hide sections based on progress
    if (progress < 33) {
      section1.classList.remove('hidden');
      section2.classList.add('hidden');
      section3.classList.add('hidden');
    } else if (progress < 66) {
      section1.classList.add('hidden');
      section2.classList.remove('hidden');
      section3.classList.add('hidden');
    } else {
      section1.classList.add('hidden');
      section2.classList.add('hidden');
      section3.classList.remove('hidden');
    }
  }

  function setAnimationProgress(progress) {
    animationProgress = Math.max(0, Math.min(100, progress));
    updateAnimationTextSections(animationProgress);

    // If THREE.js scene is initialized, update it
    if (window.vibesScene && window.vibesScene.seekTimeline) {
      window.vibesScene.seekTimeline(animationProgress);
    }
  }

  // ==========================================================================
  // Scroll Handling
  // ==========================================================================

  function setupScrollHandlers() {
    const animatedSceneWrapper = document.getElementById('animatedSceneWrapper');

    if (animatedSceneWrapper) {
      animatedSceneWrapper.addEventListener('scroll', function() {
        const { scrollTop, scrollHeight, clientHeight } = this;
        const progress = scrollHeight > clientHeight
          ? (scrollTop / (scrollHeight - clientHeight)) * 100
          : 0;
        setAnimationProgress(progress);
      }, { passive: true });
    }
  }

  // ==========================================================================
  // Side Menu
  // ==========================================================================

  function setupSideMenu() {
    const menuOverlay = document.getElementById('sideMenuOverlay');
    const sideMenu = document.getElementById('sideMenu');
    const closeBtn = document.getElementById('closeSideMenu');

    if (!menuOverlay || !sideMenu) return;

    function openMenu() {
      menuOverlay.classList.add('open');
      sideMenu.classList.add('open');
    }

    function closeMenu() {
      menuOverlay.classList.remove('open');
      sideMenu.classList.remove('open');
    }

    // Close on overlay click
    menuOverlay.addEventListener('click', closeMenu);

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }

    // Expose for navbar button (if needed)
    window.openSideMenu = openMenu;
    window.closeSideMenu = closeMenu;
  }

  // ==========================================================================
  // Terminal Demo
  // ==========================================================================

  function initTerminalDemo() {
    const terminalContainer = document.getElementById('terminalDemo');
    if (!terminalContainer || !window.$ || typeof window.$.fn.terminal !== 'function') {
      // Retry after a short delay if jQuery Terminal isn't loaded yet
      setTimeout(initTerminalDemo, 100);
      return;
    }

    const $ = window.$;
    let animationActive = true;
    let hasSubmitted = false;

    const responseLines = [
      { text: "A simple target. Let me mutate your local app state", delay: 25 },
      { text: "and let the library worry about the network.", delay: 25 },
      { text: "", delay: 400 },
      { text: "LLMs are great at local JavaScript state.", delay: 25 },
      { text: "They're bad at distributed systems.", delay: 25 },
      { text: "", delay: 300 },
      { text: "Why?", delay: 30 },
      { text: "", delay: 400 },
      { text: "I reason inside language, not across networks.", delay: 25 },
      { text: "Code and local state are expressed directly in text,", delay: 25 },
      { text: "inside a single context.", delay: 25 },
      { text: "", delay: 300 },
      { text: "Network calls, servers, retries, timeouts, and", delay: 25 },
      { text: "eventual consistency exist outside that context.", delay: 25 },
      { text: "", delay: 300 },
      { text: "When you ask me to generate a traditional web app,", delay: 25 },
      { text: "you're asking me to reason about:", delay: 25 },
      { text: "  • things happening later,", delay: 20 },
      { text: "  • somewhere else,", delay: 20 },
      { text: "  • possibly not at all.", delay: 20 },
      { text: "", delay: 300 },
      { text: "That's friction.", delay: 30 },
      { text: "", delay: 400 },
      { text: "The local-first Vibes DIY web stack removes it.", delay: 25 },
    ];

    let lineIndex = 0;

    function typeResponseLines(term) {
      if (!animationActive) return;

      if (lineIndex >= responseLines.length) {
        return;
      }

      const line = responseLines[lineIndex];
      if (line.text === "") {
        term.echo("");
        lineIndex++;
        setTimeout(() => typeResponseLines(term), line.delay);
      } else {
        term.typing("echo", line.delay, line.text, () => {
          lineIndex++;
          setTimeout(() => typeResponseLines(term), 200);
        });
      }
    }

    // Create terminal
    const term = $(terminalContainer).terminal(
      function() {
        if (hasSubmitted) return;
        hasSubmitted = true;

        this.set_prompt("");
        this.disable();
        this.echo("");
        typeResponseLines(this);
      },
      {
        greetings: false,
        prompt: "[[;#888;]Press Enter to continue...] ",
        enabled: false,
        clickTimeout: null,
        scrollOnEcho: false,
        scrollBottomOffset: 0,
        wrap: true,
        checkArity: false,
        completion: false,
        onFocus: function() { return false; },
        onBlur: function() { return false; },
        keypress: function(e) {
          if (e.key.length === 1) {
            return false;
          }
        },
      }
    );

    terminalInstance = term;

    // Colors
    const orange = "#DA291C";
    const yellow = "#FEDD00";
    const blue = "#009ACE";
    const cream = "var(--vibes-cream)";
    const dimGray = "#555";

    // Display header
    term.echo(`[[;${orange};]  ╭──────────────────────────────────────────╮]`);
    term.echo(`[[;${orange};]  │              [[;${yellow};]Vibes OS v.0.1[[;${orange};]              │]`);
    term.echo(`[[;${orange};]  │                                          │]`);
    term.echo(`[[;${orange};]  │           [[;${cream};]Welcome, Vibe Coder![[;${orange};]           │]`);
    term.echo(`[[;${orange};]  │                                          │]`);
    term.echo(`[[;${orange};]  │                  [[;${orange};] [[;${blue};]^__^[[;${orange};][[;${orange};]                   │]`);
    term.echo(`[[;${orange};]  │                                          │]`);
    term.echo(`[[;${orange};]  │         [[;${blue};]Vibes 4.5[[;${orange};] · [[;${yellow};]Local-First[[;${orange};]          │]`);
    term.echo(`[[;${orange};]  │          [[;${dimGray};]~/your-brilliant-idea[[;${orange};]           │]`);
    term.echo(`[[;${orange};]  ╰──────────────────────────────────────────╯]`);
    term.echo("");
    term.echo(`[[;${blue};]> What do you actually want to generate?]`);
    term.echo("");

    // Enable after delay
    setTimeout(() => {
      term.enable();
    }, 300);
  }

  // ==========================================================================
  // THREE.js Scene (Placeholder/Simplified)
  // ==========================================================================

  function initAnimatedScene() {
    const container = document.getElementById('animatedSceneCanvas');
    if (!container || typeof THREE === 'undefined') {
      console.warn('THREE.js not loaded or container not found');
      return;
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5dc); // Cream color

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // Create a simple placeholder cube (represents CounterBoy)
    const geometry = new THREE.BoxGeometry(3, 4, 2);
    const material = new THREE.MeshLambertMaterial({ color: 0x5398c9 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Add some smaller blocks on top (simplified block stack)
    const blockColors = [0xDA291C, 0xEDCE02, 0x5398c9, 0x231F20];
    const blocks = [];
    for (let i = 0; i < 4; i++) {
      const blockGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
      const blockMat = new THREE.MeshLambertMaterial({ color: blockColors[i] });
      const block = new THREE.Mesh(blockGeo, blockMat);
      block.position.set(
        (Math.random() - 0.5) * 1.5,
        2.5 + i * 0.5,
        (Math.random() - 0.5) * 0.5
      );
      scene.add(block);
      blocks.push(block);
    }

    // Animation state
    let explosionProgress = 0;
    let targetExplosion = 0;

    // Expose scene control for scroll-based animation
    window.vibesScene = {
      seekTimeline: function(progress) {
        // Simplified animation based on scroll progress
        if (progress < 15) {
          targetExplosion = 0;
          cube.rotation.x = 0;
        } else if (progress >= 15 && progress < 68) {
          // Explosion state
          targetExplosion = 1;
          cube.rotation.x = -Math.PI / 4;
        } else {
          // Collapse back
          targetExplosion = 0;
          cube.rotation.x = 0;
        }

        // Camera movement
        if (progress >= 5 && progress < 10) {
          const t = (progress - 5) / 5;
          camera.position.y = t * 5;
          camera.position.z = 15 - t * 5;
        }

        if (progress >= 28 && progress < 58) {
          camera.position.x = 3;
        } else {
          camera.position.x = 0;
        }

        camera.lookAt(0, 0, 0);
      }
    };

    // Render loop
    function animate() {
      requestAnimationFrame(animate);

      // Smooth explosion animation
      explosionProgress += (targetExplosion - explosionProgress) * 0.05;

      // Animate blocks based on explosion progress
      blocks.forEach((block, i) => {
        const baseY = 2.5 + i * 0.5;
        const explodeOffset = explosionProgress * (3 + i * 0.5);
        const angle = (i / blocks.length) * Math.PI * 2;

        block.position.x = Math.sin(angle) * explodeOffset * 2;
        block.position.y = baseY + explodeOffset;
        block.position.z = Math.cos(angle) * explodeOffset;

        block.rotation.x += 0.01 * explosionProgress;
        block.rotation.y += 0.02 * explosionProgress;
      });

      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    function handleResize() {
      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    window.addEventListener('resize', debounce(handleResize, 100));
  }

  // ==========================================================================
  // Mobile Detection & Responsive Updates
  // ==========================================================================

  function updateMobileState() {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;

    if (wasMobile !== isMobile) {
      updateSectionBackgrounds();
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Setup components
    setupSideMenu();
    setupScrollHandlers();

    // Update backgrounds after layout settles
    setTimeout(updateSectionBackgrounds, 100);

    // Initialize terminal when jQuery Terminal is ready
    if (window.$ && window.$.fn && window.$.fn.terminal) {
      setTimeout(initTerminalDemo, 500);
    } else {
      // Wait for jQuery Terminal to load
      const checkTerminal = setInterval(() => {
        if (window.$ && window.$.fn && window.$.fn.terminal) {
          clearInterval(checkTerminal);
          setTimeout(initTerminalDemo, 100);
        }
      }, 100);
    }

    // Initialize THREE.js scene
    if (typeof THREE !== 'undefined') {
      setTimeout(initAnimatedScene, 100);
    } else {
      // Wait for THREE.js to load
      const checkThree = setInterval(() => {
        if (typeof THREE !== 'undefined') {
          clearInterval(checkThree);
          setTimeout(initAnimatedScene, 100);
        }
      }, 100);
    }

    // Handle window resize
    window.addEventListener('resize', debounce(() => {
      updateMobileState();
      updateSectionBackgrounds();
    }, 300));

    // Initial mobile check
    updateMobileState();
  }

  // Start initialization
  init();

})();
