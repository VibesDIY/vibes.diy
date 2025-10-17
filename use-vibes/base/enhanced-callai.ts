/**
 * Enhanced callAI wrapper that automatically includes Vibes authentication
 *
 * This wrapper extends the original callAI from call-ai package to automatically
 * include the X-VIBES-Token header when an auth token is available.
 *
 * Usage:
 *   import { callAI } from 'use-vibes';
 *   // or via importmap redirect:
 *   import { callAI } from 'call-ai';
 *
 * The enhanced version will automatically add authentication headers when available.
 */

import {
  callAI as originalCallAI,
  type CallAIOptions,
  type Message,
  type StreamResponse,
} from 'call-ai';

/**
 * Get the Vibes authentication token from localStorage
 * This is the same token used by the main Vibes DIY app for API authentication
 */
function getVibesAuthToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    return localStorage.getItem('auth_token');
  } catch (error) {
    // Handle cases where localStorage access might fail
    console.warn('[enhanced-callAI] Could not access localStorage for auth token:', error);
    return null;
  }
}

/**
 * Enhanced callAI function that automatically includes Vibes authentication headers
 *
 * @param prompt - The prompt to send to the AI (string or Message array)
 * @param options - CallAI options (will be enhanced with auth headers)
 * @returns Promise resolving to AI response
 */
export function callAI(
  prompt: string | Message[],
  options: CallAIOptions = {}
): Promise<string | StreamResponse> {
  // Get the auth token
  const authToken = getVibesAuthToken();

  // Prepare enhanced options with auth headers
  const enhancedOptions: CallAIOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
      // Add X-VIBES-Token header if auth token is available
      ...(authToken ? { 'X-VIBES-Token': authToken } : {}),
    },
  };

  // Call the original callAI with enhanced options
  return originalCallAI(prompt, enhancedOptions);
}

// Re-export everything else from the original call-ai package
export * from 'call-ai';

// Override the default export with our enhanced version
export default callAI;
