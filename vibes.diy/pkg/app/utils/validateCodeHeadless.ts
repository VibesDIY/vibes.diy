import type { Monaco } from "@monaco-editor/react";
import type * as monacoType from "monaco-editor";

export interface ValidationError {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  severity: number;
}

/**
 * Validates code using Monaco's TypeScript language services in headless mode
 * (creates a temporary model without UI rendering).
 *
 * @param code - The code string to validate
 * @param monaco - Monaco API instance from @monaco-editor/react
 * @returns Array of validation errors with line/column information
 */
export async function validateCodeHeadless(
  code: string,
  monaco: Monaco,
): Promise<ValidationError[]> {
  console.log("🔍 [validateCodeHeadless] Starting validation...");
  console.log("🔍 [validateCodeHeadless] Code length:", code.length);
  console.log("🔍 [validateCodeHeadless] Code preview:", code.substring(0, 200) + "...");
  console.log("🔍 [validateCodeHeadless] Monaco API available:", !!monaco);
  console.log("🔍 [validateCodeHeadless] Monaco.editor available:", !!monaco.editor);

  // Create a temporary in-memory model (no UI rendering)
  // Use Uri.parse() instead of Uri.file() to create proper inmemory:// URI
  // Use "typescript" language for JSX validation (Monaco maps this to typescriptreact)
  const model = monaco.editor.createModel(
    code,
    "typescript",
    monaco.Uri.parse("inmemory://validate.tsx"),
  );

  console.log("🔍 [validateCodeHeadless] Model created:", {
    uri: model.uri.toString(),
    lineCount: model.getLineCount(),
    language: model.getLanguageId(),
  });

  // Wait for TypeScript worker to process the code
  // TypeScript language service needs time to analyze the code
  console.log("🔍 [validateCodeHeadless] Waiting 100ms for TypeScript worker...");
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Get all diagnostic markers (errors, warnings, etc.)
  const markers = monaco.editor.getModelMarkers({
    resource: model.uri,
  });

  console.log("🔍 [validateCodeHeadless] Total markers found:", markers.length);
  console.log("🔍 [validateCodeHeadless] All markers:", markers.map(m => ({
    severity: m.severity,
    severityName: m.severity === 8 ? "Error" : m.severity === 4 ? "Warning" : m.severity === 2 ? "Info" : "Hint",
    line: m.startLineNumber,
    message: m.message,
  })));

  // Filter for errors only (severity 8 = Error)
  const errorMarkers = markers.filter(
    (m) => m.severity === monaco.MarkerSeverity.Error,
  );

  console.log("🔍 [validateCodeHeadless] Error markers (severity 8):", errorMarkers.length);
  console.log("🔍 [validateCodeHeadless] MarkerSeverity.Error value:", monaco.MarkerSeverity.Error);

  // Convert Monaco markers to simplified error format
  const errors: ValidationError[] = errorMarkers.map((marker) => ({
    line: marker.startLineNumber,
    column: marker.startColumn,
    endLine: marker.endLineNumber,
    endColumn: marker.endColumn,
    message: marker.message,
    severity: marker.severity,
  }));

  console.log("🔍 [validateCodeHeadless] Final error count:", errors.length);
  if (errors.length > 0) {
    console.log("🔍 [validateCodeHeadless] Errors:", errors);
  }

  // Clean up the temporary model
  model.dispose();
  console.log("🔍 [validateCodeHeadless] Model disposed");

  return errors;
}

/**
 * Formats validation errors into a human-readable string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return "";

  const errorList = errors
    .map((err) => `Line ${err.line}, Column ${err.column}: ${err.message}`)
    .join("\n");

  return `Found ${errors.length} syntax error${errors.length > 1 ? "s" : ""}:\n\n${errorList}`;
}
