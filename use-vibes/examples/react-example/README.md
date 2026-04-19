# use-vibes React Example

This example demonstrates how to use the `use-vibes` library in a React + TypeScript + Vite application.

## ImgVibes Component Example

The main component showcased here is `ImgVibes`, which generates AI images from text prompts. It provides:

- Automatic loading states
- Progress indicators
- Error handling
- Image caching

## Running the Example

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Usage

The example demonstrates how to use the ImgVibes component from use-vibes:

```tsx
import { ImgVibes } from "use-vibes";

function App() {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="container">
      <h1>Image Generator</h1>

      <div className="input-container">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your image prompt here..."
          className="prompt-input"
        />
      </div>

      <div className="image-container">
        <ImgVibes prompt={prompt} />
      </div>
    </div>
  );
}
```

See the full example code in `src/App.tsx`.
