/**
 * Helper function to encode titles for URLs
 * Converts spaces to hyphens and encodes special characters
 *
 * @param title - The title string to encode
 * @returns Encoded URL-friendly string
 */
export function encodeTitle(title: string): string {
  title = title || "untitled-chat";
  return encodeURIComponent(title.toLowerCase().replace(/\W+/g, "-"));
}
