import { describe, it, expect, beforeAll, vi } from 'vitest';

// Use a known finite set for testing, excluding three-js to keep tests stable
const knownModuleNames = ['callai', 'fireproof', 'image-gen', 'web-audio'];

// Ensure we use the real implementation of ../app/prompts in this file only
// Some tests and the global setup mock this module; undo that here before importing it.
(vi as any).doUnmock?.('../app/prompts');
vi.unmock('../app/prompts');
// Reset the module registry and mock env before importing the module under test.
vi.resetModules();
vi.mock('../app/config/env', () => ({
  CALLAI_ENDPOINT: 'http://localhost/test',
  APP_MODE: 'test',
}));

// Mock the callAI function to return our known finite set for testing
vi.mock('call-ai', () => ({
  callAI: vi.fn().mockResolvedValue(
    JSON.stringify({
      selected: knownModuleNames,
      instructionalText: true,
      demoData: true,
    })
  ),
}));

// Will be assigned in beforeAll after we unmock and re-import the module
let generateImportStatements: (llms: Array<any>) => string;
let makeBaseSystemPrompt: (model: string, sessionDoc?: any) => Promise<string>;
let preloadLlmsText: () => Promise<void>;
// no-op vars (past defaults not needed with schema-based selection)

// Load actual LLM configs and txt content from app/llms
// Use eager glob so it's resolved at import time in Vitest/Vite environment
const llmsJsonModules = import.meta.glob('../app/llms/*.json', { eager: true }) as Record<
  string,
  { default: any }
>;

// Filter to only include our known set, deterministic order by name
const orderedLlms = Object.entries(llmsJsonModules)
  .filter(([path, _]) => knownModuleNames.some((name) => path.includes(`${name}.json`)))
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([_, mod]) => mod.default);

// Load the raw text files; key by filepath, value is file contents
const llmsTxtModules = import.meta.glob('../app/llms/*.txt', {
  eager: true,
  as: 'raw',
}) as Record<string, string>;

function textForName(name: string): string {
  const entry = Object.entries(llmsTxtModules).find(([p]) => p.endsWith(`${name}.txt`));
  return entry ? (entry[1] as unknown as string) : '';
}

beforeAll(async () => {
  const mod = await import('../app/prompts');
  // Pull exported functions from the mocked module
  generateImportStatements = (mod as any).generateImportStatements;
  makeBaseSystemPrompt = mod.makeBaseSystemPrompt;
  preloadLlmsText = mod.preloadLlmsText;
  // ensure catalog loads for glob ordering
  await import('../app/llms/catalog');
});

describe('prompt builder (real implementation)', () => {
  it('generateImportStatements: deterministic, one line per JSON, no duplicates', () => {
    expect(typeof generateImportStatements).toBe('function');

    const importBlock = generateImportStatements(orderedLlms);
    const lines = importBlock.trim().split('\n').filter(Boolean);

    // One import per JSON config
    expect(lines.length).toBe(orderedLlms.length);

    // Deterministic sort: by importModule ascending
    const modulesSorted = [...orderedLlms]
      .filter((l) => l.importModule && l.importName)
      .sort((a, b) => a.importModule.localeCompare(b.importModule));
    const expectedOrder = modulesSorted.map((l) => l.importModule);
    const actualOrder = lines.map((l) => {
      const m = l.match(/from \"([^\"]+)\"$/);
      return m ? m[1] : '';
    });
    expect(actualOrder).toEqual(expectedOrder);

    // No duplicates even if we add a duplicate entry
    const withDup = [...orderedLlms, orderedLlms[0]];
    const importBlockWithDup = generateImportStatements(withDup);
    const linesWithDup = importBlockWithDup.trim().split('\n').filter(Boolean);
    expect(linesWithDup.length).toBe(orderedLlms.length);

    // Each line is an ES import line
    for (const line of lines) {
      expect(line.startsWith('import { ')).toBe(true);
      expect(line.includes(' } from "')).toBe(true);
    }
  });

  it('generateImportStatements: supports namespace imports for three-js', () => {
    // Create a mock three-js entry with namespace import type
    const threeJsEntry = {
      name: 'three-js',
      label: 'Three.js',
      module: 'three-js',
      importModule: 'three',
      importName: 'THREE',
      importType: 'namespace' as const,
    };

    const importBlock = generateImportStatements([threeJsEntry]);
    const lines = importBlock.trim().split('\n').filter(Boolean);

    expect(lines.length).toBe(1);
    expect(lines[0]).toBe('import * as THREE from "three"');
  });

  it('generateImportStatements: supports different import types', () => {
    const testEntries = [
      {
        name: 'named-import',
        label: 'Named',
        module: 'named',
        importModule: 'named-module',
        importName: 'NamedExport',
        importType: 'named' as const,
      },
      {
        name: 'namespace-import',
        label: 'Namespace',
        module: 'namespace',
        importModule: 'namespace-module',
        importName: 'NS',
        importType: 'namespace' as const,
      },
      {
        name: 'default-import',
        label: 'Default',
        module: 'default',
        importModule: 'default-module',
        importName: 'DefaultExport',
        importType: 'default' as const,
      },
    ];

    const importBlock = generateImportStatements(testEntries);
    const lines = importBlock.trim().split('\n').filter(Boolean);

    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('import DefaultExport from "default-module"');
    expect(lines[1]).toBe('import { NamedExport } from "named-module"');
    expect(lines[2]).toBe('import * as NS from "namespace-module"');
  });

  it('makeBaseSystemPrompt: in test mode, non-override path includes all catalog imports and docs; default stylePrompt', async () => {
    // Warm cache so docs are available via raw imports
    await preloadLlmsText();

    const prompt = await makeBaseSystemPrompt('test-model', {
      stylePrompt: undefined,
      userPrompt: undefined,
    });

    // The mocked AI call should return our known finite set
    const chosenLlms = orderedLlms.filter((llm) => knownModuleNames.includes(llm.name));
    const importBlock = generateImportStatements(chosenLlms);

    expect(prompt).toContain('```js');
    expect(prompt).toContain('import React, { ... } from "react"' + importBlock);

    // Concatenated docs for chosen LLMs in the same order
    const expectedDocs = chosenLlms
      .map((llm) => `\n<${llm.label}-docs>\n${textForName(llm.name) || ''}\n</${llm.label}-docs>\n`)
      .join('');
    expect(prompt).toContain(expectedDocs);

    // Default style prompt appears when undefined
    // Use a distinctive phrase from the default
    expect(prompt).toContain('Memphis Alchemy');
  });

  it('makeBaseSystemPrompt: supports custom stylePrompt and userPrompt', async () => {
    await preloadLlmsText();

    const prompt = await makeBaseSystemPrompt('test-model', {
      stylePrompt: 'custom',
      userPrompt: 'hello',
    });

    const chosenLlms = orderedLlms.filter((llm) => knownModuleNames.includes(llm.name)); // mocked AI call returns finite set
    const importBlock = generateImportStatements(chosenLlms);
    expect(prompt).toContain('import React, { ... } from "react"' + importBlock);

    // Custom stylePrompt line replaces default
    expect(prompt).toContain("Don't use words from the style prompt in your copy: custom");
    expect(prompt).not.toContain('Memphis Alchemy');

    // User prompt appears verbatim
    expect(prompt).toContain('hello');
  });

  it('makeBaseSystemPrompt: honors explicit dependencies only when override=true', async () => {
    await preloadLlmsText();
    const prompt = await makeBaseSystemPrompt('test-model', {
      dependencies: ['fireproof'],
      dependenciesUserOverride: true,
    });
    expect(prompt).toContain('<useFireproof-docs>');
    expect(prompt).not.toContain('<callAI-docs>');
  });

  it('makeBaseSystemPrompt: includes instructional-text and demo-data guidance when selector enables them (test mode)', async () => {
    await preloadLlmsText();
    const prompt = await makeBaseSystemPrompt('test-model', {
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
    });
    expect(prompt).toMatch(/include a Demo Data button/i);
    expect(prompt).toMatch(/include a vivid description of the app's purpose/i);
  });

  it('makeBaseSystemPrompt: respects instructionalTextOverride=false to disable instructional text', async () => {
    await preloadLlmsText();
    const prompt = await makeBaseSystemPrompt('test-model', {
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
      instructionalTextOverride: false,
    });
    expect(prompt).not.toMatch(/include a vivid description of the app's purpose/i);
    // Demo data should still appear (not overridden)
    expect(prompt).toMatch(/include a Demo Data button/i);
  });

  it('makeBaseSystemPrompt: respects instructionalTextOverride=true to force instructional text', async () => {
    await preloadLlmsText();
    const prompt = await makeBaseSystemPrompt('test-model', {
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
      instructionalTextOverride: true,
    });
    expect(prompt).toMatch(/include a vivid description of the app's purpose/i);
    expect(prompt).toMatch(/include a Demo Data button/i);
  });

  it('makeBaseSystemPrompt: respects demoDataOverride=false to disable demo data', async () => {
    await preloadLlmsText();
    const prompt = await makeBaseSystemPrompt('test-model', {
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
      demoDataOverride: false,
    });
    expect(prompt).not.toMatch(/include a Demo Data button/i);
    // Instructional text should still appear (not overridden)
    expect(prompt).toMatch(/include a vivid description of the app's purpose/i);
  });

  it('makeBaseSystemPrompt: respects demoDataOverride=true to force demo data', async () => {
    await preloadLlmsText();
    const prompt = await makeBaseSystemPrompt('test-model', {
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
      demoDataOverride: true,
    });
    expect(prompt).toMatch(/include a Demo Data button/i);
    expect(prompt).toMatch(/include a vivid description of the app's purpose/i);
  });

  it('makeBaseSystemPrompt: respects both overrides simultaneously', async () => {
    await preloadLlmsText();
    const prompt = await makeBaseSystemPrompt('test-model', {
      stylePrompt: undefined,
      userPrompt: undefined,
      history: [],
      instructionalTextOverride: false,
      demoDataOverride: false,
    });
    expect(prompt).not.toMatch(/include a vivid description of the app's purpose/i);
    expect(prompt).not.toMatch(/include a Demo Data button/i);
  });
});
