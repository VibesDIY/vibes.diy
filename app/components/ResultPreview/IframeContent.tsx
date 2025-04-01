import React, { useEffect, useRef } from 'react';
import type { IframeFiles } from './ResultPreviewTypes';
import { CALLAI_API_KEY } from '~/config/env';
import Editor from '@monaco-editor/react';
import { shikiToMonaco } from '@shikijs/monaco';
import { createHighlighter } from 'shiki';
import { DatabaseListView } from './DataView';

// Import the iframe template using Vite's ?raw import option
import iframeTemplateRaw from './templates/iframe-template.html?raw';

interface IframeContentProps {
  activeView: 'preview' | 'code' | 'data';
  filesContent: IframeFiles;
  isStreaming: boolean;
  codeReady: boolean;
  sandpackKey: string;
  setActiveView: (view: 'preview' | 'code' | 'data') => void;
  setBundlingComplete: (complete: boolean) => void;
  dependencies: Record<string, string>;
  isDarkMode: boolean; // Add isDarkMode prop
}

const IframeContent: React.FC<IframeContentProps> = ({
  activeView,
  filesContent,
  isStreaming,
  sandpackKey,
  codeReady,
  dependencies,
  setActiveView,
  setBundlingComplete,
  isDarkMode, // Receive the isDarkMode prop
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Theme state is now received from parent via props
  const contentLoadedRef = useRef(false);
  const lastContentRef = useRef('');

  // Reference to store the current Monaco editor instance
  const monacoEditorRef = useRef<any>(null);
  // Reference to store the current Shiki highlighter
  const highlighterRef = useRef<any>(null);
  // Reference to store disposables for cleanup
  const disposablesRef = useRef<{ dispose: () => void }[]>([]);
  // Flag to track if user has manually scrolled during streaming
  const userScrolledRef = useRef<boolean>(false);
  // Store the last scroll top position to detect user-initiated scrolls
  const lastScrollTopRef = useRef<number>(0);
  // Store the last viewport height (keeping for future use)
  // const lastViewportHeightRef = useRef<number>(0);

  // Theme detection is now handled in the parent component

  // Cleanup for disposables
  useEffect(() => {
    return () => {
      // Clean up all disposables when component unmounts
      disposablesRef.current.forEach((disposable) => disposable.dispose());
      disposablesRef.current = [];
    };
  }, []);

  // Update theme when dark mode changes
  useEffect(() => {
    if (monacoEditorRef.current) {
      // Update the Shiki theme in Monaco when dark mode changes from parent
      const currentTheme = isDarkMode ? 'github-dark' : 'github-light';
      monacoEditorRef.current.setTheme(currentTheme);
    }
  }, [isDarkMode]);

  // Reset manual scroll flag when streaming state changes
  useEffect(() => {
    if (isStreaming) {
      // Reset the flag when streaming starts
      userScrolledRef.current = false;
    }
  }, [isStreaming]);

  // This effect is now managed at the ResultPreview component level

  useEffect(() => {
    // Only load iframe content when necessary - if code is ready and content changed
    if (!isStreaming && codeReady && iframeRef.current) {
      const appCode = filesContent['/App.jsx']?.code || '';

      // Check if content has changed
      if (contentLoadedRef.current && lastContentRef.current === appCode) {
        return; // Skip if content already loaded and hasn't changed
      }

      // Update references
      contentLoadedRef.current = true;
      lastContentRef.current = appCode;

      // Replace any default export with a consistent App name
      const normalizedCode = appCode.replace(
        /export\s+default\s+function\s+(\w+)/,
        'export default function App'
      );

      // Transform bare import statements to use esm.sh URLs
      const transformImports = (code: string): string => {
        // This regex matches import statements with bare module specifiers
        // It specifically looks for import statements that don't start with /, ./, or ../
        return code.replace(
          /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"\/][^'"]*)['"];?/g,
          (match, importPath) => {
            // Skip transforming imports that are already handled in the importmap
            // Only skip the core libraries we have in our importmap
            if (
              ['react', 'react-dom', 'react-dom/client', 'use-fireproof', 'call-ai'].includes(
                importPath
              )
            ) {
              return match;
            }
            // Transform the import to use basic esm.sh URL
            return match.replace(`"${importPath}"`, `"https://esm.sh/${importPath}"`);
          }
        );
      };

      const transformedCode = transformImports(normalizedCode);

      // Use the template and replace placeholders
      const htmlContent = iframeTemplateRaw
        .replace('{{API_KEY}}', CALLAI_API_KEY)
        .replace('{{APP_CODE}}', transformedCode);

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;

      // Setup message listener for preview ready signal
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'preview-ready') {
          setBundlingComplete(true);
        }
      };

      window.addEventListener('message', handleMessage);

      return () => {
        URL.revokeObjectURL(url);
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [isStreaming, codeReady, filesContent, setBundlingComplete]);

  return (
    <div data-testid="sandpack-provider" className="h-full">
      <div
        style={{
          visibility: activeView === 'preview' ? 'visible' : 'hidden',
          position: activeView === 'preview' ? 'static' : 'absolute',
          zIndex: activeView === 'preview' ? 1 : 0,
          height: '100%',
          width: '100%',
          top: 0,
          left: 0,
        }}
      >
        {!isStreaming && (
          <iframe
            ref={iframeRef}
            className="h-full w-full border-0"
            title="Preview"
            allow="cross-origin-isolated"
          />
        )}
      </div>
      <div
        style={{
          visibility: activeView === 'code' ? 'visible' : 'hidden',
          position: activeView === 'code' ? 'static' : 'absolute',
          zIndex: activeView === 'code' ? 1 : 0,
          height: '100%',
          width: '100%',
          top: 0,
          left: 0,
        }}
      >
        <Editor
          height="100%"
          width="100%"
          path="file.jsx"
          defaultLanguage="jsx"
          theme={isDarkMode ? 'github-dark' : 'github-light'}
          value={filesContent['/App.jsx']?.code || ''}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            padding: { top: 16 },
          }}
          onMount={(editor, monaco) => {
            // Store the editor instance for later reference
            monacoEditorRef.current = editor;

            // Set up Shiki highlighter for better syntax highlighting
            createHighlighter({
              themes: [isDarkMode ? 'github-dark' : 'github-light'],
              langs: ['javascript', 'typescript', 'jsx', 'tsx'],
            }).then(async (highlighter) => {
              highlighterRef.current = highlighter;

              try {
                // Apply Shiki syntax highlighting to Monaco
                await shikiToMonaco(highlighter, monaco);
                
                // Add a simple disposable for cleanup
                disposablesRef.current.push({
                  dispose: () => {
                    // Basic cleanup function for the highlighter
                    if (highlighterRef.current) {
                      // Nothing specific needed to dispose highlighter
                      highlighterRef.current = null;
                    }
                  }
                });
              } catch (err) {
                console.error('Error applying Shiki to Monaco:', err);
              }

              // Apply the theme immediately after setup
              monaco.editor.setTheme(isDarkMode ? 'github-dark' : 'github-light');
            });

            // Handle scroll events to detect manual user scrolling
            editor.onDidScrollChange((e) => {
              const scrollTop = e.scrollTop;
              // If there's a significant difference, consider it a manual scroll
              if (Math.abs(scrollTop - lastScrollTopRef.current) > 30) {
                userScrolledRef.current = true;
              }
              lastScrollTopRef.current = scrollTop;
            });
          }}
          onChange={(value) => {
            // Nothing to do here as we've set readOnly to true
          }}
        />
      </div>
      <div
        style={{
          visibility: activeView === 'data' ? 'visible' : 'hidden',
          position: activeView === 'data' ? 'static' : 'absolute',
          zIndex: activeView === 'data' ? 1 : 0,
          height: '100%',
          width: '100%',
          top: 0,
          left: 0,
          padding: '16px',
          overflow: 'auto',
          backgroundColor: isDarkMode ? '#0d1117' : '#ffffff'
        }}
      >
        {!isStreaming && (
          <div className="data-container">
            <h3 className="text-xl font-medium mb-4">Database Information</h3>
            <DatabaseListView appCode={filesContent['/App.jsx']?.code || ''} isDarkMode={isDarkMode} />
          </div>
        )}
      </div>
    </div>
  );
};

export default IframeContent;
