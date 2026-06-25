import { describe, it, expect } from "vitest";
import { parseFiles } from "./parse-files.js";

describe("parseFiles", () => {
  it("extracts a filename-fenced block", () => {
    const text = "Here is the app.\n\nApp.jsx\n```jsx\nexport default function App(){return null;}\n```\n";
    expect(parseFiles(text)).toEqual({ "App.jsx": "export default function App(){return null;}" });
  });
  it("extracts multiple files", () => {
    const text = "App.jsx\n```jsx\nA\n```\naccess.js\n```js\nB\n```\n";
    expect(parseFiles(text)).toEqual({ "App.jsx": "A", "access.js": "B" });
  });
  it("returns {} when no filename-fenced block is present", () => {
    expect(parseFiles("just prose, no code")).toEqual({});
  });
  it("ignores a fenced block with no preceding filename line", () => {
    expect(parseFiles("```jsx\norphan\n```")).toEqual({});
  });
});
