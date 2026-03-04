import {
  generateImportStatements,
  getJsonDocs,
  JsonDocs,
  LlmCatalogEntry,
  makeBaseSystemPrompt,
  defaultStylePrompt,
} from "@vibes.diy/prompts";
import { describe, it, expect, beforeAll, vi } from "vitest";
import { Result } from "@adviser/cement";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";

// Use a known finite set for testing, excluding three-js to keep tests stable
const knownModuleNames = ["callai", "fireproof", "image-gen", "web-audio"];

const mockFetchImpl = createMockFetchFromPkgFiles();

const opts = {
  fetch: mockFetchImpl,
  callAi: {
    ModuleAndOptionsSelection: vi.fn().mockResolvedValue(
      Result.Ok(
        JSON.stringify({
          selected: knownModuleNames,
          instructionalText: true,
          demoData: true,
        })
      )
    ),
  },
};

// Will be assigned in beforeAll after JSON docs load
let llmsJsonModules: JsonDocs;
let orderedLlms: LlmCatalogEntry[];

beforeAll(async () => {
  // getJsonDocs uses globalThis.fetch internally — mock it for this setup
  const origFetch = globalThis.fetch;
  globalThis.fetch = mockFetchImpl;
  llmsJsonModules = await getJsonDocs();
  globalThis.fetch = origFetch;

  orderedLlms = Object.entries(llmsJsonModules)
    .filter(([path, _]) => knownModuleNames.some((name) => path.includes(`${name}.json`)))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([_, mod]) => mod.obj);
});

describe("prompt builder (real implementation)", () => {
  it("generateImportStatements: deterministic, one line per JSON, no duplicates", () => {
    expect(typeof generateImportStatements).toBe("function");

    const importBlock = generateImportStatements(orderedLlms);
    const lines = importBlock.trim().split("\n").filter(Boolean);

    // One import per JSON config
    expect(lines.length).toBe(orderedLlms.length);

    // Deterministic sort: by importModule ascending
    const modulesSorted = [...orderedLlms]
      .filter((l) => l.importModule && l.importName)
      .sort((a, b) => a.importModule.localeCompare(b.importModule));
    const expectedOrder = modulesSorted.map((l) => l.importModule);
    const actualOrder = lines.map((l) => {
      const m = l.match(/from "([^"]+)"$/);
      return m ? m[1] : "";
    });
    expect(actualOrder).toEqual(expectedOrder);

    // No duplicates even if we add a duplicate entry
    const withDup = [...orderedLlms, orderedLlms[0]];
    const importBlockWithDup = generateImportStatements(withDup);
    const linesWithDup = importBlockWithDup.trim().split("\n").filter(Boolean);
    expect(linesWithDup.length).toBe(orderedLlms.length);

    // Each line is an ES import line
    for (const line of lines) {
      expect(line.startsWith("import { ")).toBe(true);
      expect(line.includes(' } from "')).toBe(true);
    }
  });

  it("generateImportStatements: supports namespace imports for three-js", () => {
    // Create a mock three-js entry with namespace import type
    const threeJsEntry = {
      name: "three-js",
      label: "Three.js",
      module: "three-js",
      description: "Three.js 3D graphics library",
      importModule: "three",
      importName: "THREE",
      importType: "namespace" as const,
    };

    const importBlock = generateImportStatements([threeJsEntry]);
    const lines = importBlock.trim().split("\n").filter(Boolean);

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe('import * as THREE from "three"');
  });

  it("generateImportStatements: supports different import types", () => {
    const testEntries = [
      {
        name: "named-import",
        label: "Named",
        module: "named",
        description: "Named import library",
        importModule: "named-module",
        importName: "NamedExport",
        importType: "named" as const,
      },
      {
        name: "namespace-import",
        label: "Namespace",
        module: "namespace",
        description: "Namespace import library",
        importModule: "namespace-module",
        importName: "NS",
        importType: "namespace" as const,
      },
      {
        name: "default-import",
        label: "Default",
        module: "default",
        description: "Default import library",
        importModule: "default-module",
        importName: "DefaultExport",
        importType: "default" as const,
      },
    ];

    const importBlock = generateImportStatements(testEntries);
    const lines = importBlock.trim().split("\n").filter(Boolean);

    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('import DefaultExport from "default-module"');
    expect(lines[1]).toBe('import { NamedExport } from "named-module"');
    expect(lines[2]).toBe('import * as NS from "namespace-module"');
  });

  it("makeBaseSystemPrompt: in test mode, non-override path includes all catalog imports and docs; default stylePrompt", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      stylePrompt: undefined,
      userPrompt: undefined,
      ...opts,
    });

    // The mocked AI call should return our known finite set
    const chosenLlms = orderedLlms.filter((llm) => knownModuleNames.includes(llm.name));
    const importBlock = generateImportStatements(chosenLlms);

    expect(result.systemPrompt).toContain("```js");
    expect(result.systemPrompt).toContain('import React, { ... } from "react"' + importBlock);

    for (const llm of chosenLlms) {
      expect(result.systemPrompt).toContain(`<${llm.label}-docs>`);
      expect(result.systemPrompt).toContain(`</${llm.label}-docs>`);
    }

    // Default style prompt appears when undefined; assert against explicit export
    expect(result.systemPrompt).toContain(defaultStylePrompt);
  });

  it("makeBaseSystemPrompt: supports custom stylePrompt and userPrompt", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      ...opts,
      stylePrompt: "custom",
      userPrompt: "hello",
    });

    const chosenLlms = orderedLlms.filter((llm) => knownModuleNames.includes(llm.name)); // mocked AI call returns finite set
    const importBlock = generateImportStatements(chosenLlms);
    expect(result.systemPrompt).toContain('import React, { ... } from "react"' + importBlock);

    // Custom stylePrompt line replaces default
    expect(result.systemPrompt).toContain("Don't use words from the style prompt in your copy: custom");
    expect(result.systemPrompt).not.toContain("Memphis Alchemy");

    // User prompt appears verbatim
    expect(result.systemPrompt).toContain("hello");
  });

  it("makeBaseSystemPrompt: honors explicit dependencies only when override=true", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      ...opts,
      dependencies: ["fireproof"],
      dependenciesUserOverride: true,
    });
    expect(result.systemPrompt).toContain("<useFireproof-docs>");
    expect(result.systemPrompt).not.toContain("<callAI-docs>");
  });

  it("makeBaseSystemPrompt: includes demo-data guidance when selector enables it (test mode)", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      ...opts,
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
    });
    expect(result.systemPrompt).toMatch(/include a Demo Data button/i);
    expect(result.systemPrompt).not.toMatch(/vivid description of the app's purpose/i);
  });

  it("makeBaseSystemPrompt: respects demoDataOverride=false to disable demo data", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      ...opts,
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
      demoDataOverride: false,
    });
    expect(result.systemPrompt).not.toMatch(/include a Demo Data button/i);
    expect(result.systemPrompt).not.toMatch(/vivid description of the app's purpose/i);
  });

  it("makeBaseSystemPrompt: respects demoDataOverride=true to force demo data", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      ...opts,
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
      demoDataOverride: true,
    });
    expect(result.systemPrompt).toMatch(/include a Demo Data button/i);
    expect(result.systemPrompt).not.toMatch(/vivid description of the app's purpose/i);
  });
});
