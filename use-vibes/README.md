# use-vibes

A lightweight library that transforms any DOM element into an AI-powered micro-app.

## Installation

```bash
pnpm add use-vibes
```

## Basic Usage

```jsx
import { ImgGen } from 'use-vibes';

function MyComponent() {
  // You can use ImgGen without any props - it includes its own form UI
  return <ImgGen />;

  // Or provide a prompt directly (bypasses the form UI completely)
  // return <ImgGen prompt="A futuristic cityscape with flying cars" />;
}
```

For image manipulation using base64 data:

```jsx
import { base64ToFile } from 'use-vibes';

// Convert API response to a File object
const imageFile = base64ToFile(imageResponse.data[0].b64_json, 'my-image.png');
```

## Core Features

### Interactive Image Generation

- **Zero-config Implementation**: Add AI image generation to any React app without any configuration

  ```jsx
  {
    /* Includes a built-in form UI for prompt entry and image upload */
  }
  <ImgGen />;
  ```

- **One-line Implementation**: Directly specify a prompt for immediate generation (bypasses the form UI)

  ```jsx
  {
    /* Starts generating immediately, no form shown to the user */
  }
  <ImgGen prompt="A sunset over mountains" />;
  ```

- **Automatic Database Integration**: All images are automatically stored in Fireproof database with version history

  ```jsx
  // Custom database name
  <ImgGen prompt="Forest landscape" database="MyCustomDB" />

  // Or pass a database instance
  <ImgGen prompt="Forest landscape" database={myDbInstance} />
  ```

### Prompt Management

- **Prompt Versioning**: Tracks the history of different prompts used to generate an image
  - Uses a structured `prompts` object with timestamp-based keys
  - Maintains `currentPromptKey` to reference the active prompt

- **Prompt Editing**: Users can edit prompts directly in the overlay UI
  - Double-click the prompt text to edit
  - Press Enter to submit and regenerate with new prompt
  - App receives updates via `onPromptEdit` callback
  ```jsx
  <ImgGen
    prompt="Initial prompt"
    onPromptEdit={(id, newPrompt) => {
      console.log(`Document ${id} updated with new prompt: ${newPrompt}`);
    }}
  />
  ```

### Image Control & Manipulation

- **Image Regeneration**: One-click regeneration with the same or edited prompt
  - Preserves document history and adds new versions
  - Uses a unique `generationId` to trigger regeneration while maintaining context

- **Image Quality Control**: Set quality levels for output images

  ```jsx
  <ImgGen prompt="Detailed artwork" options={{ quality: 'high' }} />
  ```

- **Image Editing with Uploads**: Process existing images with AI

  ```jsx
  <ImgGen prompt="Turn this photo into a watercolor painting" images={[myImageFile]} />
  ```

- **Multiple Image Inputs**: Combine multiple images in one generation
  ```jsx
  <ImgGen prompt="Create a collage of these photos" images={[photo1, photo2, photo3]} />
  ```

### User Interface Components

- **Interactive Overlay**: Toggle-able information and controls overlay
  - Shows prompt text (editable)
  - Version navigation controls
  - Regenerate/refresh button
  - Delete button

  ```jsx
  // Disable overlay for a minimal UI
  <ImgGen prompt="Clean interface" overlay={false} />
  ```

- **Progress Visualization**: Shows generation progress with visual indicators
  - Progress bar updates in real-time
  - Automatic placeholder display during generation

- **Error Handling UI**: Clean error states with informative messages
  ```jsx
  <ImgGen
    prompt="Test error handling"
    onError={(error) => {
      console.error('Generation failed:', error.message);
    }}
  />
  ```

### File Management

- **File Upload Interface**: Built-in support for image uploads
  - Drag-and-drop capabilities
  - File selection dialog
  - Preview of uploaded content

- **Base64 Conversion**: Convert between base64 and File objects

  ```jsx
  import { base64ToFile } from 'use-vibes';

  // Convert API response to a File object
  const imageFile = base64ToFile(imageResponse.data[0].b64_json, 'my-image.png');
  ```

## Integration Features

### Event Callbacks

- **Generation Lifecycle Events**: Track the complete generation process
  ```jsx
  <ImgGen
    prompt="Track this generation"
    onComplete={() => console.log('Generation complete!')}
    onError={(error) => console.error('Generation failed:', error)}
    onDelete={(id) => console.log(`Document ${id} deleted`)}
    onDocumentCreated={(id) => console.log(`New document created: ${id}`)}
  />
  ```

### State Management

- **Loading States**: Component handles all loading states internally
  - Initial waiting state
  - Generation in progress state
  - Upload waiting state
  - Display state for completed images
  - Error state

- **Document Identity Tracking**: Smart re-mounting based on document changes
  - Uses internal `mountKey` system to ensure clean state transitions
  - Detects identity changes through document ID, prompt, or uploaded file documents

### UI Customization

- **Extensive Styling Options**: Multiple ways to customize appearance
  - CSS Variables for global styling

  ```css
  :root {
    --imggen-text-color: #222;
    --imggen-overlay-bg: rgba(245, 245, 245, 0.85);
    --imggen-accent: #0088ff;
    --imggen-border-radius: 4px;
  }
  ```

  - Custom classes for component-level styling

  ```jsx
  <ImgGen
    prompt="Styled component"
    classes={{
      root: 'my-custom-container',
      image: 'rounded-xl shadow-lg',
      overlay: 'bg-slate-800/70 text-white',
      progress: 'h-2 bg-green-500',
    }}
  />
  ```

### Gallery Integration

- **Thumbnail Support**: Easily create image galleries

  ```jsx
  <div className="image-grid">
    {imageDocuments.map((doc) => (
      <ImgGen key={doc._id} _id={doc._id} className="thumbnail" />
    ))}
  </div>
  ```

- **Document Reuse**: Load existing documents by ID
  ```jsx
  <ImgGen _id="existing-document-id" />
  ```

## Implementation Modes

The ImgGen component has several operational modes that it switches between automatically:

1. **Placeholder Mode**: Initial state when no prompt or document ID is provided
2. **Upload Waiting Mode**: When files are uploaded but waiting for a prompt
3. **Generating Mode**: During the image generation process
4. **Display Mode**: When showing a generated image with controls
5. **Error Mode**: When an error occurs during generation

The component automatically determines which mode to use based on the current state, providing a seamless experience for both developers and end-users.

## Advanced Usage

### Debug Mode

Enable debug mode to see detailed console logs about component state:

```jsx
<ImgGen prompt="Debug this" options={{ debug: true }} />
```

### Custom Image Sizing

Control output image dimensions with the size option:

```jsx
<ImgGen
  prompt="Landscape format"
  options={{ size: '1536x1024' }} // Landscape
/>

<ImgGen
  prompt="Portrait format"
  options={{ size: '1024x1536' }} // Portrait
/>
```

# Advanced Usage

This guide covers the implementation, configuration, and best practices for using the ImgGen component from the use-vibes library.

## Installation

```bash
pnpm add use-vibes
```

### Styling

The ImgGen component uses inline styles with centralized theme constants, so **no separate CSS setup is required**. All styling is self-contained within the component.

## Basic Usage

### Simple Image Generation

Add AI image generation to any React app with minimal code:

```jsx
import { ImgGen } from 'use-vibes';

function MyComponent() {
  return (
    <div>
      <ImgGen prompt="A sunset over mountains" />
    </div>
  );
}
```

### Configuration Options

Configure image generation with the `options` prop:

```jsx
<ImgGen
  prompt="A detailed cityscape"
  options={{
    model: 'gpt-image-1',
    quality: 'high',
    size: '1024x1024',
    debug: false,
  }}
/>
```

### Available Props

| Prop                | Type               | Description                                                             |
| ------------------- | ------------------ | ----------------------------------------------------------------------- |
| `prompt`            | string             | Text prompt for image generation (required unless `_id` is provided)    |
| `_id`               | string             | Document ID to load a specific image instead of generating a new one    |
| `className`         | string             | CSS class name for the image element                                    |
| `alt`               | string             | Alt text for the image (defaults to prompt)                             |
| `images`            | File[]             | Array of images to edit or combine with AI                              |
| `options`           | object             | Configuration options (see table below)                                 |
| `database`          | string \| Database | Database name or instance to use for storing images                     |
| `onComplete`        | function           | Callback when image load completes successfully                         |
| `onError`           | function           | Callback when image load fails, receives the error as parameter         |
| `onDelete`          | function           | Callback when an image is deleted, receives the document ID             |
| `onPromptEdit`      | function           | Callback when the prompt is edited, receives document ID and new prompt |
| `onDocumentCreated` | function           | Callback when a new document is created via drop or file picker         |
| `overlay`           | boolean            | Whether to show overlay controls and info button (default: `true`)      |
| `classes`           | object             | Custom CSS classes for styling component parts                          |
| `debug`             | boolean            | Enable debug logging                                                    |

### Options Object Properties

| Property  | Type    | Description                                                              |
| --------- | ------- | ------------------------------------------------------------------------ |
| `model`   | string  | Model to use for image generation, defaults to 'gpt-image-1'             |
| `size`    | string  | Size of the generated image (1024x1024, 1536x1024, 1024x1536, or 'auto') |
| `quality` | string  | Quality of the generated image (high, medium, low, or auto)              |
| `debug`   | boolean | Enable debug logging, defaults to false                                  |

## Advanced Features

### Prompt Management

The ImgGen component tracks the history of different prompts used to generate an image:

```jsx
<ImgGen
  prompt="Initial prompt"
  onPromptEdit={(id, newPrompt) => {
    console.log(`Document ${id} updated with new prompt: ${newPrompt}`);
  }}
/>
```

Users can edit prompts directly by double-clicking the prompt text in the overlay UI, then pressing Enter to submit and regenerate with the new prompt.

### Image Control & Manipulation

#### Image Regeneration

The component supports one-click regeneration, preserving document history while adding new versions:

```jsx
// The regeneration happens internally when the user clicks the refresh button
// or when a new prompt is submitted
```

#### Image Quality Control

Set quality levels for output images:

```jsx
<ImgGen prompt="Detailed artwork" options={{ quality: 'high' }} />
```

#### Image Editing with Uploads

Process existing images with AI:

```jsx
<ImgGen prompt="Turn this photo into a watercolor painting" images={[myImageFile]} />
```

#### Multiple Image Inputs

Combine multiple images in one generation:

```jsx
<ImgGen prompt="Create a collage of these photos" images={[photo1, photo2, photo3]} />
```

### Database Integration

All images are automatically stored in a Fireproof database with version history:

```jsx
// Custom database name
<ImgGen prompt="Forest landscape" database="MyCustomDB" />

// Or pass a database instance
<ImgGen prompt="Forest landscape" database={myDbInstance} />
```

### Event Callbacks

Track the complete generation process with lifecycle events:

```jsx
<ImgGen
  prompt="Track this generation"
  onComplete={() => console.log('Generation complete!')}
  onError={(error) => console.error('Generation failed:', error)}
  onDelete={(id) => console.log(`Document ${id} deleted`)}
  onDocumentCreated={(id) => console.log(`New document created: ${id}`)}
/>
```

### UI Controls

Toggle the information overlay and controls:

```jsx
// Disable overlay for a minimal UI
<ImgGen prompt="Clean interface" overlay={false} />
```

The overlay includes:

- Prompt text (editable)
- Version navigation controls
- Regenerate/refresh button
- Delete button

### File Management

#### Base64 Conversion

Convert between base64 and File objects:

```jsx
import { base64ToFile } from 'use-vibes';

// Convert API response to a File object
const imageFile = base64ToFile(imageResponse.data[0].b64_json, 'my-image.png');
```

## Styling and Customization

### CSS Variables

The component uses centralized theme constants from `imgGenTheme` for consistent styling. All styles are applied inline using JavaScript objects, eliminating the need for external CSS files.

### Custom Classes

For more granular control, provide a `classes` object with custom CSS classes for specific component parts:

```jsx
<ImgGen
  prompt="Styled component"
  classes={{
    root: 'my-custom-container',
    image: 'rounded-xl shadow-lg',
    overlay: 'bg-slate-800/70 text-white',
    progress: 'h-2 bg-green-500',
    button: 'hover:bg-blue-600',
  }}
/>
```

### Available Class Slots

| Class Property  | Description                      |
| --------------- | -------------------------------- |
| `root`          | Main container element           |
| `image`         | The image element                |
| `container`     | Container for image and controls |
| `overlay`       | Overlay panel with controls      |
| `progress`      | Progress indicator               |
| `placeholder`   | Placeholder shown during loading |
| `error`         | Error message container          |
| `controls`      | Control buttons container        |
| `button`        | Individual buttons               |
| `prompt`        | Prompt text/input container      |
| `deleteOverlay` | Delete confirmation dialog       |

## Gallery Implementation

### Creating an Image Gallery

Easily create image galleries using document IDs:

```jsx
<div className="image-grid">
  {imageDocuments.map((doc) => (
    <ImgGen key={doc._id} _id={doc._id} className="thumbnail" />
  ))}
</div>
```

### Loading Existing Documents

Load existing documents by ID:

```jsx
<ImgGen _id="existing-document-id" />
```

## Operation Modes

The ImgGen component has several operational modes that it switches between automatically:

1. **Placeholder Mode**: Initial state when no prompt or document ID is provided
2. **Upload Waiting Mode**: When files are uploaded but waiting for a prompt
3. **Generating Mode**: During the image generation process
4. **Display Mode**: When showing a generated image with controls
5. **Error Mode**: When an error occurs during generation

## Advanced Usage Examples

### Debug Mode

Enable debug mode to see detailed console logs about component state:

```jsx
<ImgGen prompt="Debug this" options={{ debug: true }} />
```

### Custom Image Sizing

Control output image dimensions with the size option:

```jsx
<ImgGen
  prompt="Landscape format"
  options={{ size: '1536x1024' }} // Landscape
/>

<ImgGen
  prompt="Portrait format"
  options={{ size: '1024x1536' }} // Portrait
/>
```

### Browser Compatibility

This library is compatible with all modern browsers that support React 18+ and ES6 features.

## License

MIT+Apache
