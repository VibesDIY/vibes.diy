export interface TransformState {
  input: string;
  patterns: Record<string, unknown>;
  hasAppDeclared: boolean;
  beforeExport?: string;
  afterExport?: string;
}

export function transformObjectLiteral(state: TransformState): string {
  if (!state.patterns.objectLiteral) return state.input;
  return `${state.beforeExport}
const AppObject = ${state.patterns.objectLiteral};
const App = AppObject.default || AppObject;
export default App;${state.afterExport}`;
}

export function transformHOC(state: TransformState): string {
  if (!state.patterns.hoc) return state.input;
  return `${state.beforeExport}const App = ${state.patterns.hoc};
export default App;`;
}

export function transformFunctionDeclaration(state: TransformState): string {
  if (!state.patterns.functionDeclaration) return state.input;
  return state.input.replace(
    /export\s+default\s+function\s+\w+\s*(\([^)]*\))/g,
    "export default function App$1",
  );
}

export function transformClassDeclaration(state: TransformState): string {
  if (!state.patterns.classDeclaration) return state.input;
  return state.input.replace(
    /export\s+default\s+class\s+\w+/g,
    "export default class App",
  );
}

export function transformArrowFunction(state: TransformState): string {
  if (!state.patterns.arrowFunction) return state.input;
  const cleanedAfterExport = state.afterExport?.replace(/;\s*$/, "") || "";
  return `${state.beforeExport}const App = ${cleanedAfterExport};
export default App;`;
}
