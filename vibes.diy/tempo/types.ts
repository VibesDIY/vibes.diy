/**
 * Type definitions for the Tempo K3s cluster configuration
 */

export interface ClusterConfig {
  readonly githubOrg: string;
  readonly githubRepo: string;
  readonly sshKeyName: string;
  readonly serverType: string;
  readonly location: string;
  readonly domain: string;
  readonly cloudflareZoneId: string;
  readonly cloudflareAccountId: string;
  readonly cloudflareApiToken: string;
  readonly clusterName: string;
}

export interface HetznerServerConfig {
  readonly serverType: string;
  readonly image: string;
  readonly location: string;
  readonly ipRange: string;
  readonly subnetRange: string;
}

export interface K8sAddonsConfig {
  readonly certManager: {
    readonly enabled: boolean;
    readonly email: string;
    readonly server: string;
  };
  readonly externalDns: {
    readonly enabled: boolean;
    readonly provider: string;
    readonly domainFilters: readonly string[];
    readonly policy: string;
    readonly txtOwnerId: string;
  };
  readonly traefik: {
    readonly enabled: boolean;
    readonly ingressClass: string;
  };
}

export interface GitHubActionsRBAC {
  readonly roleName: string;
  readonly roleBindingName: string;
  readonly allowedBranches: readonly string[];
  readonly allowedResources: readonly string[];
  readonly allowedVerbs: readonly string[];
}
