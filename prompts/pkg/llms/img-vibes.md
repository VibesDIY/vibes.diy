# ImgVibes Component

## Basic Usage

The ImgVibes component can be used in several ways:

1. **With a prompt prop** - Immediately generates an image (cached across reloads):

```jsx
import { ImgVibes } from "img-vibes";

function MyComponent() {
  return <ImgVibes prompt="A sunset over mountains" />;
}
```

2. **With an input image** - Edits or transforms an uploaded image:

```jsx
import { ImgVibes } from "img-vibes";

function MyComponent() {
  const [file, setFile] = useState(null);
  return (
    <div>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
      {file && <ImgVibes prompt="Make it look like a watercolor painting" images={[file]} />}
    </div>
  );
}
```

The input image is automatically resized (max 1024px) and compressed as JPEG before sending.

3. **With an \_id prop** - Loads a specific image from the database:

```jsx
import { ImgVibes } from "img-vibes";

function MyComponent() {
  return <ImgVibes _id="my-image-id" database={database} />;
}
```

If the document has a `prompt` field but no generated image yet, it will generate one automatically.

## Gallery Pattern

Images and prompts are tracked in a Fireproof database with a `type` of `image`. If a database is not provided, it uses `"ImgVibes"` as the default.

Display stored images by their ID using `useLiveQuery`:

```jsx
import { useFireproof } from "use-fireproof";
import { ImgVibes } from "img-vibes";

function MyComponent() {
  const { database, useLiveQuery } = useFireproof("my-db-name");
  const { docs: imageDocuments } = useLiveQuery("type", {
    key: "image",
    descending: true,
  });

  return (
    <div>
      <ImgVibes database={database} prompt="A colorful landscape" />
      {imageDocuments.length > 0 && (
        <div className="history">
          <h3>Previously Generated Images</h3>
          <ul className="image-list">
            {imageDocuments.map((doc) => (
              <li key={doc._id} className="image-item">
                <ImgVibes _id={doc._id} database={database} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Passing User Images Through App State

When your app captures or collects images earlier in the flow (camera, file picker, canvas), store the `File` object in React state and pass it to `ImgVibes` later. This is the most common pattern for img2img — don't discard the user's image before reaching ImgVibes:

```jsx
import { useState } from "react";
import { ImgVibes } from "img-vibes";

function App() {
  const [photo, setPhoto] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      {!submitted ? (
        <>
          <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Transform into..." />
          <button onClick={() => setSubmitted(true)} disabled={!photo || !prompt}>
            Go
          </button>
        </>
      ) : (
        <ImgVibes prompt={prompt} images={[photo]} />
      )}
    </div>
  );
}
```

**Key rule**: Any time the user provides an image (camera capture, file upload, canvas export) and the app later generates an image based on it, the `File` must be kept in state and passed via the `images` prop. Never generate without the user's image when one was provided — that's the whole point of img2img.

## Caching and Versions

- Same prompt generates a deterministic `_id` (hash-based), so results are cached across reloads
- Each image has a **regenerate** button that creates a new version
- Use **prev/next** controls to navigate between versions
- Set `showControls={false}` to hide the regen and version navigation buttons

## Styling

ImgVibes supports custom styling through CSS variables or custom class names:

```jsx
// With CSS variables in your styles
:root {
  --imggen-text-color: #222;
  --imggen-accent: #0088ff;
  --imggen-border-radius: 8px;
}

// With custom class names
<ImgVibes
  prompt="A landscape"
  className="my-custom-image"
/>
```

#### Props

- `prompt`: Text prompt for image generation (required unless `_id` is provided)
- `images`: Array of `File` objects for img2img editing/transformation (uses first image, optional)
- `_id`: Document ID to load a specific image instead of generating a new one
- `database`: Database name or instance to use for storing images (default: `'ImgVibes'`)
- `className`: CSS class name for the image element (optional)
- `alt`: Alt text for the image element (optional)
- `style`: Inline styles for the image element (optional)
- `showControls`: Toggle regenerate and version navigation buttons (default: `true`)
- `model`: Override the image generation model for this component (optional). Use a catalog model id such as `"openai/gpt-5-image-mini"` or `"prodia/flux-2.klein.9b"`. When omitted, the app's configured default is used. Note: img2img (passing `images`) is only supported for `prodia/*` models today.

## Choosing a Model

By default, images are generated with the app's configured image model. Pass the `model` prop when you want a specific `<ImgVibes>` to use a different backend — for example, routing an OpenAI-family image model for one component while leaving the rest of the app on the default:

```jsx
import { ImgVibes } from "img-vibes";

function MyComponent() {
  return <ImgVibes prompt="An astronaut riding a horse" model="openai/gpt-5-image-mini" />;
}
```

Model ids follow the `provider/model-name` form from the platform's model catalog. Unknown or unavailable ids surface as an error through the component's error UI.
