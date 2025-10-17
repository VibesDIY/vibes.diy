# Hosted Dev Environment

A Vite-based development environment that mimics the hosted app experience on vibesdiy.net with fast HMR for use-vibes development.

## 🎯 Purpose

This example provides developers with a local environment that closely matches what runs on vibesdiy.net, allowing you to:

- **Test authentication flows** - Experience the AuthWall and Fireproof sync
- **Debug AI integration** - Test call-ai with the same APIs as hosted apps
- **Develop with live HMR** - Edit use-vibes source files and see changes instantly
- **Test different configurations** - Use URL parameters to override settings

## 🚀 Quick Start

```bash
# From the repo root
pnpm install

# Start the dev server
cd use-vibes/examples/hosted-dev
pnpm dev
```

The app will open at `http://localhost:3456`

## 🏗️ Architecture

This app closely mirrors the hosted environment:

### HTML Structure

- `#container` - Main React app mount point (like hosted apps)
- `#vibe-control` - Vibes overlay mount point (like hosted apps)
- Tailwind CSS from CDN (like hosted apps)

### Global Variables

- `window.CALLAI_API_KEY` - API key for AI calls
- `window.CALLAI_CHAT_URL` - Chat API endpoint
- `window.CALLAI_IMG_URL` - Image API endpoint

### Initialization Pattern

```typescript
// Same as hosted apps:
1. Set up globals
2. Mount React app to #container
3. Mount vibes overlay to #vibe-control
```

## 🎛️ URL Parameters

Override environment settings via URL parameters (like hosted apps):

```
http://localhost:3456/?api_key=custom&chat_url=https://custom-api.com
```

Available parameters:

- `api_key` - Override CALLAI_API_KEY
- `chat_url` - Override CALLAI_CHAT_URL
- `img_url` - Override CALLAI_IMG_URL

## 🔧 Development Features

### Live HMR

Edit files in `use-vibes/pkg` and see changes instantly without rebuilding.

### Workspace Dependencies

Uses `"use-vibes": "workspace:*"` for direct development on the local package.

### Debug Info

Check the browser console for detailed initialization logs and helpful development tips.

## 📝 Sample App Features

The included sample app demonstrates:

1. **Environment Status** - Shows current configuration
2. **Database Integration** - Add/view messages with Fireproof
3. **Sync Controls** - Enable/disable database sync
4. **AI Integration** - Test call-ai with real API calls
5. **Authentication** - Triggers AuthWall when sync is enabled

## 🔍 Testing Scenarios

### Authentication Flow

1. Click "Enable Sync" to trigger the AuthWall
2. Experience the login flow (same as hosted apps)
3. Test that AI calls work with authentication

### API Integration

1. Click "Test AI Call" to verify call-ai integration
2. Check that the correct API key and URL are used
3. Test different models and parameters

### Database Sync

1. Add messages to test Fireproof database
2. Enable sync to test cloud persistence
3. Verify data syncs across browser tabs

## 🆚 vs Production

| Feature          | Hosted Dev   | Production           |
| ---------------- | ------------ | -------------------- |
| Module Loading   | Vite ESM     | Import Maps + ESM.sh |
| JSX Transform    | Compile-time | Runtime Babel        |
| HMR              | ✅ Fast      | ❌ None              |
| use-vibes Source | Workspace    | npm Package          |
| Environment      | Mock         | Real                 |

## 🛠️ Customization

### Add New Features

Edit `src/App.tsx` to test new use-vibes features or patterns.

### Change Configuration

Edit `src/setup.ts` to modify global variables or add new ones.

### Test Different Versions

In production, use URL params like `?v_vibes=0.13.4` to test different versions. In dev, edit package.json dependencies.

## 📚 Related

- **Production Replica**: `use-vibes/examples/react-example` (MountVibesAppExample)
- **Hosted Template**: `hosting/base/apptemplate.ts`
- **Live Apps**: https://vibesdiy.net

This dev environment bridges the gap between local development speed and production environment fidelity.
