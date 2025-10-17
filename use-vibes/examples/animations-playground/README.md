# Animations Playground

A TypeScript + React playground for experimenting with CSS animations, built with Vite.

## Getting Started

```bash
# Install dependencies from the monorepo root
pnpm install

# Run the development server
pnpm dev
```

The app will be available at `http://localhost:5173`

## Features

- Multiple CSS animation examples (fade, spin, bounce, pulse, rainbow)
- Interactive controls to switch between animations
- TypeScript for type safety
- Hot module replacement with Vite

## Adding New Animations

1. Add your CSS animation keyframes in `src/App.css`
2. Add the animation type to the `AnimationType` type in `src/App.tsx`
3. Add the animation to the `animations` array
4. Add a case in the `getAnimationClass()` function

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Lint code with ESLint
- `pnpm preview` - Preview production build

## Tech Stack

- React 19
- TypeScript 5.9
- Vite 7
- ESLint 9
