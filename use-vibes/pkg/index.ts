// Re-export clean public API from core package
export {
  // Primary component
  ImgGen,
  type ImgGenProps,

  // Fireproof integration
  useFireproof,
  fireproof,
  ImgFile,
  toCloud,

  // AI integration
  callAI,
  callAi,

  // Type namespaces
  type Fireproof,
  type CallAI,
} from '@vibes.diy/use-vibes-base';

export interface RuntimeError {
  type: string; // 'error' or 'unhandledrejection'
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  reason?: string;
  timestamp: string;
  errorType?: 'SyntaxError' | 'ReferenceError' | 'TypeError' | 'DatabaseError' | 'Other';
}
