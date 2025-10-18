// Hosted Dev Environment Entry Point
// This mimics how hosted apps initialize on vibesdiy.net

/// <reference types="vite/client" />
import './setup'; // Set up hosted environment globals first
import React from 'react';
import { mountVibesApp } from 'use-vibes';
import Container from './Container';

const StrictContainer = () => (
  <React.StrictMode>
    <Container />
  </React.StrictMode>
);

console.log('🚀 Initializing Hosted Dev Environment...');

// Single mount point with portal support - like the new production template will do
console.log('🎛️ Using portal approach - mounting app inside vibes overlay...');

try {
  const mountResult = mountVibesApp({
    container: document.body, // Mount to body to match production approach
    appComponent: StrictContainer, // Keep React.StrictMode in development
    title: 'Hosted Dev App',
    database: 'hosted-dev-db',
  });
  console.log('✅ Portal-based vibes app mounted successfully');
  console.log('🎛️ Mount result:', mountResult);
  console.log('🎛️ Container after mount:', mountResult.getContainer());

  // Log when everything is rendered
  setTimeout(() => {
    const container = mountResult.getContainer();

    // Check for vibes control elements
    const loginButtons = container.querySelectorAll('[role="button"], button');
    console.log('🎛️ Found buttons after mount:', loginButtons.length);
    loginButtons.forEach((btn, i) => {
      const element = btn as HTMLElement;
      console.log(`🎛️ Button ${i + 1}:`, btn.textContent, 'visible:', element.offsetWidth > 0);
    });

    const allText = container.textContent || '';
    console.log('🎛️ All text in container:', allText.slice(0, 200) + '...');
    console.log('🎛️ Contains "Login":', allText.includes('Login'));
    console.log('🎛️ Contains "Invite":', allText.includes('Invite'));
    console.log(
      '🎛️ Contains "Hosted Dev Environment":',
      allText.includes('Hosted Dev Environment')
    );
  }, 1000);
} catch (error) {
  console.error('❌ Failed to mount Portal-based Vibes app:', error);
  if (error instanceof Error) {
    console.error('❌ Error stack:', error.stack);
  }
}

console.log('🎉 Hosted Dev Environment ready!');

// Add some helpful dev info
if (import.meta.env?.DEV) {
  console.log('💡 Development Tips:');
  console.log('  • Edit use-vibes source files for live HMR');
  console.log('  • Use ?api_key=custom to override API key');
  console.log('  • Check authentication flow with auth wall');
  console.log('  • Test AI integration with call-ai');
}
