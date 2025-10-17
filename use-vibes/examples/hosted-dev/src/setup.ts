// Mock hosted environment globals
// This file sets up the same global variables that hosted apps have access to

// Declare global types for TypeScript
declare global {
  interface Window {
    CALLAI_API_KEY?: string;
    CALLAI_CHAT_URL?: string;
    CALLAI_IMG_URL?: string;
  }
}

// Set up the hosted environment globals
window.CALLAI_API_KEY = 'sk-vibes-proxy-managed';
window.CALLAI_CHAT_URL = 'https://vibesdiy.net';
window.CALLAI_IMG_URL = 'https://vibesdiy.net';

// Support URL parameter overrides like the hosted environment
const params = new URLSearchParams(window.location.search);

if (params.get('api_key')) {
  window.CALLAI_API_KEY = params.get('api_key')!;
}

if (params.get('chat_url')) {
  window.CALLAI_CHAT_URL = params.get('chat_url')!;
}

if (params.get('img_url')) {
  window.CALLAI_IMG_URL = params.get('img_url')!;
}

// Log setup for debugging
console.log('🔧 Hosted Dev Environment Setup:', {
  CALLAI_API_KEY: window.CALLAI_API_KEY,
  CALLAI_CHAT_URL: window.CALLAI_CHAT_URL,
  CALLAI_IMG_URL: window.CALLAI_IMG_URL,
});

export {}; // Ensure this is treated as a module
