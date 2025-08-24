import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';

interface ClerkAuthProviderProps {
  children: React.ReactNode;
  publishableKey: string;
  appearance?: {
    baseTheme?: any;
    variables?: {
      colorPrimary?: string;
      colorBackground?: string;
      colorText?: string;
      borderRadius?: string;
    };
    elements?: Record<string, React.CSSProperties>;
  };
}

/**
 * Wraps Clerk's ClerkProvider with vibes-specific configuration
 * This component provides the foundation for all Clerk functionality
 *
 * @param publishableKey - Clerk publishable key (get from Clerk dashboard)
 * @param appearance - Optional custom styling overrides
 */
export function ClerkAuthProvider({
  children,
  publishableKey,
  appearance = {},
}: ClerkAuthProviderProps) {
  if (!publishableKey) {
    throw new Error('ClerkAuthProvider requires a publishableKey prop');
  }

  // Default Vibes styling that matches existing auth modal patterns
  const defaultAppearance = {
    variables: {
      colorPrimary: '#f97316', // orange-500 from Tailwind (matches existing auth)
      colorBackground: '#ffffff',
      colorText: '#1f2937', // gray-800
      borderRadius: '0.5rem', // rounded-lg
    },
    elements: {
      // Match existing modal styling from NeedsLoginModal
      card: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '2px solid #fed7aa', // orange-200
      },
      headerTitle: {
        color: '#f97316', // orange-500
        fontWeight: 'bold',
      },
    },
    ...appearance,
  };

  return (
    <ClerkProvider publishableKey={publishableKey} appearance={defaultAppearance}>
      {children}
    </ClerkProvider>
  );
}
