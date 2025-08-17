// Central catalog for LLM/library modules used by prompts and Settings UI
// Loads ./llms/*.json (name, label, description, importModule, importName, llmsTxtUrl)

const modules = import.meta.glob('./*.json', { eager: true }) as Record<
  string,
  {
    default: {
      name: string;
      label: string;
      llmsTxtUrl?: string; // Optional - if not provided, loads from local repo
      module: string;
      description?: string;
      importModule: string;
      importName: string;
    };
  }
>;

export type LlmsCatalogEntry = (typeof modules)[string]['default'] & {
  importType?: 'named' | 'namespace' | 'default'; // Support for different import types
};

export const llmsCatalog: LlmsCatalogEntry[] = Object.values(modules).map((m) => m.default);

// Catalog dependency names (stable identifiers)
export const CATALOG_DEPENDENCY_NAMES = new Set(llmsCatalog.map((m) => m.name));

// Default deterministic selection when none is persisted
// We pick the core libraries commonly used across the app
export const DEFAULT_DEPENDENCIES: string[] = ['fireproof', 'callai'];
