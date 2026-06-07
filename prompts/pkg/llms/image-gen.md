# ImgGen Component

Generate and edit images from a text prompt. Each generated image lands as a file ref on the doc — display reads the platform-minted URL via `_files`.

## Basic Usage

Start with a minimal image generation component:

App.jsx

```jsx
import React from "react";
import { useFireproof } from "use-fireproof";
import { ImgGen } from "use-vibes";

export default function App() {
  return (
    <div>
      <h2>Image Generator</h2>
      <ImgGen prompt="A sunset over mountains" />
    </div>
  );
}
```

`<ImgGen>` writes the doc into a Fireproof database (default name `"ImgGen"`). The doc carries `_files.v1 = { uploadId, type, size }` and the platform mints `_files.v1.url` on read. To render a stored image doc manually, read the version with `doc.versions?.[doc.currentVersion ?? 0]`, get the file metadata with `doc._files?.[ver.id]`, and use `meta.url` for `<img src>`. The gallery pattern below shows this in a working component with proper hooks.

This is the same `_files`-shape contract documented in `fireproof.md`'s "Working with Files" section — read it first if you have not seen the platform's file/URL story.

## Editing an Uploaded Image

Pass a `File` object via `images` to run img2img. Adding a file picker that feeds into ImgGen:

App.jsx

```jsx
<<<<<<< SEARCH
export default function App() {
  return (
    <div>
      <h2>Image Generator</h2>
=======
export default function App() {
  const [file, setFile] = React.useState(null);

  return (
    <div>
      <h2>Image Generator</h2>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
      {file && <ImgGen prompt="Make it look like a watercolor painting" images={[file]} />}
>>>>>>> REPLACE
```

The input image is automatically resized (max 1024px) and compressed as JPEG before sending. img2img is currently supported on `prodia/*` models.

## Loading a Specific Doc

Load a previously generated image by `_id` — if the doc has a `prompt` but no `_files` yet, the component generates one: `<ImgGen _id="my-image-id" database={database} />`

## Gallery Pattern

Browse stored images with `useLiveQuery`. Building a gallery below the generator:

App.jsx

```jsx
<<<<<<< SEARCH
export default function App() {
  const [file, setFile] = React.useState(null);

  return (
=======
export default function App() {
  const { useLiveQuery } = useFireproof("ImgGen");
  const { docs } = useLiveQuery("type", { key: "image", descending: true });
  const [file, setFile] = React.useState(null);

  return (
>>>>>>> REPLACE
```

App.jsx

```jsx
<<<<<<< SEARCH
    </div>
  );
}
=======
      <h3>Gallery</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {docs.map((doc) => {
          const ver = doc.versions?.[doc.currentVersion ?? 0];
          const meta = ver?.id ? doc._files?.[ver.id] : undefined;
          return <img key={doc._id} src={meta?.url} alt={doc.prompt} width={128} />;
        })}
      </div>
    </div>
  );
}
>>>>>>> REPLACE
```

## Caching and Versions

- Same prompt produces a deterministic `_id` (hash-based), so results are cached across reloads.
- Each image has a regenerate button that appends a new version (writes a new `_files.v<N>` entry).
- Prev / next controls navigate between stored versions.
- Set `showControls={false}` to hide regenerate and version navigation.

## Choosing a Model

Override the model per component: `<ImgGen prompt="An astronaut riding a horse" model="openai/gpt-5-image-mini" />`

Model ids follow the `provider/model-name` form from the platform's model catalog. Unknown ids surface as an error in the component's error UI.

#### Props

- `prompt`: text prompt (required unless `_id` is provided)
- `images`: array of `File` objects for img2img (uses first image)
- `_id`: load a specific doc instead of generating
- `database`: Fireproof db name or instance (default `"ImgGen"`)
- `className`, `alt`, `style`: standard image styling
- `showControls`: toggle regenerate + version nav (default `true`)
- `model`: override the image-gen model for this component
