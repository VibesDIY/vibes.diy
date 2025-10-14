// Test helper functions to reduce duplication in catalog title assertions
import { expect } from "vitest";

/**
 * Assert that HTML contains catalog title page elements
 * @param html - The HTML content to check
 * @param title - Expected app title
 */
export function expectCatalogTitle(html: string, title: string): void {
  expect(html).toContain(title);
  expect(html).toContain("catalog-container");
  expect(html).toContain("Install");
  expect(html).toContain(`<title>${title} - Vibes DIY</title>`);
}

/**
 * Assert that HTML contains basic catalog title page elements (without full title)
 * @param html - The HTML content to check
 * @param title - Expected app title
 */
export function expectBasicCatalogTitle(html: string, title: string): void {
  expect(html).toContain(title);
  expect(html).toContain("catalog-container");
  expect(html).toContain("Install");
}

/**
 * Assert that HTML contains app instance elements (not catalog)
 * @param html - The HTML content to check
 * @param appCode - Expected app code fragment
 */
export function expectAppInstance(html: string, appCode: string): void {
  expect(html).toContain(appCode);
  expect(html).toContain("ReactDOMClient");
  expect(html).toContain("container");
  expect(html).not.toContain("catalog-container");
  expect(html).not.toContain("Install");
}
