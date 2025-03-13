import { describe, it, expect } from 'vitest';
import { parseContent, parseDependencies } from '../app/utils/segmentParser';
import fs from 'fs';
import path from 'path';

describe('segmentParser utilities', () => {
  it('correctly parses markdown content with no code blocks', () => {
    const text = 'This is a simple markdown text with no code blocks.';
    const result = parseContent(text);

    expect(result.segments.length).toBe(1);
    expect(result.segments[0].type).toBe('markdown');
    expect(result.segments[0].content).toBe(text);
    expect(result.dependenciesString).toBeUndefined();
  });

  it('correctly handles nested JSX content', () => {
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

    // Log the content for debugging
    console.log('Testing with problematic content:', text);

    const result = parseContent(text);

    // We expect the parser to handle this as a single markdown segment
    expect(result.segments.length).toBe(1);
    expect(result.segments[0].type).toBe('markdown');
    expect(result.segments[0].content).toBe(text);
  });

  it('correctly parses JSX/React code in code blocks', () => {
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

    console.log('Testing with code block JSX content:');
    console.log(text);

    const result = parseContent(text);

    console.log('Resulting segments:', result.segments);

    // The text should be split into:
    // 1. Markdown before the code
    // 2. Code block
    // 3. Empty markdown after the code
    expect(result.segments.length).toBe(2);
    expect(result.segments[0].type).toBe('markdown');
    expect(result.segments[1].type).toBe('code');
    expect(result.segments[1].content).toContain('function SearchResults');
  });

  it('verifies segment types for all fixture files', () => {
    // Define expected segment types for each fixture file
    const fixtureExpectations = {
      'easy-message.txt': ['markdown', 'code', 'markdown'],
      'easy-message2.txt': ['markdown', 'code', 'markdown'],
      'easy-message3.txt': ['markdown', 'code', 'markdown'],
      'hard-message.txt': ['markdown', 'code', 'markdown'],
      'long-message.txt': ['markdown', 'code', 'markdown'],
      'long-message2.txt': ['markdown', 'code', 'markdown'],
    };

    // Test each fixture file
    Object.entries(fixtureExpectations).forEach(([filename, expectedTypes]) => {
      const fixturePath = path.join(__dirname, filename);
      expect(fs.existsSync(fixturePath)).toBe(true);

      const content = fs.readFileSync(fixturePath, 'utf-8');
      const result = parseContent(content);
      const actualTypes = result.segments.map((segment) => segment.type);

      expect([filename, ...actualTypes]).toEqual([filename, ...expectedTypes]);
    });
  });
});
