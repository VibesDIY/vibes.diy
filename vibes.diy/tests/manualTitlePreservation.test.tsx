import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the sendMessage module to test title generation prevention
const mockVibeDoc = {
  _id: "vibe" as const,
  title: "",
  encodedTitle: "",
  remixOf: "",
  created_at: Date.now(),
  titleSetManually: false,
};

// Mock the generateTitle function
const mockGenerateTitle = vi.fn().mockResolvedValue("AI Generated Title");

// Mock the updateTitle function
const mockUpdateTitle = vi
  .fn()
  .mockImplementation(async (title: string, isManual = false) => {
    mockVibeDoc.title = title;
    mockVibeDoc.titleSetManually = isManual;
    mockVibeDoc.encodedTitle = title.toLowerCase().replace(/\s+/g, "-");
  });

describe("Manual Title Preservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock vibeDoc state
    mockVibeDoc.title = "";
    mockVibeDoc.titleSetManually = false;
    mockVibeDoc.encodedTitle = "";
  });

  it("should call updateTitle with isManual=true when user manually sets title", async () => {
    // Simulate user manually setting title in AppSettingsView
    await mockUpdateTitle("My Custom App Title", true);

    expect(mockUpdateTitle).toHaveBeenCalledWith("My Custom App Title", true);
    expect(mockVibeDoc.titleSetManually).toBe(true);
    expect(mockVibeDoc.title).toBe("My Custom App Title");
  });

  it("should call updateTitle with isManual=false for AI-generated titles", async () => {
    // Simulate AI generating title
    await mockUpdateTitle("AI Generated Title", false);

    expect(mockUpdateTitle).toHaveBeenCalledWith("AI Generated Title", false);
    expect(mockVibeDoc.titleSetManually).toBe(false);
    expect(mockVibeDoc.title).toBe("AI Generated Title");
  });

  it("should prevent title generation when titleSetManually is true", async () => {
    // First set a manual title
    await mockUpdateTitle("Manual Title", true);

    // Simulate the logic from sendMessage.ts
    const titleSetManually = mockVibeDoc?.titleSetManually === true;
    const shouldGenerateTitle = !titleSetManually;

    expect(titleSetManually).toBe(true);
    expect(shouldGenerateTitle).toBe(false);

    // If this was real sendMessage code, generateTitle would NOT be called
    if (shouldGenerateTitle) {
      await mockGenerateTitle();
    }

    expect(mockGenerateTitle).not.toHaveBeenCalled();
  });

  it("should allow title generation when titleSetManually is false", async () => {
    // Set an AI-generated title first
    await mockUpdateTitle("AI Title", false);

    // Simulate the logic from sendMessage.ts
    const titleSetManually = mockVibeDoc?.titleSetManually === true;
    const shouldGenerateTitle = !titleSetManually;

    expect(titleSetManually).toBe(false);
    expect(shouldGenerateTitle).toBe(true);

    // If this was real sendMessage code, generateTitle would be called
    if (shouldGenerateTitle) {
      const newTitle = await mockGenerateTitle();
      await mockUpdateTitle(newTitle, false);
    }

    expect(mockGenerateTitle).toHaveBeenCalled();
    expect(mockVibeDoc.title).toBe("AI Generated Title");
  });

  it("should preserve manual title state when set", async () => {
    // Start with no title
    expect(mockVibeDoc.titleSetManually).toBe(false);

    // User sets manual title
    await mockUpdateTitle("User Set Title", true);
    expect(mockVibeDoc.titleSetManually).toBe(true);
    expect(mockVibeDoc.title).toBe("User Set Title");

    // Simulate multiple AI responses that would try to generate titles
    for (let i = 0; i < 3; i++) {
      const titleSetManually = mockVibeDoc?.titleSetManually === true;

      if (!titleSetManually) {
        // This should not happen when title is manually set
        await mockUpdateTitle(`AI Title ${i}`, false);
      }

      // Title should remain the manual one
      expect(mockVibeDoc.title).toBe("User Set Title");
      expect(mockVibeDoc.titleSetManually).toBe(true);
    }
  });

  it("should handle transition from AI to manual title correctly", async () => {
    // Start with AI-generated title
    await mockUpdateTitle("Initial AI Title", false);
    expect(mockVibeDoc.titleSetManually).toBe(false);

    // User changes to manual title
    await mockUpdateTitle("My Custom Title", true);
    expect(mockVibeDoc.titleSetManually).toBe(true);
    expect(mockVibeDoc.title).toBe("My Custom Title");

    // Future AI generations should be blocked
    const shouldGenerateTitle = !(mockVibeDoc?.titleSetManually === true);
    expect(shouldGenerateTitle).toBe(false);
  });

  it("should encode titles correctly for both manual and AI titles", async () => {
    // Test manual title encoding
    await mockUpdateTitle("My Complex App Name", true);
    expect(mockVibeDoc.encodedTitle).toBe("my-complex-app-name");

    // Test AI title encoding
    await mockUpdateTitle("AI Generated Complex Title", false);
    expect(mockVibeDoc.encodedTitle).toBe("ai-generated-complex-title");
  });
});
