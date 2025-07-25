export const mockResultPreviewProps = {
  displayView: 'code' as const, // Changed from activeView
  // setActiveView: () => {}, // Removed
  onPreviewLoaded: () => {},
  setMobilePreviewShown: () => {},
};

export const mockChatStateProps = {
  codeReady: false,
  addScreenshot: () => Promise.resolve(),
  setSelectedResponseId: () => {},
  setNeedsNewKey: () => {},
  // Error tracking properties
  immediateErrors: [],
  advisoryErrors: [],
  addError: () => Promise.resolve(),
};

export const mockSessionSidebarProps = {
  sessionId: 'test-session-id',
  isVisible: true,
  onClose: () => {},
};

export const createMockChatState = (overrides = {}) => ({
  docs: [],
  input: '',
  setInput: () => {},
  inputRef: { current: null },
  sendMessage: () => Promise.resolve(),
  isStreaming: false,
  title: 'Test Session',
  sessionId: 'test-session-id',
  selectedSegments: [],
  selectedCode: {
    type: 'code',
    content: 'console.log("Hello world")',
  },
  selectedResponseDoc: undefined,
  codeReady: false,
  addScreenshot: () => Promise.resolve(),
  setSelectedResponseId: () => {},
  setNeedsNewKey: () => {},
  // Error tracking properties
  immediateErrors: [],
  advisoryErrors: [],
  addError: () => Promise.resolve(),
  ...overrides,
});
