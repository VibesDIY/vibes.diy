# bundle-fs - Filesystem Bundler

Bundle directories and files into a single JavaScript module with a `readFile()` API.

## Usage

### Basic Usage

Bundle a single directory:

```bash
pnpm bundle-fs -p ./src/components -o dist/components-bundle.js
```

### Multiple Paths

Bundle multiple directories and files:

```bash
pnpm bundle-fs \
  -p ./src/components \
  -p ./src/utils \
  -p ./config.js \
  -o dist/bundle.js
```

### With Options

```bash
pnpm bundle-fs \
  -p ./src/components \
  -o dist/bundle.min.js \
  --minify \
  --sourcemap \
  --format esm \
  --platform browser
```

## CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--path` | `-p` | Path to directory or file (can be used multiple times) | *required* |
| `--output` | `-o` | Output file path | *required* |
| `--ext` | `-e` | Comma-separated file extensions to include | `js,jsx,ts,tsx` |
| `--minify` | `-m` | Minify the output bundle | `false` |
| `--format` | `-f` | Output format: `esm`, `cjs`, or `iife` | `esm` |
| `--platform` | | Target platform: `browser`, `node`, or `neutral` | `neutral` |
| `--sourcemap` | `-s` | Generate sourcemap | `false` |

## Examples

### Example 1: Bundle React Components

```bash
pnpm bundle-fs \
  -p ./src/components \
  -o dist/components.js \
  --ext jsx,tsx
```

### Example 2: Bundle Specific Files

```bash
pnpm bundle-fs \
  -p ./utils/helpers.js \
  -p ./utils/constants.js \
  -p ./config/settings.js \
  -o dist/utils-bundle.js
```

### Example 3: Production Build

```bash
pnpm bundle-fs \
  -p ./src \
  -o dist/app-bundle.min.js \
  --minify \
  --sourcemap \
  --platform browser \
  --format esm
```

## Using the Bundle

After generating the bundle, import and use it:

```javascript
// ESM import
import bundle from './dist/bundle.js';

// List all files in the bundle
const files = bundle.listFiles();
console.log('Available files:', files);
// Output: ['./Component.jsx', './utils/helper.js', ...]

// Read a file's content
const content = bundle.readFile('/Component.jsx');
console.log(content);

// Check if a file exists
if (bundle.hasFile('/Component.jsx')) {
  console.log('Component exists!');
}

// Get file count
console.log('Total files:', bundle.getFileCount());

// Access the raw files object
console.log(bundle.files);
```

### Alternative Import Styles

```javascript
// Named imports
import { readFile, listFiles, hasFile } from './dist/bundle.js';

const code = readFile('/MyComponent.jsx');
const allFiles = listFiles();

// CommonJS (if bundled with --format cjs)
const bundle = require('./dist/bundle.js');
const content = bundle.readFile('/file.js');
```

## API Reference

### `readFile(path: string): string`

Read the content of a file from the bundle.

- **Parameters:**
  - `path` - File path (with or without leading `/`)
- **Returns:** File content as string
- **Throws:** Error if file not found (includes list of available files)

### `listFiles(): string[]`

Get an array of all file paths in the bundle.

- **Returns:** Array of file paths

### `hasFile(path: string): boolean`

Check if a file exists in the bundle.

- **Parameters:**
  - `path` - File path (with or without leading `/`)
- **Returns:** `true` if file exists, `false` otherwise

### `getFileCount(): number`

Get the total number of files in the bundle.

- **Returns:** Number of files

### `files: Record<string, string>`

Direct access to the files object.

- **Type:** `{ [path: string]: string }`

## Use Cases

1. **Component Libraries**: Bundle all components into a single distributable file
2. **Template Systems**: Package templates for runtime rendering
3. **Documentation**: Bundle code examples and snippets
4. **Testing**: Create fixture bundles for tests
5. **Web Workers**: Bundle code for web worker initialization
6. **Plugin Systems**: Create plugin bundles with virtual filesystem

## Direct Script Usage

You can also run the script directly:

```bash
./scripts/bundle-fs.ts \
  -p ./src/components \
  -o dist/bundle.js

# Or with tsx
tsx scripts/bundle-fs.ts \
  -p ./src/components \
  -o dist/bundle.js
```

## Notes

- File paths in the bundle are normalized to start with `/`
- When bundling individual files, only the basename is used as the key
- Directories are traversed recursively
- Files with extensions not in the allowed list are skipped
- The bundle includes error messages with available files for debugging
