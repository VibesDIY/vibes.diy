// Hosted Dev Environment Entry Point
// This mimics how hosted apps initialize on vibesdiy.net

import './setup'; // Set up hosted environment globals first
import React from 'react';
import ReactDOM from 'react-dom/client';
import { mountVibesApp } from 'use-vibes';
import App from './App';

console.log('🚀 Initializing Hosted Dev Environment...');

// Mount the main React app to the container (like hosted apps)
const container = document.getElementById('container');
if (!container) {
  throw new Error('Container element not found - this should match hosted environment');
}

console.log('📦 Mounting main React app...');
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Mount Vibes control overlay (like hosted apps do)
console.log('🎛️ Mounting Vibes control overlay...');
console.log('🎛️ Looking for container:', '#vibe-control');

const vibeControlContainer = document.querySelector('#vibe-control');
console.log('🎛️ Container found:', !!vibeControlContainer);
console.log('🎛️ Container element:', vibeControlContainer);

try {
  const mountResult = mountVibesApp({
    container: '#vibe-control',
    title: 'Hosted Dev App',
    database: 'hosted-dev-db',
  });
  console.log('✅ Vibes control mounted successfully');
  console.log('🎛️ Mount result:', mountResult);
  console.log('🎛️ Container after mount:', mountResult.getContainer());
  console.log('🎛️ Container innerHTML length:', mountResult.getContainer().innerHTML.length);

  // Log when buttons are rendered
  setTimeout(() => {
    const container = mountResult.getContainer();
    const loginButtons = container.querySelectorAll('[role="button"], button');
    console.log('🎛️ Found buttons after mount:', loginButtons.length);
    loginButtons.forEach((btn, i) => {
      console.log(`🎛️ Button ${i + 1}:`, btn.textContent, 'visible:', btn.offsetWidth > 0);
    });

    const allText = container.textContent || '';
    console.log('🎛️ All text in vibes control:', allText);
    console.log('🎛️ Contains "Login":', allText.includes('Login'));
    console.log('🎛️ Contains "Invite":', allText.includes('Invite'));
    console.log('🎛️ Contains "Rem":', allText.includes('Rem'));
  }, 1000);
} catch (error) {
  console.error('❌ Failed to mount Vibes control:', error);
  console.error('❌ Error stack:', error.stack);
}

console.log('🎉 Hosted Dev Environment ready!');

// Add some helpful dev info
if (import.meta.env.DEV) {
  console.log('💡 Development Tips:');
  console.log('  • Edit use-vibes source files for live HMR');
  console.log('  • Use ?api_key=custom to override API key');
  console.log('  • Check authentication flow with auth wall');
  console.log('  • Test AI integration with call-ai');
}
