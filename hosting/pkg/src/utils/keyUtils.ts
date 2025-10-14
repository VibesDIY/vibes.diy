// TypeScript interfaces for OpenRouter key management utilities
import { KeyData, KeyResult } from "../endpoints/keyLib";

// Parameters for listing keys
export interface KeyListParams {
  provisioningKey: string; // Required: OpenRouter provisioning API key
  offset?: number; // Optional: Offset for pagination
  includeDisabled?: boolean; // Optional: Whether to include disabled keys
}

// Core function to list all OpenRouter API keys
export async function listKeys(params: KeyListParams): Promise<KeyResult> {
  const { provisioningKey, offset, includeDisabled } = params;

  try {
    if (!provisioningKey) {
      console.error("Provisioning key is required to list keys");
      return {
        success: false,
        error: "Missing API key: provisioningKey is required",
      };
    }

    // Build query parameters
    const queryParams = new URLSearchParams();
    if (offset !== undefined) queryParams.append("offset", offset.toString());
    if (includeDisabled !== undefined)
      queryParams.append("include_disabled", includeDisabled.toString());

    const queryString = queryParams.toString();
    const url = `https://openrouter.ai/api/v1/keys${queryString ? `?${queryString}` : ""}`;

    console.log(
      `🔍 Listing OpenRouter keys${offset !== undefined ? ` with offset ${offset}` : ""}`,
    );

    // Make request to OpenRouter API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${provisioningKey}`,
      },
    });

    // Define the OpenRouter API response structure for listing keys
    interface OpenRouterKeyListResponse {
      data: Array<{
        hash: string;
        name: string;
        label: string;
        disabled: boolean;
        limit: number;
        created_at: string;
        updated_at: string;
      }>;
    }

    const responseData = (await response.json()) as OpenRouterKeyListResponse;

    if (!response.ok) {
      console.error(`❌ Error listing keys:`, responseData);
      return {
        success: false,
        error: `Failed to list keys: ${response.statusText}`,
      };
    }

    // Check response format
    if (!responseData.data || !Array.isArray(responseData.data)) {
      console.error(`❌ Unexpected API response format:`, responseData);
      return {
        success: false,
        error: "Invalid API response format",
      };
    }

    // Format the response to match our KeyData interface
    const keys: KeyData[] = responseData.data.map((keyData) => ({
      hash: keyData.hash,
      name: keyData.name,
      label: keyData.label,
      disabled: keyData.disabled,
      limit: keyData.limit,
      created_at: keyData.created_at,
      updated_at: keyData.updated_at,
    }));

    console.log(`✅ Successfully retrieved ${keys.length} keys`);

    return {
      success: true,
      keys: keys,
    } as KeyResult & { keys: KeyData[] };
  } catch (error) {
    console.error(`Error in listKeys:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Example usage:
 *
 * import { listKeys } from './utils/keyUtils';
 *
 * async function getAllKeys() {
 *   const provisioningKey = process.env.SERVER_OPENROUTER_PROV_KEY;
 *   if (!provisioningKey) {
 *     console.error("Missing OpenRouter provisioning key");
 *     return;
 *   }
 *
 *   const result = await listKeys({ provisioningKey });
 *   if (result.success && 'keys' in result) {
 *     console.log(`Found ${result.keys.length} keys`);
 *     result.keys.forEach(key => {
 *       console.log(`Key: ${key.hash}, Name: ${key.name}, Limit: $${key.limit}`);
 *     });
 *   } else {
 *     console.error(`Failed to list keys: ${result.error}`);
 *   }
 * }
 */
