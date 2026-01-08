# Vibes DIY - Static Landing Page

A standalone HTML/CSS/JS version of the vibes.diy marketing landing page, extracted from the React application.

## Structure

```
landing-page/
├── index.html          - Main HTML page
├── styles.css          - All styles (extracted from CSS-in-JS)
├── main.js             - Interactive functionality
├── assets/
│   ├── images/         - GIFs and PNGs
│   │   ├── computer-anim.gif
│   │   ├── rainbow-computer.gif
│   │   ├── mouth.gif
│   │   ├── html.png
│   │   ├── fireproof-logo.png
│   │   └── vibe-zone.png
│   └── fonts/          - Custom fonts
│       ├── AlteHaasGroteskBold.ttf
│       └── AlteHaasGroteskRegular.ttf
└── README.md           - This file
```

## External Dependencies (loaded via CDN)

- **THREE.js** (~150KB gzipped) - 3D graphics
- **AnimeJS** (~17KB gzipped) - Animation library
- **jQuery** (~30KB gzipped) - DOM manipulation (for terminal)
- **jQuery Terminal** (~15KB gzipped) - Terminal emulator

## Usage

Simply open `index.html` in a web browser. No build step required.

For local development with proper CORS support, you can use a simple HTTP server:

```bash
# Python 3
python -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## Features

- **Responsive Design** - Works on desktop and mobile
- **Light Mode** - Static light theme
- **Interactive Terminal** - Press Enter to see the AI response
- **3D Animation** - Simplified THREE.js scene (scroll to animate)
- **Chat Demo** - Static chat conversation display
- **Scroll-driven Sections** - Text sections change based on scroll position

## Notes

### THREE.js Scene
The 3D animated scene is a simplified version. The original React app uses custom `CounterBoy` and `ScreenshotBoy` classes with complex explosion/collapse animations. The static version includes a simpler representation that demonstrates the scroll-driven animation concept.

To fully replicate the original animation, you would need to port:
- `CounterBoy.ts` class
- `ScreenshotBoy.ts` class
- `useSceneSetup.ts` hook
- `sceneObjects.ts` factories

### Chat Messages
The chat demo shows the "Friendsgiving" scenario. The original app randomly selects from 3 scenarios on each load.

### Dark Mode
This static version is light-mode only. The original supports both light and dark themes via CSS custom properties and localStorage.

## Source

Extracted from the vibes.diy React application:
- `pkg/app/pages/HomeScreen/HomeScreen.tsx`
- `pkg/app/pages/HomeScreen/HomeScreen.styles.ts`
- `pkg/app/pages/HomeScreen/AnimatedScene.tsx`
- `pkg/app/pages/HomeScreen/TerminalDemo.tsx`
- `pkg/app/pages/HomeScreen/SideMenu.tsx`

## License

Copyright Vibes DIY. All rights reserved.
