export const isDebug = (): boolean =>
  Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) &&
  (typeof window === 'undefined' || localStorage.getItem('debugDelete') === '1');

export function logDebug(...args: unknown[]) {
  if (isDebug()) {
    console.log(...args);
  }
}
