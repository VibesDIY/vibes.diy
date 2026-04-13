# ImgGen Component

## Basic Usage

The ImgGen component can be used in three ways:

1. **With no props** - Shows a form UI for users to enter a prompt and/or upload images:

```jsx
import { ImgGen } from 'use-vibes';

function MyComponent() {
  return <ImgGen />; // Shows built-in form for prompt entry and image upload
}
```

2. **With a prompt prop** - Immediately generates an image (no form shown):

```jsx
import { ImgGen } from 'use-vibes';

function MyComponent() {
  return <ImgGen prompt="A sunset over mountains" />; // Direct generation, no form
}
```

3. **With images prop** - Edits or combines images with AI (no form shown):

```jsx
import { ImgGen } from 'use-vibes';

function MyComponent() {
  const [files, setFiles] = useState([]);
  return (
    <ImgGen 
      prompt="Create a gift basket with these items" 
      images={files} // Array of File objects
    />
  );
}
```

4. **With an _id prop** - Loads a specific image from the database (no form shown):

If there is no image generated for the document yet, but it has a `prompt` field, it will generate a new image with the prompt. If there an images is stored, at doc._files.original, it will use that as the base image.

```jsx
import { ImgGen } from 'use-vibes';

function MyComponent() {
  return <ImgGen _id="my-image-id" />; // Loads specific image by ID
}
```


## List by ID

Images and prompts are tracked in a Fireproof database with a `type` of `image`. If a database is not provided, it uses `"ImgGen"` as the database name.

Display stored images by their ID. Ensure you do this, so users can find the images they created.

```jsx
import { useFireproof } from 'use-fireproof';
import { ImgGen } from 'use-vibes';

function MyComponent() {
  const { database, useLiveQuery } = useFireproof("my-db-name");
   const { docs: imageDocuments } = useLiveQuery('type', {
    key: 'image',
    descending: true,
  });

  return (
    <div>
      <ImgGen database={database} />
      {imageDocuments.length > 0 && (
        <div className="history">
          <h3>Previously Generated Images</h3>
          <ul className="image-list">
            {imageDocuments.map((doc) => (
              <li key={doc._id} className="image-item">
                <ImgGen _id={doc._id} database={database} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Styling

ImgGen supports custom styling through CSS variables or custom class names:

```jsx
// With CSS variables in your styles
:root {
  --imggen-text-color: #222;
  --imggen-accent: #0088ff;
  --imggen-border-radius: 8px;
}

// With custom class names
<ImgGen 
  prompt="A landscape" 
  className="my-custom-image"
  classes={{
    root: 'custom-container',
    image: 'custom-img',
    overlay: 'custom-overlay'
  }}
/>
```

#### Props

- `prompt`: Text prompt for image generation (required unless `_id` is provided)
- `_id`: Document ID to load a specific image instead of generating a new one
- `database`: Database name or instance to use for storing images (default: `'ImgGen'`)- `options` (object, optional): Configuration options for image generation
  - `model` (string, optional): Model to use for image generation, defaults to 'gpt-image-1'
  - `size` (string, optional): Size of the generated image (Must be one of 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait), or 'auto' (default value) for gpt-image-1, and one of 256x256, 512x512, or 1024x1024 for dall-e-2.)
  - `quality` (string, optional): Quality of the generated image (high, medium and low are only supported for gpt-image-1. dall-e-2 only supports standard quality. Defaults to auto.)
  - `debug` (boolean, optional): Enable debug logging, defaults to false
- `onLoad`: Callback when image load completes successfully
- `onError`: Callback when image load fails, receives the error as parameter
- `className`: CSS class name for the image element (optional)- `classes`: Object containing custom CSS classes for styling component parts (see Styling section)
