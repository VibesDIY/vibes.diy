/**
 * System fetch wrapper
 * This is a simple wrapper around fetch for now
 */
export const systemFetch: typeof fetch = (...args) => {
  return fetch(...args);
};
