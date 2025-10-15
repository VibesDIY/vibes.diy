# API Key Rotation Strategy

## Overview

This document outlines our approach to API key management, rotation, and credit tracking within the Vibes.DIY application. Our architecture prioritizes security, user experience, and efficiency.

## Key Lifecycle Management

### 1. Anonymous Users (Pre-login)

For anonymous users, we use a streamlined approach:

- **API Key as Identifier**: Rather than using a separate device ID, we utilize the CallAI API key (or its hash) as the device/session identifier, eliminating unnecessary duplication.
- **Local Storage**: The API key is stored in localStorage with its creation timestamp.
- **No Automatic Rotation**: Anonymous users do not receive automatic key rotation when credits are depleted - they must log in to continue using the service.
- **Login Prompt**: When an anonymous user's key is depleted, they are prompted to log in to continue using the service.

### 2. Logged-in Users

Once a user logs in:

- We associate the API key with their user ID
- All API requests include the user ID
- The user ID is used in key labels for auditing purposes

### 3. Key Rotation Triggers

A new API key is provisioned when:

1. **First Visit**: No key exists in localStorage
2. **Expiration**: For logged-in users, the stored key is older than 7 days
3. **Low Credits**: For logged-in users, less than a threshold amount of credits remain
4. **Credit Depletion**: For logged-in users only, when the key has used all its allocated credits
5. **API Error**: For logged-in users, certain API errors indicate an invalid key

Important: Anonymous users do not receive automatic key rotation. When their credits are depleted or key expires, they must log in to continue using the service.

## Credit Checking Strategy

To efficiently manage credits while minimizing overhead:

1. **Initial Page Load**: Check remaining credits on initial page load
2. **Pre-request Validation**: Before sending a message, verify the key has sufficient credits
3. **Post-request Update**: After completion of a request, update the stored credit information
4. **Threshold Monitoring**: For logged-in users only, when credits drop below a threshold (e.g., 10% of limit), prepare to rotate the key
5. **Anonymous User Conversion**: When anonymous users approach their credit limit, prompt them to create an account

## Implementation Details

### Credit Check Endpoint

We use the `/api/v1/auth/key` endpoint which returns:

- `limit` - Total allocated credits
- `usage` - Credits used so far
- `limit_remaining` - Available credits
- `rate_limit` - Rate limit information

### Edge Function Fallback

1. **Direct API Key Use**: If CALLAI_API_KEY is set (development), use it directly
2. **Edge Function**: In production, provision keys through the `/api/callai/create-key` endpoint
3. **Secure Storage**: The edge function uses SERVER_OPENROUTER_API_KEY which is never exposed client-side

## Benefits of This Approach

1. **Simplicity**: Using the API key itself as the identifier eliminates redundant tracking mechanisms
2. **Security**: Server-side provisioning of keys prevents exposure of the master provisioning key
3. **Resilience**: The system recovers automatically from key expiration, deletion, or invalidation
4. **User Experience**: Key rotation happens transparently with minimal impact on user experience
5. **Cost Control**: Credit limits per key provide predictable spending boundaries

## Future Enhancements

- **Predictive Rotation**: Rotate keys preemptively based on usage patterns
- **Graduated Limits**: Adjust key credit limits based on user engagement/spending patterns
- **Fallback Pool**: Maintain a small pool of pre-generated keys for high-availability scenarios
- **Credit Analytics**: Track and analyze credit usage patterns to optimize cost and performance
