import React, { useEffect } from 'react';
import { SignIn, SignUp, useAuth, useUser } from '@clerk/clerk-react';

interface VibesClerkAuthProps {
  mode?: 'signin' | 'signup';
  onAuthSuccess?: (user: any) => void;
  onClose?: () => void;
  className?: string;
}

/**
 * Vibes-branded Clerk authentication component
 * Provides inline auth UI with styling that matches existing vibes.diy patterns
 */
export function VibesClerkAuth({
  mode = 'signin',
  onAuthSuccess,
  onClose,
  className = '',
}: VibesClerkAuthProps) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  // Handle successful authentication
  useEffect(() => {
    if (isSignedIn && user && onAuthSuccess) {
      onAuthSuccess(user);
    }
  }, [isSignedIn, user, onAuthSuccess]);

  const commonAppearance = {
    elements: {
      // Remove default Clerk branding (like Fireproof does)
      footer: { display: 'none' },
      footerAction: { display: 'none' },

      // Custom styling to match vibes.diy aesthetic
      card: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '2px solid #fed7aa', // orange-200
        borderRadius: '0.5rem',
      },

      headerTitle: {
        color: '#f97316', // orange-500
        fontWeight: 'bold',
        fontSize: '1.125rem',
      },

      headerSubtitle: {
        color: '#6b7280', // gray-500
      },

      // Style form elements to match existing patterns
      formFieldInput: {
        borderColor: '#d1d5db', // gray-300
        borderRadius: '0.375rem',
      },

      formButtonPrimary: {
        backgroundColor: '#f97316', // orange-500
        borderRadius: '0.375rem',
        fontWeight: '600',
        '&:hover': {
          backgroundColor: '#ea580c', // orange-600
        },
      },
    },
  };

  return (
    <div className={`vibes-clerk-auth ${className}`}>
      {/* Close button if modal usage */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xl font-bold z-10"
          aria-label="Close authentication"
        >
          ×
        </button>
      )}

      {/* Render SignIn or SignUp based on mode */}
      {mode === 'signin' ? (
        <SignIn 
          appearance={commonAppearance} 
          routing="path" 
          path="/login"
          redirectUrl="/"
          afterSignInUrl="/"
        />
      ) : (
        <SignUp 
          appearance={commonAppearance} 
          routing="path" 
          path="/signup"
          redirectUrl="/"
          afterSignUpUrl="/"
        />
      )}
    </div>
  );
}
