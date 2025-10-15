export interface TokenPayload {
  email?: string;
  userId: string;
  tenants: {
    id: string;
    role: string;
  }[];
  ledgers: {
    id: string;
    role: string;
    right: string;
  }[];
  iat: number;
  iss: string;
  aud: string;
  exp: number;
}
export declare function verifyToken(
  token: string,
  publicKey: string,
): Promise<{
  payload: TokenPayload;
} | null>;
export declare function extendToken(
  currentToken: string,
  connectApiUrl: string,
  fetchImpl?: typeof fetch,
): Promise<string | null>;
export declare function isTokenAboutToExpire(
  payload: TokenPayload,
  thresholdMs?: number,
): boolean;
export declare function getUserId(payload: TokenPayload): string | null;
export declare function hasTenantRole(
  payload: TokenPayload,
  tenantId: string,
  role: string,
): boolean;
export declare function hasLedgerAccess(
  payload: TokenPayload,
  ledgerId: string,
  right?: "read" | "write",
): boolean;
//# sourceMappingURL=auth.d.ts.map
