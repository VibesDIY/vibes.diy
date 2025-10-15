// TypeScript interfaces for key data
export interface KeyData {
  hash: string;
  name: string;
  label: string;
  disabled: boolean;
  limit: number;
  /**
   * The usage amount in dollars
   * NOTE: This field will be undefined for keys retrieved via
   * getKey() or updateKey() as the OpenRouter API doesn't return usage in those responses
   */
  usage?: number;
  created_at: string;
  updated_at: string | null;
  /**
   * The API key string
   * NOTE: This field will be undefined for keys retrieved via
   * getKey() or updateKey() as the OpenRouter API doesn't return the actual key
   * in those responses.
   */
  key?: string;
}

export interface KeyResult {
  success: boolean;
  key?: KeyData;
  error?: string;
}

// Parameters for updating a key
export interface KeyUpdateParams {
  hash: string; // Required: Hash of the key to update
  name?: string; // Optional: New name for the key
  disabled?: boolean; // Optional: Whether the key should be disabled
  limit?: number; // Optional: New credit limit for the key
  provisioningKey: string; // Required: OpenRouter provisioning API key
}

// Parameters for retrieving a key
export interface KeyGetParams {
  hash: string; // Required: Hash of the key to retrieve
  provisioningKey: string; // Required: OpenRouter provisioning API key
}

// Core function to create a key with the OpenRouter API directly
export async function createKey(params: {
  userId: string;
  name: string;
  label?: string;
  authToken?: string; // Kept for backward compatibility but not used
  provisioningKey?: string; // Added to allow passing the key from the context
}): Promise<KeyResult> {
  // Destructure parameters with defaults
  const {
    userId,
    name,
    label = `session-${Date.now()}`,
    provisioningKey,
  } = params;

  try {
    // Check if we have the provisioning key

    if (!provisioningKey) {
      console.error(
        "SERVER_OPENROUTER_PROV_KEY environment variable not found",
      );
      return {
        success: false,
        error: "Server configuration error: Missing API key",
      };
    }

    // Normalize the userId - consider undefined, null, empty string, or 'anonymous' as anonymous
    const isAuthenticated = userId && userId !== "anonymous";

    // Set dollar amount based on user status
    const dollarAmount = isAuthenticated ? 2.5 : 1.25;
    console.log(
      `💰 Setting dollar amount to $${dollarAmount} for ${isAuthenticated ? "authenticated" : "anonymous"} user`,
    );

    // Add userId to the key label if available and meaningful
    const keyLabel = isAuthenticated
      ? `user-${userId}-${label}`
      : `anonymous-${label}`;
    console.log(`🏷️ Using label: ${keyLabel}`);

    // Make direct request to OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provisioningKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: isAuthenticated ? `User ${userId} Session` : name,
        label: keyLabel,
        limit: dollarAmount,
      }),
    });

    // Define the OpenRouter API response structure
    interface OpenRouterKeyResponse {
      key: string;
      data: {
        hash: string;
        name: string;
        label: string;
        disabled: boolean;
        limit: number;
        usage: number;
        created_at: string;
        updated_at: string | null;
      };
    }

    const data = (await response.json()) as OpenRouterKeyResponse;

    if (!response.ok) {
      console.error(`❌ Error creating key:`, data);
      return {
        success: false,
        error: `Failed to create key: ${response.statusText}`,
      };
    }

    // OpenRouter API returns data in a nested structure
    // The key is at the top level, metadata in data object
    if (!data.key) {
      console.error(`❌ Unexpected API response format:`, data);
      return {
        success: false,
        error: "Invalid API response format",
      };
    }

    // Format the response to match our KeyData interface
    const keyData: KeyData = {
      ...data.data, // Include all metadata from the data object
      key: data.key, // Add the key from the top level
      // Default values for any missing fields required by KeyData interface
      hash: data.data.hash || "",
      name: data.data.name || name,
      label: data.data.label || keyLabel,
      disabled: data.data.disabled || false,
      limit: data.data.limit || dollarAmount,
      usage: data.data.usage || 0,
      created_at: data.data.created_at || new Date().toISOString(),
      updated_at: data.data.updated_at || null,
    };

    console.log(`✅ Successfully created key:`, {
      hash: keyData.hash || "unknown",
      label: keyData.label || "unknown",
      limit: keyData.limit || 0,
      limitInCents: (keyData.limit || 0) * 100,
      dollarAmount: dollarAmount,
    });

    return {
      success: true,
      key: keyData,
    };
  } catch (error: unknown) {
    console.error(`Error in createKey:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Core function to update an existing OpenRouter API key
export async function updateKey(params: KeyUpdateParams): Promise<KeyResult> {
  const { hash, name, disabled, limit, provisioningKey } = params;

  try {
    // Validate required parameters
    if (!hash) {
      return {
        success: false,
        error: "Hash is required for updating a key",
      };
    }

    if (!provisioningKey) {
      console.error(
        "SERVER_OPENROUTER_PROV_KEY environment variable not found",
      );
      return {
        success: false,
        error: "Server configuration error: Missing API key",
      };
    }

    // Create request body with only the fields that are provided
    const requestBody: Partial<
      Pick<KeyUpdateParams, "name" | "disabled" | "limit">
    > = {};
    if (name !== undefined) requestBody.name = name;
    if (disabled !== undefined) requestBody.disabled = disabled;
    if (limit !== undefined) requestBody.limit = limit;

    console.log(`🔄 Updating key ${hash} with parameters:`, {
      name: name !== undefined ? name : "[unchanged]",
      disabled: disabled !== undefined ? disabled : "[unchanged]",
      limit: limit !== undefined ? limit : "[unchanged]",
    });

    // Make request to OpenRouter API
    const response = await fetch(`https://openrouter.ai/api/v1/keys/${hash}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${provisioningKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Define the OpenRouter API response structure for key updates
    interface OpenRouterKeyUpdateResponse {
      data: {
        hash: string;
        name: string;
        label: string;
        disabled: boolean;
        limit: number;
        created_at: string;
        updated_at: string;
      };
    }

    const data = (await response.json()) as OpenRouterKeyUpdateResponse;

    if (!response.ok) {
      console.error(`❌ Error updating key:`, data);
      return {
        success: false,
        error: `Failed to update key: ${response.statusText}`,
      };
    }

    // Check if the response has the expected format
    if (!data.data) {
      console.error(`❌ Unexpected API response format:`, data);
      return {
        success: false,
        error: "Invalid API response format",
      };
    }

    // Format the response to match our KeyData interface
    // Format the response to match our KeyData interface
    // The update response doesn't include the key value or usage, which are now optional fields
    const keyData: KeyData = {
      ...data.data,
    };

    console.log(`✅ Successfully updated key:`, {
      hash: keyData.hash,
      name: keyData.name,
      limit: keyData.limit,
      disabled: keyData.disabled,
      updated_at: keyData.updated_at,
    });

    return {
      success: true,
      key: keyData,
    };
  } catch (error: unknown) {
    console.error(`Error in updateKey:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Core function to retrieve an existing OpenRouter API key
export async function getKey(params: KeyGetParams): Promise<KeyResult> {
  const { hash, provisioningKey } = params;

  try {
    if (!hash) {
      return { success: false, error: "Hash is required to retrieve a key" };
    }
    if (!provisioningKey) {
      console.error(
        "SERVER_OPENROUTER_PROV_KEY environment variable not found",
      );
      return {
        success: false,
        error: "Server configuration error: Missing API key",
      };
    }

    console.log(`🔍 Retrieving key ${hash}`);
    const response = await fetch(`https://openrouter.ai/api/v1/keys/${hash}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${provisioningKey}` },
    });

    interface OpenRouterKeyGetResponse {
      data: {
        hash: string;
        name: string;
        label: string;
        disabled: boolean;
        limit: number;
        created_at: string;
        updated_at: string;
      };
    }

    const data = (await response.json()) as OpenRouterKeyGetResponse;

    if (!response.ok) {
      console.error(`❌ Error retrieving key:`, data);
      return {
        success: false,
        error: `Failed to retrieve key: ${response.statusText}`,
      };
    }
    if (!data.data) {
      console.error(`❌ Unexpected API response format:`, data);
      return { success: false, error: "Invalid API response format" };
    }

    // Format the response to match our KeyData interface
    // The GET response doesn't include the key value or usage, which are now optional fields
    const keyData: KeyData = {
      ...data.data,
    };

    console.log(`✅ Successfully retrieved key:`, {
      hash: keyData.hash,
      name: keyData.name,
      limit: keyData.limit,
      disabled: keyData.disabled,
      updated_at: keyData.updated_at,
    });

    return { success: true, key: keyData };
  } catch (error: unknown) {
    console.error(`Error in getKey:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
