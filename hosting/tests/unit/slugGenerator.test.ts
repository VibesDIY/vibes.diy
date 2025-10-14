import { describe, it, expect } from "vitest";
import { generateVibeSlug } from "../src/utils/slugGenerator";

describe("Vibe Slug Generator", () => {
  it("should generate 30 unique slugs with no repeats", () => {
    const generatedSlugs = new Set();
    const slugs = [];

    // Generate 30 slugs
    for (let i = 0; i < 30; i++) {
      const slug = generateVibeSlug();
      slugs.push(slug);
      generatedSlugs.add(slug);
    }

    // Print all generated slugs to console
    console.log("\nGenerated 30 vibe slugs:");
    slugs.forEach((slug, index) => {
      console.log(`${index + 1}. ${slug}`);
    });

    // Check that we have 30 unique slugs (no duplicates)
    console.log(`\nUnique slugs: ${generatedSlugs.size}/30`);

    // Test passes if all 30 slugs are unique
    expect(generatedSlugs.size).toBe(30);

    // Verify slug format (system-character-number)
    slugs.forEach((slug) => {
      const parts = slug.split("-");
      expect(parts.length).toBe(3);
      expect(parts[2]).toMatch(/^\d{4}$/); // Should be 4-digit number
    });
  });
});
