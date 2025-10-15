#!/usr/bin/env node
// @ts-check
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the .env file content directly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");

// Extract the provisioning key from .env
const OPENROUTER_PROV_KEY = envContent
  .split("\n")
  .find((line) => line.startsWith("SERVER_OPENROUTER_API_KEY="))
  ?.split("=")?.[1]
  ?.trim();

// Ensure we have a provisioning key
if (!OPENROUTER_PROV_KEY) {
  console.error("No provisioning key found in .env file");
  process.exit(1);
}

/**
 * Creates a new OpenRouter API key with a specified dollar amount limit
 * @param {string} provisioningKey - The OpenRouter provisioning API key
 * @param {number} dollarAmount - The dollar amount to set as the credit limit
 * @param {Object} options - Optional parameters for key creation
 * @returns {Promise<Object>} The newly created API key information
 */
async function createSessionKey(provisioningKey, dollarAmount, options = {}) {
  const BASE_URL = "https://openrouter.ai/api/v1/keys";
  const creditLimit = dollarAmount;

  try {
    console.log("Creating session key...");
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provisioningKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: options?.name || "Session Key",
        label: options?.label || `session-${Date.now()}`,
        limit: creditLimit,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to create session key: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();
    // The OpenRouter API returns a response with this structure:
    // { data: { hash, name, label, ... }, key: "sk-or-v1-..." }
    // We need to combine these into a single object for easier use
    if (data && data.key) {
      return {
        ...data.data, // Include all the metadata from data.data
        key: data.key, // Add the key from the top level
      };
    } else {
      // If we can't find the key, log the full response for debugging
      console.log("Full API response:", JSON.stringify(data, null, 2));
      throw new Error("Unexpected API response format");
    }
  } catch (error) {
    console.error("Error creating OpenRouter session key:", error);
    throw error;
  }
}

/**
 * Fetches the credit information for an API key
 * @param {string} provisioningKey - The provisioning key to use for checking credits
 * @param {string} keyHash - The hash of the key to check credits for
 * @returns {Promise<Object>} The credit information
 */
async function getCredits(provisioningKey, keyHash) {
  try {
    console.log(`Fetching credits for key hash: ${keyHash}...`);
    // Use the provisioning key and specific key hash endpoint
    const response = await fetch(
      `https://openrouter.ai/api/v1/keys/${keyHash}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${provisioningKey}` },
      },
    );

    // Log the complete response for debugging
    console.log("Credit response status:", response.status);
    console.log(
      "Credit response headers:",
      JSON.stringify(Object.fromEntries([...response.headers]), null, 2),
    );

    // Get the response body as text first for logging
    const responseText = await response.text();
    console.log("Credit response body:", responseText);

    if (!response.ok) {
      throw new Error(`Failed to fetch credits: ${response.status}`);
    }

    // Parse the response text as JSON
    const responseData = JSON.parse(responseText);
    console.log("Parsed credit data:", responseData);

    return responseData.data;
  } catch (error) {
    console.error("Error fetching OpenRouter credits:", error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Create a new API key with a $0.01 limit
    // Safe substring operation with nullish coalescing
    const provKeyPreview = OPENROUTER_PROV_KEY
      ? OPENROUTER_PROV_KEY.substring(0, 10) + "..."
      : "undefined";
    console.log(`Using provisioning key: ${provKeyPreview}`);
    // Ensure we're passing a string to createSessionKey
    if (!OPENROUTER_PROV_KEY) {
      throw new Error("Provisioning key is undefined");
    }

    const keyData = await createSessionKey(OPENROUTER_PROV_KEY, 0.01, {
      name: "Vibes.DIY CLI Session",
      label: `vibes-cli-${Date.now()}`,
    });

    console.log("\nAPI key created successfully!");

    // Log key details
    console.log(`- Hash: ${keyData.hash}`);
    console.log(`- Name: ${keyData.name}`);
    console.log(`- Label: ${keyData.label}`);
    console.log(`- Limit: $${keyData.limit}`);
    // Only show the first 10 characters of the key for security
    console.log(
      `- Key: ${keyData.key.substring(0, 10)}...${keyData.key.substring(keyData.key.length - 4)}`,
    );

    // For debugging, also log the full key data structure
    console.log("\nFull key data:", JSON.stringify(keyData, null, 2));

    // Sleep for 3 seconds to allow the key to be fully activated
    console.log("\nWaiting for 3 seconds before checking credits...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check credits for the new key using the provisioning key
    console.log("\nChecking credits for key hash:", keyData.hash);
    const keyInfo = await getCredits(OPENROUTER_PROV_KEY, keyData.hash);

    console.log("\nKey information:");
    if (keyInfo && keyInfo.data) {
      console.log(`- Name: ${keyInfo.data.name}`);
      console.log(`- Label: ${keyInfo.data.label}`);
      console.log(`- Limit: $${keyInfo.data.limit}`);
      console.log(`- Usage: $${keyInfo.data.usage}`);
      console.log(`- Disabled: ${keyInfo.data.disabled}`);
      console.log(`- Created: ${keyInfo.data.created_at}`);
    } else {
      console.log("No detailed key information available");
    }

    // Print the full key at the end for easy copying
    console.log(`\nAPI_KEY=${keyData.key}`);

    return { keyData, keyInfo };
  } catch (error) {
    console.error("\nError:", error);
    process.exit(1);
  }
}

// Run the main function
console.log("Running API key utility script...");
main()
  .then(() => {
    console.log("\nScript completed successfully");
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
