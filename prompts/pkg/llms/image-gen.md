# ImgGen Component

Generate and edit images from a text prompt. Each generated image lands as a file ref on the doc — display reads the platform-minted URL via `_files`.

## Basic Usage

```jsx
import { ImgGen } from "use-vibes";

function MyComponent() {
  return <ImgGen prompt="A sunset over mountains" />;
}
```

`<ImgGen>` writes the doc into a Fireproof database (default name `"ImgGen"`). The doc carries `_files.v1 = { uploadId, type, size }` and the platform mints `_files.v1.url` on read. Render the image with:

```jsx
const ver = doc.versions?.[doc.currentVersion ?? 0];
const meta = ver?.id ? doc._files?.[ver.id] : undefined;
return <img src={meta?.url} alt={doc.prompt} />;
```

This is the same `_files`-shape contract documented in `fireproof.md`'s "Working with Files" section — read it first if you have not seen the platform's file/URL story.

## Editing an Uploaded Image

Pass a `File` object via `images` to run img2img:

```jsx
import { useState } from "react";
import { ImgGen } from "use-vibes";

function MyComponent() {
  const [file, setFile] = useState(null);
  return (
    <div>
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
      {file && <ImgGen prompt="Make it look like a watercolor painting" images={[file]} />}
    </div>
  );
}
```

The input image is automatically resized (max 1024px) and compressed as JPEG before sending. img2img is currently supported on `prodia/*` models.

## Loading a Specific Doc

```jsx
<ImgGen _id="my-image-id" database={database} />
```

If the doc has a `prompt` but no `_files` yet, the component generates one.

## Gallery Pattern

Browse stored images with `useLiveQuery`:

```jsx
import { useFireproof } from "use-fireproof";
import { ImgGen } from "use-vibes";

function MyComponent() {
  const { useLiveQuery } = useFireproof("ImgGen");
  const { docs } = useLiveQuery("type", { key: "image", descending: true });

  return (
    <div>
      <ImgGen prompt="A colorful landscape" />
      {docs.map((doc) => {
        const ver = doc.versions?.[doc.currentVersion ?? 0];
        const meta = ver?.id ? doc._files?.[ver.id] : undefined;
        return <img key={doc._id} src={meta?.url} alt={doc.prompt} width={128} />;
      })}
    </div>
  );
}
```

## Caching and Versions

- Same prompt produces a deterministic `_id` (hash-based), so results are cached across reloads.
- Each image has a regenerate button that appends a new version (writes a new `_files.v<N>` entry).
- Prev / next controls navigate between stored versions.
- Set `showControls={false}` to hide regenerate and version navigation.

## Choosing a Model

```jsx
<ImgGen prompt="An astronaut riding a horse" model="openai/gpt-5-image-mini" />
```

Model ids follow the `provider/model-name` form from the platform's model catalog. Unknown ids surface as an error in the component's error UI.

#### Props

- `prompt`: text prompt (required unless `_id` is provided)
- `images`: array of `File` objects for img2img (uses first image)
- `_id`: load a specific doc instead of generating
- `database`: Fireproof db name or instance (default `"ImgGen"`)
- `className`, `alt`, `style`: standard image styling
- `showControls`: toggle regenerate + version nav (default `true`)
- `model`: override the image-gen model for this component
