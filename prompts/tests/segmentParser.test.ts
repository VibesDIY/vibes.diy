import { describe, it, expect } from "vitest";
import { parseContent } from "@vibes.diy/prompts";
import { BuildURI, loadAsset, pathOps } from "@adviser/cement";

// move this test to @vibes.diy/prompts test package, also the referenced fixtures

describe("segmentParser utilities", () => {
  it("correctly parses markdown content with no code blocks", () => {
    const text = "This is a simple markdown text with no code blocks.";
    const result = parseContent(text);

    expect(result.segments.length).toBe(1);
    expect(result.segments[0].type).toBe("markdown");
    expect(result.segments[0].content).toBe(text);
  });

  it("correctly handles nested JSX content", () => {
    const text = `
                    >
                      {search.term}
                    </span>
                    <span className="text-xs text-orange-300">
                      {new Date(search.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-gray-900 p-4 rounded-lg border-2 border-orange-500">
          <h2 className="text-2xl font-bold mb-4 bg-orange-500 text-black p-2 inline-block">FAVORITES</h2>
          {favoriteGifs.length === 0 ? (
            <p className="text-orange-300">No favorite GIFs yet.</p>
          ) : (
            <div className="space-y-4">
              {favoriteGifs.map((fav) => (
                <div key={fav._id} className="border-b border-orange-700 pb-3">
                  <img 
                    src={fav.url} 
                    alt={fav.title} 
                    className="w-full h-auto rounded mb-2"
                  />
                  <div className="flex justify-between items-center">
                    <div className="truncate text-xs">{fav.title}</div>
                    <button 
                      onClick={() => removeFavorite(fav._id)}
                      className="text-orange-500 hover:text-red-500"
                    >
                      ✖
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
</div>
); }

This app creates a retr`;

    const result = parseContent(text);

    // We expect the parser to handle this as a single markdown segment
    expect(result.segments.length).toBe(1);
    expect(result.segments[0].type).toBe("markdown");
    expect(result.segments[0].content).toBe(text);
  });

  it("correctly parses JSX/React code in code blocks", () => {
    const text = `
Here is a React component:

\`\`\`jsx
function SearchResults({ searches }) {
  return (
    <div>
      {searches.map((search) => (
        <span>{search.term}</span>
      ))}
    </div>
  );
}
\`\`\`
`;

    const result = parseContent(text);

    // The text should be split into:
    // 1. Markdown before the code
    // 2. Code block
    // 3. Empty markdown after the code
    expect(result.segments.length).toBe(2);
    expect(result.segments[0].type).toBe("markdown");
    expect(result.segments[1].type).toBe("code");
    expect(result.segments[1].content).toContain("function SearchResults");
  });

  it("correctly parses JSX/React code in the longest code block", () => {
    const text = `
Here is a React component with a short code block before it:

\`\`\`jsx
for (let i = 0; i < 10; i++) {
  console.log(i);
}
\`\`\`

More markdown

\`\`\`jsx
function SearchResults({ searches }) {
  return (
    <div>
      {searches.map((search) => (
        <span>{search.term}</span>
      ))}
    </div>
  );
}
\`\`\`

Final markdown
`;

    const result = parseContent(text);

    // The text should be split into:
    // 1. Markdown before the code
    // 2. Code block
    // 3. Empty markdown after the code
    expect(result.segments.length).toBe(3);
    expect(result.segments[0].type).toBe("markdown");
    expect(result.segments[1].type).toBe("code");
    expect(result.segments[2].type).toBe("markdown");
    expect(result.segments[0].content).toContain("console");
    expect(result.segments[1].content).toContain("function SearchResults");
  });

  it("verifies segment types for all fixture files", async () => {
    // make subset files for partial parse
    const fixtureExpectations = {
      "easy-message.txt": ["markdown", "code", "markdown"],
      "easy-message2.txt": ["markdown", "code", "markdown"],
      "easy-message3.txt": ["markdown", "code", "markdown"],
      "easy-message4.txt": ["markdown", "code", "markdown"],
      "easy-message5.txt": ["markdown", "code", "markdown"],
      "hard-message.txt": ["markdown", "code", "markdown"],
      "long-message.txt": ["markdown", "code", "markdown"],
      "long-message2.txt": ["markdown", "code", "markdown"],
      "prefix-easy.txt": ["markdown", "code"],
    };

    for (const [filename, expectedTypes] of Object.entries(
      fixtureExpectations,
    )) {
      const content = await loadAsset(pathOps.join("fixtures", filename), {
        basePath: () => {
          const r = BuildURI.from(import.meta.url)
            .cleanParams()
            .pathname("/")
            .toString();
          return r;
        },
      });
      const result = parseContent(content.Ok());
      const actualTypes = result.segments.map((segment) => segment.type);
      expect([filename, ...actualTypes]).toEqual([filename, ...expectedTypes]);
    }
  });

  it("correctly parses dependencies from easy-message5.txt fixture", async () => {
    // Read the fixture file
    // const fixturePath = pathOps.join(__dirname, "fixtures", "easy-message5.txt");
    // expect(fs.existsSync(fixturePath)).toBe(true);
    // const content = fs.readFileSync(fixturePath, "utf-8");
    const content = await loadAsset("fixtures/easy-message5.txt", {
      basePath: () => {
        const r = BuildURI.from(import.meta.url)
          .cleanParams()
          .pathname("/")
          .toString();
        return r;
      },
    });
    const result = parseContent(content.Ok());
    expect(result.segments.length).toBe(3);
    expect(result.segments[1].type).toBe("code");
    expect(result.segments[1].content).toContain("react-modal");
  });
});

it("correctly parses dependencies from hard-message2.txt fixture", async () => {
  const rContent = await loadAsset("fixtures/hard-message2.txt", {
    basePath: () => {
      const r = BuildURI.from(import.meta.url)
        .cleanParams()
        .pathname("/")
        .toString();
      return r;
    },
  });
  const result = parseContent(rContent.Ok());
  expect(result.segments.length).toBe(3);
  expect(result.segments[1].type).toBe("code");
  expect(result.segments[1].content).toContain("react-dropzone");
});

it("correctly parses markdown and code from hard-message3.txt fixture", async () => {
  const rContent = await loadAsset("fixtures/hard-message3.txt", {
    basePath: () => {
      const r = BuildURI.from(import.meta.url)
        .cleanParams()
        .pathname("/")
        .toString();
      return r;
    },
  });
  const result = parseContent(rContent.Ok());

  expect(result.segments.length).toBe(3);
  expect(result.segments[0].type).toBe("markdown");
  expect(result.segments[1].type).toBe("code");
  expect(result.segments[2].type).toBe("markdown");

  // code should match Loading questions
  expect(result.segments[1].content).toMatch(/Loading questions/);
});
