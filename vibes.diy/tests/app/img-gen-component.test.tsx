// vibes.diy/tests/app/img-gen-component.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ImgGen } from "@vibes.diy/base";
import { Result } from "@adviser/cement";
import { registerFirefly } from "../../vibe/runtime/use-firefly.js";
import { createMockVibeApi, asSandboxApi, type MockVibeApi } from "./mock-vibe-api.js";

// Swap @fireproof/use-fireproof with Firefly — mirrors the sandbox import-map behavior.
// Must be declared before any imports that use it (vitest hoists vi.mock calls).
vi.mock("@fireproof/use-fireproof", async () => {
  const { useFireproof } = await import("../../vibe/runtime/use-firefly.js");
  return { useFireproof };
});

// Control imgGen without hitting the real API.
const mockImgGen = vi.hoisted(() => vi.fn());
vi.mock("@vibes.diy/vibe-runtime", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  imgGen: mockImgGen,
}));

// ── Test helpers ────────────────────────────────────────────────────

let mockApi: MockVibeApi;
let dbCounter = 0;
/** Unique DB name per test — avoids Firefly dbCache cross-contamination. */
function freshDb() {
  return `img-gen-test-${++dbCounter}`;
}

/** Pre-built image doc with a URL-bearing _files entry. */
function makeImageDoc(id: string, url: string, versions = 1) {
  const versionList = Array.from({ length: versions }, (_, i) => ({
    id: `v${i + 1}`,
    created: Date.now() - (versions - i) * 1000,
    promptKey: "p1",
  }));
  const files: Record<string, unknown> = {};
  versionList.forEach((v, i) => {
    files[v.id] = {
      url: i === versions - 1 ? url : `${url}-v${i + 1}`,
      uploadId: `upl-${i + 1}`,
      cid: `bafy-${i + 1}`,
      type: "image/png",
      size: 100,
      lastModified: Date.now(),
    };
  });
  return {
    _id: id,
    type: "image",
    prompt: "test prompt",
    currentVersion: versions - 1,
    versions: versionList,
    currentPromptKey: "p1",
    prompts: { p1: { text: "test prompt", created: Date.now() } },
    _files: files,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockApi = createMockVibeApi("test-app");
  await registerFirefly(asSandboxApi(mockApi));
});

// ── Tests ───────────────────────────────────────────────────────────

describe("ImgGen component", () => {
  it("shows 'No prompt provided' when neither prompt nor _id is given", () => {
    render(<ImgGen database={freshDb()} />);
    expect(screen.getByText("No prompt provided")).toBeInTheDocument();
  });

  it("shows generating state when prompt is given but no image exists yet", () => {
    // imgGen is a never-resolving promise — component stays in generating state
    mockImgGen.mockImplementation(() => new Promise(() => {}));
    render(<ImgGen prompt="mountain sunset" database={freshDb()} />);
    expect(screen.getByText("Generating image...")).toBeInTheDocument();
    expect(screen.getByText("mountain sunset")).toBeInTheDocument();
  });

  it("shows error state when imgGen rejects", async () => {
    mockImgGen.mockRejectedValue(new Error("Prodia API failed"));
    render(<ImgGen prompt="test prompt" database={freshDb()} />);
    await waitFor(() => {
      expect(screen.getByText("Prodia API failed")).toBeInTheDocument();
    });
  });

  it("calls imgGen with the correct prompt and stores the result doc", async () => {
    const mockFile = { uploadId: "upl-abc", cid: "bafy-abc", mimeType: "image/png", size: 1024 };
    mockImgGen.mockResolvedValue(Result.Ok([mockFile]));

    render(<ImgGen prompt="beautiful sunset" database={freshDb()} />);

    await waitFor(() => {
      expect(mockImgGen).toHaveBeenCalledWith("beautiful sunset", undefined, undefined);
    });
    await waitFor(() => {
      const stored = [...mockApi._docs.values()].find((d) => d.type === "image" && d.prompt === "beautiful sunset");
      expect(stored).toBeDefined();
      expect(stored?._files).toEqual(expect.objectContaining({ v1: expect.objectContaining({ uploadId: "upl-abc" }) }));
    });
  });

  it("renders <img> with the correct src when a pre-existing image doc is present", async () => {
    mockApi._docs.set("img-existing", makeImageDoc("img-existing", "https://example.com/img.png"));
    render(<ImgGen _id="img-existing" database={freshDb()} />);
    await waitFor(() => {
      expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/img.png");
    });
  });

  it("applies className to the root element in generating state", () => {
    mockImgGen.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<ImgGen prompt="test" className="my-custom-class" database={freshDb()} />);
    expect(container.firstChild).toHaveClass("my-custom-class");
  });

  it("switches to a new image when _id changes", async () => {
    mockApi._docs.set("doc-1", makeImageDoc("doc-1", "https://example.com/doc1.png"));
    mockApi._docs.set("doc-2", makeImageDoc("doc-2", "https://example.com/doc2.png"));
    const db = freshDb();

    const { rerender } = render(<ImgGen _id="doc-1" database={db} />);
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/doc1.png"));

    rerender(<ImgGen _id="doc-2" database={db} />);
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/doc2.png"));
  });

  it("shows prev/next version controls for a doc with multiple versions", async () => {
    mockApi._docs.set("img-multi", makeImageDoc("img-multi", "https://example.com/multi.png", 2));
    render(<ImgGen _id="img-multi" database={freshDb()} />);
    await waitFor(() => {
      expect(screen.getByTitle("Previous version")).toBeInTheDocument();
      expect(screen.getByTitle("Next version")).toBeInTheDocument();
    });
  });

  it("switches from generating state to image display when _id replaces prompt", async () => {
    mockImgGen.mockImplementation(() => new Promise(() => {}));
    mockApi._docs.set("img-from-id", makeImageDoc("img-from-id", "https://example.com/from-id.png"));
    const db = freshDb();

    const { rerender } = render(<ImgGen prompt="a sunset" database={db} />);
    expect(screen.getByText("Generating image...")).toBeInTheDocument();

    rerender(<ImgGen _id="img-from-id" database={db} />);
    await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/from-id.png"));
  });
});
