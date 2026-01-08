# Cloudflare React Hello World

A simple React application ready to deploy on Cloudflare Pages.

## Development

Install dependencies:
```bash
pnpm install
```

Run development server:
```bash
pnpm dev
```

## Build

Build for production:
```bash
pnpm build
```

Preview production build:
```bash
pnpm preview
```

## Deploy to Cloudflare Pages

### Option 1: Using Wrangler CLI

```bash
pnpm deploy
```

### Option 2: Using Cloudflare Dashboard

1. Push your code to a Git repository
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
3. Click "Create a project"
4. Connect your Git repository
5. Configure build settings:
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Root directory: `/`
6. Click "Save and Deploy"

## Tech Stack

- React 18
- TypeScript
- Vite
- Cloudflare Pages
