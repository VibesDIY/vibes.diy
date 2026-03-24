/**
 * Builds the system message for schema-based callAI requests.
 * Mirrors vibes.diy/vibe/srv-sandbox/srv-sandbox.ts vibeCallAI handler.
 *
 * Used by capture.sh (via print-schema-prompt.ts) and will be imported
 * by srv-sandbox to keep the prompt in one place.
 */
export function buildSchemaSystemMessage(schema: unknown): string {
  return `Here is the JSON schema for the expected response.
                    Please generate one result that conforms to this schema.
                    Output like Code Blocks and like \`\`\`JSON
                    ${JSON.stringify(schema)}`;
}
