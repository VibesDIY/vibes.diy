# Netlify Edge Function for OpenRouter API Key Management

## Overview

This document outlines the implementation of a Netlify Edge Function to securely manage OpenRouter API keys for the Vibes DIY application. The Edge Function will serve as a secure intermediary between the client and the OpenRouter API, keeping the provisioning key secure while allowing authenticated users to create and manage session keys.

## Architecture

### Edge Function Architecture

```
┌─────────────┐     ┌───────────────────┐     ┌────────────────┐
│             │     │                   │     │                │
│  Client App │────▶│  Netlify Edge Fn  │────▶│  OpenRouter   │
│             │     │                   │     │                │
└─────────────┘     └───────────────────┘     └────────────────┘
        │                     ▲                       ▲
        │                     │                       │
        └─────────────────┐  │                       │
                         ▼  │                       │
                ┌─────────────────┐                │
                │                 │                │
                │  Clerk Auth     │───────────────┘
                │  (future)       │
                └─────────────────┘
```

Our implementation leverages Netlify Edge Functions to:

1. **Handle API Key Provisioning**: Create and manage OpenRouter session keys without exposing the provisioning key to clients
2. **Validate Authentication**: (Future) Validate Clerk auth tokens to ensure only authenticated users can create keys
3. **Enforce Limits**: Implement business rules for credit allocation based on user status

## Implementation

### 1. Setup netlify.toml Configuration

Create or update your `netlify.toml` file in the project root with the following configuration:

```toml
[build]
  command = "pnpm build"
  publish = "dist"
  functions = "netlify/functions"

[[edge_functions]]
  path = "/api/openrouter/*"
  function = "openrouter"
```

### 2. Create the Edge Function

Create a file at `netlify/edge-functions/openrouter.js` with the following content:

```javascript
import { Context } from "netlify:edge";

export default async (request, context) => {
  // Extract the path segment after /api/openrouter/
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");
  const action = pathSegments[3]; // e.g., "create-key", "check-credits"

  // Authenticate the request (will be expanded in future with Clerk)
  try {
    // For now, simple API key validation
    // This will be replaced with proper Clerk auth in the future
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Access the secure provisioning key from environment variables
    const provisioningKey = Netlify.env.get("OPENROUTER_PROV_KEY");

    if (!provisioningKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Handle different API actions
    switch (action) {
      case "create-key":
        return await handleCreateKey(request, provisioningKey);
      case "check-credits":
        return await handleCheckCredits(request, provisioningKey);
      case "list-keys":
        return await handleListKeys(request, provisioningKey);
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// Function to create a new OpenRouter session key
async function handleCreateKey(request, provisioningKey) {
  try {
    const {
      dollarAmount = 0.5,
      name = "Session Key",
      label = "session",
    } = await request.json();

    const response = await fetch("https://openrouter.ai/api/v1/keys/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provisioningKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        label,
        limit: dollarAmount,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to create key", details: data }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Function to check credits for a specific key
async function handleCheckCredits(request, provisioningKey) {
  try {
    const { keyHash } = await request.json();

    if (!keyHash) {
      return new Response(JSON.stringify({ error: "Key hash is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      `https://openrouter.ai/api/v1/keys/${keyHash}`,
      {
        headers: {
          Authorization: `Bearer ${provisioningKey}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to check credits", details: data }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Function to list keys
async function handleListKeys(request, provisioningKey) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/keys", {
      headers: {
        Authorization: `Bearer ${provisioningKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to list keys", details: data }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

### 3. Configure Environment Variables

Set up the required environment variables in Netlify:

1. Go to your Netlify site dashboard
2. Navigate to Site settings > Environment variables
3. Add the following variables:
   - `OPENROUTER_PROV_KEY`: Your OpenRouter provisioning key
   - Mark it as a "Secret" environment variable for enhanced security

### 4. Client-Side Integration

Update your client-side code to use the Edge Function instead of directly calling OpenRouter:

```javascript
// Before: Direct OpenRouter API call
const createKey = async (dollarAmount) => {
  const response = await fetch("https://openrouter.ai/api/v1/keys/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provisioning_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "User Session",
      label: `user-${userId}`,
      limit: dollarAmount,
    }),
  });

  return await response.json();
};

// After: Using the Edge Function
const createKey = async (dollarAmount) => {
  const response = await fetch("/api/openrouter/create-key", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${user_api_key}`, // Will be validated by Clerk in future
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dollarAmount,
      name: "User Session",
      label: `user-${userId}`,
    }),
  });

  return await response.json();
};
```

## Future Implementation: Clerk Authentication

In the next sprint, we'll integrate Clerk for authentication and authorization. Here's the planned implementation:

### 1. Install Clerk in Your Project

```bash
pnpm add @clerk/netlify
```

### 2. Update the Edge Function with Clerk Authentication

```javascript
import { Context } from "netlify:edge";
import { clerkMiddleware, createClerkClient } from "@clerk/netlify/edge";

// Setup Clerk middleware
const clerk = createClerkClient({
  secretKey: Netlify.env.get("CLERK_SECRET_KEY"),
});

// Wrap the handler with Clerk middleware
export default clerkMiddleware(async (request, context) => {
  // Get the session and user from Clerk
  const { sessionId, userId } = context.clerk;

  // If no session, return unauthorized
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Retrieve the active Clerk session
  const session = await clerk.sessions.getSession(sessionId);
  if (!session || !session.active) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rest of the function remains the same, but now we have authenticated user info
  // which we can use for authorization and personalization
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");
  const action = pathSegments[3];

  // Access the secure provisioning key from environment variables
  const provisioningKey = Netlify.env.get("OPENROUTER_PROV_KEY");

  // Handle different API actions
  switch (action) {
    case "create-key":
      // Can now add user-specific logic based on userId
      return await handleCreateKey(request, provisioningKey, userId);
    case "check-credits":
      return await handleCheckCredits(request, provisioningKey);
    case "list-keys":
      return await handleListKeys(request, provisioningKey, userId);
    default:
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
  }
});

// Update handler functions to include user-specific logic
async function handleCreateKey(request, provisioningKey, userId) {
  // Add user-specific logic, like tracking key usage by user ID
  // or implementing different credit limits based on user status
  // ...rest of the function
}
```

## Benefits of This Approach

1. **Security**: The OpenRouter provisioning key is never exposed to the client
2. **Centralized Control**: All API key management happens through a secure edge function
3. **Business Logic**: Implement credit allocation and limits based on user status
4. **Performance**: Edge functions run globally close to your users for minimal latency

## Considerations and Limitations

1. **Cold Starts**: Edge functions may experience occasional cold starts, though these are typically brief
2. **Rate Limiting**: Netlify has rate limits on Edge Function invocations, though these are generous
3. **Monitoring**: Consider implementing logging and monitoring for the Edge Function to track usage

## Deployment

Deploying this Edge Function is automatic with your Netlify deployment pipeline. The function will be available at the path specified in your netlify.toml file after deployment.
