#!/usr/bin/env tsx

import { readFile, writeFile, unlink, stat } from "fs/promises";
import { readdir } from "fs/promises";
import { join, relative, dirname, basename } from "path";
import { gzipSync } from "zlib";
import * as esbuild from "esbuild";
import { run, command, option, flag, multioption, string, array } from "cmd-ts";

/**
 * Normalize base path to ensure it starts with / and doesn't end with /
 */
function normalizeBasePath(basePath: string): string {
  if (!basePath) return "";
  let normalized = basePath;
  if (!normalized.startsWith("/")) normalized = "/" + normalized;
  // Only remove trailing slash if path is longer than just "/"
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Recursively collect files from a directory
 */
async function collectFilesFromDirectory(
  dirPath: string,
  baseDir: string,
  files: Record<string, string>,
  extensions: string[],
  excludePatterns: RegExp[],
  basePath: string,
): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(baseDir, fullPath);
      const normalizedPath = join(basePath, relativePath).replace(/\\/g, "/");

      // Check if path matches any exclude pattern
      if (excludePatterns.some((pattern) => pattern.test(normalizedPath))) {
        console.error(`  ⊘ Excluded: ${normalizedPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        await collectFilesFromDirectory(
          fullPath,
          baseDir,
          files,
          extensions,
          excludePatterns,
          basePath,
        );
      } else {
        const ext = entry.name.split(".").pop()?.toLowerCase();
        if (ext && extensions.includes(ext)) {
          const content = await readFile(fullPath, "utf-8");
          files[normalizedPath] = content;
          console.error(`  ✓ ${normalizedPath}`);
        }
      }
    }
  } catch (error) {
    console.error(
      `Error reading directory ${dirPath}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Minify a single file using esbuild
 * Only processes JS/TS files, skips JSON/CSS
 */
async function minifyFile(content: string, filePath: string): Promise<string> {
  // Skip minification for JSON and CSS files
  if (filePath.endsWith(".json") || filePath.endsWith(".css")) {
    return content;
  }

  try {
    const loader = filePath.endsWith(".tsx")
      ? "tsx"
      : filePath.endsWith(".ts")
        ? "ts"
        : filePath.endsWith(".jsx")
          ? "jsx"
          : "js";

    const result = await esbuild.transform(content, {
      loader,
      minify: true,
      target: "es2020",
    });
    return result.code;
  } catch (error) {
    console.error(`  ⚠ Failed to minify ${filePath}, using original content`);
    return content;
  }
}

/**
 * Compress file content using gzip
 */
function compressFile(content: string): string {
  const buffer = Buffer.from(content, "utf-8");
  const compressed = gzipSync(buffer);
  return compressed.toString("base64");
}

/**
 * Compress all files
 */
function compressFiles(files: Record<string, string>): Record<string, string> {
  console.error(
    `\nCompressing ${Object.keys(files).length} files with gzip...`,
  );
  const compressed: Record<string, string> = {};
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (const [path, content] of Object.entries(files)) {
    const original = Buffer.byteLength(content, "utf-8");
    const compressedData = compressFile(content);
    const compressedSize = Buffer.byteLength(compressedData, "utf-8");

    compressed[path] = compressedData;
    totalOriginal += original;
    totalCompressed += compressedSize;
  }

  const ratio = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
  console.error(`  Original: ${(totalOriginal / 1024).toFixed(2)} KB`);
  console.error(`  Compressed: ${(totalCompressed / 1024).toFixed(2)} KB`);
  console.error(`  Reduction: ${ratio}%`);

  return compressed;
}

/**
 * Collect files from multiple paths (files or directories)
 */
async function collectFilesFromPaths(
  paths: string[],
  extensions: string[],
  shouldMinifyFiles: boolean,
  excludePatterns: RegExp[],
  shouldCompress: boolean,
  basePath: string,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  for (const path of paths) {
    try {
      const stats = await stat(path);

      if (stats.isDirectory()) {
        console.error(`Collecting from directory: ${path}`);
        await collectFilesFromDirectory(
          path,
          path,
          files,
          extensions,
          excludePatterns,
          basePath,
        );
      } else if (stats.isFile()) {
        const key = join(basePath, basename(path)).replace(/\\/g, "/");

        // Explicitly added files bypass exclude patterns
        const ext = basename(path).split(".").pop()?.toLowerCase();
        if (ext && extensions.includes(ext)) {
          const content = await readFile(path, "utf-8");
          files[key] = content;
          console.error(`  ✓ ${key} (explicit)`);
        } else {
          console.error(`  ⊘ Skipped ${path} (extension not in allowed list)`);
        }
      }
    } catch (error) {
      console.error(
        `Error processing path ${path}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Minify files if requested
  if (shouldMinifyFiles && Object.keys(files).length > 0) {
    console.error(`\nMinifying ${Object.keys(files).length} files...`);
    const minifiedFiles: Record<string, string> = {};
    for (const [path, content] of Object.entries(files)) {
      minifiedFiles[path] = await minifyFile(content, path);
    }
    return shouldCompress ? compressFiles(minifiedFiles) : minifiedFiles;
  }

  return shouldCompress ? compressFiles(files) : files;
}

/**
 * Bundle directory/files into a single readable JavaScript module
 */
export async function bundleFilesToReadable(
  paths: string[],
  outputFile: string,
  options: {
    extensions?: string[];
    minify?: boolean;
    exclude?: string[];
    compress?: boolean;
    basePath?: string;
  } = {},
): Promise<void> {
  const {
    extensions = ["js", "jsx", "ts", "tsx", "json", "css"],
    minify = false,
    exclude = [],
    compress = false,
    basePath = "/",
  } = options;

  const normalizedBasePath = normalizeBasePath(basePath);

  // Compile regex patterns
  const excludePatterns: RegExp[] = exclude.map(
    (pattern) => new RegExp(pattern),
  );

  if (excludePatterns.length > 0) {
    console.error(`\nExclude patterns:`);
    exclude.forEach((p) => console.error(`  - ${p}`));
  }

  console.error(`\nBase path: ${normalizedBasePath || "/"}`);
  console.error(`Collecting files with extensions: ${extensions.join(", ")}`);
  const files = await collectFilesFromPaths(
    paths,
    extensions,
    minify,
    excludePatterns,
    compress,
    normalizedBasePath,
  );

  const fileCount = Object.keys(files).length;
  if (fileCount === 0) {
    console.error("\n❌ No files found matching the criteria");
    process.exit(1);
  }

  console.error(`\nFound ${fileCount} files to bundle`);

  // Create the entry file content
  const entryContent = compress
    ? `
// Auto-generated filesystem bundle (gzip compressed)
// Created: ${new Date().toISOString()}
// Files: ${fileCount}

const files = ${JSON.stringify(files)};

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decompressGzip(uint8Array) {
  const stream = new Response(uint8Array).body
    .pipeThrough(new DecompressionStream('gzip'));

  const decompressed = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

export async function readFileGzip(path) {
  if (!path.startsWith('/')) path = '/' + path;
  if (!files[path]) {
    const available = Object.keys(files).join('\\n  - ');
    throw new Error(\`File not found: \${path}\\n\\nAvailable files:\\n  - \${available}\`);
  }
  return base64ToUint8Array(files[path]);
}

export async function readFile(path) {
  const compressed = await readFileGzip(path);
  return await decompressGzip(compressed);
}

export function listFiles() {
  return Object.keys(files);
}

export function hasFile(path) {
  if (!path.startsWith('/')) path = '/' + path;
  return path in files;
}

export function getFileCount() {
  return Object.keys(files).length;
}

export { files };

export default {
  readFile,
  readFileGzip,
  listFiles,
  hasFile,
  getFileCount,
  files,
};
`
    : `
// Auto-generated filesystem bundle
// Created: ${new Date().toISOString()}
// Files: ${fileCount}

const files = ${JSON.stringify(files)};

export async function readFile(path) {
  if (!path.startsWith('/')) path = '/' + path;
  if (!files[path]) {
    const available = Object.keys(files).join('\\n  - ');
    throw new Error(\`File not found: \${path}\\n\\nAvailable files:\\n  - \${available}\`);
  }
  return files[path];
}

export function listFiles() {
  return Object.keys(files);
}

export function hasFile(path) {
  if (!path.startsWith('/')) path = '/' + path;
  return path in files;
}

export function getFileCount() {
  return Object.keys(files).length;
}

export { files };

export default {
  readFile,
  listFiles,
  hasFile,
  getFileCount,
  files,
};
`;

  // Write the bundle file directly
  await writeFile(outputFile, entryContent);

  // Output bundle statistics
  const stats = await stat(outputFile);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.error(`\n✅ Bundle created successfully!`);
  console.error(`   Output: ${outputFile}`);
  console.error(`   Size: ${sizeKB} KB`);
  console.error(`   Files bundled: ${fileCount}`);
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = command({
    name: "bundle-fs",
    description:
      "Bundle directories and files into a single JavaScript module with readFile() API",
    args: {
      paths: multioption({
        type: array(string),
        long: "path",
        short: "p",
        description:
          "Path to directory or file to include (can be specified multiple times)",
      }),
      output: option({
        type: string,
        long: "output",
        short: "o",
        description: "Output file path",
      }),
      extensions: option({
        type: string,
        long: "ext",
        short: "e",
        description: "Comma-separated list of file extensions to include",
        defaultValue: () => "js,jsx,ts,tsx,json,css",
      }),
      exclude: multioption({
        type: array(string),
        long: "exclude",
        short: "x",
        description:
          "Regex patterns to exclude files/directories (can be specified multiple times)",
        defaultValue: () => [],
      }),
      minify: flag({
        long: "minify",
        short: "m",
        description: "Minify the output bundle",
        defaultValue: () => false,
      }),
      compress: flag({
        long: "compress",
        short: "c",
        description:
          "Compress files with gzip (uses DecompressionStream in browser)",
        defaultValue: () => false,
      }),
      basePath: option({
        type: string,
        long: "base-path",
        short: "b",
        description: "Base path prefix for all files (default: /)",
        defaultValue: () => "/",
      }),
    },
    handler: async ({
      paths,
      output,
      extensions,
      exclude,
      minify,
      compress,
      basePath,
    }) => {
      if (!paths || paths.length === 0) {
        console.error("❌ Error: At least one --path must be specified");
        console.error("\nUsage examples:");
        console.error(
          "  tsx scripts/bundle-fs.ts -p ./src/components -o bundle.js",
        );
        console.error(
          "  tsx scripts/bundle-fs.ts -p ./dist -o bundle.js --minify --compress",
        );
        console.error(
          "  tsx scripts/bundle-fs.ts -p ./dist -o bundle.js --base-path /my-app",
        );
        console.error(
          "  tsx scripts/bundle-fs.ts -p ./dist -o bundle.js --exclude '\\.ts$' --exclude '/tests/'",
        );
        console.error(
          "  tsx scripts/bundle-fs.ts -p ./file.js -p ./other.js -o bundle.js",
        );
        process.exit(1);
      }

      if (!output) {
        console.error("❌ Error: --output must be specified");
        process.exit(1);
      }

      const extList = extensions.split(",").map((e) => e.trim().toLowerCase());

      console.error("=".repeat(60));
      console.error("Bundle Filesystem Generator");
      console.error("=".repeat(60));

      await bundleFilesToReadable(paths, output, {
        extensions: extList,
        exclude,
        minify,
        compress,
        basePath,
      });

      console.error("\n" + "=".repeat(60));
      console.error("Done! Import and use:");
      console.error("=".repeat(60));

      if (compress) {
        console.error(`
  import bundle from './${output}';

  const files = bundle.listFiles();
  const content = await bundle.readFile('/MyComponent.js'); // Async, decompresses to string
  const compressed = await bundle.readFileGzip('/MyComponent.js'); // Async, returns Uint8Array
  console.log('Files:', files);
        `);
      } else {
        console.error(`
  import bundle from './${output}';

  const files = bundle.listFiles();
  const content = await bundle.readFile('/MyComponent.js'); // Always async
  console.log('Files:', files);
        `);
      }
    },
  });

  run(app, process.argv.slice(2));
}
