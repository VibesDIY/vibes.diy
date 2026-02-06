#!/usr/bin/env node

/**
 * Script to generate CSS utility classes from Tailwind class usage in the codebase
 *
 * This scans for classes like:
 * - bg-light-background-00 / dark:bg-dark-background-00
 * - text-light-primary / dark:text-dark-primary
 * - border-light-decorative-01 / dark:border-dark-decorative-01
 *
 * And generates the corresponding CSS rules that can be added to GlobalStyles.tsx
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pattern to match Tailwind classes in className attributes
const CLASS_REGEX = /className=["']([^"']+)["']/g;
const CLASS_SPLIT_REGEX = /\s+/;

// Patterns for the classes we care about
const LIGHT_DARK_PATTERNS = {
  background: /^(?:dark:)?(bg-(?:light|dark)-(?:background|decorative)-\d{2})$/,
  text: /^(?:dark:)?(text-(?:light|dark)-(?:primary|secondary))$/,
  border: /^(?:dark:)?(border-(?:light|dark)-decorative-\d{2})$/,
  hover:
    /^(?:dark:)?(hover:bg-(?:light|dark)-(?:background|decorative)-\d{2})$/,
};

function extractClassesFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const classes = new Set();

  let match;
  while ((match = CLASS_REGEX.exec(content)) !== null) {
    const classString = match[1];
    const individualClasses = classString.split(CLASS_SPLIT_REGEX);

    for (const cls of individualClasses) {
      // Check if it matches any of our patterns
      for (const pattern of Object.values(LIGHT_DARK_PATTERNS)) {
        if (pattern.test(cls)) {
          classes.add(cls);
        }
      }
    }
  }

  return Array.from(classes);
}

function scanDirectory(dir, extensions = [".tsx", ".ts", ".jsx", ".js"]) {
  const allClasses = new Set();

  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);

    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules and other build directories
        if (!["node_modules", "dist", "build", ".next"].includes(file)) {
          walk(filePath);
        }
      } else if (extensions.some((ext) => file.endsWith(ext))) {
        const classes = extractClassesFromFile(filePath);
        classes.forEach((cls) => allClasses.add(cls));
      }
    }
  }

  walk(dir);
  return Array.from(allClasses).sort();
}

function parseClass(cls) {
  // Remove dark: and hover: prefixes
  const isDark = cls.startsWith("dark:");
  const isHover = cls.includes("hover:");
  const baseClass = cls.replace(/^dark:/, "").replace(/^hover:/, "");

  // Parse the base class
  const parts = baseClass.split("-");
  const property = parts[0]; // bg, text, border
  const mode = parts[1]; // light or dark
  const category = parts[2]; // background, decorative, primary, secondary
  const number = parts[3]; // 00, 01, 02 (if exists)

  const varName = number
    ? `--color-${mode}-${category}-${number}`
    : `--color-${mode}-${category}`;

  return {
    original: cls,
    baseClass,
    property,
    mode,
    category,
    number,
    varName,
    isDark,
    isHover,
  };
}

function generateCSS(classes) {
  const cssMap = {
    light: [],
    dark: [],
    hover: [],
  };

  for (const cls of classes) {
    const parsed = parseClass(cls);

    let cssProperty;
    switch (parsed.property) {
      case "bg":
        cssProperty = "background-color";
        break;
      case "text":
        cssProperty = "color";
        break;
      case "border":
        cssProperty = "border-color";
        break;
      default:
        continue;
    }

    const cssValue = `var(${parsed.varName})`;

    if (parsed.isHover) {
      // Hover variants need special handling
      if (parsed.isDark || parsed.mode === "dark") {
        const selector = `.dark\\\\:${parsed.baseClass.replace(":", "\\\\:")}:is(.dark *):hover`;
        const mediaSelector = `.dark\\\\:${parsed.baseClass.replace(":", "\\\\:")}:hover`;
        cssMap.hover.push({
          selector: selector,
          mediaSelector: mediaSelector,
          property: cssProperty,
          value: cssValue,
          mode: "dark",
        });
      } else {
        cssMap.hover.push({
          selector: `.${parsed.baseClass.replace(":", "\\\\:")}:hover`,
          property: cssProperty,
          value: cssValue,
          mode: "light",
        });
      }
    } else if (parsed.isDark || parsed.mode === "dark") {
      // Dark mode classes
      const escapedClass = parsed.baseClass.replace(":", "\\\\:");
      const selector = `.dark\\\\:${escapedClass}:is(.dark *)`;
      const mediaSelector = `.dark\\\\:${escapedClass}`;
      cssMap.dark.push({
        original: parsed.original,
        selector: selector,
        mediaSelector: mediaSelector,
        property: cssProperty,
        value: cssValue,
      });
    } else {
      // Light mode classes
      cssMap.light.push({
        original: parsed.original,
        selector: `.${parsed.baseClass}`,
        property: cssProperty,
        value: cssValue,
      });
    }
  }

  return cssMap;
}

function formatCSS(cssMap) {
  let output = "";

  // Light mode classes
  if (cssMap.light.length > 0) {
    output += "/* Tailwind utility classes for light/dark backgrounds */\n";
    for (const rule of cssMap.light) {
      output += `${rule.selector} {\n`;
      output += `  ${rule.property}: ${rule.value};\n`;
      output += `}\n\n`;
    }
  }

  // Dark mode classes
  if (cssMap.dark.length > 0) {
    output += "/* Dark mode variants */\n";
    for (const rule of cssMap.dark) {
      output += `${rule.selector},\n`;
      output += `@media (prefers-color-scheme: dark) {\n`;
      output += `  ${rule.mediaSelector} {\n`;
      output += `    ${rule.property}: ${rule.value};\n`;
      output += `  }\n`;
      output += `}\n\n`;
    }
  }

  // Hover variants
  if (cssMap.hover.length > 0) {
    output += "/* Hover variants */\n";
    const lightHovers = cssMap.hover.filter((r) => r.mode === "light");
    const darkHovers = cssMap.hover.filter((r) => r.mode === "dark");

    for (const rule of lightHovers) {
      output += `${rule.selector} {\n`;
      output += `  ${rule.property}: ${rule.value};\n`;
      output += `}\n\n`;
    }

    for (const rule of darkHovers) {
      output += `${rule.selector},\n`;
      output += `@media (prefers-color-scheme: dark) {\n`;
      output += `  ${rule.mediaSelector} {\n`;
      output += `    ${rule.property}: ${rule.value};\n`;
      output += `  }\n`;
      output += `}\n\n`;
    }
  }

  return output;
}

function main() {
  const appDir = path.join(__dirname, "../app");

  console.log("Scanning for Tailwind utility classes...");
  const classes = scanDirectory(appDir);

  console.log(`Found ${classes.length} unique classes:`);
  classes.forEach((cls) => console.log(`  - ${cls}`));

  console.log("\nGenerating CSS...\n");
  const cssMap = generateCSS(classes);
  const css = formatCSS(cssMap);

  console.log("=".repeat(80));
  console.log(
    "Generated CSS (copy this into index.tsx GlobalStyles function):",
  );
  console.log("=".repeat(80));
  console.log(css);
  console.log("=".repeat(80));

  // Optionally write to a file
  const outputFile = path.join(
    __dirname,
    "../generated-tailwind-utilities.css",
  );
  fs.writeFileSync(outputFile, css);
  console.log(`\nCSS also written to: ${outputFile}`);
}

main();
