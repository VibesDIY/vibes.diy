// Re-export subdomain parsing functions from use-vibes-base
// This ensures single source of truth for hostname/URL parsing logic

export {
  parseSubdomain,
  constructSubdomain,
  isValidSubdomain,
  generateRandomInstanceId as generateInstallId,
} from "@vibes.diy/use-vibes-base";

// Re-export the interface for backwards compatibility
export type { ParsedSubdomain } from "@vibes.diy/use-vibes-base";
