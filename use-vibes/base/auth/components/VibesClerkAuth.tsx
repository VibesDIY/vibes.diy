import React, { useEffect } from 'react';
import { SignIn, SignUp, useAuth, useUser } from '@clerk/clerk-react';
import { generateFireproofToken, storeFireproofToken } from '../utils/tokenGeneration.js';

interface VibesClerkAuthProps {
  mode?: 'signin' | 'signup';
  onAuthSuccess?: (user: unknown) => void;
  onClose?: () => void;
  className?: string;
  /** Public key for Fireproof token generation */
  fireproofPublicKey?: string;
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
  fireproofPublicKey
}: VibesClerkAuthProps) {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  // Handle successful authentication with automatic Fireproof integration
  useEffect(() => {
    if (isSignedIn && user) {
      handleAuthSuccess();
    }
  }, [isSignedIn, user]);

  const handleAuthSuccess = async () => {
    console.group('🔐 === CLERK AUTH SUCCESS HANDLER ===');
    try {
      // Generate and store Fireproof token if integration is enabled
      if (fireproofPublicKey && user) {
        console.log('🔄 Starting Fireproof token exchange for user:', user.id);
        console.log('📋 User details:', {
          id: user.id,
          emailAddresses: user.emailAddresses?.map((e) => e.emailAddress),
          username: user.username,
        });

        // Get the real Clerk JWT
        console.log('🎫 Requesting Clerk JWT...');
        const clerkJwt = await getToken();
        if (!clerkJwt) {
          throw new Error('Failed to get Clerk JWT from Clerk');
        }
        console.log('✅ Got Clerk JWT, length:', clerkJwt.length);
        console.log('🔍 JWT preview (first 50 chars):', clerkJwt.substring(0, 50) + '...');

        // Exchange it for a real Fireproof token
        console.log('📡 Calling Fireproof API for token exchange...');
        console.log('🔑 Using public key:', fireproofPublicKey);
        const fireproofToken = await generateFireproofToken(clerkJwt, fireproofPublicKey);

        console.log('✅ Got Fireproof token, length:', fireproofToken.length);
        console.log(
          '🔍 Fireproof token preview (first 50 chars):',
          fireproofToken.substring(0, 50) + '...'
        );
        console.log('💾 Storing in localStorage...');
        storeFireproofToken(fireproofToken);

        // Verify it was stored
        const stored = localStorage.getItem('auth_token');
        console.log('🔍 Verification - token stored?', !!stored, 'length:', stored?.length);
        console.log('🔍 Stored token matches?', stored === fireproofToken);

        // Try to verify the token immediately
        console.log('🧪 Testing token verification...');
        try {
          // Import verifyFireproofToken to test locally
          const { verifyFireproofToken } = await import('../utils/tokenGeneration.js');
          const verifyResult = await verifyFireproofToken(fireproofToken, fireproofPublicKey);
          if (verifyResult) {
            console.log('✅ Token verification successful! User ID:', verifyResult.payload.userId);
            console.log('📋 Token payload:', verifyResult.payload);
          } else {
            console.error('❌ Token verification failed!');
          }
        } catch (verifyError) {
          console.error('❌ Error during token verification test:', verifyError);
        }

        console.log('🎉 Fireproof token exchange completed successfully!');
      } else {
        console.log('⚠️ Fireproof integration missing requirements:', {
          hasPublicKey: !!fireproofPublicKey,
          hasUser: !!user,
        });
      }

      // Call the consumer's success handler
      if (onAuthSuccess && user) {
        console.log('📞 Calling consumer success handler...');
        onAuthSuccess(user);
      } else {
        console.log('⚠️ No success handler or user to call');
      }
    } catch (error) {
      console.error('❌ Error in auth success handler:', error);
      if (error instanceof Error) {
        console.error('❌ Error stack:', error.stack);
      }

      // Still call the success handler even if token generation failed
      if (onAuthSuccess && user) {
        console.log('🔄 Calling success handler despite error...');
        onAuthSuccess(user);
      }
    } finally {
      console.groupEnd();
      console.log('⏱️ Auth success handler completed at:', new Date().toISOString());
    }
  };

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
        <SignIn appearance={commonAppearance} routing="path" path="/login" />
      ) : (
        <SignUp appearance={commonAppearance} routing="path" path="/signup" />
      )}
    </div>
  );
}
